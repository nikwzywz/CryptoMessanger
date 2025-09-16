// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CryptoMessenger
 * @dev Упрощенная версия децентрализованного зашифрованного мессенджера
 * @author CryptoMessenger Team
 */
contract CryptoMessenger {
        
    // Структура для хранения сообщений в чате
    struct ChatMessage {
        bytes encryptedForSmaller;   // Зашифрованное сообщение для участника с меньшим адресом кошелька
        bytes encryptedForLarger;    // Зашифрованное сообщение для участника с большим адресом кошелька
        uint256 messageTimestamp;    // Дата и время сообщения
    }

    // Структуры для работы с чатами
    struct Chat {
        uint256 messageCount;        // Количество сообщений в чате
        ChatMessage[] messages;      // Массив сообщений
        bool    isActive;            // true = чат активен (приглашение принято, можно писать в этом чате)
        bool    isNeedAcceptance;    // true = чат ожидает принятия приглашения
        uint256 createdAt; // Время создания приглашения
        address inviter;             // Кто отправил приглашение
        uint256 invitationFee;       // Сумма оплаты за последнее (текущее) приглашение
    }
    
    // Структура для хранения настроек пользователя
    struct UserSettings {
        string contactName;         // Имя контакта (ник-нейм)
        bytes publicKeyForEncode;   // Публичный ключ для шифрования сообщений
        uint256 contactRequestFee;  // Плата за запрос на добавление в контакты (в wei)
        bool isRegistered;
    }

    // Константы
    uint256 public constant INVITATION_TIMEOUT = 3 days; // 3 суток на принятие приглашения
    
    
    // Дефолтная плата за запрос на добавление в контакты
    uint256 public defaultContactRequestFee;
    
    // Владелец контракта
    address public contractOwner;
    
    // Настройки пользователя
    mapping(address => UserSettings) public userSettings;

    
    // [пользователь1][пользователь2] => били ли пользователи в контакте (даже если они уже не могут общаться).
    // При этом, первым всегда передаётся пользователь с меньшим адресом кошелька
    mapping(address => mapping(address => bool)) public isContact; // [меньший_адрес][больший_адрес] => true/false

    // МАССИВ всех контактов каждого пользователя, для быстрого доступа
    mapping(address => address[]) public userContacts; 

    
    // Хранилище чатов по их уникальному идентификатору
    mapping(bytes32 => Chat) public chats;

    // Маппинг ссылок на чаты. Храним только ссылку на чат
    // При этом, первым всегда передаётся пользователь с меньшим адресом кошелька
    mapping(address => mapping(address => bytes32)) public chatReferences; // [меньший_адрес][больший_адрес] => chatId


    // События
    event PublicKeyRegistered(address indexed userAddress, bytes publicKey);
    event InvitationSent(
        address indexed inviterAddress,
        address indexed recipientAddress, 
        bytes32 indexed chatId,
        bytes encryptedForRecipient,
        bytes encryptedForSender,
        uint256 invitationFee
    );
    event InvitationAccepted(address indexed inviterAddress, address indexed recipientAddress, bytes32 indexed chatId);
    event InvitationRejected(address indexed inviterAddress, address indexed recipientAddress, bytes32 indexed chatId);
    event InvitationWithdrawn(address indexed inviterAddress, address indexed recipientAddress, bytes32 indexed chatId);
    event ContactDeactivated(address indexed userAddress, address indexed contactAddress);
    event MessageSent(
        address indexed senderAddress, 
        address indexed recipientAddress, 
        bytes32 indexed chatId,
        bytes encryptedForRecipient,
        bytes encryptedForSender,
        uint256 messageTimestamp
    );
    event ContactRequestFeeUpdated(address indexed userAddress, uint256 newFeeAmount);
    event ContactNameUpdated(address indexed userAddress, string newContactName);
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

    
    // Конструктор
    constructor() {       
        contractOwner = msg.sender;
        defaultContactRequestFee = 0.00000217 ether; // 1 цент при курсе ETH $4600
    }
    
    /**
     * @dev Регистрация пользователя с именем и публичным ключом
     * @param contactName Имя контакта (ник-нейм)
     * @param userPublicKey Публичный ключ для шифрования сообщений
     */
    function registerUser(string memory contactName, bytes memory userPublicKey) external {
        require(bytes(contactName).length > 0, "Contact name cannot be empty");
        require(bytes(contactName).length <= 50, "Contact name too long");
        require(userPublicKey.length > 0, "Public key cannot be empty");
        require(!userSettings[msg.sender].isRegistered, "User already registered");
        
        userSettings[msg.sender] = UserSettings({
            contactName: contactName,
            publicKeyForEncode: userPublicKey,
            contactRequestFee: defaultContactRequestFee,
            isRegistered: true
        });
        
        emit PublicKeyRegistered(msg.sender, userPublicKey);
        emit ContactNameUpdated(msg.sender, contactName);
    }
    
    
    /**
     * @dev Установка платы за запрос на добавление в контакты
     * @param contactRequestFee Плата в wei
     */
    function setContactRequestFee(uint256 contactRequestFee) 
      external 
      onlyRegisteredUser 
    {
        require(contactRequestFee <= 1 ether, "Fee too high");
        
        userSettings[msg.sender].contactRequestFee = contactRequestFee;
        emit ContactRequestFeeUpdated(msg.sender, contactRequestFee);
    }
    
    /**
     * @dev Изменение имени контакта
     * @param newContactName Новое имя контакта
     */
    function setContactName(string memory newContactName) 
      external 
      onlyRegisteredUser 
    {
        require(bytes(newContactName).length > 0, "Contact name cannot be empty");
        require(bytes(newContactName).length <= 50, "Contact name too long");
        
        userSettings[msg.sender].contactName = newContactName;
        emit ContactNameUpdated(msg.sender, newContactName);
    }
    
    /**
     * @dev Отправка приглашения на контакт с первым сообщением
     * @param recipientAddress Адрес получателя приглашения
     * @param encryptedForRecipient Зашифрованные данные для получателя
     * @param encryptedForSender Зашифрованные данные для отправителя
     */
    function invitationSend(
        address recipientAddress,
        bytes memory encryptedForRecipient,
        bytes memory encryptedForSender
    ) 
      external 
      payable 
      onlyRegisteredUser 
      validAddress(recipientAddress) 
    {
        require(userSettings[recipientAddress].isRegistered, "Recipient not registered");
        
        bytes32 chatId = _generateChatId(msg.sender, recipientAddress);
        (address smaller, address larger) = _getOrderedAddresses(msg.sender, recipientAddress);
        bool isNewChat = chatReferences[smaller][larger] == bytes32(0) && chats[chatId].messageCount == 0;
        
        // ЕСЛИ чат существует, то проверяем, 
        //    что этот чат не активен (нельзя создавать приглашение в активный чат)
        //    и что этот чат не ожидает принятия приглашения (нельзя создавать приглашение в чат, который уже ожидает принятия приглашения)
        if (!isNewChat) {
            require(!chats[chatId].isActive, "Chat is already active");
            require(!chats[chatId].isNeedAcceptance, "Invitation already pending");
        }
        
        uint256 requiredFee = userSettings[recipientAddress].contactRequestFee;
        require(msg.value >= requiredFee, "Insufficient payment");
        
        // Всегда устанавливаем ссылки на чат (используем упорядоченные адреса)
        chatReferences[smaller][larger] = chatId;
        
        // Устанавливаем факт контакта между пользователями
        isContact[smaller][larger] = true;
        
        if (isNewChat) {
            // Создаем новый чат в статусе "ожидания принятия"
            Chat storage newChat = chats[chatId];
            newChat.messageCount = 0;
            newChat.isActive = false;
            newChat.isNeedAcceptance = true;
            newChat.createdAt = block.timestamp;
            newChat.inviter = msg.sender;
            newChat.invitationFee = msg.value;
            
            // Добавляем в массивы контактов (первое приглашение)
            userContacts[msg.sender].push(recipientAddress);
            userContacts[recipientAddress].push(msg.sender);
        } else {
            // Обновляем существующий чат (контакты уже в массивах)
            Chat storage existingChat = chats[chatId];
            existingChat.isNeedAcceptance = true;
            existingChat.createdAt = block.timestamp;
            existingChat.inviter = msg.sender;
            existingChat.invitationFee = msg.value;
        }
        
        // Добавляем первое сообщение в чат
        _addMessageToChat(chatId, msg.sender, recipientAddress, encryptedForRecipient, encryptedForSender);
        
        emit InvitationSent(msg.sender, recipientAddress, chatId, encryptedForRecipient, encryptedForSender, msg.value);
    }
    
    /**
     * @dev Принятие приглашения на контакт
     * @param inviterAddress Адрес отправителя приглашения
     */
    function invitationAccept(address inviterAddress) 
      external 
      onlyRegisteredUser  
      validAddress(inviterAddress) 
    {
        (address smaller, address larger) = _getOrderedAddresses(msg.sender, inviterAddress);
        bytes32 chatId = chatReferences[smaller][larger];
        require(chatId != bytes32(0), "No chat invitation found");
        
        Chat storage chat = chats[chatId];
        require(chat.isNeedAcceptance, "Chat invitation already processed");
        require(chat.inviter == inviterAddress, "Invalid inviter");
        
        // Активируем чат
        chat.isNeedAcceptance = false;
        chat.isActive = true;
        
        // Возвращаем деньги приглашающему
        payable(inviterAddress).transfer(chat.invitationFee);
        
        emit InvitationAccepted(inviterAddress, msg.sender, chatId);
    }
    
    /**
     * @dev Отклонение приглашения на контакт
     * @param inviterAddress Адрес отправителя приглашения
     */
    function invitationReject(address inviterAddress) 
      external 
      onlyRegisteredUser  
      validAddress(inviterAddress) 
    {
        (address smaller, address larger) = _getOrderedAddresses(msg.sender, inviterAddress);
        bytes32 chatId = chatReferences[smaller][larger];
        require(chatId != bytes32(0), "No chat invitation found");
        
        Chat storage chat = chats[chatId];
        require(chat.isNeedAcceptance, "Chat invitation already processed");
        require(chat.inviter == inviterAddress, "Invalid inviter");
        
        // Деактивируем чат
        chat.isNeedAcceptance = false;
        chat.isActive = false;
        
        // Отправляем деньги получателю приглашения
        payable(msg.sender).transfer(chat.invitationFee);
        
        emit InvitationRejected(inviterAddress, msg.sender, chatId);
    }
    
    /**
     * @dev Отзыв приглашения (возврат денег через 3 суток)
     * @param recipientAddress Адрес получателя приглашения
     */
    function invitationCancel(address recipientAddress) 
      external 
      onlyRegisteredUser  
      validAddress(recipientAddress) 
    {
        (address smaller, address larger) = _getOrderedAddresses(msg.sender, recipientAddress);
        bytes32 chatId = chatReferences[smaller][larger];
        require(chatId != bytes32(0), "No chat invitation found");
        
        Chat storage chat = chats[chatId];
        require(chat.isNeedAcceptance, "Chat invitation already processed");
        require(chat.inviter == msg.sender, "Only inviter can withdraw");
        require(block.timestamp >= chat.createdAt + INVITATION_TIMEOUT, "Invitation timeout not reached");
        
        // Деактивируем чат
        chat.isNeedAcceptance = false;
        chat.isActive = false;
        
        // Возвращаем деньги приглашающему
        payable(msg.sender).transfer(chat.invitationFee);
        
        emit InvitationWithdrawn(msg.sender, recipientAddress, chatId);
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
      validAddress(recipientAddress) 
    {
        require(userSettings[recipientAddress].isRegistered, "Recipient not registered");
        
        (address smaller, address larger) = _getOrderedAddresses(msg.sender, recipientAddress);
        bytes32 chatId = chatReferences[smaller][larger];
        require(chatId != bytes32(0), "Chat not found");
        
        Chat storage chat = chats[chatId];
        require(chat.isActive, "Chat is not active");
        
        require(encryptedForRecipient.length > 0, "Encrypted message for recipient cannot be empty");
        require(encryptedForSender.length > 0, "Encrypted message for sender cannot be empty");
        
        // Добавляем сообщение в чат
        _addMessageToChat(chatId, msg.sender, recipientAddress, encryptedForRecipient, encryptedForSender);
        
        emit MessageSent(msg.sender, recipientAddress, chatId, encryptedForRecipient, encryptedForSender, block.timestamp);
    }
    
    
    /**
     * @dev Деактивация чата с контактом
     * @param contactAddress Адрес контакта для деактивации чата
     */
    function deactivateContact(address contactAddress) external onlyRegisteredUser validAddress(contactAddress) {
        (address smaller, address larger) = _getOrderedAddresses(msg.sender, contactAddress);
        bytes32 chatId = chatReferences[smaller][larger];
        require(chatId != bytes32(0), "Chat not found");
        
        // Деактивируем чат (контакты остаются в списке, но чат становится неактивным)
        chats[chatId].isActive = false;
        
        emit ContactDeactivated(msg.sender, contactAddress);
        emit ContactDeactivated(contactAddress, msg.sender);
    }

    /**
     * @dev Проверка, состоят ли в контакте два пользователя
     * @param userAddress1 Адрес пользователя #1
     * @param userAddress2 Адрес пользователя #2
     * @return true если контакт разрешен
     */
    function checkContact(address userAddress1, address userAddress2) public view returns (bool) {
        (address smaller, address larger) = _getOrderedAddresses(userAddress1, userAddress2);
        return isContact[smaller][larger];
    }

    
    /**
     * @dev Установка дефолтной платы за запрос на добавление в контакты
     * @param newDefaultFee Новая дефолтная плата в wei
     */
    function setDefaultContactRequestFee(uint256 newDefaultFee) external onlyOwner {
        require(newDefaultFee <= 0.01 ether, "Default fee too high");
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
        return userSettings[userAddress].publicKeyForEncode;
    }
    
    /**
     * @dev Получение имени контакта пользователя
     * @param userAddress Адрес пользователя
     * @return Имя контакта
     */
    function getContactName(address userAddress) external view returns (string memory) {
        return userSettings[userAddress].contactName;
    }
    
    /**
     * @dev Получение списка контактов пользователя
     * @param userAddress Адрес пользователя
     * @return Массив адресов контактов
     */
    function getContacts(address userAddress) external view returns (address[] memory) {
        return userContacts[userAddress];
    }
    
    /**
     * @dev Получение количества контактов пользователя
     * @param userAddress Адрес пользователя
     * @return Количество контактов
     */
    function getContactsCount(address userAddress) external view returns (uint256) {
        return userContacts[userAddress].length;
    }
    
    
    /**
     * @dev Получение контактов пользователя с полными данными (имена и публичные ключи)
     * @param userAddress Адрес пользователя
     * @param startIndex Начальный индекс (включительно)
     * @param endIndex Конечный индекс (исключительно, если передать 0, то верннёт всех контактов)
     * @return contacts Массив адресов контактов
     * @return names Массив имен контактов
     * @return publicKeys Массив публичных ключей контактов
     */
    function getContactsWithDetailsPaginated(
        address userAddress, 
        uint256 startIndex, 
        uint256 endIndex
    ) external view returns (
        address[] memory contacts,
        string[] memory names,
        bytes[] memory publicKeys
    ) {
        address[] storage userContactsList = userContacts[userAddress];
        
        // Проверяем корректность диапазона
        require(startIndex <= userContactsList.length, "Start index out of bounds");
        require(endIndex == 0 || endIndex <= userContactsList.length, "End index out of bounds");
        require(endIndex == 0 || startIndex <= endIndex, "Invalid range: startIndex > endIndex");
        
        if (startIndex >= userContactsList.length) {
            return (new address[](0), new string[](0), new bytes[](0));
        }
        
        // Если endIndex = 0, берем до конца массива
        if (endIndex == 0) {
            endIndex = userContactsList.length;
        }
        
        uint256 resultLength = endIndex - startIndex;
        contacts = new address[](resultLength);
        names = new string[](resultLength);
        publicKeys = new bytes[](resultLength);
        
        for (uint256 i = startIndex; i < endIndex; i++) {
            address contactAddress = userContactsList[i];
            contacts[i - startIndex] = contactAddress;
            names[i - startIndex] = userSettings[contactAddress].contactName;
            publicKeys[i - startIndex] = userSettings[contactAddress].publicKeyForEncode;
        }
    }


    /**
     * @dev Получение сообщений из чата с пагинацией
     * @param chatId Идентификатор чата
     * @param startIndex Начальный индекс (включительно)
     * @param endIndex Конечный индекс (исключительно, 0 = до конца)
     * @return Массив сообщений
     */
    function getChatMessagesPaginated(bytes32 chatId, uint256 startIndex, uint256 endIndex) external view returns (ChatMessage[] memory) {
        Chat storage chat = chats[chatId];
        
        // Проверяем корректность диапазона
        require(startIndex <= chat.messageCount, "Start index out of bounds");
        require(endIndex == 0 || endIndex <= chat.messageCount, "End index out of bounds");
        require(endIndex == 0 || startIndex <= endIndex, "Invalid range: startIndex > endIndex");
        
        if (startIndex >= chat.messageCount) {
            return new ChatMessage[](0);
        }
        
        // Если endIndex = 0, берем до конца массива
        if (endIndex == 0) {
            endIndex = chat.messageCount;
        }
        
        uint256 resultLength = endIndex - startIndex;
        ChatMessage[] memory result = new ChatMessage[](resultLength);
        
        for (uint256 i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = chat.messages[i];
        }
        
        return result;
    }

    /**
     * @dev Получение последних N сообщений из чата
     * @param chatId Идентификатор чата
     * @param count Количество последних сообщений
     * @return Массив последних сообщений
     */
    function getLastChatMessages(bytes32 chatId, uint256 count) external view returns (ChatMessage[] memory) {
        Chat storage chat = chats[chatId];
        
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
    
    /**
     * @dev Получение информации о чате
     * @param chatId Идентификатор чата
     * @return Структура чата
     */
    function getChat(bytes32 chatId) external view returns (Chat memory) {
        return chats[chatId];
    }
    
    /**
     * @dev Получение идентификатора чата между двумя пользователями
     * @param user1 Адрес первого пользователя
     * @param user2 Адрес второго пользователя
     * @return Идентификатор чата (0 если чат не существует)
     */
    function getChatId(address user1, address user2) external view returns (bytes32) {
        (address smaller, address larger) = _getOrderedAddresses(user1, user2);
        return chatReferences[smaller][larger];
    }
    
    /**
     * @dev Получение сообщений из чата
     * @param chatId Идентификатор чата
     * @return Количество сообщений и массив сообщений
     */
    function getChatMessages(bytes32 chatId) external view returns (uint256, ChatMessage[] memory) {
        Chat storage chat = chats[chatId];
        return (chat.messageCount, chat.messages);
    }




    // ========================================
    // СЛУЖЕБНЫЕ ФУНКЦИИ
    // ========================================
    
    /**
     * @dev Внутренняя функция для определения правильного порядка адресов
     * @param address1 Первый адрес
     * @param address2 Второй адрес
     * @return smallerAddress Адрес с меньшим значением
     * @return largerAddress Адрес с большим значением
     */
    function _getOrderedAddresses(address address1, address address2) internal pure returns (address smallerAddress, address largerAddress) {
        if (address1 < address2) {
            return (address1, address2);
        } else {
            return (address2, address1);
        }
    }
    
    
    /**
     * @dev Создание уникального идентификатора чата на основе двух адресов
     * @param address1 Первый адрес
     * @param address2 Второй адрес
     * @return Уникальный идентификатор чата
     */
    function _generateChatId(address address1, address address2) internal pure returns (bytes32) {
        (address smaller, address larger) = _getOrderedAddresses(address1, address2);
        return keccak256(abi.encodePacked(smaller, larger));
    }

    /**
     * @dev Внутренняя функция для добавления сообщения в чат
     * @param chatId Идентификатор чата
     * @param senderAddress Адрес отправителя
     * @param recipientAddress Адрес получателя
     * @param encryptedForRecipient Зашифрованные данные для получателя
     * @param encryptedForSender Зашифрованные данные для отправителя
     */
    function _addMessageToChat(bytes32 chatId, address senderAddress, address recipientAddress, bytes memory encryptedForRecipient, bytes memory encryptedForSender) internal {
        Chat storage chat = chats[chatId];
        
        // Определяем порядок адресов
        (address smaller,) = _getOrderedAddresses(senderAddress, recipientAddress);
        
        // Определяем, какое шифрование для кого
        bytes memory encryptedForSmaller;
        bytes memory encryptedForLarger;
        
        if (senderAddress == smaller) {
            // Отправитель - меньший адрес
            encryptedForSmaller = encryptedForSender;
            encryptedForLarger = encryptedForRecipient;
        } else {
            // Отправитель - больший адрес
            encryptedForSmaller = encryptedForRecipient;
            encryptedForLarger = encryptedForSender;
        }
        
        // Создаем одно сообщение для чата
        ChatMessage memory message = ChatMessage({
            encryptedForSmaller: encryptedForSmaller,
            encryptedForLarger: encryptedForLarger,
            messageTimestamp: block.timestamp
        });
        
        // Добавляем сообщение в чат
        chat.messages.push(message);
        chat.messageCount++;
    }

}
