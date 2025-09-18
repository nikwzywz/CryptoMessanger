# Руководство по миграции с CryptoMessenger v1 на v2

## 📋 Обзор изменений

Контракт `CryptoMessenger.sol` был полностью переработан. Основные изменения касаются архитектуры системы контактов и сообщений.

## 🔄 КРИТИЧЕСКИЕ ИЗМЕНЕНИЯ ДЛЯ FRONTEND

### 1. Новая система приглашений (замена Contact Requests)

**БЫЛО (v1):**
```javascript
// Запрос контакта
await contract.requestContact(recipient, introMessage, encryptedMessage, {value: fee});

// Принятие/отклонение
await contract.acceptContactRequest(requester);
await contract.rejectContactRequest(requester);
```

**СТАЛО (v2):**
```javascript
// Отправка приглашения
await contract.invitationSend(recipient, encryptedForRecipient, encryptedForSender, {value: fee});

// Принятие/отклонение/отзыв
await contract.invitationAccept(inviter);
await contract.invitationReject(inviter);
await contract.invitationCancel(recipient);
```

### 2. Изменения в структуре сообщений

**БЫЛО (v1):**
```javascript
// Одно сообщение с полем isOutgoing
struct ChatMessage {
    bytes encryptedForReader;
    uint256 messageTimestamp;
    bool isOutgoing;
}
```

**СТАЛО (v2):**
```javascript
// Одно сообщение с двойным шифрованием
struct ChatMessage {
    bytes encryptedForSmaller;   // Для участника с меньшим адресом
    bytes encryptedForLarger;    // Для участника с большим адресом
    uint256 messageTimestamp;
}
```

### 3. Новая система чатов

**БЫЛО (v1):**
```javascript
// Отдельные чаты для каждого пользователя
mapping(address => mapping(address => ChatWithOneContact)) public chats;
```

**СТАЛО (v2):**
```javascript
// Для каждой пары собеседников - Единый чат с уникальным ID
mapping(bytes32 => Chat) public chats;
mapping(address => mapping(address => bytes32)) public chatReferences;
```

### 4. Изменения в функциях получения данных

**БЫЛО (v1):**
```javascript
// Получение контактов
await contract.getUserContacts(userAddress);

// Получение сообщений
await contract.getChatMessages(userAddress, contactAddress);
```

**СТАЛО (v2):**
```javascript
// Получение контактов (переименовано)
await contract.getContacts(userAddress);

// Получение сообщений по chatId
await contract.getChatMessages(chatId);

// Получение chatId
const chatId = await contract.getChatId(user1, user2);
```

## 🔧 ОБНОВЛЕНИЯ ДЛЯ FRONTEND

### 1. Обновление ABI

```javascript
// Замените старый ABI на новый
// Основные изменения в функциях:
// - requestContact → invitationSend
// - acceptContactRequest → invitationAccept
// - rejectContactRequest → invitationReject
// - removeContact → deactivateContact
// - getUserContacts → getContacts
```

### 2. Обновление системы отправки сообщений

**БЫЛО:**
```javascript
async function sendMessage(recipient, message) {
    const encrypted = await encryptMessage(message, recipientPublicKey);
    await contract.sendMessage(recipient, encrypted, {from: userAddress});
}
```

**СТАЛО:**
```javascript
async function sendMessage(recipient, message) {
    const chatId = await contract.getChatId(userAddress, recipient);
    const encryptedForRecipient = await encryptMessage(message, recipientPublicKey);
    const encryptedForSender = await encryptMessage(message, userPublicKey);
    
    await contract.sendMessage(recipient, encryptedForRecipient, encryptedForSender, {from: userAddress});
}
```

### 3. Обновление системы загрузки сообщений

**БЫЛО:**
```javascript
async function loadMessages(userAddress, contactAddress) {
    const [count, messages] = await contract.getChatMessages(userAddress, contactAddress);
    return messages;
}
```

**СТАЛО:**
```javascript
async function loadMessages(userAddress, contactAddress) {
    const chatId = await contract.getChatId(userAddress, contactAddress);
    const [count, messages] = await contract.getChatMessages(chatId);
    return messages;
}
```

### 4. Обновление системы контактов

**БЫЛО:**
```javascript
async function loadContacts(userAddress) {
    const contacts = await contract.getUserContacts(userAddress);
    return contacts;
}
```

**СТАЛО:**
```javascript
async function loadContacts(userAddress) {
    const contacts = await contract.getContacts(userAddress);
    return contacts;
}
```

### 5. Обновление системы приглашений

**БЫЛО:**
```javascript
async function requestContact(recipient, introMessage) {
    const encrypted = await encryptMessage(introMessage, recipientPublicKey);
    await contract.requestContact(recipient, introMessage, encrypted, {value: fee});
}
```

**СТАЛО:**
```javascript
async function sendInvitation(recipient, message) {
    const encryptedForRecipient = await encryptMessage(message, recipientPublicKey);
    const encryptedForSender = await encryptMessage(message, userPublicKey);
    await contract.invitationSend(recipient, encryptedForRecipient, encryptedForSender, {value: fee});
}
```

## 🆕 НОВЫЕ ВОЗМОЖНОСТИ

### 1. Имена контактов

```javascript
// Установка имени при регистрации
await contract.registerUser(contactName, publicKey);

// Изменение имени
await contract.setContactName(newName);

// Получение имени
const name = await contract.getContactName(userAddress);
```

### 2. Пагинация контактов с деталями

```javascript
// Получение контактов с именами и ключами
const [contacts, names, publicKeys] = await contract.getContactsWithDetailsPaginated(
    userAddress, 
    startIndex, 
    endIndex
);
```

### 3. Пагинация сообщений

```javascript
// Получение сообщений с пагинацией
const messages = await contract.getChatMessagesPaginated(chatId, startIndex, endIndex);
```

## ⚠️ ВАЖНЫЕ ОТЛИЧИЯ

### 1. Система контактов

- **v1**: Контакты удаляются полностью из массивов
- **v2**: Контакты остаются в списке, но чат деактивируется

### 2. Шифрование сообщений

- **v1**: Одно сообщение с полем `isOutgoing`
- **v2**: Одно сообщение с двойным шифрованием для обоих участников

### 3. Управление чатами

- **v1**: Отдельные чаты для каждого пользователя
- **v2**: Единый чат с уникальным ID для пары пользователей

### 4. События

**БЫЛО:**
```javascript
ContactRequested(requester, recipient, encryptedMessage, paymentAmount)
ContactAccepted(requester, recipient)
ContactRejected(requester, recipient)
ContactRemoved(user, contact)
```

**СТАЛО:**
```javascript
InvitationSent(inviter, recipient, chatId, encryptedForRecipient, encryptedForSender, fee)
InvitationAccepted(inviter, recipient, chatId)
InvitationRejected(inviter, recipient, chatId)
InvitationWithdrawn(inviter, recipient, chatId)
ContactDeactivated(user, contact)
```

## 🚀 ПЛАН МИГРАЦИИ

1. **Обновить ABI** - заменить на новую версию
2. **Обновить функции отправки сообщений** - добавить двойное шифрование
3. **Обновить систему загрузки сообщений** - использовать chatId
4. **Обновить систему контактов** - использовать новые названия функций
5. **Обновить систему приглашений** - перейти на новую архитектуру
6. **Добавить поддержку имен контактов** - новая функциональность
7. **Обновить обработку событий** - новые названия и параметры

## 📝 ЗАМЕТКИ

- Все старые функции переименованы для краткости
- Новая система более эффективна по газу
- Добавлена поддержка пагинации для больших списков
- Улучшена система управления чатами
- Добавлена поддержка пользовательских имен
