// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CryptoMessenger
 * @dev Децентрализованный зашифрованный мессенджер. Версия V3.
 * @author CryptoMessenger Team
 */
contract CryptoMessenger {

    // Кастомные ошибки для экономии газа
    error ContactNameTooLong();
    error PublicKeyEmpty();
    error UserAlreadyRegistered();
    error UserNotRegistered();
    error InvalidAddress();
    error CannotInteractWithSelf();
    error RecipientNotRegistered();
    error ChatNotActive();
    error ChatAlreadyActive();
    error InvitationAlreadyPending();
    error InsufficientPayment();
    error NoInvitationFound();
    error InvalidInviter();
    error FeeTooHigh();
    error InvitationFeeTooHigh();
    error OnlyOwner();
    error StartIndexOutOfBounds();

    enum enumChatState {
        allowedWrite, // разрешено писать в чат
        notAllowedWrite, // не разрешено писать в чат
        waitingAcceptance // ожидает принятия приглашения
    }
        
    // Структура для хранения сообщений в чате (оптимизирована для экономии газа)
    struct TypeMessage {
        bytes32 chatID;              // Ссылка на чат к которому относится это сообщение (32 байта)
        bytes encryptedMessage;      // Зашифрованное сообщение ключом publicKeyForEncode (динамический)
        uint248 messIndex;           // Индекс сообщения (31 байт) - достаточно для 2^248 сообщений
        bool isFromMe;               // true = сообщение от меня, false = сообщение от собеседника (1 байт)
        uint32 messageTimestamp;     // Дата и время сообщения в секундах (4 байта) - до 2106 года
        enumChatState newChatState;  // Новое состояние чата (1 байт)
        // Итого: 32 + dynamic + 32 = 64 байта + dynamic (вместо 96 + dynamic)
    }

    // Структура для хранения настроек одного чата (оптимизирована для экономии газа)
    struct ChatSettings {
        address inviter;             // Адрес последнего кто делал приглашение в чат (20 байт)
        uint56 invitationFee;        // Сумма оплаты в единицах 256wei (7 байт) - до MAX_INVITATION_FEE ETH
        uint32 createdAt;            // Время создания приглашения в секундах (4 байта) - до 2106 года
        enumChatState state;         // Состояние чата (1 байт)
        // Итого: 20 + 7 + 4 + 1 = 32 байта - идеально в один слот storage!
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
    uint256 public constant MAX_CONTACT_REQUEST_FEE = 1 ether; // Максимальная плата за запрос контакта
    uint256 public constant FEE_UNIT = 256; // Единица измерения для invitationFee (256 wei)
    uint256 public constant MAX_INVITATION_FEE = (2**56 - 1) * FEE_UNIT; // Максимальная invitationFee ≈ 18.4 ETH
        
    // Дефолтная плата за запрос на добавление в контакты
    uint256 public defaultContactRequestFee;
    
    // Владелец контракта
    address public contractOwner;

    
    // Настройки пользователя
    mapping(address => UserSettings) public userSettings;
    
    // МАССИВ всех контактов каждого пользователя, для быстрого доступа
    mapping(address => address[]) public userContacts; 

    // МАССИВ входящих и исходящих сообщений для каждого пользователя
    mapping(address => TypeMessage[]) public messages;   
    
    // Счетчики сообщений для каждого пользователя (для экономии газа вместо array.length)
    mapping(address => uint256) public messageCounters;
    
    // Хранилище настроек чатов по их уникальному идентификатору
    mapping(bytes32 => ChatSettings) public chats;

    // Только два события оставили
    event DefaultContactRequestFeeUpdated(uint256 newDefaultFee);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    

    // Модификаторы (оптимизированы с кастомными ошибками)
    modifier onlyOwner() {
        if (msg.sender != contractOwner) revert OnlyOwner();
        _;
    }
    
    modifier onlyRegisteredUser() {
        if (!userSettings[msg.sender].isRegistered) revert UserNotRegistered();
        _;
    }
    
    modifier validAddress(address targetAddress) {
        if (targetAddress == address(0)) revert InvalidAddress();
        if (targetAddress == msg.sender) revert CannotInteractWithSelf();
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
        // Кэшируем длины для экономии газа
        uint256 nameLength = bytes(contactName).length;
        uint256 keyLength = userPublicKey.length;
        
        if (nameLength > 50) revert ContactNameTooLong();
        if (keyLength == 0) revert PublicKeyEmpty();
        if (userSettings[msg.sender].isRegistered) revert UserAlreadyRegistered();
        
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
        if (contactRequestFee > MAX_CONTACT_REQUEST_FEE) revert FeeTooHigh();
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
        // Кэшируем длину для экономии газа
        uint256 nameLength = bytes(newContactName).length;
        
        if (nameLength > 40) revert ContactNameTooLong();
        
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
        if (msg.sender == recipientAddress) revert CannotInteractWithSelf();
        // Отпралять приглашения только зарегистрированным в контракте пользователям
        if (!userSettings[recipientAddress].isRegistered) revert RecipientNotRegistered();        
        // Рассчитываю ID чата
        bytes32 chatId = _generateChatId(msg.sender, recipientAddress);
        // Проверяю, что это новый чат (inviter никогда не устанавливался)
        bool isNewChat = (chats[chatId].inviter == address(0));
        
        // ЕСЛИ чат существует, то проверяем, 
        //    что этот чат не активен (нельзя создавать приглашение в активный чат)
        //    и что этот чат не ожидает принятия приглашения (нельзя создавать приглашение в чат, который уже ожидает принятия приглашения)
        if (!isNewChat) {
            if (chats[chatId].state == enumChatState.allowedWrite) revert ChatAlreadyActive();
            if (chats[chatId].state == enumChatState.waitingAcceptance) revert InvitationAlreadyPending();
        }

        // Проверяем что отправлено достаточно ETH в качестве комиссии за рассмотрение заявки на контакт
        uint256 requiredFee = userSettings[recipientAddress].contactRequestFee;
        if (msg.value < requiredFee) revert InsufficientPayment();
        
        // Проверяем что сумма не превышает максимальное значение для invitationFee
        if (msg.value > MAX_INVITATION_FEE) revert InvitationFeeTooHigh();
        
        // Если это новый чат
        if (isNewChat) {
            // Создаем новый чат в статусе "ожидания принятия приглашения"
            ChatSettings storage newChat = chats[chatId];
            newChat.state = enumChatState.waitingAcceptance;
            newChat.createdAt = uint32(block.timestamp);
            newChat.inviter = msg.sender;
            newChat.invitationFee = uint56(msg.value / FEE_UNIT);            
            // Добавляем в массивы контактов (первое приглашение)
            userContacts[msg.sender].push(recipientAddress);
            userContacts[recipientAddress].push(msg.sender);
        } else {
            // Обновляем параметры существующего чата
            ChatSettings storage existingChat = chats[chatId];
            existingChat.state = enumChatState.waitingAcceptance;
            existingChat.inviter = msg.sender;
            existingChat.invitationFee = uint56(msg.value / FEE_UNIT);
        }
        
        // Добавляем первое сообщение в чат
        // После добавления первого сообщения чат перестаёт быть новым
        _addMessageToChat(chatId, msg.sender, recipientAddress, encryptedForRecipient, encryptedForSender, enumChatState.waitingAcceptance);        
    }
    
    /**
     * @dev Принятие приглашения на контакт
     * @param inviterAddress Адрес отправителя приглашения
     * @param encryptedForRecipient Зашифрованные данные для получателя (inviter)
     * @param encryptedForSender Зашифрованные данные для отправителя (msg.sender)
     */
    function invitationAccept(address inviterAddress,
        bytes memory encryptedForRecipient,
        bytes memory encryptedForSender) 
      external 
      onlyRegisteredUser  
      validAddress(inviterAddress) 
    {
        // Рассчитываю ID чата
        bytes32 chatId = _generateChatId(msg.sender, inviterAddress);    
        // Получаю доступ к хранилищу настроек чата
        ChatSettings storage chat = chats[chatId];
        // Проверяю, что приглашение активное в этом чате ждёт одобрения
        if (chat.state != enumChatState.waitingAcceptance) revert NoInvitationFound();
        // Проверяю, что отправитель приглашения действительно тот кто указан в настройках чата, а не текущий пользователь
        if (chat.inviter != inviterAddress) revert InvalidInviter();
        
        // Активируем чат
        chat.state = enumChatState.allowedWrite;
        
        // Добавляем сообщение о принятии приглашения
        _addMessageToChat(chatId, msg.sender, inviterAddress, encryptedForRecipient, encryptedForSender, enumChatState.allowedWrite);
        
        // Сумма комиссии возвращается приглашающему из смарт-контракта
        payable(inviterAddress).transfer(uint256(chat.invitationFee) * FEE_UNIT);
    }
    
    /**
     * @dev Отклонение приглашения на контакт
     * @param inviterAddress Адрес отправителя приглашения
     * @param encryptedForRecipient Зашифрованные данные для получателя (inviter)
     * @param encryptedForSender Зашифрованные данные для отправителя (msg.sender)
     */
    function invitationReject(address inviterAddress,
        bytes memory encryptedForRecipient,
        bytes memory encryptedForSender) 
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
        require(chat.state == enumChatState.waitingAcceptance, "Chat invitation already processed");
        // Проверяю, что отправитель приглашения действительно тот кто указан в настройках чата, а не текущий пользователь
        require(chat.inviter == inviterAddress, "Invalid inviter");        
        // Деактивируем чат
        chat.state = enumChatState.notAllowedWrite;
        
        // Добавляем сообщение об отклонении приглашения
        _addMessageToChat(chatId, msg.sender, inviterAddress, encryptedForRecipient, encryptedForSender, enumChatState.notAllowedWrite);
        
        // Отправляем деньги получателю приглашения,
        // то есть вызывающий этот метод (приглашаемый), 
        // получает ETH в размере суммы комиссии из контракта себе
        payable(msg.sender).transfer(uint256(chat.invitationFee) * FEE_UNIT);
    }
    
    /**
     * @dev Отзыв приглашения (возврат денег через 3 суток)
     * @param recipientAddress Адрес получателя приглашения
     * @param encryptedForRecipient Зашифрованные данные для получателя
     * @param encryptedForSender Зашифрованные данные для отправителя
     */
    function invitationCancel(address recipientAddress,
        bytes memory encryptedForRecipient,
        bytes memory encryptedForSender) 
      external 
      onlyRegisteredUser  
      validAddress(recipientAddress) 
    {        
        // Рассчитываю ID чата
        bytes32 chatId = _generateChatId(msg.sender, recipientAddress);
        // Получаю доступ к хранилищу настроек чата
        ChatSettings storage chat = chats[chatId];
        // Проверяю что приглашение существует
        require(chat.state == enumChatState.waitingAcceptance, "Chat invitation already processed");
        // Проверяю, что приглашающим был именно текущий пользователь
        require(chat.inviter == msg.sender, "Only inviter can withdraw");
        // Проверяю, что интервал минимального ожидания истёк
        require(block.timestamp >= chat.createdAt + INVITATION_TIMEOUT, "Invitation timeout not reached");        
        // Деактивируем чат
        chat.state = enumChatState.notAllowedWrite;
        
        // Добавляем сообщение об отзыве приглашения
        _addMessageToChat(chatId, msg.sender, recipientAddress, encryptedForRecipient, encryptedForSender, enumChatState.notAllowedWrite);
        
        // Возвращаем деньги приглашающему
        // То есть пользователю, вызывающему этот метод
        payable(msg.sender).transfer(uint256(chat.invitationFee) * FEE_UNIT);
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
        if (!userSettings[recipientAddress].isRegistered) revert RecipientNotRegistered();
        // Рассчитываю ID чата
        bytes32 chatId = _generateChatId(msg.sender, recipientAddress);
        // Получаю доступ к хранилищу настроек чата
        ChatSettings storage chat = chats[chatId];
        // Проверяю что чат активен (что в нём можно писать новые сообщения)
        if (chat.state != enumChatState.allowedWrite) revert ChatNotActive();
        // Добавляем сообщение в чат (проверки длины сообщений убраны для экономии газа)
        _addMessageToChat(chatId, msg.sender, recipientAddress, encryptedForRecipient, encryptedForSender, enumChatState.allowedWrite);
    }
    
    
    /**
     * @dev Деактивация чата с контактом (любой из двух участников чата может это сделать).
     * @param contactAddress Адрес контакта для деактивации чата
     */
    function deactivateChat(address contactAddress,
        bytes memory encryptedForRecipient,
        bytes memory encryptedForSender) 
    external onlyRegisteredUser validAddress(contactAddress) {
        // Рассчитываю ID чата
        bytes32 chatId = _generateChatId(msg.sender, contactAddress);
        // Получаю доступ к хранилищу настроек чата
        ChatSettings storage chat = chats[chatId];        
        // Деактивируем чат (контакты остаются в списке, но чат становится неактивным)
        //При этом в этом чате будет запрещено писать новые сообщения.     
        chat.state = enumChatState.notAllowedWrite;
        // Добавляем сообщение в чат
        _addMessageToChat(chatId, msg.sender, contactAddress, encryptedForRecipient, encryptedForSender, enumChatState.notAllowedWrite);
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
     * @dev Получение суммарного количества сообщений текущего пользователя
     * @return Количество сообщений
     */
    function getMessagesCount() external view returns (uint256) {
        return messages[msg.sender].length;
    }
    
    /**
     * @dev Получение количества контактов текущего пользователя
     * @return Количество контактов
     */
    function getContactsCount() external view returns (uint256) {
        return userContacts[msg.sender].length;
    }
    
    /**
     * @dev Получение контактов пользователя с полными данными (имена и публичные ключи)
     * @param startIndex Начальный индекс (включительно)
     * @param endIndex Конечный индекс (включительно)
     * @return contacts Массив адресов контактов
     * @return names Массив имен контактов
     * @return publicKeys Массив публичных ключей контактов
     */
    function getContactsPaginated(
        uint256 startIndex, 
        uint256 endIndex
    ) external view returns (
        address[] memory contacts,
        string[] memory names,
        bytes[] memory publicKeys
    ) {
        // Получаю список контактов текущего пользователя
        address[] storage userContactsList = userContacts[msg.sender];           
        // Проверяем, что массив не пустой
        if (userContactsList.length == 0) {
            return (new address[](0), new string[](0), new bytes[](0));
        }        
        // Проверяем корректность диапазона
        if (startIndex > userContactsList.length) revert StartIndexOutOfBounds();
        
        // Если endIndex больше длины массива контактов, то берем до конца массива
        if (endIndex >= userContactsList.length) {
            endIndex = userContactsList.length - 1;
        }
        
        require(startIndex <= endIndex, "Invalid range: startIndex > endIndex");            
        // Рассчитываем длину результата (endIndex включительный)
        uint256 resultLength = endIndex - startIndex + 1;
        // Создаем массивы для результата
        contacts = new address[](resultLength);
        names = new string[](resultLength);
        publicKeys = new bytes[](resultLength);
        // Заполняем массивы результата
        for (uint256 i = startIndex; i <= endIndex; i++) {
            address contactAddress = userContactsList[i];
            contacts[i - startIndex] = contactAddress;
            names[i - startIndex] = userSettings[contactAddress].contactName;
            publicKeys[i - startIndex] = userSettings[contactAddress].publicKeyForEncode;
        }
    }


    /**
     * @dev Получение сообщений из чата с пагинацией
     * @param startMessIndex Начальный messIndex (включительно)
     * @param endMessIndex Конечный messIndex (включительно)
     * @return Массив сообщений
     */
    function getMessagesPaginated(uint256 startMessIndex, uint256 endMessIndex) 
      external
      view 
    returns (TypeMessage[] memory) {
        // Проверяем, что массив не пустой
        if (messages[msg.sender].length == 0) {
            return new TypeMessage[](0);
        }        
        // Если endMessIndex больше длины массива сообщений, то берем до конца массива
        if (endMessIndex >= messages[msg.sender].length) {
            endMessIndex = messages[msg.sender].length - 1;
        }
        // Проверяем корректность диапазона
        if (startMessIndex > messages[msg.sender].length) revert StartIndexOutOfBounds();
        require(startMessIndex <= endMessIndex, "Invalid range: startIndex > endIndex");
        // Рассчитываем длину результата
        uint256 resultLength = endMessIndex - startMessIndex + 1;
        // Создаем массив для результата
        TypeMessage[] memory result = new TypeMessage[](resultLength);
        // Заполняем массив результата
        for (uint256 i = startMessIndex; i <= endMessIndex; i++) {
            result[i - startMessIndex] = messages[msg.sender][i];
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
     * @param newChatState Новое состояние чата после этого сообщения
     */
    function _addMessageToChat(bytes32 chatId, address senderAddress, address recipientAddress, bytes memory encryptedForRecipient, bytes memory encryptedForSender, enumChatState newChatState) internal {
        // Получаю доступ к хранилищу сообщений отправителя
        TypeMessage[] storage senderMessages = messages[senderAddress];     
        // Получаем текущий индекс сообщения для отправителя из счетчика (экономия газа)
        uint256 senderMessageIndex = messageCounters[senderAddress];
        // Создаем одно сообщение для отправителя
        TypeMessage memory newMessageForSender = TypeMessage({
            chatID: chatId,
            encryptedMessage: encryptedForSender,
            messIndex: uint248(senderMessageIndex),
            isFromMe: true,
            messageTimestamp: uint32(block.timestamp),
            newChatState: newChatState
        });
        // Добавляем сообщение в массив отправителя
        senderMessages.push(newMessageForSender);
        // Увеличиваем счетчик сообщений отправителя (unchecked для экономии газа)
        unchecked {
            messageCounters[senderAddress] = senderMessageIndex + 1;
        }

        // Получаю доступ к хранилищу сообщений получателя
        TypeMessage[] storage recipientMessages = messages[recipientAddress];   
        // Получаем текущий индекс сообщения для получателя из счетчика (экономия газа)
        uint256 recipientMessageIndex = messageCounters[recipientAddress];
        // Создаем одно сообщение для получателя
        TypeMessage memory newMessageForRecipient = TypeMessage({
            chatID: chatId,
            encryptedMessage: encryptedForRecipient,
            messIndex: uint248(recipientMessageIndex),
            isFromMe: false,
            messageTimestamp: uint32(block.timestamp),
            newChatState: newChatState
        });
        // Добавляем сообщение в массив получателя
        recipientMessages.push(newMessageForRecipient);
        // Увеличиваем счетчик сообщений получателя (unchecked для экономии газа)
        unchecked {
            messageCounters[recipientAddress] = recipientMessageIndex + 1;
        }
    }

}