# Модульная архитектура CryptoMessenger v3.0.0

## 🏗️ Архитектурная концепция

CryptoMessenger V3 использует **polling-архитектуру** с четким разделением ответственности между модулями. Система основана на периодической проверке новых данных вместо real-time событий.

## 📦 Структура модулей V3

### 🏛️ AppState (modules/app-state.js)
**ОТВЕТСТВЕННОСТЬ:** Централизованное управление состоянием + Event Bus + Уведомления
- Хранение состояния приложения (currentUser, currentContact, userPublicKey, userPrivateKey)
- Система подписок (subscribe/notify) для связи между модулями
- Глобальные уведомления (showNotification)
- Master в Master-Detail паттерне

### 📋 ContactListManagerV3 (modules/contact-list-manager-v3.js)
**ОТВЕТСТВЕННОСТЬ:** Левая панель - список контактов + приглашения + поиск
- Управление списком контактов и их отображение
- Модальные окна приглашений (openInvitationModal, closeInvitationModal)
- Отправка приглашений (sendInvitation) с валидацией
- Получение публичных ключей (getContactPublicKey)
- Поиск и фильтрация контактов (setupContactSearch, filterContacts)
- Кэширование контактов (contactsCache)

### 💬 ChatAreaManagerV3 (modules/chat-area-manager-v3.js)
**ОТВЕТСТВЕННОСТЬ:** Правая панель - область чата + управление панелями + сообщения
- Управление областью чата и отображением сообщений
- Управление состояниями UI (updateChatAreaForState)
- Управление панелями (setVisiblePanel*)
- Принятие/отклонение/отзыв приглашений
- Отправка сообщений (sendMessage)
- ECIES шифрование для контактов и себя

### 🔄 DecentralizedEventSystemV3 (lib/decentralized-event-system-v3.js)
**ОТВЕТСТВЕННОСТЬ:** Polling система для загрузки данных
- Периодическая проверка новых сообщений (pollForNewMessages)
- Автоматическая загрузка новых контактов (loadNewContacts)
- Определение frontend состояний чатов
- Callbacks для уведомления UI модулей
- Кэширование известных контактов (knownContacts Set)
- Отслеживание индексов (lastMessageIndex, lastContactIndex)

### 🛠️ Utils (lib/utils.js)
**ОТВЕТСТВЕННОСТЬ:** Утилиты общего назначения
- formatTime() - форматирование времени с поддержкой i18n (RU/EN)
- Версионирование и логирование

## 📋 ContactListManagerV3 - Ключевые функции

### 🔑 ПРИГЛАШЕНИЯ С ВАЛИДАЦИЕЙ
```javascript
async sendInvitation(recipientAddress, message, fee) {
    // ✅ Валидация: формат адреса, не себя, не дубли
    // ✅ Проверка регистрации получателя
    // ✅ ECIES шифрование для обеих сторон
    // ✅ Отправка + автозакрытие модального окна
}
```

### 📊 СОСТОЯНИЯ ЧАТОВ
- `💬 allowedWrite` - обычный чат
- `📥 waitingAcceptanceFromMe` - входящее приглашение  
- `⏳ waitingAcceptanceFromOther` - исходящее приглашение
- `🚫 notAllowedWrite` - заблокированный чат

---

## 💬 ChatAreaManagerV3 - Ключевые функции

### 🎨 УПРАВЛЕНИЕ ПАНЕЛЯМИ (Component-Based)
- `setVisiblePanelInputAndSendMessage()` - панель ввода сообщений
- `setVisiblePanelWaitingAcceptanceFromMe()` - входящие приглашения  
- `setVisiblePanelWaitingAcceptanceFromOther()` - исходящие приглашения
- `updateChatAreaForState()` - центральная функция управления UI

### 🔄 ДЕЙСТВИЯ В ЧАТЕ
```javascript
// Все действия используют стандартные фразы из config_v2.js + ECIES шифрование
sendMessage() → contract.methods.sendMessage()
acceptInvitation() → contract.methods.invitationAccept()  
rejectInvitation() → contract.methods.invitationReject()
cancelInvitation() → contract.methods.invitationCancel()
```

---

## 🔄 Polling Архитектура V3

### 📡 ПРИНЦИП: Polling каждые 15 секунд вместо real-time событий

### 📊 CALLBACKS:
- `onNewMessages` → обновление чатов
- `onNewContacts` → обновление списка контактов  
- `onChatStateChange` → обновление иконок состояний

### 🔄 АВТОМАТИЧЕСКАЯ СИНХРОНИЗАЦИЯ:

✅ **Автозагрузка новых контактов** при обнаружении неизвестных чатов
✅ **Polling каждые 15 секунд** для проверки новых сообщений  
✅ **Кэширование** известных контактов и состояний чатов
✅ **UI обновления** через callbacks без прямых вызовов между модулями

### 💡 ПРЕИМУЩЕСТВА V3:

✅ **Надежность** - работает с любыми RPC endpoints (HTTP/WebSocket)
✅ **Простота** - нет сложной логики подписок на события
✅ **Масштабируемость** - легко добавлять новые типы polling
✅ **Независимость** - модули связаны только через AppState и callbacks

---

## 🎨 main.html - Координатор

### 🚀 ФУНКЦИИ:
- `initializeApp()` - инициализация модулей в правильном порядке
- `selectContact()` - связующее звено Master-Detail
- `setupEventHandlers()` - глобальные обработчики
- `showNotification()` - уведомления

### 🔗 СВЯЗЫВАНИЕ:
- **AppState** → Master-Detail паттерн
- **Callbacks** → автообновление UI

---

## 📁 Структура V3

```
📋 ContactListManagerV3  # Контакты + приглашения + поиск
💬 ChatAreaManagerV3     # Чат + панели + сообщения  
🔄 DecentralizedEventSystemV3 # Polling система
🏛️ AppState             # Состояние + уведомления
🎨 main.html            # Координатор
```

### 🎯 ПРИНЦИПЫ:
- **Polling** вместо событий
- **Callbacks** для связи модулей
- **Четкое разделение** ответственности
