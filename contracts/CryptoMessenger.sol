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

    // Максимальное количество контактов на пользователя
    uint256 public maxContactsPerUser;
    
    // Владелец контракта
    address public owner;
    
    // Состояние контракта
    mapping(address => bytes) public userPublicKeys;
    mapping(address => UserSettings) public userSettings;

    mapping(address => address[]) public userContacts; // mapping для быстрого доступа к Списку контактов пользователя
    mapping(address => mapping(address => bool)) public contacts; // [пользователь][контакт] => разрешен ли

    mapping(address => address[]) public incomingRequests; // mapping для быстрого доступа к входящим запросам на контакт
    mapping(address => address[]) public outgoingRequests; // mapping для быстрого доступа к исходящим запросам на контакт
    mapping(address => mapping(address => ContactRequest)) public contactRequests; // [получатель][отправитель] => запрос
    
    // События
    event PublicKeyRegistered(address indexed user, bytes publicKey);
    event ContactRequested(address indexed from, address indexed to, bytes firstMessage, uint256 payment);
    event ContactAccepted(address indexed from, address indexed to);
    event ContactRejected(address indexed from, address indexed to);
    event ContactRemoved(address indexed from, address indexed to);
    event MessageSent(address indexed from, address indexed to, bytes encryptedData, uint256 timestamp);
    event ContactRequestFeeUpdated(address indexed user, uint256 newFee);
    event MaxContactsLimitUpdated(uint256 newLimit);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // Модификаторы
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyRegistered() {
        require(userSettings[msg.sender].isRegistered, "User not registered");
        _;
    }
    
    modifier validAddress(address _address) {
        require(_address != address(0), "Invalid address");
        require(_address != msg.sender, "Cannot interact with self");
        _;
    }

    modifier onlyEOA() {
        require(msg.sender == tx.origin, "Only EOA allowed");
        _;
    }

    modifier withinContactLimit() {
        require(userContacts[msg.sender].length < maxContactsPerUser, "Too many contacts");
        _;
    }
    
    // Конструктор
    constructor() {       
        owner = msg.sender; // Устанавливаем создателя контракта как владельца
        maxContactsPerUser = 2000; // Лимит контактов на пользователя
    }
    
    /**
     * @dev Регистрация публичного ключа пользователя
     * @param _user_public_key Публичный ключ для шифрования сообщений
     */
    function registerPublicKey(bytes memory _user_public_key) external {
        require(_user_public_key.length > 0, "Public key cannot be empty");
        require(!userSettings[msg.sender].isRegistered, "User already registered");
        
        userPublicKeys[msg.sender] = _user_public_key;
        userSettings[msg.sender] = UserSettings({
            contactRequestFee: 0.0002 ether, // Дефолтная плата ~$1
            isRegistered: true
        });
        
        emit PublicKeyRegistered(msg.sender, _user_public_key);
    }
    
    /**
     * @dev Обновление публичного ключа
     * @param _updated_public_key Новый публичный ключ
     */
    function updatePublicKey(bytes memory _updated_public_key) external onlyRegistered {
        require(_updated_public_key.length > 0, "Public key cannot be empty");
        
        userPublicKeys[msg.sender] = _updated_public_key;
        emit PublicKeyRegistered(msg.sender, _updated_public_key);
    }
    
    /**
     * @dev Установка платы за запрос на добавление в контакты
     * @param _contact_request_fee Плата в wei
     */
    function setContactRequestFee(uint256 _contact_request_fee) external onlyRegistered {
        require(_contact_request_fee <= 1 ether, "Fee too high"); // Максимум 1 ETH
        
        userSettings[msg.sender].contactRequestFee = _contact_request_fee;
        emit ContactRequestFeeUpdated(msg.sender, _contact_request_fee);
    }
    
    /**
     * @dev Запрос на добавление в контакты
     * @param _recipient_address Адрес получателя запроса
     * @param _intro_message Первое сообщение (открытый текст)
     * @param _encrypted_message_data Зашифрованные данные сообщения
     */
    function requestContact(
        address _recipient_address,
        bytes memory _intro_message,
        bytes memory _encrypted_message_data
    ) external payable onlyRegistered validAddress(_recipient_address) {
        require(userSettings[_recipient_address].isRegistered, "Recipient not registered");
        require(!contacts[_recipient_address][msg.sender], "Already in contacts");
        require(!contactRequests[_recipient_address][msg.sender].isActive, "Request already pending");
        require(!contactRequests[msg.sender][_recipient_address].isActive, "There is already a counter request");
        
        uint256 required_fee = userSettings[_recipient_address].contactRequestFee;
        require(msg.value >= required_fee, "Insufficient payment");
        
        // Создаем запрос
        contactRequests[_recipient_address][msg.sender] = ContactRequest({
            from: msg.sender,
            firstMessage: _intro_message,
            encryptedData: _encrypted_message_data,
            payment: msg.value,
            timestamp: block.timestamp,
            isActive: true
        });
        // Добавляем в массивы
        incomingRequests[_recipient_address].push(msg.sender);
        outgoingRequests[msg.sender].push(_recipient_address);
        
        emit ContactRequested(msg.sender, _recipient_address, _intro_message, msg.value);
    }
    
    /**
     * @dev Принятие запроса на добавление в контакты
     * @param _sender_address Адрес отправителя запроса
     */
    function acceptContactRequest(address _sender_address) external onlyRegistered onlyEOA validAddress(_sender_address) {
        ContactRequest storage contact_request = contactRequests[msg.sender][_sender_address];
        require(contact_request.isActive, "No active request");
        
        // Добавляем в контакты в обе стороны
        contacts[msg.sender][_sender_address] = true;
        contacts[_sender_address][msg.sender] = true;
        userContacts[msg.sender].push(_sender_address);
        userContacts[_sender_address].push(msg.sender);
        
        // Деактивируем запрос
        contact_request.isActive = false;
        // Удаляем из массивов запросов
        _removeFromArray(incomingRequests[msg.sender], _sender_address);
        _removeFromArray(outgoingRequests[_sender_address], msg.sender);
        
        // Возвращаем средства отправителю
        payable(_sender_address).transfer(contact_request.payment);
        
        emit ContactAccepted(_sender_address, msg.sender);
        emit ContactAccepted(msg.sender, _sender_address);
        emit MessageSent(contact_request.from, msg.sender, contact_request.encryptedData, contact_request.timestamp);
    }
    
    /**
     * @dev Отклонение запроса на добавление в контакты
     * @param _sender_address Адрес отправителя запроса
     */
    function rejectContactRequest(address _sender_address) external onlyRegistered onlyEOA validAddress(_sender_address) {
        ContactRequest storage contact_request = contactRequests[msg.sender][_sender_address];
        require(contact_request.isActive, "No active request");
        
        // Деактивируем запрос (средства не возвращаются)
        contact_request.isActive = false;
        
        emit ContactRejected(_sender_address, msg.sender);
    }
    
    /**
     * @dev Отправка зашифрованного сообщения
     * @param _recipient_address Адрес получателя
     * @param _encrypted_message_data Зашифрованные данные сообщения
     */
    function sendMessage(
        address _recipient_address,
        bytes memory _encrypted_message_data
    ) external onlyRegistered onlyEOA validAddress(_recipient_address) {
        require(userSettings[_recipient_address].isRegistered, "Recipient not registered");
        require(contacts[_recipient_address][msg.sender], "Not in recipient's contacts");
        require(_encrypted_message_data.length > 0, "Message cannot be empty");
        
        emit MessageSent(msg.sender, _recipient_address, _encrypted_message_data, block.timestamp);
    }
    
    /**
     * @dev Удаление контакта из списка
     * @param _contact_to_remove Адрес контакта для удаления
     */
    function removeContact(address _contact_to_remove) external onlyRegistered onlyEOA validAddress(_contact_to_remove) {
        require(contacts[msg.sender][_contact_to_remove], "Contact not found");
        require(contacts[_contact_to_remove][msg.sender], "Contact not found");
        
        // Удаляем в обе стороны
        contacts[msg.sender][_contact_to_remove] = false;
        contacts[_contact_to_remove][msg.sender] = false;
        
        // Удаляем из массивов
        _removeFromArray(userContacts[msg.sender], _contact_to_remove);
        _removeFromArray(userContacts[_contact_to_remove], msg.sender);
        
        emit ContactRemoved(msg.sender, _contact_to_remove);
        emit ContactRemoved(_contact_to_remove, msg.sender);
    }

    /**
     * @dev Внутренняя функция для удаления адреса из массива
     * @param _array_contacts Массив адресов для удаления
     * @param _deleted_contact Адрес для удаления
     */
    function _removeFromArray(address[] storage _array_contacts, address _deleted_contact) internal {
        for (uint256 i = 0; i < _array_contacts.length; i++) {
            if (_array_contacts[i] == _deleted_contact) {
                _array_contacts[i] = _array_contacts[_array_contacts.length - 1];
                _array_contacts.pop();
                break;
            }
        }
    }

    /**
     * @dev Установка максимального количества контактов на пользователя
     * @param _new_contacts_limit Новый лимит контактов (от 1000 до 10000)
     */
    function setMaxContactsPerUser(uint256 _new_contacts_limit) external onlyOwner {
        require(_new_contacts_limit >= 1000 && _new_contacts_limit <= 10000, "Invalid limit");
        maxContactsPerUser = _new_contacts_limit;
        emit MaxContactsLimitUpdated(_new_contacts_limit);
    }
    
    /**
     * @dev Передача права владения контрактом
     * @param _new_owner_address Адрес нового владельца
     */
    function transferOwnership(address _new_owner_address) external onlyOwner {
        require(_new_owner_address != address(0), "New owner cannot be zero address");
        require(_new_owner_address != owner, "New owner must be different from current owner");
        
        address previous_owner = owner;
        owner = _new_owner_address;
        emit OwnershipTransferred(previous_owner, _new_owner_address);
    }
    
    // View функции
    
    /**
     * @dev Получение публичного ключа пользователя
     * @param _user_address Адрес пользователя
     * @return Публичный ключ
     */
    function getPublicKey(address _user_address) external view returns (bytes memory) {
        return userPublicKeys[_user_address];
    }
    
    /**
     * @dev Проверка статуса контакта
     * @param _user_address Адрес пользователя
     * @param _contact_address Адрес контакта
     * @return true если контакт разрешен
     */
    function isContact(address _user_address, address _contact_address) external view returns (bool) {
        return contacts[_user_address][_contact_address];
    }
    
    /**
     * @dev Получение списка контактов пользователя
     * @param _user_address Адрес пользователя
     * @return Массив адресов контактов
     */
    function getUserContacts(address _user_address) external view returns (address[] memory) {
        return userContacts[_user_address];
    }
    
    /**
     * @dev Получение информации о запросе контакта
     * @param _recipient_address Адрес получателя
     * @param _sender_address Адрес отправителя
     * @return Структура запроса контакта
     */
    function getContactRequest(address _recipient_address, address _sender_address) external view returns (ContactRequest memory) {
        return contactRequests[_recipient_address][_sender_address];
    }
    
    /**
     * @dev Получение настроек пользователя
     * @param _user_address Адрес пользователя
     * @return Структура настроек пользователя
     */
    function getUserSettings(address _user_address) external view returns (UserSettings memory) {
        return userSettings[_user_address];
    }
    
    /**
     * @dev Проверка регистрации пользователя
     * @param _user_address Адрес пользователя
     * @return true если пользователь зарегистрирован
     */
    function isUserRegistered(address _user_address) external view returns (bool) {
        return userSettings[_user_address].isRegistered;
    }
}
