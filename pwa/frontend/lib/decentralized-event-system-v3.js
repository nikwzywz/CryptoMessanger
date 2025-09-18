/**
 * Децентрализованная система событий для CryptoMessenger V3 (Polling Architecture)
 * Архитектура основана на polling вместо real-time событий
 * VERSION: 3.0.0 - Polling-based architecture for TypeMessage and frontend states
 */

class DecentralizedEventSystemV3 {
    constructor(contract = null, userAddress = null) {
        console.log('📦 DecentralizedEventSystem v3.0.0 - Polling architecture loaded');
        console.log('🔧 File: decentralized-event-system-v3.js');
        
        // Web3 контракт
        this.contract = contract;
        this.userAddress = userAddress;
        
        // Polling состояние
        this.lastMessageIndex = -1; // Начинаем с -1, первое сообщение имеет индекс 0
        this.lastContactIndex = 0;
        this.isPollingActive = false;
        this.pollingInterval = null;
        
        // Кэш известных контактов
        this.knownContacts = new Set();
        
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
                knownContacts: this.knownContacts.size,
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
        console.log('📇 Загружаем контакты пользователя...');
        
        let hasMoreContacts = true;
        let totalContacts = 0;
        
        while (hasMoreContacts) {
            try {
                const startIndex = this.lastContactIndex;
                const endIndex = startIndex + this.CONTACTS_BATCH_SIZE - 1;
                
                // Проверяем, есть ли контакты для загрузки
                const contactsCount = await this.contract.methods.getContactsCount().call({ 
                    from: this.userAddress 
                });
                
                if (startIndex >= parseInt(contactsCount)) {
                    console.log('📇 Загрузка контактов завершена (startIndex >= contactsCount)');
                    hasMoreContacts = false;
                    break;
                }
                
                const result = await this.contract.methods.getContactsPaginated(
                    startIndex, 
                    endIndex
                ).call({ from: this.userAddress });
                
                if (result.contacts.length === 0) {
                    hasMoreContacts = false;
                    console.log('📇 Загрузка контактов завершена (пустой результат)');
                } else {
                    // Добавляем контакты в кэш
                    result.contacts.forEach(address => {
                        this.knownContacts.add(address.toLowerCase());
                    });
                    
                    // Уведомляем UI о новых контактах
                    if (this.onNewContacts) {
                        this.onNewContacts(result);
                    }
                    
                    totalContacts += result.contacts.length;
                    this.lastContactIndex += result.contacts.length;
                    
                    console.log(`📇 Загружено ${result.contacts.length} контактов (всего: ${totalContacts})`);
                }
                
            } catch (error) {
                console.error('❌ Ошибка загрузки контактов:', error);
                hasMoreContacts = false;
            }
        }
        
        console.log(`✅ Загружено ${totalContacts} контактов`);
    }

    /**
     * Определение последнего индекса сообщений
     */
    async initializeMessageIndex() {
        try {
            // Получаем количество сообщений для текущего пользователя
            const messagesCount = await this.contract.methods.getMessagesCount().call();
            
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
            const unknownChatIDs = Array.from(newChatIDs).filter(chatID => {
                const addresses = this.extractAddressesFromChatID(chatID);
                return !addresses.every(addr => this.knownContacts.has(addr.toLowerCase()));
            });
            
            if (unknownChatIDs.length > 0) {
                console.log(`🚨 Обнаружены новые контакты в ${unknownChatIDs.length} чатах`);
                await this.loadNewContacts();
            }
            
            // 4. Обновляем UI
            this.updateUI(messagesByChat, chatFrontendStates);
            
            // 5. Обновляем счетчик последнего сообщения
            const maxIndex = Math.max(...newMessages.map(msg => parseInt(msg.messIndex)));
            this.lastMessageIndex = maxIndex;
            
            console.log(`📊 Обновлен lastMessageIndex: ${this.lastMessageIndex}`);
            
        } catch (error) {
            console.error('❌ Ошибка polling сообщений:', error);
        }
    }

    /**
     * Загрузка новых контактов при обнаружении неизвестных чатов
     */
    async loadNewContacts() {
        console.log('📇 Загружаем новые контакты...');
        
        let hasMoreContacts = true;
        let currentIndex = this.lastContactIndex;
        let newContactsCount = 0;
        
        while (hasMoreContacts) {
            try {
                const startIndex = currentIndex;
                const endIndex = startIndex + this.CONTACTS_BATCH_SIZE - 1;
                
                // Проверяем, есть ли новые контакты для загрузки
                const contactsCount = await this.contract.methods.getContactsCount().call({ 
                    from: this.userAddress 
                });
                
                if (startIndex >= parseInt(contactsCount)) {
                    console.log('📇 Загрузка новых контактов завершена (startIndex >= contactsCount)');
                    hasMoreContacts = false;
                    break;
                }
                
                const result = await this.contract.methods.getContactsPaginated(
                    startIndex,
                    endIndex
                ).call({ from: this.userAddress });
                
                if (result.contacts.length === 0) {
                    hasMoreContacts = false;
                } else {
                    // Добавляем новые контакты в кэш
                    result.contacts.forEach(address => {
                        this.knownContacts.add(address.toLowerCase());
                    });
                    
                    // Уведомляем UI о новых контактах
                    if (this.onNewContacts) {
                        this.onNewContacts(result);
                    }
                    
                    newContactsCount += result.contacts.length;
                    currentIndex += result.contacts.length;
                }
                
            } catch (error) {
                console.error('❌ Ошибка загрузки новых контактов:', error);
                hasMoreContacts = false;
            }
        }
        
        this.lastContactIndex = currentIndex;
        console.log(`✅ Загружено ${newContactsCount} новых контактов`);
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
        
        for (const contactAddress of this.knownContacts) {
            const testChatID = this.generateChatId(currentUserLower, contactAddress);
            if (testChatID === chatID) {
                return [currentUserLower, contactAddress];
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
            knownContactsCount: this.knownContacts.size,
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
        this.knownContacts.clear();
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
