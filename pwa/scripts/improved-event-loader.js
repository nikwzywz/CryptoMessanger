/**
 * Улучшенная система загрузки событий для CryptoMessenger
 * Реализует multi-source подход с fallback механизмами
 */

const fs = require('fs');
const path = require('path');

// Загружаем конфигурацию
const configPath = path.join(__dirname, '../frontend/config.js');
const configCode = fs.readFileSync(configPath, 'utf8');
global.window = {};
eval(configCode);

const Web3 = require('../frontend/node_modules/web3');

class ImprovedEventLoader {
    constructor() {
        this.rpcEndpoints = [
            'https://base-rpc.publicnode.com',
            'https://base.api.onfinality.io/public',
            'https://base.therpc.io',
            'https://mainnet.base.org',
            'https://base.drpc.org',
            'https://base.lava.build',
            'https://api.zan.top/base-mainnet',
            'https://base.public.blockpi.network/v1/rpc/public',
            'https://1rpc.io/base'
        ];
        
        this.web3Instances = new Map();
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    }

    /**
     * Получает Web3 instance для RPC endpoint
     */
    async getWeb3Instance(rpcUrl) {
        if (this.web3Instances.has(rpcUrl)) {
            return this.web3Instances.get(rpcUrl);
        }

        try {
            const web3 = new Web3(rpcUrl);
            // Проверяем подключение
            await web3.eth.getBlockNumber();
            
            this.web3Instances.set(rpcUrl, web3);
            console.log(`✅ RPC подключен: ${rpcUrl}`);
            return web3;
        } catch (error) {
            console.warn(`❌ RPC недоступен: ${rpcUrl}`, error.message);
            return null;
        }
    }

    /**
     * Загружает события с fallback между RPC
     */
    async loadEventsWithFallback(eventName, options = {}) {
        const strategies = [
            () => this.loadFromRPC(eventName, options),
            () => this.loadFromCache(eventName, options),
            () => this.loadFromBackupRPC(eventName, options)
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                console.log(`🔄 Попытка ${i + 1}/${strategies.length}: ${strategies[i].name}`);
                const result = await strategies[i]();
                
                if (result && result.length > 0) {
                    console.log(`✅ Успешно загружено ${result.length} событий через ${strategies[i].name}`);
                    return result;
                }
            } catch (error) {
                console.warn(`❌ Стратегия ${strategies[i].name} не удалась:`, error.message);
            }
        }

        throw new Error('Все стратегии загрузки событий не удались');
    }

    /**
     * Загружает события через RPC
     */
    async loadFromRPC(eventName, options) {
        for (const rpcUrl of this.rpcEndpoints) {
            try {
                const web3 = await this.getWeb3Instance(rpcUrl);
                if (!web3) continue;

                const contract = new web3.eth.Contract(
                    global.window.CryptoMessengerConfig.contractABI,
                    global.window.CryptoMessengerConfig.contractAddress
                );

                const events = await contract.getPastEvents(eventName, {
                    fromBlock: options.fromBlock || 0,
                    toBlock: options.toBlock || 'latest',
                    filter: options.filter || {}
                });

                // Кэшируем результат
                this.cacheResult(eventName, options, events);
                
                return events;
            } catch (error) {
                console.warn(`RPC ${rpcUrl} failed:`, error.message);
                continue;
            }
        }
        
        throw new Error('Все RPC endpoints недоступны');
    }

    /**
     * Загружает события из кэша
     */
    async loadFromCache(eventName, options) {
        const cacheKey = this.getCacheKey(eventName, options);
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            console.log(`📦 Загружено из кэша: ${cached.data.length} событий`);
            return cached.data;
        }
        
        return null;
    }

    /**
     * Загружает события через backup RPC (с ограниченным диапазоном)
     */
    async loadFromBackupRPC(eventName, options) {
        console.log('🔄 Пробуем backup RPC с ограниченным диапазоном...');
        
        const limitedOptions = {
            ...options,
            fromBlock: Math.max(0, (options.toBlock || 0) - 10000), // Ограничиваем до 10k блоков
            toBlock: options.toBlock || 'latest'
        };
        
        return await this.loadFromRPC(eventName, limitedOptions);
    }

    /**
     * Кэширует результат
     */
    cacheResult(eventName, options, data) {
        const cacheKey = this.getCacheKey(eventName, options);
        this.cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * Генерирует ключ кэша
     */
    getCacheKey(eventName, options) {
        return `${eventName}_${JSON.stringify(options)}`;
    }

    /**
     * Загружает сообщения между двумя пользователями
     */
    async loadMessagesBetweenUsers(user1, user2, options = {}) {
        console.log(`💬 Загружаем сообщения между ${user1} и ${user2}`);
        
        const filter = {
            or: [
                { from: user1, to: user2 },
                { from: user2, to: user1 }
            ]
        };

        const events = await this.loadEventsWithFallback('MessageSent', {
            ...options,
            filter: filter
        });

        return events.map(event => ({
            sender: event.topics[1] ? '0x' + event.topics[1].slice(26) : null,
            recipient: event.topics[2] ? '0x' + event.topics[2].slice(26) : null,
            encryptedData: event.returnValues.encryptedData,
            timestamp: event.returnValues.timestamp,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        }));
    }

    /**
     * Очищает кэш
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Кэш очищен');
    }

    /**
     * Получает статистику кэша
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

// Пример использования
async function testImprovedLoader() {
    const loader = new ImprovedEventLoader();
    
    try {
        const user02 = '0x016b67764012166A8d9Ed3502eA542A061B771f8';
        const user05 = '0x1b804e7A8365768a8e554a848C393A522655b947';
        
        const messages = await loader.loadMessagesBetweenUsers(user02, user05, {
            fromBlock: 35464000,
            toBlock: 35464999
        });
        
        console.log(`\n📊 Результат: найдено ${messages.length} сообщений`);
        console.log('📋 Статистика кэша:', loader.getCacheStats());
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

// Экспортируем для использования в других модулях
module.exports = { ImprovedEventLoader };

// Запускаем тест если файл выполняется напрямую
if (require.main === module) {
    testImprovedLoader();
}
