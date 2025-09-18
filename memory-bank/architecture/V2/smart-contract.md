# Смарт-контракт CryptoMessenger V2

## 📋 Обзор

Контракт `CryptoMessenger.sol` реализует децентрализованную систему обмена зашифрованными сообщениями на блокчейне Base.

## 🔗 Адрес контракта

**Base Mainnet**: `0x541a49c4f9A97a274ADf0623beDCF6A8F9F17bF8`

## 🏗️ Основные функции

### Регистрация пользователей
```solidity
function registerPublicKey(bytes calldata publicKey) external payable
```
- Регистрирует публичный ключ для шифрования
- Требует плату за регистрацию
- Проверяет, что пользователь не зарегистрирован

### Управление контактами
```solidity
function requestContact(address recipient, string calldata introMessage, bytes calldata encryptedMessage) external payable
function acceptContactRequest(address requester) external
function rejectContactRequest(address requester) external
function removeContact(address contact) external
```

### Отправка сообщений
```solidity
function sendMessage(address recipient, bytes calldata encryptedMessage) external
```
- Отправляет зашифрованное сообщение
- Требует, чтобы получатель был в контактах
- Генерирует событие `MessageSent`

## 🔒 Безопасность

- **onlyOwner**: Только владелец может изменять настройки
- **onlyEOA**: Только внешние аккаунты (не контракты)
- **onlyRegistered**: Только зарегистрированные пользователи
- **Проверка платы**: Валидация размера платы

## 📊 События

- `UserRegistered(address user, bytes publicKey)`
- `ContactRequested(address requester, address recipient)`
- `ContactRequestAccepted(address requester, address recipient)`
- `ContactRequestRejected(address requester, address recipient)`
- `MessageSent(address sender, address recipient, bytes encryptedMessage)`

## 🧪 Тестирование

- 18 тестов покрывают все функции
- Тесты безопасности и валидации
- Тесты с различными сценариями ошибок
