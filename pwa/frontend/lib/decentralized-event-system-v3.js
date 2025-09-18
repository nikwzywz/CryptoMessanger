/**
 * Децентрализованная система событий для CryptoMessenger V3 (Polling Architecture)
 * Архитектура основана на polling вместо real-time событий
 * VERSION: 3.0.0 - Polling-based architecture for TypeMessage and frontend states
 */

class DecentralizedEventSystemV3 {
    constructor(contract = null, userAddress = null, contactListManager = null) {
        console.log('📦 DecentralizedEventSystem v3.0.0 - Polling architecture loaded');
        console.log('🔧 File: decentralized-event-system-v3.js');
        
        // Web3 контракт
        this.contract = contract;
        this.userAddress = userAddress;
        this.contactListManager = contactListManager; // Ссылка на ContactListManagerV3
        
        // Polling состояние
        this.lastMessageIndex = -1; // Начинаем с -1, первое сообщение имеет индекс 0
        this.lastContactIndex = 0;
        this.isPollingActive = false;
        this.pollingInterval = null;
        
        // Frontend состояния чатов
        this.chatFrontendStates = new Map(); // chatID -> frontendState
        
        // Конфигурация polling
        this.POLLING_INTERVAL = 15000; // 15 секунд между проверками
        this.CHECK_INTERVAL = 1000;   // Проверяем каждую секунду
        this.MESSAGES_BATCH_SIZE = 100; // Количество сообщений за запрос
        this.CONTACTS_BATCH_SIZE = 100; // Количество контактов за запрос
        
        // Callbacks для обновления UI
        this.onNewMessages = null;
        this.onNewContacts = null;
        this.onChatStateChange = null;
        
        this.lastUpdateTime = 0;
        
        console.log('🎯 Polling конфигурация:', {
            pollingInterval: this.POLLING_INTERVAL,
            messagesBatchSize: this.MESSAGES_BATCH_SIZE,
            contactsBatchSize: this.CONTACTS_BATCH_SIZE
        });
    }

    /**
     * Инициализация системы - загрузка контактов и запуск polling
     */
    async initialize() {
        console.log('🚀 Инициализация DecentralizedEventSystem V3...');
        
        if (!this.contract || !this.userAddress) {
            throw new Error('Contract и userAddress обязательны для инициализации');
        }
        
        try {
            // 1. Загружаем все контакты при первом запуске
            await this.loadInitialContacts();
            
            // 2. Определяем последний индекс сообщений
            await this.initializeMessageIndex();
            
            // 3. Запускаем polling
            this.startPolling();
            
            console.log('✅ DecentralizedEventSystem V3 инициализирован');
            console.log('📊 Состояние:', {
                knownContacts: this.contactListManager ? this.contactListManager.contactsCache.size : 0,
                lastMessageIndex: this.lastMessageIndex,
                pollingActive: this.isPollingActive
            });
            
        } catch (error) {
            console.error('❌ Ошибка инициализации DecentralizedEventSystem V3:', error);
            throw error;
        }
    }

    /**
     * Загрузка всех контактов пагинацией
     */
    async loadInitialContacts() {
        console.log('📇 V3: Загружаем контакты постранично...');
        try {
            let hasMoreContacts = true;
            while (hasMoreContacts) {
                const startIndex = this.contactListManager.contactsCache.size;
                const endIndex = startIndex + this.CONTACTS_BATCH_SIZE - 1;
                
                console.log(`📥 V3: Запрашиваем страницу контактов: ${startIndex} - ${endIndex}`);

                const rawData = await this.contract.methods.getContactsPaginated(startIndex, endIndex).call({ from: this.userAddress });

                if (!rawData || !rawData.contacts || rawData.contacts.length === 0) {
                    hasMoreContacts = false;
                    console.log('✅ V3: Все страницы контактов загружены.');
                } else {
                    const formattedContacts = [];
                    for (let i = 0; i < rawData.contacts.length; i++) {
                        formattedContacts.push({
                            address: rawData.contacts[i],
                            name: rawData.names[i],
                            publicKeyForEncode: rawData.publicKeys[i],
                            lastMessageTimestamp: 0 // 🛠️ ИСПРАВЛЕНИЕ: Устанавливаем значение по умолчанию
                        });
                    }
                    this.onNewContacts(formattedContacts);

                    // Если получили меньше, чем размер страницы, это последняя страница
                    if (rawData.contacts.length < this.CONTACTS_BATCH_SIZE) {
                        hasMoreContacts = false;
                        console.log('✅ V3: Загружена последняя страница контактов.');
                    }
                }
            }
        } catch (error) {
            console.error('❌ V3: Критическая ошибка при постраничной загрузке контактов:', error);
            this.onNewContacts([]); // Отправляем пустой массив в случае ошибки
        }
    }

    /**
     * Определение последнего индекса сообщений
     */
    async initializeMessageIndex() {
        try {
            // 🛡️ ПРАВИЛО: Явно указываем отправителя для .call()
            const messagesCount = await this.contract.methods.getMessagesCount().call({ from: this.userAddress });
            
            this.lastMessageIndex = parseInt(messagesCount) - 1; // Последний существующий индекс
            
            console.log(`📊 Найдено сообщений: ${messagesCount}, последний индекс: ${this.lastMessageIndex}`);
            
        } catch (error) {
            console.error('❌ Ошибка получения количества сообщений:', error);
            console.error('❌ Детали ошибки:', error.message);
            this.lastMessageIndex = -1; // Начинаем с начала при ошибке
        }
    }

    /**
     * Запуск polling механизма
     */
    startPolling() {
        if (this.isPollingActive) {
            console.log('⚠️ Polling уже активен');
            return;
        }
        
        this.isPollingActive = true;
        this.lastUpdateTime = Date.now();
        
        // Проверяем каждую секунду, но обновляем раз в 15 секунд
        this.pollingInterval = setInterval(() => {
            this.checkForUpdates();
        }, this.CHECK_INTERVAL);
        
        console.log('🔄 Polling запущен');
        console.log(`⏰ Проверка каждые ${this.CHECK_INTERVAL}ms, обновление каждые ${this.POLLING_INTERVAL}ms`);
    }

    /**
     * Остановка polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        this.isPollingActive = false;
        console.log('⏹️ Polling остановлен');
    }

    /**
     * Проверка необходимости обновления (каждую секунду)
     */
    async checkForUpdates() {
        const now = Date.now();
        
        if (now - this.lastUpdateTime < this.POLLING_INTERVAL) {
            return; // Еще не прошло 15 секунд
        }
        
        this.lastUpdateTime = now;
        await this.pollForNewMessages();
    }

    /**
     * Основной polling метод для получения новых сообщений
     */
    async pollForNewMessages() {
        try {
            console.log(`🔍 Polling новых сообщений начиная с индекса ${this.lastMessageIndex + 1}...`);
            
            // 1. Получаем новые сообщения (все чаты сразу)
            const startIndex = this.lastMessageIndex + 1;
            const endIndex = startIndex + this.MESSAGES_BATCH_SIZE - 1;
            
            // Проверяем, есть ли новые сообщения
            const messagesCount = await this.contract.methods.getMessagesCount().call({ 
                from: this.userAddress 
            });
            
            if (startIndex >= parseInt(messagesCount)) {
                console.log('📭 Новых сообщений нет (startIndex >= messagesCount)');
                return;
            }
            
            const newMessages = await this.contract.methods.getMessagesPaginated(
                startIndex,
                endIndex
            ).call({ from: this.userAddress });
            
            if (newMessages.length === 0) {
                console.log('📭 Новых сообщений нет');
                return;
            }
            
            console.log(`📨 Получено ${newMessages.length} новых сообщений`);
            
            // 2. Группируем по чатам и определяем frontend состояния
            const messagesByChat = {};
            const chatFrontendStates = {};
            const newChatIDs = new Set();
            
            newMessages.forEach(msg => {
                // Группировка сообщений
                if (!messagesByChat[msg.chatID]) {
                    messagesByChat[msg.chatID] = [];
                }
                messagesByChat[msg.chatID].push(msg);
                
                // 🆕 ОПРЕДЕЛЕНИЕ FRONTEND СОСТОЯНИЯ ЧАТА
                chatFrontendStates[msg.chatID] = this.determineFrontendChatState(msg);
                
                // Запоминаем новые чаты
                newChatIDs.add(msg.chatID);
            });
            
            // 3. 🆕 ПРОВЕРЯЕМ НОВЫЕ КОНТАКТЫ
            // Получаем chatID для каждого нового сообщения
            const newChatIDsSet = new Set(newMessages.map(msg => msg.chatID));
            console.log(`💬 V3: Обнаружены сообщения в ${newChatIDsSet.size} чатах`);

            // Сравниваем с известными контактами, чтобы найти чаты с новыми собеседниками
            const unknownChatIDs = Array.from(newChatIDsSet).filter(chatID => {
                // 🛡️ ПРАВИЛО: currentUser уже в lowerCase
                const currentUserLower = this.userAddress; 
                
                // contactListManager.contactsCache.keys() уже содержит адреса в lowerCase
                for (const contactAddress of this.contactListManager.contactsCache.keys()) {
                    // generateChatId также внутри использует lowerCase
                    const testChatID = CryptoUtils.generateChatId(currentUserLower, contactAddress);
                    if (testChatID === chatID) {
                        return false; // Контакт известен
                    }
                }
                return true; // Контакт неизвестен
            });
            
            if (unknownChatIDs.length > 0) {
                console.log(`🚨 Обнаружены новые контакты в ${unknownChatIDs.length} чатах:`, unknownChatIDs.map(id => id.substring(0, 10)));
                console.log(`📇 Текущее количество известных контактов: ${this.contactListManager ? this.contactListManager.contactsCache.size : 0}`);
                await this.loadNewContacts();
            }
            
            // 4. Обновляем UI
            this.updateUI(messagesByChat, chatFrontendStates);
            
            // 5. Обновляем счетчик последнего сообщения
            const maxIndex = Math.max(...newMessages.map(msg => parseInt(msg.messIndex)));
            this.lastMessageIndex = maxIndex;
            
            console.log(`📊 Обновлен lastMessageIndex: ${this.lastMessageIndex}`);
            
        } catch (error) {
            // Скрываем Network Error - это нормально при временных сбоях сети
        }
    }

    /**
     * Загружает следующую страницу контактов. Вызывается при обнаружении неизвестного chatID.
     * Работает без getContactsCount.
     */
    async loadNewContacts() {
        console.log('📇 V3: Обнаружен неизвестный chatID, загружаем следующую страницу контактов...');
        try {
            const startIndex = this.contactListManager.contactsCache.size;
            const endIndex = startIndex + this.CONTACTS_BATCH_SIZE - 1;
            
            console.log(`📥 V3: Запрашиваем страницу новых контактов: ${startIndex} - ${endIndex}`);

            const rawData = await this.contract.methods.getContactsPaginated(startIndex, endIndex).call({ from: this.userAddress });

            if (!rawData || !rawData.contacts || rawData.contacts.length === 0) {
                console.log('ℹ️ V3: Новых контактов на следующей странице не найдено.');
                return;
            }
                
            const formattedContacts = [];
            for (let i = 0; i < rawData.contacts.length; i++) {
                formattedContacts.push({
                    address: rawData.contacts[i],
                    name: rawData.names[i],
                    publicKeyForEncode: rawData.publicKeys[i],
                    lastMessageTimestamp: 0 // 🛠️ ИСПРАВЛЕНИЕ: Устанавливаем значение по умолчанию
                });
            }

            this.onNewContacts(formattedContacts);
            console.log(`✅ V3: Загружено ${formattedContacts.length} новых контактов со страницы.`);

        } catch (error) {
            console.error('❌ V3: Ошибка при загрузке новых контактов:', error);
        }
    }

    /**
     * Определение frontend состояния чата на основе newChatState + isFromMe
     */
    determineFrontendChatState(message) {
        const contractState = parseInt(message.newChatState);
        
        // 0 = allowedWrite, 1 = notAllowedWrite, 2 = waitingAcceptance
        if (contractState === 0) {
            return 'allowedWrite'; // Разрешено писать в чат
        }
        
        if (contractState === 1) {
            return 'notAllowedWrite'; // Не разрешено писать в чат
        }
        
        if (contractState === 2) { // waitingAcceptance
            if (message.isFromMe) {
                return 'waitingAcceptanceFromOther'; // Жду принятия от собеседника
            } else {
                return 'waitingAcceptanceFromMe'; // Нужно принять или отклонить
            }
        }
        
        return 'unknown'; // Неизвестное состояние
    }

    /**
     * Извлечение адресов из chatID (обратная операция к _generateChatId)
     */
    extractAddressesFromChatID(chatID) {
        // В V3 архитектуре chatID генерируется как keccak256(abi.encodePacked(smaller, larger))
        // Но обратное извлечение невозможно из-за хеширования
        // Поэтому используем другой подход - проверяем все известные контакты
        
        // Для каждого известного контакта проверяем, соответствует ли chatID
        const currentUserLower = this.userAddress.toLowerCase();
        
        if (this.contactListManager) {
            for (const contactAddress of this.contactListManager.contactsCache.keys()) {
                const testChatID = this.generateChatId(currentUserLower, contactAddress);
                if (testChatID === chatID) {
                    return [currentUserLower, contactAddress];
                }
            }
        }
        
        // Если не нашли среди известных контактов, возвращаем пустой массив
        return [];
    }

    /**
     * Генерация chatID (аналогично контракту)
     */
    generateChatId(address1, address2) {
        return CryptoUtils.generateChatId(address1, address2);
    }

    /**
     * Обновление UI с новыми сообщениями и состояниями
     */
    updateUI(messagesByChat, chatFrontendStates) {
        Object.keys(messagesByChat).forEach(chatID => {
            const messages = messagesByChat[chatID];
            const frontendState = chatFrontendStates[chatID];
            
            console.log(`💬 Обновляем чат ${chatID.substring(0, 8)}...`, {
                messagesCount: messages.length,
                frontendState: frontendState
            });
            
            // Сохраняем состояние чата
            this.chatFrontendStates.set(chatID, frontendState);
            
            // Уведомляем UI о новых сообщениях
            if (this.onNewMessages) {
                this.onNewMessages(chatID, messages);
            }
            
            // Уведомляем UI об изменении состояния чата
            if (this.onChatStateChange) {
                this.onChatStateChange(chatID, frontendState);
            }
        });
    }

    /**
     * Получение текущего frontend состояния чата
     */
    getChatFrontendState(chatID) {
        return this.chatFrontendStates.get(chatID) || 'unknown';
    }

    /**
     * Установка callback'ов для обновления UI
     */
    setCallbacks(callbacks) {
        this.onNewMessages = callbacks.onNewMessages || null;
        this.onNewContacts = callbacks.onNewContacts || null;
        this.onChatStateChange = callbacks.onChatStateChange || null;
        
        console.log('🔗 Callbacks установлены:', {
            onNewMessages: !!this.onNewMessages,
            onNewContacts: !!this.onNewContacts,
            onChatStateChange: !!this.onChatStateChange
        });
    }

    /**
     * Принудительное обновление (для кнопки "Обновить")
     */
    async forceUpdate() {
        console.log('🔄 Принудительное обновление...');
        this.lastUpdateTime = 0; // Сбрасываем таймер
        await this.pollForNewMessages();
    }

    /**
     * Получение статистики системы
     */
    getStats() {
        return {
            lastMessageIndex: this.lastMessageIndex,
            lastContactIndex: this.lastContactIndex,
            knownContactsCount: this.contactListManager ? this.contactListManager.contactsCache.size : 0,
            isPollingActive: this.isPollingActive,
            chatStatesCount: this.chatFrontendStates.size,
            pollingInterval: this.POLLING_INTERVAL
        };
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        this.stopPolling();
        this.chatFrontendStates.clear();
        
        this.onNewMessages = null;
        this.onNewContacts = null;
        this.onChatStateChange = null;
        
        console.log('🗑️ DecentralizedEventSystem V3 очищен');
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DecentralizedEventSystemV3;
}
