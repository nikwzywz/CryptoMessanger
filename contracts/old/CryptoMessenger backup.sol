// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CryptoMessenger
 * @dev Децентрализованный зашифрованный мессенджер на блокчейне Base
 * @author CryptoMessenger Team
 */
contract CryptoMessenger {
    
    // Структуры данных
    struct ContactRequest {
        address requesterAddress;
        bytes encryptedForRecipient;
        bytes encryptedForSender;
        uint256 paymentAmount;
        uint256 requestTimestamp;
        bool isActive;
    }
    
    struct MessageData {
        address recipientAddress;
        bytes encryptedForRecipient;
        bytes encryptedForSender;
    }
    
    // Новая структура для хранения сообщений в чате
    struct ChatMessage {
        bytes encryptedForReader;     // Зашифрованное сообщение для читателя этого чата
        uint256 messageTimestamp;    // Дата и время сообщения
        bool isOutgoing;             // true = исходящее, false = входящее
    }
    
    // Структура для чата с одним контактом
    struct ChatWithOneContact {
        uint256 messageCount;        // Количество сообщений в чате
        ChatMessage[] messages;      // Массив сообщений
    }
    
    struct UserSettings {
        uint256 contactRequestFee; // Плата за запрос на добавление в контакты (в wei)
        bool isRegistered;
    }

    // Максимальное количество контактов на пользователя
    uint256 public maxContactsPerUser;
    
    // Дефолтная плата за запрос на добавление в контакты (1 цент при курсе ETH $4600)
    uint256 public defaultContactRequestFee;
    
    // Владелец контракта
    address public contractOwner;
    
    // Состояние контракта
    mapping(address => bytes) public userPublicKeys;
    mapping(address => UserSettings) public userSettings;

    mapping(address => address[]) public userContacts; // mapping для быстрого доступа к списку контактов пользователя
    mapping(address => mapping(address => bool)) public isContact; // [пользователь][контакт] => разрешен ли

    mapping(address => address[]) public incomingContactRequests; // mapping для быстрого доступа к входящим запросам на контакт
    mapping(address => address[]) public outgoingContactRequests; // mapping для быстрого доступа к исходящим запросам на контакт
    mapping(address => mapping(address => ContactRequest)) public contactRequests; // [получатель][отправитель] => запрос
    
    // mapping для чатов с сообщениями, для быстрого доступа к сообщениям чата
    mapping(address => mapping(address => ChatWithOneContact)) public chats; // [пользователь][контакт] => чат
    
    // События
    event PublicKeyRegistered(address indexed userAddress, bytes publicKey);
    event ContactRequested(address indexed requesterAddress, address indexed recipientAddress, bytes encryptedForRecipient, uint256 paymentAmount);
    event ContactAccepted(address indexed requesterAddress, address indexed recipientAddress);
    event ContactRejected(address indexed requesterAddress, address indexed recipientAddress);
    event ContactRemoved(address indexed userAddress, address indexed contactAddress);
    event MessageSent(
        address indexed senderAddress, 
        address indexed recipientAddress, 
        bytes encryptedForRecipient,
        bytes encryptedForSender,
        uint256 messageTimestamp
    );
    event ContactRequestFeeUpdated(address indexed userAddress, uint256 newFeeAmount);
    event MaxContactsLimitUpdated(uint256 newLimit);
    event DefaultContactRequestFeeUpdated(uint256 newDefaultFee);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // Модификаторы
    modifier onlyOwner() {
        require(msg.sender == contractOwner, "Only contract owner can call this function");
        _;
    }
    
    modifier onlyRegisteredUser() {
        require(userSettings[msg.sender].isRegistered, "User not registered");
        _;
    }
    
    modifier validAddress(address targetAddress) {
        require(targetAddress != address(0), "Invalid address");
        require(targetAddress != msg.sender, "Cannot interact with self");
        _;
    }

    modifier onlyExternalAccounts() {
         require(msg.sender == tx.origin, "Only external accounts allowed");
         _;
    }

    modifier withinContactLimit() {
        require(userContacts[msg.sender].length < maxContactsPerUser, "Contact limit exceeded");
        _;
    }
    
    // Конструктор
    constructor() {       
        contractOwner = msg.sender; // Устанавливаем создателя контракта как владельца
        maxContactsPerUser = 2000; // Лимит контактов на пользователя
        defaultContactRequestFee = 0.00000217 ether; // 1 цент при курсе ETH $4600
    }
    
    /**
     * @dev Регистрация публичного ключа пользователя
     * @param userPublicKey Публичный ключ для шифрования сообщений
     */
    function registerPublicKey(bytes memory userPublicKey) external {
        require(userPublicKey.length > 0, "Public key cannot be empty");
        require(!userSettings[msg.sender].isRegistered, "User already registered");
        
        userPublicKeys[msg.sender] = userPublicKey;
        userSettings[msg.sender] = UserSettings({
            contactRequestFee: defaultContactRequestFee, // Используем дефолтную плату
            isRegistered: true
        });
        
        emit PublicKeyRegistered(msg.sender, userPublicKey);
    }
    
    /**
     * @dev Обновление публичного ключа
     * @param updatedPublicKey Новый публичный ключ
     */
    function updatePublicKey(bytes memory updatedPublicKey) external onlyRegisteredUser {
        require(updatedPublicKey.length > 0, "Public key cannot be empty");
        
        userPublicKeys[msg.sender] = updatedPublicKey;
        emit PublicKeyRegistered(msg.sender, updatedPublicKey);
    }
    
    /**
     * @dev Тестовая функция для проверки Web3 вызовов
     * @return Адрес отправителя транзакции
     */
    function helloWorld() external view returns (address) {
        return msg.sender;
    }
    
    /**
     * @dev Установка платы за запрос на добавление в контакты
     * @param contactRequestFee Плата в wei
     */
    function setContactRequestFee(uint256 contactRequestFee) 
      external 
      onlyRegisteredUser 
    {
        require(contactRequestFee <= 1 ether, "Fee too high"); // Максимум 1 ETH
        
        userSettings[msg.sender].contactRequestFee = contactRequestFee;
        emit ContactRequestFeeUpdated(msg.sender, contactRequestFee);
    }
    
    /**
     * @dev Запрос на добавление в контакты
     * @param recipientAddress Адрес получателя запроса
     * @param encryptedForRecipient Зашифрованные данные для получателя
     * @param encryptedForSender Зашифрованные данные для отправителя
     */
    function requestContact(
        address recipientAddress,
        bytes memory encryptedForRecipient,
        bytes memory encryptedForSender
    ) 
      external 
      payable 
      onlyRegisteredUser 
      onlyExternalAccounts
      validAddress(recipientAddress) 
    {
        require(userSettings[recipientAddress].isRegistered, "Recipient not registered");
        require(!isContact[recipientAddress][msg.sender], "Already in contacts");
        require(!contactRequests[recipientAddress][msg.sender].isActive, "Request already pending");
        require(!contactRequests[msg.sender][recipientAddress].isActive, "There is already a counter request");
        
        uint256 requiredFee = userSettings[recipientAddress].contactRequestFee;
        require(msg.value >= requiredFee, "Insufficient payment");
        
        // Создаем запрос
        contactRequests[recipientAddress][msg.sender] = ContactRequest({
            requesterAddress: msg.sender,
            encryptedForRecipient: encryptedForRecipient,
            encryptedForSender: encryptedForSender,
            paymentAmount: msg.value,
            requestTimestamp: block.timestamp,
            isActive: true
        });
        // Добавляем в массивы
        incomingContactRequests[recipientAddress].push(msg.sender);
        outgoingContactRequests[msg.sender].push(recipientAddress);
        
        // Переводим новому потенциальному контакту плату за зассмотрение заявки
        // Напрямую ему, а не на контракт
        payable(recipientAddress).transfer(requiredFee);
        
        emit ContactRequested(msg.sender, recipientAddress, encryptedForRecipient, msg.value);
    }
    
    /**
     * @dev Принятие запроса на добавление в контакты
     * @param requesterAddress Адрес отправителя запроса
     */
    function acceptContactRequest(address requesterAddress) 
      external 
      payable 
      onlyRegisteredUser  
      onlyExternalAccounts
      validAddress(requesterAddress) 
    {
        ContactRequest storage contactRequest = contactRequests[requesterAddress][msg.sender]; 
        require(contactRequest.isActive, "No active request");
        
        uint256 paidFee = contactRequest.paymentAmount;
        require(msg.value <= paidFee, "Insufficient payment");

        // Добавляем в контакты в обе стороны
        isContact[msg.sender][requesterAddress] = true;
        isContact[requesterAddress][msg.sender] = true;
        userContacts[msg.sender].push(requesterAddress);
        userContacts[requesterAddress].push(msg.sender);
        
        // Деактивируем запрос
        contactRequest.isActive = false;
        // Удаляем из массивов запросов
        _removeFromArray(incomingContactRequests[msg.sender], requesterAddress);
        _removeFromArray(outgoingContactRequests[requesterAddress], msg.sender);
        
        // Возвращаем средства отправителю (любезность при принятии)
        payable(requesterAddress).transfer(msg.value);
        
        emit ContactAccepted(requesterAddress, msg.sender);
        emit ContactAccepted(msg.sender, requesterAddress);
        // При принятии запроса отправляем зашифрованное сообщение
        emit MessageSent(
            contactRequest.requesterAddress, 
            msg.sender, 
            contactRequest.encryptedForRecipient,
            contactRequest.encryptedForSender,
            contactRequest.requestTimestamp
        );
    }
    
    /**
     * @dev Отклонение запроса на добавление в контакты
     * @param requesterAddress Адрес отправителя запроса
     */
    function rejectContactRequest(address requesterAddress) 
      external 
      onlyRegisteredUser  
      onlyExternalAccounts
      validAddress(requesterAddress) 
    {
        ContactRequest storage contactRequest = contactRequests[requesterAddress][msg.sender];
        require(contactRequest.isActive, "No active request");
        
        // Деактивируем запрос 
        // и средства не возвращаем
        contactRequest.isActive = false;
        
        emit ContactRejected(requesterAddress, msg.sender);
    }
    
    /**
     * @dev Отправка зашифрованного сообщения
     * @param recipientAddress Адрес получателя
     * @param encryptedForRecipient Зашифрованные данные для получателя
     * @param encryptedForSender Зашифрованные данные для отправителя
     */
    function sendMessage(
        address recipientAddress,
        bytes memory encryptedForRecipient,
        bytes memory encryptedForSender
    ) 
      external 
      onlyRegisteredUser 
      onlyExternalAccounts 
      validAddress(recipientAddress) 
    {
        require(userSettings[recipientAddress].isRegistered, "Recipient not registered");
        require(isContact[recipientAddress][msg.sender], "Not in recipient's contacts");
        require(encryptedForRecipient.length > 0, "Encrypted message for recipient cannot be empty");
        require(encryptedForSender.length > 0, "Encrypted message for sender cannot be empty");
        
        // Создаем сообщение для отправителя (исходящее)
        ChatMessage memory senderMessage = ChatMessage({
            encryptedForReader: encryptedForSender,
            messageTimestamp: block.timestamp,
            isOutgoing: true
        });
        
        // Создаем сообщение для получателя (входящее)
        ChatMessage memory recipientMessage = ChatMessage({
            encryptedForReader: encryptedForRecipient,
            messageTimestamp: block.timestamp,
            isOutgoing: false
        });
        
        // Добавляем сообщения в чаты
        chats[msg.sender][recipientAddress].messages.push(senderMessage);
        chats[msg.sender][recipientAddress].messageCount++;
        
        chats[recipientAddress][msg.sender].messages.push(recipientMessage);
        chats[recipientAddress][msg.sender].messageCount++;
        
        // Эмитим событие (для совместимости)
        emit MessageSent(
            msg.sender, 
            recipientAddress, 
            encryptedForRecipient,
            encryptedForSender,
            block.timestamp
        );
    }
    
    /**
     * @dev Удаление контакта из списка
     * @param contactAddress Адрес контакта для удаления
     */
    function removeContact(address contactAddress) external onlyRegisteredUser  validAddress(contactAddress) {
        require(isContact[msg.sender][contactAddress], "Contact not found");
        require(isContact[contactAddress][msg.sender], "Contact not found");
        
        // Удаляем в обе стороны
        isContact[msg.sender][contactAddress] = false;
        isContact[contactAddress][msg.sender] = false;
        
        // Удаляем из массивов
        _removeFromArray(userContacts[msg.sender], contactAddress);
        _removeFromArray(userContacts[contactAddress], msg.sender);
        
        emit ContactRemoved(msg.sender, contactAddress);
        emit ContactRemoved(contactAddress, msg.sender);
    }

    /**
     * @dev Внутренняя функция для удаления адреса из массива
     * @param contactArray Массив адресов для удаления
     * @param contactToRemove Адрес для удаления
     */
    function _removeFromArray(address[] storage contactArray, address contactToRemove) internal {
        for (uint256 i = 0; i < contactArray.length; i++) {
            if (contactArray[i] == contactToRemove) {
                contactArray[i] = contactArray[contactArray.length - 1];
                contactArray.pop();
                break;
            }
        }
    }

    /**
     * @dev Установка максимального количества контактов на пользователя
     * @param newContactsLimit Новый лимит контактов (от 1000 до 10000)
     */
    function setMaxContactsPerUser(uint256 newContactsLimit) external onlyOwner {
        require(newContactsLimit >= 1000 && newContactsLimit <= 10000, "Invalid limit");
        maxContactsPerUser = newContactsLimit;
        emit MaxContactsLimitUpdated(newContactsLimit);
    }
    
    /**
     * @dev Установка дефолтной платы за запрос на добавление в контакты
     * @param newDefaultFee Новая дефолтная плата в wei
     */
    function setDefaultContactRequestFee(uint256 newDefaultFee) external onlyOwner {
        require(newDefaultFee <= 0.01 ether, "Default fee too high"); // Максимум 1 цент
        defaultContactRequestFee = newDefaultFee;
        emit DefaultContactRequestFeeUpdated(newDefaultFee);
    }
    
    /**
     * @dev Передача права владения контрактом
     * @param newOwnerAddress Адрес нового владельца
     */
    function transferOwnership(address newOwnerAddress) external onlyOwner {
        require(newOwnerAddress != address(0), "New owner cannot be zero address");
        require(newOwnerAddress != contractOwner, "New owner must be different from current owner");
        
        address previousOwner = contractOwner;
        contractOwner = newOwnerAddress;
        emit OwnershipTransferred(previousOwner, newOwnerAddress);
    }
    
    /**
     * @dev Вывод ETH с контракта (только для владельца)
     */
    function withdrawETH() external onlyOwner {
        uint256 contractBalance = address(this).balance;
        require(contractBalance > 0, "No ETH to withdraw");        
        payable(contractOwner).transfer(contractBalance);
    }
    
    // View функции
    
    /**
     * @dev Получение публичного ключа пользователя
     * @param userAddress Адрес пользователя
     * @return Публичный ключ
     */
    function getPublicKey(address userAddress) external view returns (bytes memory) {
        return userPublicKeys[userAddress];
    }
    
    /**
     * @dev Проверка статуса контакта
     * @param userAddress Адрес пользователя
     * @param contactAddress Адрес контакта
     * @return true если контакт разрешен
     */
    function checkContact(address userAddress, address contactAddress) external view returns (bool) {
        return isContact[userAddress][contactAddress];
    }
    
    /**
     * @dev Получение списка контактов пользователя
     * @param userAddress Адрес пользователя
     * @return Массив адресов контактов
     */
    function getUserContacts(address userAddress) external view returns (address[] memory) {
        return userContacts[userAddress];
    }
    
    /**
     * @dev Получение информации о запросе контакта
     * @param recipientAddress Адрес получателя
     * @param senderAddress Адрес отправителя
     * @return Структура запроса контакта
     */
    function getContactRequest(address recipientAddress, address senderAddress) external view returns (ContactRequest memory) {
        return contactRequests[recipientAddress][senderAddress];
    }
    
    /**
     * @dev Получение настроек пользователя
     * @param userAddress Адрес пользователя
     * @return Структура настроек пользователя
     */
    function getUserSettings(address userAddress) external view returns (UserSettings memory) {
        return userSettings[userAddress];
    }
    
    /**
     * @dev Проверка регистрации пользователя
     * @param userAddress Адрес пользователя
     * @return true если пользователь зарегистрирован
     */
    function isUserRegistered(address userAddress) external view returns (bool) {
        return userSettings[userAddress].isRegistered;
    }
    
    // Новые функции для работы с сообщениями
    
    /**
     * @dev Получение сообщений из чата
     * @param userAddress Адрес пользователя
     * @param contactAddress Адрес контакта
     * @return Количество сообщений и массив сообщений
     */
    function getChatMessages(address userAddress, address contactAddress) external view returns (uint256, ChatMessage[] memory) {
        ChatWithOneContact storage chat = chats[userAddress][contactAddress];
        return (chat.messageCount, chat.messages);
    }

    /**
     * @dev Получение последних N сообщений из чата
     * @param userAddress Адрес пользователя
     * @param contactAddress Адрес контакта
     * @param count Количество последних сообщений
     * @return Массив последних сообщений
     */
    function getLastChatMessages(address userAddress, address contactAddress, uint256 count) external view returns (ChatMessage[] memory) {
        ChatWithOneContact storage chat = chats[userAddress][contactAddress];
        
        if (chat.messageCount == 0) {
            return new ChatMessage[](0);
        }
        
        uint256 startIndex = chat.messageCount > count ? chat.messageCount - count : 0;
        uint256 resultLength = chat.messageCount - startIndex;
        
        ChatMessage[] memory result = new ChatMessage[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = chat.messages[startIndex + i];
        }
        
        return result;
    }

    /**
     * @dev Получение сообщений из чата с пагинацией
     * @param userAddress Адрес пользователя
     * @param contactAddress Адрес контакта
     * @param offset Начальный индекс
     * @param limit Максимальное количество сообщений
     * @return Массив сообщений
     */
    function getChatMessagesPaginated(address userAddress, address contactAddress, uint256 offset, uint256 limit) external view returns (ChatMessage[] memory) {
        ChatWithOneContact storage chat = chats[userAddress][contactAddress];
        
        if (offset >= chat.messageCount) {
            return new ChatMessage[](0);
        }
        
        uint256 endIndex = offset + limit;
        if (endIndex > chat.messageCount) {
            endIndex = chat.messageCount;
        }
        
        uint256 resultLength = endIndex - offset;
        ChatMessage[] memory result = new ChatMessage[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = chat.messages[offset + i];
        }
        
        return result;
    }
}