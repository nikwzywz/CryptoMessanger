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
        address from;
        bytes firstMessage;
        bytes encryptedData;
        uint256 payment;
        uint256 timestamp;
        bool isActive;
    }
    
    struct UserSettings {
        uint256 contactRequestFee; // Плата за запрос на добавление в контакты (в wei)
        bool isRegistered;
    }
    
    // Состояние контракта
    mapping(address => bytes) public userPublicKeys;
    mapping(address => UserSettings) public userSettings;
    mapping(address => mapping(address => bool)) public contacts; // [пользователь][контакт] => разрешен ли
    mapping(address => mapping(address => ContactRequest)) public contactRequests; // [получатель][отправитель] => запрос
    mapping(address => address[]) public userContacts; // Список контактов пользователя
    
    // События
    event PublicKeyRegistered(address indexed user, bytes publicKey);
    event ContactRequested(address indexed from, address indexed to, bytes firstMessage, uint256 payment);
    event ContactAccepted(address indexed from, address indexed to);
    event ContactRejected(address indexed from, address indexed to);
    event MessageSent(address indexed from, address indexed to, bytes encryptedData, uint256 timestamp);
    event ContactRequestFeeUpdated(address indexed user, uint256 newFee);
    
    // Модификаторы
    modifier onlyRegistered() {
        require(userSettings[msg.sender].isRegistered, "User not registered");
        _;
    }
    
    modifier validAddress(address _address) {
        require(_address != address(0), "Invalid address");
        require(_address != msg.sender, "Cannot interact with self");
        _;
    }
    
    // Конструктор
    constructor() {
        // Устанавливаем дефолтную плату за запрос контакта (примерно $10 в ETH)
        // При цене ETH $2000, это 0.005 ETH
        uint256 defaultFee = 0.005 ether;
        
        // Сохраняем дефолтную настройку для всех пользователей
        // Каждый пользователь может изменить свою плату при регистрации
    }
    
    /**
     * @dev Регистрация публичного ключа пользователя
     * @param _publicKey Публичный ключ для шифрования сообщений
     */
    function registerPublicKey(bytes memory _publicKey) external {
        require(_publicKey.length > 0, "Public key cannot be empty");
        require(!userSettings[msg.sender].isRegistered, "User already registered");
        
        userPublicKeys[msg.sender] = _publicKey;
        userSettings[msg.sender] = UserSettings({
            contactRequestFee: 0.005 ether, // Дефолтная плата ~$10
            isRegistered: true
        });
        
        emit PublicKeyRegistered(msg.sender, _publicKey);
    }
    
    /**
     * @dev Обновление публичного ключа
     * @param _newPublicKey Новый публичный ключ
     */
    function updatePublicKey(bytes memory _newPublicKey) external onlyRegistered {
        require(_newPublicKey.length > 0, "Public key cannot be empty");
        
        userPublicKeys[msg.sender] = _newPublicKey;
        emit PublicKeyRegistered(msg.sender, _newPublicKey);
    }
    
    /**
     * @dev Установка платы за запрос на добавление в контакты
     * @param _fee Плата в wei
     */
    function setContactRequestFee(uint256 _fee) external onlyRegistered {
        require(_fee <= 1 ether, "Fee too high"); // Максимум 1 ETH
        
        userSettings[msg.sender].contactRequestFee = _fee;
        emit ContactRequestFeeUpdated(msg.sender, _fee);
    }
    
    /**
     * @dev Запрос на добавление в контакты
     * @param _to Адрес получателя запроса
     * @param _firstMessage Первое сообщение (открытый текст)
     * @param _encryptedData Зашифрованные данные сообщения
     */
    function requestContact(
        address _to,
        bytes memory _firstMessage,
        bytes memory _encryptedData
    ) external payable onlyRegistered validAddress(_to) {
        require(userSettings[_to].isRegistered, "Recipient not registered");
        require(!contacts[_to][msg.sender], "Already in contacts");
        require(!contactRequests[_to][msg.sender].isActive, "Request already pending");
        
        uint256 requiredFee = userSettings[_to].contactRequestFee;
        require(msg.value >= requiredFee, "Insufficient payment");
        
        // Создаем запрос
        contactRequests[_to][msg.sender] = ContactRequest({
            from: msg.sender,
            firstMessage: _firstMessage,
            encryptedData: _encryptedData,
            payment: msg.value,
            timestamp: block.timestamp,
            isActive: true
        });
        
        emit ContactRequested(msg.sender, _to, _firstMessage, msg.value);
    }
    
    /**
     * @dev Принятие запроса на добавление в контакты
     * @param _from Адрес отправителя запроса
     */
    function acceptContactRequest(address _from) external onlyRegistered validAddress(_from) {
        ContactRequest storage request = contactRequests[msg.sender][_from];
        require(request.isActive, "No active request");
        
        // Добавляем в контакты
        contacts[msg.sender][_from] = true;
        userContacts[msg.sender].push(_from);
        
        // Деактивируем запрос
        request.isActive = false;
        
        // Возвращаем средства отправителю
        payable(_from).transfer(request.payment);
        
        emit ContactAccepted(_from, msg.sender);
    }
    
    /**
     * @dev Отклонение запроса на добавление в контакты
     * @param _from Адрес отправителя запроса
     */
    function rejectContactRequest(address _from) external onlyRegistered validAddress(_from) {
        ContactRequest storage request = contactRequests[msg.sender][_from];
        require(request.isActive, "No active request");
        
        // Деактивируем запрос (средства не возвращаются)
        request.isActive = false;
        
        emit ContactRejected(_from, msg.sender);
    }
    
    /**
     * @dev Отправка зашифрованного сообщения
     * @param _to Адрес получателя
     * @param _encryptedData Зашифрованные данные сообщения
     */
    function sendMessage(
        address _to,
        bytes memory _encryptedData
    ) external onlyRegistered validAddress(_to) {
        require(userSettings[_to].isRegistered, "Recipient not registered");
        require(contacts[_to][msg.sender], "Not in recipient's contacts");
        require(_encryptedData.length > 0, "Message cannot be empty");
        
        emit MessageSent(msg.sender, _to, _encryptedData, block.timestamp);
    }
    
    /**
     * @dev Удаление контакта из списка
     * @param _contact Адрес контакта для удаления
     */
    function removeContact(address _contact) external onlyRegistered validAddress(_contact) {
        require(contacts[msg.sender][_contact], "Contact not found");
        
        contacts[msg.sender][_contact] = false;
        
        // Удаляем из массива контактов
        address[] storage userContactList = userContacts[msg.sender];
        for (uint256 i = 0; i < userContactList.length; i++) {
            if (userContactList[i] == _contact) {
                userContactList[i] = userContactList[userContactList.length - 1];
                userContactList.pop();
                break;
            }
        }
    }
    
    // View функции
    
    /**
     * @dev Получение публичного ключа пользователя
     * @param _user Адрес пользователя
     * @return Публичный ключ
     */
    function getPublicKey(address _user) external view returns (bytes memory) {
        return userPublicKeys[_user];
    }
    
    /**
     * @dev Проверка статуса контакта
     * @param _user Адрес пользователя
     * @param _contact Адрес контакта
     * @return true если контакт разрешен
     */
    function isContact(address _user, address _contact) external view returns (bool) {
        return contacts[_user][_contact];
    }
    
    /**
     * @dev Получение списка контактов пользователя
     * @param _user Адрес пользователя
     * @return Массив адресов контактов
     */
    function getUserContacts(address _user) external view returns (address[] memory) {
        return userContacts[_user];
    }
    
    /**
     * @dev Получение информации о запросе контакта
     * @param _recipient Адрес получателя
     * @param _sender Адрес отправителя
     * @return Структура запроса контакта
     */
    function getContactRequest(address _recipient, address _sender) external view returns (ContactRequest memory) {
        return contactRequests[_recipient][_sender];
    }
    
    /**
     * @dev Получение настроек пользователя
     * @param _user Адрес пользователя
     * @return Структура настроек пользователя
     */
    function getUserSettings(address _user) external view returns (UserSettings memory) {
        return userSettings[_user];
    }
    
    /**
     * @dev Проверка регистрации пользователя
     * @param _user Адрес пользователя
     * @return true если пользователь зарегистрирован
     */
    function isUserRegistered(address _user) external view returns (bool) {
        return userSettings[_user].isRegistered;
    }
}
