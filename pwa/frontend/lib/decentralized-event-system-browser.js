/**
 * Децентрализованная система событий для CryptoMessenger (Browser Version)
 * Оптимизированная версия с пагинацией, ленивой подгрузкой и real-time обновлениями
 */

class DecentralizedEventSystem {
    constructor(contract = null, userAddress = null) {
        // Децентрализованные RPC endpoints
        this.rpcEndpoints = [
            'https://base-rpc.publicnode.com',
            'https://mainnet.base.org',
            'https://base.drpc.org',
            'https://base.lava.build',
            'https://base.therpc.io',
            'https://1rpc.io/base'
        ];
        
        // Web3 контракт для оптимизированных запросов
        this.contract = contract;
        this.userAddress = userAddress;
        
        // Local caching
        this.memoryCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут
        
        // Smart block range management
        this.lastMessageBlocks = new Map(); // userAddress -> lastBlockNumber
        
        // Chat storage with pagination
        this.chatStorage = new ChatStorage();
        
        // Event subscriptions
        this.eventSubscriptions = new Map(); // contactAddress -> subscription
        
        // Offline support
        this.isOnline = navigator.onLine;
        this.offlineQueue = [];
        
        this.setupOfflineHandling();
    }

    /**
     * Настройка offline/online обработки
     */
    setupOfflineHandling() {
        window.addEventListener('online', () => {
            console.log('🌐 Соединение восстановлено');
            this.isOnline = true;
            this.processOfflineQueue();
        });
        
        window.addEventListener('offline', () => {
            console.log('📴 Соединение потеряно');
            this.isOnline = false;
        });
    }

    /**
     * Обработка очереди offline запросов
     */
    async processOfflineQueue() {
        if (this.offlineQueue.length === 0) return;
        
        console.log(`🔄 Обрабатываем ${this.offlineQueue.length} offline запросов`);
        
        for (const request of this.offlineQueue) {
            try {
                await this.executeRequest(request);
            } catch (error) {
                console.warn('Ошибка обработки offline запроса:', error);
            }
        }
        
        this.offlineQueue = [];
    }

    /**
     * 🚀 ОПТИМИЗИРОВАННАЯ загрузка сообщений с пагинацией
     * Загружает только нужные сообщения, а не все события
     */
    async loadChatMessages(contactAddress, loadCount = 200) {
        console.log(`💬 Загружаем чат с ${contactAddress} (лимит: ${loadCount})`);
        
        if (!this.contract) {
            throw new Error('Контракт не инициализирован. Используйте setContract() для установки контракта.');
        }

        const chatData = this.chatStorage.getChatData(contactAddress);
        
        // 1. Получаем общее количество сообщений из контракта
        const [contractCount] = await this.contract.methods
            .getChatMessages(this.userAddress, contactAddress).call();
        
        console.log(`📊 В контракте: ${contractCount} сообщений, загружено: ${chatData.loadedCount}`);
        
        // 2. Если в контракте больше сообщений - загружаем недостающие
        if (contractCount > chatData.loadedCount) {
            const missingCount = contractCount - chatData.loadedCount;
            const toLoad = Math.min(missingCount, loadCount);
            
            console.log(`📥 Загружаем ${toLoad} новых сообщений...`);
            
            // Загружаем последние сообщения
            const newMessages = await this.contract.methods
                .getLastChatMessages(this.userAddress, contactAddress, toLoad).call();
            
            // Обновляем данные
            chatData.messages = [...newMessages, ...chatData.messages];
            chatData.loadedCount = contractCount;
            chatData.lastCount = contractCount;
            chatData.newestIndex = Math.max(chatData.newestIndex, contractCount - 1);
            chatData.oldestIndex = Math.max(0, contractCount - chatData.messages.length);
            chatData.isFullyLoaded = chatData.oldestIndex === 0;
            chatData.lastSyncTime = Date.now();
            
            this.chatStorage.updateChatData(contactAddress, chatData);
            
            console.log(`✅ Загружено ${newMessages.length} сообщений`);
            console.log(`📊 Диапазон: ${chatData.oldestIndex} - ${chatData.newestIndex}`);
        }
        
        return chatData.messages;
    }

    /**
     * 📚 Загрузка истории чата (старых сообщений)
     */
    async loadChatHistory(contactAddress, callback = null) {
        const chatData = this.chatStorage.getChatData(contactAddress);
        
        if (chatData.isFullyLoaded) {
            console.log('📚 Вся история уже загружена');
            return chatData.messages;
        }
        
        console.log(`📚 Загружаем историю чата с ${contactAddress}...`);
        console.log(`📊 Текущий диапазон: ${chatData.oldestIndex} - ${chatData.newestIndex}`);
        
        const PAGE_SIZE = 50; // Загружаем по 50 сообщений
        let currentIndex = chatData.oldestIndex;
        let loadedPages = 0;
        const maxPages = 10; // Максимум 10 страниц за раз (500 сообщений)
        
        while (currentIndex > 0 && loadedPages < maxPages) {
            const startIndex = Math.max(0, currentIndex - PAGE_SIZE);
            const count = currentIndex - startIndex;
            
            console.log(`📄 Загружаем страницу: ${startIndex} - ${currentIndex} (${count} сообщений)`);
            
            try {
                const pageMessages = await this.contract.methods
                    .getChatMessagesPaginated(this.userAddress, contactAddress, startIndex, count).call();
                
                if (pageMessages.length === 0) {
                    console.log('📚 Достигнут конец истории');
                    break;
                }
                
                // Добавляем в начало массива (старые сообщения)
                chatData.messages = [...pageMessages, ...chatData.messages];
                chatData.oldestIndex = startIndex;
                chatData.loadedCount += pageMessages.length;
                chatData.isFullyLoaded = startIndex === 0;
                
                currentIndex = startIndex;
                loadedPages++;
                
                // Вызываем callback для обновления UI
                if (callback) {
                    callback(pageMessages, startIndex);
                }
                
                // Небольшая пауза между страницами
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Ошибка загрузки страницы ${startIndex}-${currentIndex}:`, error);
                break;
            }
        }
        
        this.chatStorage.updateChatData(contactAddress, chatData);
        
        console.log(`✅ История загружена: ${loadedPages} страниц`);
        console.log(`📊 Новый диапазон: ${chatData.oldestIndex} - ${chatData.newestIndex}`);
        
        return chatData.messages;
    }

    /**
     * 🆕 Проверка новых сообщений (для real-time обновлений)
     */
    async checkForNewMessages(contactAddress) {
        const chatData = this.chatStorage.getChatData(contactAddress);
        
        const [contractCount] = await this.contract.methods
            .getChatMessages(this.userAddress, contactAddress).call();
        
        if (contractCount > chatData.lastCount) {
            const newCount = contractCount - chatData.lastCount;
            console.log(`🆕 Найдено ${newCount} новых сообщений`);
            
            // Загружаем только новые сообщения
            const newMessages = await this.contract.methods
                .getLastChatMessages(this.userAddress, contactAddress, newCount).call();
            
            // Добавляем в конец массива (новые сообщения)
            chatData.messages = [...chatData.messages, ...newMessages];
            chatData.lastCount = contractCount;
            chatData.loadedCount = contractCount;
            chatData.newestIndex = contractCount - 1;
            
            this.chatStorage.updateChatData(contactAddress, chatData);
            
            return newMessages;
        }
        
        return [];
    }

    /**
     * 🔔 Подписка на новые сообщения
     */
    subscribeToNewMessages(contactAddress, callback = null) {
        if (!this.contract) {
            throw new Error('Контракт не инициализирован');
        }

        if (this.eventSubscriptions.has(contactAddress)) {
            console.log(`🔔 Подписка на ${contactAddress} уже активна`);
            return;
        }

        console.log(`🔔 Подписываемся на новые сообщения от ${contactAddress}`);

        // Подписываемся на события MessageSent
        const subscription = this.contract.events.MessageSent({
            filter: {
                recipientAddress: this.userAddress
            },
            fromBlock: 'latest'
        });

        subscription.on('data', async (event) => {
            const senderAddress = event.returnValues.senderAddress;
            
            // Проверяем, что сообщение от нужного контакта
            if (senderAddress.toLowerCase() === contactAddress.toLowerCase()) {
                console.log('📨 Новое сообщение получено!');
                
                // Загружаем новые сообщения
                const newMessages = await this.checkForNewMessages(contactAddress);
                
                // Вызываем callback
                if (callback) {
                    callback(newMessages, event);
                }
            }
        });

        subscription.on('error', (error) => {
            console.error('❌ Ошибка подписки на события:', error);
        });

        this.eventSubscriptions.set(contactAddress, subscription);
        console.log(`✅ Подписка на события для ${contactAddress} активирована`);
    }

    /**
     * 🔕 Отписка от событий
     */
    unsubscribeFromMessages(contactAddress) {
        const subscription = this.eventSubscriptions.get(contactAddress);
        if (subscription) {
            subscription.unsubscribe();
            this.eventSubscriptions.delete(contactAddress);
            console.log(`🔕 Отписка от событий для ${contactAddress}`);
        }
    }

    /**
     * 🔧 Установка контракта и адреса пользователя
     */
    setContract(contract, userAddress = null) {
        this.contract = contract;
        if (userAddress) {
            this.userAddress = userAddress;
        }
        console.log('✅ Контракт и адрес пользователя установлены');
    }

    /**
     * 📊 Получение статистики чата
     */
    getChatStats(contactAddress) {
        const chatData = this.chatStorage.getChatData(contactAddress);
        return {
            totalMessages: chatData.lastCount,
            loadedMessages: chatData.loadedCount,
            oldestIndex: chatData.oldestIndex,
            newestIndex: chatData.newestIndex,
            isFullyLoaded: chatData.isFullyLoaded,
            lastSyncTime: chatData.lastSyncTime
        };
    }

    /**
     * 🧹 Очистка кэша чата
     */
    clearChatCache(contactAddress = null) {
        if (contactAddress) {
            this.chatStorage.chats.delete(contactAddress);
            console.log(`🧹 Кэш чата с ${contactAddress} очищен`);
        } else {
            this.chatStorage.chats.clear();
            console.log('🧹 Весь кэш чатов очищен');
        }
    }

    // Legacy методы для обратной совместимости
    async loadMessagesBetweenUsers(user1, user2, options = {}) {
        console.log(`💬 Загружаем сообщения между ${user1} и ${user2} (legacy метод)`);
        return await this.loadChatMessages(user2, options.limit || 200);
    }

    async loadEvents(eventName, options = {}) {
        // 1. Проверяем кэш
        const cached = this.getFromCache(eventName, options);
        if (cached) {
            console.log('📦 Загружено из кэша');
            return cached;
        }

        // 2. Если offline, возвращаем кэшированные данные
        if (!this.isOnline) {
            console.log('📴 Offline режим - возвращаем кэшированные данные');
            return this.getCachedData(eventName, options) || [];
        }

        // 3. Пробуем RPC endpoints
        for (const rpcUrl of this.rpcEndpoints) {
            try {
                const events = await this.loadFromRPC(rpcUrl, eventName, options);
                if (events && events.length > 0) {
                    this.saveToCache(eventName, options, events);
                    return events;
                }
            } catch (error) {
                console.warn(`RPC ${rpcUrl} failed:`, error.message);
                continue;
            }
        }

        // 4. Если все RPC недоступны, возвращаем кэш
        console.log('⚠️ Все RPC недоступны, возвращаем кэшированные данные');
        return this.getCachedData(eventName, options) || [];
    }

    /**
     * Загрузка с конкретного RPC
     */
    async loadFromRPC(rpcUrl, eventName, options) {
        try {
            const web3 = new Web3(rpcUrl);
            const contract = new web3.eth.Contract(
                window.CryptoMessengerConfig.contractABI,
                window.CryptoMessengerConfig.contractAddress
            );

            const events = await contract.getPastEvents(eventName, {
                fromBlock: options.fromBlock || 0,
                toBlock: options.toBlock || 'latest'
            });

            return events;
        } catch (error) {
            throw new Error(`RPC ${rpcUrl} failed: ${error.message}`);
        }
    }

    /**
     * Сохранение в кэш
     */
    saveToCache(eventName, options, data) {
        const key = this.getCacheKey(eventName, options);
        this.memoryCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * Получение из кэша
     */
    getFromCache(eventName, options) {
        const key = this.getCacheKey(eventName, options);
        const cached = this.memoryCache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        
        return null;
    }

    /**
     * Получение кэшированных данных (даже устаревших)
     */
    getCachedData(eventName, options) {
        const key = this.getCacheKey(eventName, options);
        const cached = this.memoryCache.get(key);
        return cached ? cached.data : null;
    }

    /**
     * Генерация ключа кэша
     */
    getCacheKey(eventName, options) {
        return `${eventName}_${JSON.stringify(options)}`;
    }

    /**
     * Получение текущего номера блока
     */
    async getCurrentBlock() {
        for (const rpcUrl of this.rpcEndpoints) {
            try {
                const web3 = new Web3(rpcUrl);
                const blockNumber = await web3.eth.getBlockNumber();
                console.log(`📊 Текущий блок: ${blockNumber} (через ${rpcUrl})`);
                return Number(blockNumber);
            } catch (error) {
                console.warn(`Ошибка получения блока через ${rpcUrl}:`, error.message);
                continue;
            }
        }
        throw new Error('Не удалось получить текущий блок ни через один RPC');
    }
}

/**
 * Класс для хранения данных чатов с пагинацией
 */
class ChatStorage {
    constructor() {
        this.chats = new Map(); // contactAddress -> ChatData
    }

    getChatData(contactAddress) {
        return this.chats.get(contactAddress) || {
            lastCount: 0,           // Количество сообщений в контракте
            loadedCount: 0,         // Количество загруженных сообщений
            oldestIndex: 0,         // Индекс самого старого загруженного сообщения
            newestIndex: 0,         // Индекс самого нового загруженного сообщения
            messages: [],           // Массив сообщений
            isFullyLoaded: false,   // Загружена ли вся история
            lastSyncTime: 0         // Время последней синхронизации
        };
    }

    updateChatData(contactAddress, newData) {
        this.chats.set(contactAddress, newData);
    }
}

/**
 * Класс для ленивой подгрузки при скролле
 */
class LazyChatLoader {
    constructor(messageLoader) {
        this.messageLoader = messageLoader;
        this.scrollThreshold = 100; // Пикселей до конца для подгрузки
        this.isLoading = false;
    }

    /**
     * Инициализация скролла для чата
     */
    initScrollListener(contactAddress, chatContainer, onNewMessages) {
        const chatData = this.messageLoader.chatStorage.getChatData(contactAddress);
        
        chatContainer.addEventListener('scroll', async (event) => {
            const container = event.target;
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            
            // Проверяем, близко ли к началу (для загрузки истории)
            if (scrollTop < this.scrollThreshold && !chatData.isFullyLoaded && !this.isLoading) {
                console.log('📚 Скролл к началу - загружаем историю...');
                this.isLoading = true;
                
                try {
                    const newMessages = await this.messageLoader.loadChatHistory(contactAddress, (pageMessages, startIndex) => {
                        // Обновляем UI с новой страницей
                        onNewMessages(pageMessages, startIndex);
                    });
                    
                    // Прокручиваем к позиции, где был пользователь
                    const newScrollHeight = container.scrollHeight;
                    const heightDiff = newScrollHeight - scrollHeight;
                    container.scrollTop = scrollTop + heightDiff;
                    
                } catch (error) {
                    console.error('❌ Ошибка загрузки истории:', error);
                } finally {
                    this.isLoading = false;
                }
            }
        });
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DecentralizedEventSystem, ChatStorage, LazyChatLoader };
}

// Глобальный экспорт для браузера
if (typeof window !== 'undefined') {
    window.DecentralizedEventSystem = DecentralizedEventSystem;
    window.ChatStorage = ChatStorage;
    window.LazyChatLoader = LazyChatLoader;
}