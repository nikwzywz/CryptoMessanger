# Миграция CryptoMessenger с V2 на V3 - Переход к Polling архитектуре

## 📋 Обзор

CryptoMessenger V3 представляет кардинальное изменение архитектуры данных для решения проблем с real-time событиями в V2. Основная цель - создать эффективную систему polling вместо неработающих Web3 событий.

## 🔍 ПРИЧИНЫ ПЕРЕДЕЛКИ

### ❌ Проблемы V2:
1. **HTTP RPC не поддерживает real-time события**
   - События `MessageSent` накапливаются и приходят пакетами
   - Входящие сообщения не отображаются до следующего действия пользователя
   - WebSocket endpoints недоступны для большинства публичных RPC

2. **Неэффективный polling**
   - Нужно проверять каждый чат отдельно: `getChatMessages(chatId1)`, `getChatMessages(chatId2)`...
   - Множественные запросы к контракту для проверки новых сообщений
   - Высокое потребление RPC запросов

3. **Сложная структура данных**
   - `mapping(bytes32 => Chat)` с отдельными массивами сообщений
   - Необходимость определения `encryptedForSmaller`/`encryptedForLarger`
   - Сложная логика восстановления чатов

## 🚀 РЕШЕНИЯ V3

### ✅ Персональные массивы сообщений:
```solidity
// V2: Отдельный чат для каждой пары
mapping(bytes32 => Chat) public chats;

// V3: Личный массив сообщений для каждого пользователя, в котором подряд сообщения всех чатов 
mapping(address => ChatMessage[]) public messages;
```

### ✅ Супер-эффективный polling:
```javascript
// V2: Множественные запросы
for (contact of contacts) {
    await contract.getChatMessages(getChatId(user, contact));
}

// V3: Один запрос для всех чатов, выбирающий до 100 новых сообщений за одно чтение
const newMessages = await contract.getMessagesPaginated(lastMessageIndex+1, lastMessageIndex+100);
```

### ✅ Отличие в хранении зашифрованнных сообщений:
```solidity
// V2: Оба зашифрованных варианта хранились в одном элементе ChatMessage
struct ChatMessage {
    bytes encryptedForSmaller;
    bytes encryptedForLarger; 
}

// V3: Персональное шифрование в отдельных массивах + состояние чата
// МАССИВ входящих и исходящих сообщений для каждого пользователя. Ключевое слово ДЛЯ КАЖДОГО пользователя.
struct TypeMessage {
    bytes32 chatID;              // К какому чату относится
    uint256 messIndex;           // Индекс сообщения (начиная с 0)
    uint256 messageTimestamp;    // Время сообщения
    bytes encryptedMessage;      // Зашифровано ключом владельца массива
    bool isFromMe;              // Направление сообщения
    enumChatState newChatState; // 🆕 НОВОЕ СОСТОЯНИЕ ЧАТА!
}
```

## 📊 АРХИТЕКТУРНЫЕ РАЗЛИЧИЯ

### V2 - Чат-центричная архитектура:
```
Chat[chatId] {
    messages: [
        {encryptedForSmaller, encryptedForLarger, sender}
    ]
}
```

### V3 - Пользователь-центричная архитектура с состояниями:
```
User[alice].messages: [
    {chatID: chat_with_bob, encryptedMessage, isFromMe: true, newChatState: waitingAcceptance},     // Приглашение к Bob
    {chatID: chat_with_charlie, encryptedMessage, isFromMe: false, newChatState: allowedWrite}, // Принятие от Charlie  
    {chatID: chat_with_bob, encryptedMessage, isFromMe: false, newChatState: allowedWrite},    // Принятие от Bob
    {chatID: chat_with_dave, encryptedMessage, isFromMe: true, newChatState: allowedWrite}     // Сообщение к Dave
]
// ↑ ОДИН массив содержит сообщения ИЗ ВСЕХ чатов Alice вперемешку + их состояния!
// Приложение группирует по chatID и автоматически обновляет статусы чатов
```

## 🔧 КЛЮЧЕВЫЕ ИЗМЕНЕНИЯ

### 1. Структура данных:
- **V2**: `mapping(bytes32 => Chat)` - один чат на пару пользователей
- **V3**: `mapping(address => TypeMessage[])` - личный массив для каждого пользователя

### 2. Хранение сообщений:
- **V2**: Одно сообщение с двойным шифрованием
- **V3**: Два сообщения с персональным шифрованием + состояние чата

### 3. События:
- **V2**: Полный набор событий (не работают с HTTP RPC)
- **V3**: Минимальные события, основной упор на polling

### 4. Определение новых чатов:
- **V2**: `chats[chatId].messageCount == 0`
- **V3**: `chats[chatId].inviter == address(0)` (упрощенная логика)

### 5. 🆕 Состояния чатов в сообщениях:
- **V2**: Нужно отдельно запрашивать `getChat(chatId)` для получения состояния
- **V3**: Состояние чата передается в каждом сообщении через `newChatState`

### 6. 🆕 Enum состояний:
- **V2**: `bool isActive` + `bool isNeedAcceptance` (4 возможных комбинации)
- **V3**: `enumChatState` (allowedWrite, notAllowedWrite, waitingAcceptance)

### 7. 🆕 Обязательные зашифрованные сообщения:
- **V2**: Только при отправке обычных сообщений
- **V3**: При ВСЕХ операциях изменения состояния чата (accept, reject, cancel, deactivate)

## 📈 ПРЕИМУЩЕСТВА V3

### ⚡ Производительность:
- **Один запрос** вместо множественных для polling
- **Автоматическая пагинация** через массивы
- **Клиентская фильтрация** по chatID для группировки сообщений по чатам
- **🆕 Нет лишних RPC запросов** для получения состояний чатов
- **🆕 Нет необходимости в `getContactsCount()`** - используем пагинацию до исчерпания

### 🔐 Безопасность:
- **Персональное шифрование** - каждый видит только свои данные
- **Изоляция пользователей** - нет доступа к чужим сообщениям
- **Простота дешифрования** - один ключ на пользователя

### 🎯 Синхронизация состояний:
- **🆕 Автоматическое обновление** статусов чатов через сообщения
- **🆕 Нет рассинхронизации** между состоянием чата и сообщениями
- **🆕 Полная история** изменений состояний в хронологическом порядке
- **🆕 Определение роли в приглашении** через комбинацию `newChatState` + `isFromMe`

### 🛠️ Логика работы с перемешанными сообщениями:
- **Получение новых сообщений** - один вызов `getMessagesPaginated(lastIndex+1, lastIndex+100)`
- **Группировка по чатам** - frontend фильтрует массив по `chatID`
- **Обновление конкретного чата** - находим сообщения с нужным `chatID`
- **Уведомления** - можем определить, в каких чатах появились новые сообщения

### 📱 Полная логика frontend с состояниями и контактами:

```javascript
// ========================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ========================================

// При первом входе загружаем контакты
let lastContactIndex = 0;
let lastMessageIndex = 0; // 🆕 Используем messIndex вместо messNum
const knownContacts = new Set(); // Кэш известных контактов

async function initializeApp() {
    // Загружаем контакты пагинацией по 100 за раз
    await loadInitialContacts();
    
    // Запускаем polling сообщений каждые 15 секунд
    setInterval(checkForUpdates, 1000); // Проверяем каждую секунду
}

async function loadInitialContacts() {
    let hasMoreContacts = true;
    while (hasMoreContacts) {
        const contacts = await contract.getContactsPaginated(
            lastContactIndex, lastContactIndex + 100
        );
        
        if (contacts.contacts.length === 0) {
            hasMoreContacts = false;
        } else {
            // Добавляем контакты в кэш
            contacts.contacts.forEach(address => knownContacts.add(address.toLowerCase()));
            updateContactListUI(contacts);
            lastContactIndex += contacts.contacts.length;
        }
    }
    
    // 🆕 НЕ ВЫЗЫВАЕМ getContactsCount() - пагинация сама определяет конец
}

// ========================================
// POLLING МЕХАНИЗМ (каждые 15 секунд)
// ========================================

let lastUpdateTime = 0;
const UPDATE_INTERVAL = 15000; // 15 секунд

async function checkForUpdates() {
    const now = Date.now();
    if (now - lastUpdateTime < UPDATE_INTERVAL) {
        return; // Еще не прошло 15 секунд
    }
    
    lastUpdateTime = now;
    await pollForNewMessages();
}

async function pollForNewMessages() {
    // 1. Получаем новые сообщения (все чаты сразу)
    const newMessages = await contract.getMessagesPaginated(
        lastMessageIndex + 1, lastMessageIndex + 100
    );
    
    if (newMessages.length === 0) {
        return; // Новых сообщений нет
    }

    // 2. Группируем по чатам И определяем frontend состояния
    const messagesByChat = {};
    const chatFrontendStates = {}; // 🆕 Frontend состояния чатов
    const newChatIDs = new Set();

    newMessages.forEach(msg => {
        // Группировка сообщений
        if (!messagesByChat[msg.chatID]) {
            messagesByChat[msg.chatID] = [];
        }
        messagesByChat[msg.chatID].push(msg);
        
        // 🆕 ОПРЕДЕЛЕНИЕ FRONTEND СОСТОЯНИЯ ЧАТА
        chatFrontendStates[msg.chatID] = determineFrontendChatState(msg);
        
        // Запоминаем новые чаты
        newChatIDs.add(msg.chatID);
    });

    // 3. 🆕 ПРОВЕРЯЕМ НОВЫЕ КОНТАКТЫ
    const unknownChatIDs = Array.from(newChatIDs).filter(chatID => {
        // Извлекаем адреса из chatID и проверяем, знаем ли мы их
        const addresses = extractAddressesFromChatID(chatID);
        return !addresses.every(addr => knownContacts.has(addr.toLowerCase()));
    });

    if (unknownChatIDs.length > 0) {
        // 🚨 ОБНАРУЖЕНЫ НОВЫЕ КОНТАКТЫ! Загружаем их данные
        await loadNewContacts();
    }

    // 4. Обновляем UI чатов И их состояния
    Object.keys(messagesByChat).forEach(chatID => {
        // Обновляем сообщения в открытом чате
        if (isCurrentlyOpenChat(chatID)) {
            updateChatUI(messagesByChat[chatID]);
        }
        
        // 🆕 Обновляем frontend состояние чата
        updateChatFrontendState(chatID, chatFrontendStates[chatID]);
        
        // 🆕 Обновляем иконки в списке контактов
        updateContactListIcon(chatID, chatFrontendStates[chatID]);
        
        // 🆕 Показываем уведомления о новых сообщениях
        if (!isCurrentlyOpenChat(chatID)) {
            showNotification(chatID, messagesByChat[chatID].length);
        }
    });

    // 5. Обновляем счетчик последнего сообщения
    lastMessageIndex = Math.max(...newMessages.map(msg => msg.messIndex));

    // 6. 🆕 НЕТ НЕОБХОДИМОСТИ в getChat(chatId)!
    // Все состояния уже получены через сообщения
}

// ========================================
// ЗАГРУЗКА НОВЫХ КОНТАКТОВ
// ========================================

async function loadNewContacts() {
    let hasMoreContacts = true;
    let currentIndex = lastContactIndex;
    
    while (hasMoreContacts) {
        const contacts = await contract.getContactsPaginated(
            currentIndex, currentIndex + 100
        );
        
        if (contacts.contacts.length === 0) {
            hasMoreContacts = false;
        } else {
            // Добавляем новые контакты в кэш
            contacts.contacts.forEach(address => knownContacts.add(address.toLowerCase()));
            updateContactListUI(contacts);
            currentIndex += contacts.contacts.length;
        }
    }
    
    lastContactIndex = currentIndex;
    
    // 🆕 НЕ ИСПОЛЬЗУЕМ getContactsCount() - определяем конец через пагинацию
}

```

### 🎯 КЛЮЧЕВЫЕ ОСОБЕННОСТИ POLLING V3:

1. **Инициализация**: Загружаем все контакты при первом запуске
2. **Периодичность**: Проверяем новые сообщения каждые 15 секунд
3. **Эффективность**: Получаем до 100 сообщений за один запрос
4. **Автообнаружение**: Автоматически загружаем данные новых контактов
5. **Синхронизация**: Состояния чатов обновляются через сообщения
6. **Уведомления**: Показываем уведомления о новых сообщениях
7. **🆕 Без лишних count-запросов**: Используем пагинацию до исчерпания вместо `getContactsCount()`
8. **🆕 Унифицированная пагинация**: Обе функции (`getMessagesPaginated` и `getContactsPaginated`) используют включительные диапазоны

## 🎯 ОПРЕДЕЛЕНИЕ РОЛЕЙ В ПРИГЛАШЕНИЯХ V3

### 📋 Логика определения роли:

Frontend должен анализировать комбинацию `newChatState` + `isFromMe` для понимания роли пользователя в приглашении:

```javascript
function determineFrontendChatState(message) {
    if (message.newChatState === 'allowedWrite') {
        return 'allowedWrite'; // Разрешено писать в чат
    }
    
    if (message.newChatState === 'notAllowedWrite') {
        return 'notAllowedWrite'; // Не разрешено писать в чат
    }
    
    if (message.newChatState === 'waitingAcceptance') {
        if (message.isFromMe) {
            return 'waitingAcceptanceFromOther'; // Жду принятия от собеседника
        } else {
            return 'waitingAcceptanceFromMe'; // Нужно принять или отклонить
        }
    }
}
```

### 🎨 Frontend состояния чатов:

| Frontend состояние | Описание | UI отображение |
|-------------------|----------|----------------|
| `allowedWrite` | Разрешено писать в чат | Обычный чат с полем ввода |
| `notAllowedWrite` | Не разрешено писать в чат | Заблокированный чат |
| `waitingAcceptanceFromMe` | Нужно принять приглашение | "✅ Принять" + "❌ Отклонить" |
| `waitingAcceptanceFromOther` | Жду принятия от собеседника | "⏳ Ожидание принятия приглашения" |

### 💡 Пример использования:

```javascript
newMessages.forEach(msg => {
    const frontendState = determineFrontendChatState(msg);
    
    switch (frontendState) {
        case 'allowedWrite':
            // Показываем обычный чат с полем ввода
            showNormalChat(msg.chatID);
            break;
            
        case 'notAllowedWrite':
            // Показываем заблокированный чат
            showBlockedChat(msg.chatID);
            break;
            
        case 'waitingAcceptanceFromMe':
            // Показываем кнопки "Принять" и "Отклонить"
            showInvitationButtons(msg.chatID);
            break;
            
        case 'waitingAcceptanceFromOther':
            // Показываем статус ожидания
            showWaitingStatus(msg.chatID);
            break;
    }
});
```

## 🗓️ ПЛАН МИГРАЦИИ

### Этап 1: Исправление контракта V3 ✅ ЗАВЕРШЕН
- [x] Убрать `messageCount` из `ChatSettings`
- [x] Исправить ошибки типов в функциях
- [x] Переименовать `ChatMessage` в `TypeMessage`
- [x] Исправить `getChatMessagesPaginated` в `getMessagesPaginated`
- [x] Заменить `messNum` на `messIndex` (индексация с 0)
- [x] Исправить логику определения новых чатов (`inviter == address(0)`)
- [x] 🆕 Заменить `isActive/isNeedAcceptance` на `enumChatState`
- [x] 🆕 Добавить поле `newChatState` в структуру `TypeMessage`
- [x] 🆕 Унифицировать пагинацию - обе функции используют включительные диапазоны
- [x] 🆕 Обновить все функции для передачи состояний через сообщения:
  - `invitationAccept` - передает `allowedWrite`
  - `invitationReject` - передает `notAllowedWrite`
  - `invitationCancel` - передает `notAllowedWrite`
  - `invitationSend` - передает `waitingAcceptance`
  - `sendMessage` - передает `allowedWrite`
  - `deactivateChat` - передает `notAllowedWrite`

### Этап 2: Обновление тестов (3-4 часа) ✅ ЗАВЕРШЕН
- [x] Адаптировать тесты под новую структуру `TypeMessage`
- [x] Обновить тесты отправки сообщений
- [x] Добавить тесты персональных массивов сообщений
- [x] Тесты пагинации для новой архитектуры (`messIndex` с 0)
- [x] Тесты polling функций (эффективность одного запроса)
- [x] 🆕 Тесты состояний чатов в сообщениях
- [x] 🆕 Тесты всех функций с зашифрованными параметрами
- [x] 🆕 Тесты enum состояний (allowedWrite/notAllowedWrite/waitingAcceptance)
- [x] 🆕 Тесты унифицированной пагинации (включительные диапазоны)

### Этап 3: Обновление frontend (4-5 часов)
- [ ] Создать новый `DecentralizedEventSystem` для V3
- [ ] Реализовать polling механизм
- [ ] Адаптировать `ChatAreaManager` под новую структуру `TypeMessage`
- [ ] Обновить `ContactListManager` для новых функций
- [ ] 🆕 Реализовать автоматическое обновление состояний чатов
- [ ] 🆕 Реализовать frontend состояния чатов: `allowedWrite`, `notAllowedWrite`, `waitingAcceptanceFromMe`, `waitingAcceptanceFromOther`
- [ ] 🆕 Обновить UI для отображения состояний: поле ввода / кнопки принятия / статус ожидания
- [ ] 🆕 Обновить все функции для передачи зашифрованных сообщений
- [ ] 🆕 Адаптировать UI под enum состояния
- [ ] Тестирование полного цикла

### Этап 4: Деплой и тестирование (1-2 часа)
- [ ] Компиляция и деплой контракта V3
- [ ] Обновление ABI в frontend
- [ ] Интеграционное тестирование
- [ ] Заполнение тестовыми данными

## 🧪 ПЛАН ТЕСТИРОВАНИЯ

### Критические тесты для V3:
1. **Персональные массивы сообщений**
   ```solidity
   function testPersonalMessageArrays() public {
       // Проверить, что Alice и Bob видят разные версии одного сообщения
   }
   ```

2. **Polling эффективность**
   ```solidity
   function testPollingEfficiency() public {
       // Проверить получение новых сообщений одним запросом
   }
   ```

3. **Совместимость шифрования**
   ```solidity
   function testEncryptionCompatibility() public {
       // Проверить, что сообщения корректно шифруются для каждого пользователя
   }
   ```

4. **Пагинация сообщений**
   ```solidity
   function testMessagePagination() public {
       // Проверить корректность пагинации в персональных массивах
   }
   ```

5. **🆕 Состояния чатов в сообщениях**
   ```solidity
   function testChatStatesInMessages() public {
       // Проверить, что все операции изменения состояния передают правильный newChatState
   }
   ```

6. **🆕 Enum состояния**
   ```solidity
   function testEnumChatStates() public {
       // Проверить переходы между allowedWrite/notAllowedWrite/waitingAcceptance
   }
   ```

7. **🆕 Обязательные зашифрованные параметры**
   ```solidity
   function testEncryptedParametersRequired() public {
       // Проверить, что все функции изменения состояния требуют зашифрованные данные
   }
   ```

## ⚠️ РИСКИ И ОГРАНИЧЕНИЯ

### Потенциальные проблемы:
- **Увеличение размера контракта** - сообщения дублируются для каждого пользователя
- **Gas costs** - больше операций записи при отправке сообщения
- **Синхронизация** - нужно обеспечить консистентность между массивами пользователей
- **🆕 Дополнительные параметры** - все функции теперь требуют зашифрованные данные
- **🆕 Совместимость frontend** - нужно обновить все вызовы функций контракта

### Меры по снижению рисков:
- **Тщательное тестирование** всех сценариев
- **Постепенная миграция** с сохранением V2 как fallback
- **Мониторинг gas costs** и оптимизация при необходимости

## 📋 ЧЕКЛИСТ ГОТОВНОСТИ К МИГРАЦИИ

### Контракт:
- [x] Все ошибки исправлены
- [x] Тесты проходят (22/22) ✅
- [ ] Gas costs оптимизированы
- [x] 🆕 Функции обновлены под новую архитектуру
- [x] 🆕 Состояния чатов передаются через сообщения
- [x] 🆕 Унифицированная пагинация (включительные диапазоны)
- [ ] 🆕 Frontend совместимость проверена

### Frontend:
- [ ] Новый DecentralizedEventSystem готов
- [ ] Polling механизм реализован
- [ ] UI адаптирован под новую структуру `TypeMessage`
- [ ] 🆕 Автоматическое обновление состояний чатов
- [ ] 🆕 Frontend состояния чатов: `allowedWrite`, `notAllowedWrite`, `waitingAcceptanceFromMe`, `waitingAcceptanceFromOther`
- [ ] 🆕 UI для состояний: поле ввода / кнопки принятия / статус ожидания / заблокированный чат
- [ ] 🆕 Все функции обновлены для передачи зашифрованных параметров
- [ ] 🆕 Enum состояния интегрированы в UI
- [ ] Обратная совместимость с V2 (при необходимости)

### Инфраструктура:
- [ ] Деплой скрипты обновлены
- [ ] ABI экспортирован
- [ ] Документация обновлена
- [ ] Мониторинг настроен

## 🎯 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

### Технические:
- ✅ **Real-time обновления** через эффективный polling
- ✅ **Снижение RPC запросов** в 5-10 раз
- ✅ **Упрощение логики** frontend
- ✅ **Стабильная работа** без зависимости от событий

### Пользовательские:
- ✅ **Мгновенные уведомления** о новых сообщениях
- ✅ **Стабильная работа** в любых сетевых условиях
- ✅ **Быстрая загрузка** истории сообщений
- ✅ **Надёжная синхронизация** между устройствами

## 📅 ВРЕМЕННЫЕ РАМКИ

- **Общее время**: 10-14 часов
- **Критический путь**: Исправление контракта → Тесты → Frontend
- **Готовность к продакшену**: 2-3 дня

---

*Документ создан: 2025-01-15*  
*Статус: План миграции*  
*Версия: 1.0*
