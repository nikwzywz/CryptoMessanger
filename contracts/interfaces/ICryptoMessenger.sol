// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ICryptoMessenger
 * @dev Интерфейс для смарт-контракта CryptoMessenger
 */
interface ICryptoMessenger {
    
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
        uint256 contactRequestFee;
        bool isRegistered;
    }
    
    // События
    event PublicKeyRegistered(address indexed user, bytes publicKey);
    event ContactRequested(address indexed from, address indexed to, bytes firstMessage, uint256 payment);
    event ContactAccepted(address indexed from, address indexed to);
    event ContactRejected(address indexed from, address indexed to);
    event MessageSent(address indexed from, address indexed to, bytes encryptedData, uint256 timestamp);
    event ContactRequestFeeUpdated(address indexed user, uint256 newFee);
    
    // Основные функции
    function registerPublicKey(bytes memory _publicKey) external;
    function updatePublicKey(bytes memory _newPublicKey) external;
    function setContactRequestFee(uint256 _fee) external;
    function requestContact(address _to, bytes memory _firstMessage, bytes memory _encryptedData) external payable;
    function acceptContactRequest(address _from) external;
    function rejectContactRequest(address _from) external;
    function sendMessage(address _to, bytes memory _encryptedData) external;
    function removeContact(address _contact) external;
    
    // View функции
    function getPublicKey(address _user) external view returns (bytes memory);
    function isContact(address _user, address _contact) external view returns (bool);
    function getUserContacts(address _user) external view returns (address[] memory);
    function getContactRequest(address _recipient, address _sender) external view returns (ContactRequest memory);
    function getUserSettings(address _user) external view returns (UserSettings memory);
    function isUserRegistered(address _user) external view returns (bool);
}
