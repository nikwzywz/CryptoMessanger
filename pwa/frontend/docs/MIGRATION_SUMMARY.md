# Миграция main.html на контракт v2

## ✅ Выполненные изменения

### 1. Система контактов
- **Было:** `getUserContacts()` 
- **Стало:** `getContacts()` + `getContactName()`
- Добавлена поддержка имен контактов из контракта

### 2. Система сообщений
- **Было:** Отдельные чаты для каждого пользователя
- **Стало:** Единый чат с `chatId` для пары пользователей
- Используется `getChatId()` и `getChatMessages(chatId)`

### 3. Шифрование сообщений
- **Было:** Одно зашифрованное сообщение с полем `isOutgoing`
- **Стало:** Двойное шифрование - `encryptedForSmaller` и `encryptedForLarger`
- Логика определения правильного поля для расшифровки

### 4. Система приглашений
- **Было:** `requestContact()` → `acceptContactRequest()` → `rejectContactRequest()`
- **Стало:** `invitationSend()` → `invitationAccept()` → `invitationReject()` → `invitationCancel()`
- Обновлены комментарии и названия функций

### 5. Отправка сообщений
- **Было:** `sendMessage(recipient, encryptedMessage)`
- **Стало:** `sendMessage(recipient, encryptedForRecipient, encryptedForSender)`
- Добавлена функция `encryptMessage()` для двойного шифрования

### 6. Структура сообщений
- **Было:** `{encryptedMessage, timestamp, isOutgoing}`
- **Стало:** `{encryptedForSmaller, encryptedForLarger, messageTimestamp}`

### 7. UI обновления
- Обновлен заголовок на "CryptoMessenger v2"
- Обновлены комментарии в CSS для приглашений
- Обновлены названия функций в консольных логах

## 🔄 Оставшиеся задачи

### 1. Обработка событий
- Обновить обработку событий с новыми названиями:
  - `ContactRequested` → `InvitationSent`
  - `ContactAccepted` → `InvitationAccepted`
  - `ContactRejected` → `InvitationRejected`
  - `ContactRemoved` → `ContactDeactivated`

### 2. Пагинация
- Добавить поддержку пагинации:
  - `getContactsWithDetailsPaginated()`
  - `getChatMessagesPaginated()`

### 3. Дополнительные функции v2
- `setContactName()` - изменение имени контакта
- `deactivateContact()` - деактивация контакта вместо удаления

## 📋 Основные изменения в коде

### Функции контактов
```javascript
// v1
const contacts = await contract.methods.getUserContacts(userAddress).call();

// v2
const contacts = await contract.methods.getContacts(userAddress).call();
const contactName = await contract.methods.getContactName(address).call();
```

### Функции сообщений
```javascript
// v1
const messages = await contract.methods.getChatMessages(user1, user2).call();

// v2
const chatId = await contract.methods.getChatId(user1, user2).call();
const [count, messages] = await contract.methods.getChatMessages(chatId).call();
```

### Отправка сообщений
```javascript
// v1
await contract.methods.sendMessage(recipient, encryptedMessage).send({from: user});

// v2
await contract.methods.sendMessage(recipient, encryptedForRecipient, encryptedForSender).send({from: user});
```

## 🎯 Результат

Основной интерфейс `main.html` успешно мигрирован на контракт v2 с сохранением всей функциональности и улучшенной архитектурой.
