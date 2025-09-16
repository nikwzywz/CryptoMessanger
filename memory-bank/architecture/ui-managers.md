# Модульная архитектура CryptoMessenger v4.0.0

## 🏗️ Архитектурная концепция

CryptoMessenger использует **модульную архитектуру** с четким разделением ответственности. UIManager был удален как избыточный - его функции распределены между специализированными модулями.

## 📦 Структура модулей

### 🏛️ AppState (modules/app-state.js)
**ОТВЕТСТВЕННОСТЬ:** Централизованное управление состоянием + Event Bus + Уведомления
- Хранение состояния приложения (currentUser, currentContact, contacts, etc.)
- Система подписок (subscribe/notify) для связи между модулями
- Глобальные уведомления (showNotification)
- Master в Master-Detail паттерне

### 📋 ContactListManager (modules/contact-list-manager.js)
**ОТВЕТСТВЕННОСТЬ:** Левая панель - список контактов + UI рендеринг

### 💬 ChatAreaManager (modules/chat-area-manager.js)
**ОТВЕТСТВЕННОСТЬ:** Правая панель - область чата + управление панелями

### 🛠️ Utils (lib/utils.js)
**ОТВЕТСТВЕННОСТЬ:** Утилиты общего назначения
- formatTime() - форматирование времени для UI
- getAvatarColor() - генерация цветов аватаров на основе адреса

### 📞 1. ЗАГРУЗКА КОНТАКТОВ
```javascript
async loadContacts() {
    // Получение списка из contract.methods.getContacts()
    // Загрузка имён контактов из контракта
    // Получение последних сообщений для превью
    // Подсчёт непрочитанных сообщений
}
```

### 🔍 2. АНАЛИЗ СТАТУСА ЧАТОВ
```javascript
async getChatInfo(contactAddress) {
    // contract.methods.getChatId(currentUser, contactAddress)
    // contract.methods.getChat(chatId)
    // Возвращает: { isActive, isNeedAcceptance, inviter, chatType }
}
```

### 🔑 3. РАБОТА С КЛЮЧАМИ
```javascript
async getContactPublicKey(contactAddress) {
    // contract.methods.getPublicKey(contactAddress)
    // Кэширование публичных ключей для производительности
    // Валидация ключей
}
```

### 📊 4. КЛАССИФИКАЦИЯ КОНТАКТОВ
```javascript
classifyContact(contact, chatInfo) {
    // Определение типа контакта на основе статуса чата:
    // - 'contact' (обычный активный контакт)
    // - 'incoming-request' (входящее приглашение)
    // - 'outgoing-request' (исходящее приглашение)
}
```

### 🔄 5. СИНХРОНИЗАЦИЯ СОСТОЯНИЯ
```javascript
async refreshContacts() {
    // Полная перезагрузка списка контактов
    // Обновление статусов всех чатов
    // Уведомление AppState об изменениях
}
```

### 📱 6. UI СПИСКА КОНТАКТОВ
```javascript
updateContactsListUI() {
    // Отображение списка контактов
    // Цветные аватары с первой буквой имени
    // Бейджи (!, числа) для уведомлений
    // Превью последних сообщений
    // Подсветка активного контакта
}
```

---

## 💬 ChatAreaManager (chat-ui-manager-v4.js)

**ЗОНА ОТВЕТСТВЕННОСТИ:** Правая панель - область чата

### 💬 1. ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ В КОНТЕКСТЕ ЧАТА
```javascript
// Все действия, которые пользователь может выполнить в рамках одного чата:

async sendMessage(recipientAddress, messageText) {
    // Отправка обычного сообщения
    // Шифрование сообщения с ECIES
    // contract.methods.sendMessage()
    // Обновление UI чата
}

async sendInvitation(recipientAddress, message, fee) {
    // Отправка приглашения в блокчейн
    // contract.methods.invitationSend()
}

async acceptInvitation(inviterAddress) {
    // Принятие приглашения
    // contract.methods.invitationAccept()
}

async rejectInvitation(inviterAddress) {
    // Отклонение приглашения  
    // contract.methods.invitationReject()
}

async cancelInvitation(recipientAddress) {
    // Отзыв отправленного приглашения
    // contract.methods.invitationWithdraw()
}
```

### 🎨 2. УПРАВЛЕНИЕ ОБЛАСТЯМИ И ПАНЕЛЯМИ ЧАТА
```javascript
// Управление основными областями:

showWelcomeArea() {
    // Область приветствия "Добро пожаловать в CryptoMessenger! Выберите контакт..."
    // Отображается когда НЕ выбран текущий контакт
}

showChatMessagesArea() {
    // Область с сообщениями выбранного чата
    // Отображается когда выбран контакт
}

// Динамическое переключение панелей в зависимости от статуса чата:

showMessageInputPanel() {
    // Панель "Введите сообщение..." для активных чатов
}

showInvitationAcceptPanel(inviterAddress) {
    // Панель "✅ Разрешить общение / ❌ Запретить"
}

showInvitationWaitingPanel(recipientAddress) {
    // Панель "⏳ Ожидание принятия приглашения"
}

showCreateInvitationPanel(recipientAddress) {
    // Панель "📤 Отправить приглашение"
}
```

### 📜 3. УПРАВЛЕНИЕ СООБЩЕНИЯМИ
```javascript
loadChatMessages(contactAddress) {
    // Загрузка истории сообщений
    // Сортировка по времени
    // Отображение в UI
}

displayMessage(message) {
    // Создание элемента сообщения
    // Определение направления (входящее/исходящее)
    // Расшифровка и отображение
}

addNewMessage(message) {
    // Добавление нового сообщения в конец чата
    // Автопрокрутка вниз
}
```

---

## 🔄 Event-Driven Связь

### 📡 ПРИНЦИП максимально возможной НЕЗАВИСИМОСТИ

**ContactListManager говорит ChatAreaManager:** "обнови чат" когда пользователь переключается на новый контакт в списке
**ChatAreaManager НЕ говорит ContactListManager:** "обнови контакт"

Получается принцип Master-Detail по полю текушийКонтакт

### 🎯 ВМЕСТО ЭТОГО:

1. **ChatAreaManager** выполняет действие (отправляет сообщение/принимает приглашение)
2. **Смарт-контракт** генерирует событие
3. **Event System** ловит событие из блокчейна  
4. **ContactListManager** автоматически обновляется при получении события

### 💡 ПРЕИМУЩЕСТВА:

✅ **Полная независимость** модулей (за исключением изменения currentContact в ContactListManager, через метод, который вынуждает ChatAreaManager обновиться для нового контакта)
✅ **Автоматическая синхронизация** через блокчейн события
✅ **Масштабируемость** - легко добавлять новые менеджеры
✅ **Надёжность** - состояние всегда актуально
✅ **Реальное время** - изменения видны всем участникам

---

## 🎨 Общий UIManager

**ОТВЕТСТВЕННОСТЬ:** Координация между менеджерами

- Подписки на изменения AppState
- Общие утилиты (уведомления, форматирование)
- Координация обновлений UI
- Управление глобальными элементами интерфейса

---

## 📁 Итоговая структура модулей

```
modules/
├── app-state.js              # Централизованное состояние
├── ui-manager.js             # Общий координатор UI
├── contact-ui-manager-v4.js  # Левая панель (список контактов)
└── chat-ui-manager-v4.js     # Правая панель (область чата)
```

**Каждый модуль знает только свою зону ответственности!** 🎯
