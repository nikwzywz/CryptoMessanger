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
        bytes32 chatID;              // Ссылка на чат к которому относится это сообщение
        bytes encryptedMessage;      // Зашифрованное сообщение ключом publicKeyForEncode
        uint256 messageTimestamp;    // Дата и время сообщения
        bool isFromMe;               // true = сообщение от меня, false = сообщение от моего собеседника
        uint256 messNum;             // Номер сообщения, начиная с 1 для первого сообщения
    }

    // Структура настроек одного чата
    struct ChatSettings {
        uint256 messageCount;        // Количество сообщений в чате
        bool    isActive;            // true = чат активен (можно писать новые сообщения в этом чате)
        bool    isNeedAcceptance;    // true = чат ожидает принятия приглашения
        uint256 createdAt;           // Время создания приглашения
        address inviter;             // Адрес последнего участника чата, который отправил приглашение
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
    
    // МАССИВ всех контактов каждого пользователя, для быстрого доступа
    mapping(address => address[]) public userContacts; 

    // МАССИВ входящих и исходящих сообщений для каждого пользователя
    mapping(address => ChatMessage[]) public messages;   
    
    // Хранилище настроек чатов по их уникальному идентификатору
    mapping(bytes32 => ChatSettings) public chats;

    // Только два события оставили
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
        defaultContactRequestFee = 0.00000217 ether; // 0.01 доллар при курсе ETH $4600
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
        require(bytes(newContactName).length <= 40, "Contact name too long");        
        userSettings[msg.sender].contactName = newContactName;
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
        // Не отправлять приглашение самому себе
        require(!(msg.sender==recipientAddress), "It is you");
        // Отпралять приглашения только зарегистрированным в контракте пользователям
        require(userSettings[recipientAddress].isRegistered, "Recipient not registered");        
        // Рассчитываю ID чата
        bytes32 chatId = _generateChatId(msg.sender, recipientAddress);
        // Проверяю, что это новый чат
        bool isNewChat = (chats[chatId].messageCount == 0);
        
        // ЕСЛИ чат существует, то проверяем, 
        //    что этот чат не активен (нельзя создавать приглашение в активный чат)
        //    и что этот чат не ожидает принятия приглашения (нельзя создавать приглашение в чат, который уже ожидает принятия приглашения)
        if (!isNewChat) {
            require(!chats[chatId].isActive, "Chat is already active");
            require(!chats[chatId].isNeedAcceptance, "Invitation already pending");
        }

        // Проверяем что отправлено достаточно ETH в качестве комиссии за рассмотрение заявки на контакт
        uint256 requiredFee = userSettings[recipientAddress].contactRequestFee;
        require(msg.value >= requiredFee, "Insufficient payment");
        
        // Если это новый чат
        if (isNewChat) {
            // Создаем новый чат в статусе "ожидания принятия приглашения"
            ChatSettings storage newChat = chats[chatId];
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
            // Обновляем параметры существующего чата
            ChatSettings storage existingChat = chats[chatId];
            existingChat.isNeedAcceptance = true;
            existingChat.inviter = msg.sender;
            existingChat.invitationFee = msg.value;
        }
        
        // Добавляем первое сообщение в чат
        // После добавления первого сообщения чат перестаёт быть новым
        _addMessageToChat(chatId, msg.sender, recipientAddress, encryptedForRecipient, encryptedForSender);        
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
        // Рассчитываю ID чата
        bytes32 chatId = _generateChatId(msg.sender, inviterAddress);    
        // Получаю доступ к хранилищу настроек чата
        ChatSettings storage chat = chats[chatId];
        // Проверяю, что приглашение активное в этом чате ждёт одобрения
        require(chat.isNeedAcceptance, "No chat invitation found");
        // Проверяю, что отправитель приглашения действительно тот кто указан в настройках чата, а не текущий пользователь
        require(chat.inviter == inviterAddress, "Invalid inviter");
        
        // Активируем чат
        chat.isActive = true;
        // Приглашение деактивируем
        chat.isNeedAcceptance = false;
        
        // Сумма комиссии возвращается приглашающему из смарт-контракта
        payable(inviterAddress).transfer(chat.invitationFee);
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
        // Рассчитываю ID чата
        bytes32 chatId = _generateChatId(msg.sender, inviterAddress);
        // Проряю что чат существует
        require(chatId != bytes32(0), "No chat invitation found");
        // Получаю доступ к хранилищу настроек чата
        ChatSettings storage chat = chats[chatId];
        // Проверяю что приглашение существует
        require(chat.isNeedAcceptance, "Chat invitation already processed");
        // Проверяю, что отправитель приглашения действительно тот кто указан в настройках чата, а не текущий пользователь
        require(chat.inviter == inviterAddress, "Invalid inviter");        
        // Деактивируем чат
        chat.isActive = false;
        // Деактивируем приглашение
        chat.isNeedAcceptance = false;
        // Отправляем деньги получателю приглашения,
        // то есть вызывающий этот метод (приглашаемый), 
        // получает ETH в размере суммы комиссии из контракта себе
        payable(msg.sender).transfer(chat.invitationFee);
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
        // Рассчитываю ID чата
        bytes32 chatId = _generateChatId(msg.sender, recipientAddress);
        // Получаю доступ к хранилищу настроек чата
        ChatSettings storage chat = chats[chatId];
        // Проверяю что приглашение существует
        require(chat.isNeedAcceptance, "Chat invitation already processed");
        // Проверяю, что приглашающим был именно текущий пользователь
        require(chat.inviter == msg.sender, "Only inviter can withdraw");
        // Проверяю, что интервал минимального ожидания истёк
        require(block.timestamp >= chat.createdAt + INVITATION_TIMEOUT, "Invitation timeout not reached");        
        // Деактивируем чат
        chat.isActive = false;
        // Деактивируем приглашение
        chat.isNeedAcceptance = false;        
        // Возвращаем деньги приглашающему
        // То есть пользователю, вызывающему этот метод
        payable(msg.sender).transfer(chat.invitationFee);
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
        // Проверяю, что адресат зарегистрирован в контракте
        require(userSettings[recipientAddress].isRegistered, "Recipient not registered");
        // Рассчитываю ID чата
        bytes32 chatId = _generateChatId(msg.sender, recipientAddress);
        // Получаю доступ к хранилищу настроек чата
        ChatSettings storage chat = chats[chatId];
        // Проверяю что чат активен (что в нём можно писать новые сообщения)
        require(chat.isActive, "Chat is not active");
        // Проверяю, что передано не пустое зашифрованное сообщение для отправителя
        require(encryptedForSender.length > 0, "Encrypted message for sender cannot be empty");
        // Проверяю, что передано не пустое зашифрованное сообщение для получателя
        require(encryptedForRecipient.length > 0, "Encrypted message for recipient cannot be empty");       
        // Добавляем сообщение в чат
        _addMessageToChat(chatId, msg.sender, recipientAddress, encryptedForRecipient, encryptedForSender);
    }
    
    
    /**
     * @dev Деактивация чата с контактом (любой из двух участников чата может это сделать).
     * @param contactAddress Адрес контакта для деактивации чата
     */
    function deactivateChat(address contactAddress) external onlyRegisteredUser validAddress(contactAddress) {
        // Рассчитываю ID чата
        bytes32 chatId = _generateChatId(msg.sender, recipientAddress);
        // Получаю доступ к хранилищу настроек чата
        Chat storage chat = chats[chatId];        
        // Деактивируем чат (контакты остаются в списке, но чат становится неактивным)
        //При этом в этом чате будет запрещено писать новые сообщения.     
        chats[chatId].isActive = false;
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
     * @dev Вывод ETH с контракта (только для владельца). Удалить этот метод на продакшене.
     */
    function withdrawETH() external onlyOwner {
        uint256 contractBalance = address(this).balance;
        require(contractBalance > 0, "No ETH to withdraw");        
        payable(contractOwner).transfer(contractBalance);
    }
    


    // View функции
    
    /**
     * @dev Получение количества контактов текущего пользователя
     * @return Количество контактов
     */
    function getContactsCount() external view returns (uint256) {
        return userContacts[msg.sender].length;
    }    

    /**
     * @dev Получение суммарного количества сообщений в чатах текущего пользователя
     * @return Количество контактов
     */
    function getContactsCount() external view returns (uint256) {
        return messages[msg.sender].length;
    }
    
    /**
     * @dev Получение контактов пользователя с полными данными (имена и публичные ключи)
     * @param startIndex Начальный индекс (включительно)
     * @param endIndex Конечный индекс (исключительно, если передать 0, то верннёт всех контактов)
     * @return contacts Массив адресов контактов
     * @return names Массив имен контактов
     * @return publicKeys Массив публичных ключей контактов
     */
    function getContactsWithDetailsPaginated(
        uint256 startIndex, 
        uint256 endIndex
    ) external view returns (
        address[] memory contacts,
        string[] memory names,
        bytes[] memory publicKeys
    ) {
        // Получаю список контактов текущего пользователя
        address[] storage userContactsList = userContacts[msg.sender];   
        // Проверяем корректность диапазона
        require(startIndex <= userContactsList.length, "Start index out of bounds");
        require(endIndex == 0 || endIndex <= userContactsList.length, "End index out of bounds");
        require(endIndex == 0 || startIndex <= endIndex, "Invalid range: startIndex > endIndex");            
        // Если endIndex = 0, берем до конца массива
        if (endIndex == 0) {
            endIndex = userContactsList.length;
        }
        // Рассчитываем длину результата
        uint256 resultLength = endIndex - startIndex;
        // Создаем массивы для результата
        contacts = new address[](resultLength);
        names = new string[](resultLength);
        publicKeys = new bytes[](resultLength);
        // Заполняем массивы результата
        for (uint256 i = startIndex; i < endIndex; i++) {
            address contactAddress = userContactsList[i];
            contacts[i - startIndex] = contactAddress;
            names[i - startIndex] = userSettings[contactAddress].contactName;
            publicKeys[i - startIndex] = userSettings[contactAddress].publicKeyForEncode;
        }
    }


    /**
     * @dev Получение сообщений из чата с пагинацией
     * @param startMessNum Начальный messNum (включительно)
     * @param endMessNum Конечный messNum (включительно, 0 = до конца)
     * @return Массив сообщений
     */
    function getChatMessagesPaginated(uint256 startMessNum, uint256 endMessNum) 
      external
      view 
    returns (ChatMessage[] memory) {
        // Получаю доступ к хранилищу сообщений всех чатов текущего пользователя
        ChatMessage storage myMessages = messages[msg.sender];
        // Проверяем корректность диапазона
        require(startMessNum <= myMessages.length, "Start index out of bounds");
        require(endMessNum == 0 || endMessNum <= myMessages.length, "End index out of bounds");
        require(endMessNum == 0 || startMessNum <= endMessNum, "Invalid range: startIndex > endIndex");
        // Если endIndex = 0, берем до конца массива
        if (endIndex == 0) {
            endIndex = myMessages.length;
        }
        // Рассчитываем длину результата
        uint256 resultLength = endIndex - startIndex;
        // Создаем массив для результата
        ChatMessage[] memory result = new ChatMessage[](resultLength);
        // Заполняем массив результата
        for (uint256 i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = myMessages[i - startIndex];
        }
        // Возвращаем результат
        return result;
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
    function getChat(bytes32 chatId) external view returns (ChatSettings memory) {
        return chats[chatId];
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
            messageTimestamp: block.timestamp,
            sender: senderAddress
        });
        
        // Добавляем сообщение в чат
        chat.messages.push(message);
        chat.messageCount++;
    }

}
