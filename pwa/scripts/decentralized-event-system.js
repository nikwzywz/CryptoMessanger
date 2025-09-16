/**
 * Децентрализованная система событий для CryptoMessenger
 * Без бэкэнда, только RPC + Local Caching
 */

// Импорт Web3 для Node.js
const Web3Module = require('../frontend/node_modules/web3');
const Web3 = Web3Module.default || Web3Module;

// Загружаем конфигурацию
const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '../frontend/config.js');
const configCode = fs.readFileSync(configPath, 'utf8');
global.window = {};
eval(configCode);

class DecentralizedEventSystem {
    constructor() {
        // Децентрализованные RPC endpoints
        this.rpcEndpoints = [
            'https://base-rpc.publicnode.com',
            'https://mainnet.base.org',
            'https://base.drpc.org',
            'https://base.lava.build',
            'https://base.therpc.io',
            'https://1rpc.io/base'
        ];
        
        // Local caching
        this.memoryCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут
        
        // Offline support
        this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        this.offlineQueue = [];
        
        if (typeof window !== 'undefined') {
            this.setupOfflineHandling();
        }
    }

    /**
     * Настройка offline/online обработки
     */
    setupOfflineHandling() {
        if (typeof window !== 'undefined' && window.addEventListener) {
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
     * Загрузка событий с fallback стратегией
     */
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
            console.log(`🔄 Пробуем RPC: ${rpcUrl}`);
            const web3 = new Web3(rpcUrl);
            
            // Проверяем подключение
            const blockNumber = await web3.eth.getBlockNumber();
            console.log(`✅ RPC ${rpcUrl} подключен, блок: ${blockNumber}`);
            
            const contract = new web3.eth.Contract(
                global.window.CryptoMessengerConfig.contractABI,
                global.window.CryptoMessengerConfig.contractAddress
            );

            const events = await contract.getPastEvents(eventName, {
                fromBlock: options.fromBlock || 0,
                toBlock: options.toBlock || 'latest',
                filter: options.filter || {}
            });
            
            console.log(`📊 RPC ${rpcUrl} вернул ${events.length} событий`);
            return events;
        } catch (error) {
            console.warn(`❌ RPC ${rpcUrl} failed:`, error.message);
            throw error;
        }
    }

    /**
     * Кэширование в памяти
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
     * Загрузка сообщений между пользователями
     */
    async loadMessagesBetweenUsers(user1, user2, options = {}) {
        console.log(`💬 Загружаем сообщения между ${user1} и ${user2}`);
        console.log(`📊 Диапазон блоков: ${options.fromBlock} - ${options.toBlock}`);
        
        // Сначала попробуем загрузить все события MessageSent без фильтра
        console.log('🔍 Загружаем все события MessageSent...');
        const allEvents = await this.loadEvents('MessageSent', {
            fromBlock: options.fromBlock,
            toBlock: options.toBlock
        });
        
        console.log(`📊 Найдено ${allEvents.length} событий MessageSent`);
        
        if (allEvents.length > 0) {
            console.log('📋 Первые 3 события:');
            allEvents.slice(0, 3).forEach((event, index) => {
                const sender = event.topics[1] ? '0x' + event.topics[1].slice(26) : 'N/A';
                const recipient = event.topics[2] ? '0x' + event.topics[2].slice(26) : 'N/A';
                console.log(`   ${index + 1}. ${sender} → ${recipient}`);
            });
        }
        
        // Теперь фильтруем события
        const filteredEvents = allEvents.filter(event => {
            const sender = event.topics[1] ? '0x' + event.topics[1].slice(26) : null;
            const recipient = event.topics[2] ? '0x' + event.topics[2].slice(26) : null;
            
            // Сравниваем в нижнем регистре для точности
            return (sender?.toLowerCase() === user1.toLowerCase() && recipient?.toLowerCase() === user2.toLowerCase()) ||
                   (sender?.toLowerCase() === user2.toLowerCase() && recipient?.toLowerCase() === user1.toLowerCase());
        });
        
        console.log(`🎯 Отфильтровано ${filteredEvents.length} сообщений между пользователями`);

        return filteredEvents.map(event => ({
            sender: event.topics[1] ? '0x' + event.topics[1].slice(26) : null,
            recipient: event.topics[2] ? '0x' + event.topics[2].slice(26) : null,
            encryptedData: event.returnValues.encryptedData,
            timestamp: event.returnValues.timestamp,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        }));
    }

    /**
     * Подписка на новые события (real-time)
     */
    subscribeToNewMessages(callback) {
        if (!this.isOnline) {
            console.log('📴 Offline режим - подписка недоступна');
            return null;
        }

        // Пробуем подключиться к первому доступному RPC
        for (const rpcUrl of this.rpcEndpoints) {
            try {
                const web3 = new Web3(rpcUrl);
                const contract = new web3.eth.Contract(
                    window.CryptoMessengerConfig.contractABI,
                    window.CryptoMessengerConfig.contractAddress
                );

                const subscription = contract.events.MessageSent();
                subscription.on('data', callback);
                
                console.log(`✅ Подписка на события через ${rpcUrl}`);
                return subscription;
            } catch (error) {
                console.warn(`Не удалось подключиться к ${rpcUrl}:`, error.message);
                continue;
            }
        }

        console.log('❌ Не удалось подключиться ни к одному RPC');
        return null;
    }

    /**
     * Очистка кэша
     */
    clearCache() {
        this.memoryCache.clear();
        console.log('🗑️ Кэш очищен');
    }

    /**
     * Статистика системы
     */
    getStats() {
        return {
            isOnline: this.isOnline,
            cacheSize: this.memoryCache.size,
            offlineQueueSize: this.offlineQueue.length,
            rpcEndpoints: this.rpcEndpoints.length
        };
    }
}


// Экспорт для использования в frontend
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DecentralizedEventSystem };
    
    // Тестовая функция удалена
} else {
    window.DecentralizedEventSystem = DecentralizedEventSystem;
}
