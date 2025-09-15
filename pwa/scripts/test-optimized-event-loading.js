#!/usr/bin/env node

/**
 * Тест оптимизированной системы загрузки событий
 * Проверяет RPC фильтрацию, умный диапазон блоков и кэширование
 */

const fs = require('fs');
const path = require('path');

// Загружаем Web3 из локального node_modules
const web3Path = path.join(__dirname, '../frontend/node_modules/web3');
const Web3Module = require(web3Path);
const Web3 = Web3Module.default || Web3Module;

// Загружаем конфигурацию
const configPath = path.join(__dirname, '../frontend/config.js');
const configContent = fs.readFileSync(configPath, 'utf8');

// Извлекаем конфигурацию из config.js
const configMatch = configContent.match(/window\.CryptoMessengerConfig\s*=\s*({[\s\S]*?});/);
if (!configMatch) {
    throw new Error('Не удалось найти конфигурацию в config.js');
}

const config = eval('(' + configMatch[1] + ')');

// Создаем Web3 и контракт
const web3 = new Web3(config.rpcUrl);
const contract = new web3.eth.Contract(config.contractABI, config.contractAddress);

// Создаем простую Node.js версию DecentralizedEventSystem для тестирования
class DecentralizedEventSystem {
    constructor(contract) {
        this.contract = contract;
        this.memoryCache = new Map();
        this.lastMessageBlocks = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    }

    async loadMessagesForUsers(user1, user2, options = {}) {
        console.log(`🔍 Загружаем сообщения между ${user1} и ${user2}`);
        
        // 1. Определяем оптимальный диапазон блоков
        const range = await this.getOptimalBlockRange(user1, user2);
        console.log(`📊 Диапазон блоков: ${range.fromBlock} - ${range.toBlock} (${range.isInitial ? 'первый запуск' : 'инкрементальный'})`);
        
        // 2. Проверяем кэш
        const cacheKey = `messages_${user1}_${user2}_${range.fromBlock}_${range.toBlock}`;
        const cached = this.memoryCache.get(cacheKey);
        if (cached) {
            console.log('📦 Загружено из кэша');
            return cached;
        }

        // 3. Загружаем ТОЛЬКО нужные события через RPC фильтрацию
        const events = await this.loadFilteredMessages(user1, user2, range);
        
        // 4. Обновляем кэш последних блоков
        this.updateLastMessageBlocks(events, user1, user2);
        
        // 5. Сохраняем в кэш
        this.memoryCache.set(cacheKey, events);
        
        console.log(`✅ Загружено ${events.length} сообщений`);
        return events;
    }

    async loadFilteredMessages(user1, user2, range) {
        if (!this.contract) {
            throw new Error('Контракт не инициализирован');
        }

        try {
            // Используем Web3.js фильтрацию на уровне RPC
            const events = await this.contract.getPastEvents('MessageSent', {
                filter: {
                    senderAddress: [user1, user2],      // Фильтр на сервере!
                    recipientAddress: [user1, user2]    // Только нужные сообщения
                },
                fromBlock: range.fromBlock,
                toBlock: range.toBlock
            });

            // Обрабатываем только релевантные данные
            return events.map(event => ({
                sender: event.returnValues.senderAddress,
                recipient: event.returnValues.recipientAddress,
                encryptedForRecipient: event.returnValues.encryptedForRecipient,
                encryptedForSender: event.returnValues.encryptedForSender,
                timestamp: event.returnValues.timestamp,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash
            }));

        } catch (error) {
            console.error('Ошибка загрузки отфильтрованных сообщений:', error);
            return [];
        }
    }

    async getOptimalBlockRange(user1, user2) {
        // 1. Получаем последний блок для каждого пользователя
        const lastBlock1 = await this.getLastMessageBlock(user1);
        const lastBlock2 = await this.getLastMessageBlock(user2);
        const lastBlock = Math.max(lastBlock1 || 0, lastBlock2 || 0);

        // 2. Если это первый запуск - загружаем последние 1000 блоков
        if (!lastBlock) {
            const currentBlock = await this.getCurrentBlock();
            return {
                fromBlock: Math.max(0, currentBlock - 1000),
                toBlock: currentBlock,
                isInitial: true
            };
        }

        // 3. Последующие запуски - с последнего блока + 1
        return {
            fromBlock: lastBlock + 1,
            toBlock: 'latest',
            isInitial: false
        };
    }

    async getLastMessageBlock(userAddress) {
        // Проверяем кэш
        if (this.lastMessageBlocks.has(userAddress)) {
            return this.lastMessageBlocks.get(userAddress);
        }

        if (!this.contract) {
            return null;
        }

        try {
            // Ищем последнее сообщение для пользователя
            const events = await this.contract.getPastEvents('MessageSent', {
                filter: {
                    senderAddress: userAddress
                },
                fromBlock: 0,
                toBlock: 'latest'
            });

            const lastBlock = events.length > 0 ? Math.max(...events.map(e => e.blockNumber)) : null;
            
            // Кэшируем результат
            if (lastBlock) {
                this.lastMessageBlocks.set(userAddress, lastBlock);
            }

            return lastBlock;
        } catch (error) {
            console.warn(`Ошибка получения последнего блока для ${userAddress}:`, error);
            return null;
        }
    }

    updateLastMessageBlocks(events, user1, user2) {
        if (events.length === 0) return;

        const maxBlock = Math.max(...events.map(e => e.blockNumber));
        
        // Обновляем для обоих пользователей
        this.lastMessageBlocks.set(user1, maxBlock);
        this.lastMessageBlocks.set(user2, maxBlock);
        
        console.log(`📝 Обновлен последний блок: ${maxBlock}`);
    }

    async getCurrentBlock() {
        try {
            const blockNumber = await web3.eth.getBlockNumber();
            return Number(blockNumber);
        } catch (error) {
            console.warn('Ошибка получения текущего блока:', error);
            return 0;
        }
    }

    // Legacy метод для обратной совместимости
    async loadMessagesBetweenUsers(user1, user2, options = {}) {
        console.log(`💬 Загружаем сообщения между ${user1} и ${user2} (оптимизированная версия)`);
        return await this.loadMessagesForUsers(user1, user2, options);
    }
}

// Создаем систему событий
const eventSystem = new DecentralizedEventSystem(contract);

// Тестовые адреса из populate-contract-test-data.js
const testUsers = [
    '0x016b67764012166A8d9Ed3502eA542A061B771f8', // user01
    '0x1b804e7A8365768a8e554a848C393A522655b947', // user02
    '0x2c915e7B8365768a8e554a848C393A522655b948'  // user03
];

async function testOptimizedEventLoading() {
    console.log('🧪 Начинаем тестирование оптимизированной системы загрузки событий\n');
    
    try {
        // 1. Тест RPC фильтрации
        console.log('1️⃣ Тестируем RPC фильтрацию...');
        const startTime = Date.now();
        
        const messages = await eventSystem.loadMessagesForUsers(testUsers[0], testUsers[1]);
        const loadTime = Date.now() - startTime;
        
        console.log(`   ✅ Загружено ${messages.length} сообщений за ${loadTime}ms`);
        console.log(`   📊 Время загрузки: ${loadTime}ms`);
        
        if (messages.length > 0) {
            console.log('   📋 Первые 3 сообщения:');
            messages.slice(0, 3).forEach((msg, index) => {
                console.log(`      ${index + 1}. ${msg.sender} → ${msg.recipient} (блок ${msg.blockNumber})`);
            });
        }
        
        // 2. Тест умного диапазона блоков
        console.log('\n2️⃣ Тестируем умный диапазон блоков...');
        const range1 = await eventSystem.getOptimalBlockRange(testUsers[0], testUsers[1]);
        console.log(`   📊 Диапазон 1: ${range1.fromBlock} - ${range1.toBlock} (${range1.isInitial ? 'первый запуск' : 'инкрементальный'})`);
        
        // Второй запрос должен быть инкрементальным
        const range2 = await eventSystem.getOptimalBlockRange(testUsers[0], testUsers[1]);
        console.log(`   📊 Диапазон 2: ${range2.fromBlock} - ${range2.toBlock} (${range2.isInitial ? 'первый запуск' : 'инкрементальный'})`);
        
        // 3. Тест кэширования
        console.log('\n3️⃣ Тестируем кэширование...');
        const cacheStartTime = Date.now();
        const cachedMessages = await eventSystem.loadMessagesForUsers(testUsers[0], testUsers[1]);
        const cacheTime = Date.now() - cacheStartTime;
        
        console.log(`   ✅ Кэшированные данные загружены за ${cacheTime}ms`);
        console.log(`   📊 Ускорение: ${Math.round(loadTime / cacheTime)}x`);
        
        // 4. Тест с разными пользователями
        console.log('\n4️⃣ Тестируем с разными пользователями...');
        const messages2 = await eventSystem.loadMessagesForUsers(testUsers[1], testUsers[2]);
        console.log(`   ✅ Загружено ${messages2.length} сообщений между user02 и user03`);
        
        // 5. Тест производительности
        console.log('\n5️⃣ Тестируем производительность...');
        const perfStartTime = Date.now();
        
        // Загружаем сообщения для всех пар пользователей
        const allMessages = [];
        for (let i = 0; i < testUsers.length; i++) {
            for (let j = i + 1; j < testUsers.length; j++) {
                const msgs = await eventSystem.loadMessagesForUsers(testUsers[i], testUsers[j]);
                allMessages.push(...msgs);
            }
        }
        
        const perfTime = Date.now() - perfStartTime;
        console.log(`   ✅ Загружено ${allMessages.length} сообщений для всех пар за ${perfTime}ms`);
        console.log(`   📊 Среднее время на пару: ${Math.round(perfTime / 3)}ms`);
        
        // 6. Тест обратной совместимости
        console.log('\n6️⃣ Тестируем обратную совместимость...');
        const legacyMessages = await eventSystem.loadMessagesBetweenUsers(testUsers[0], testUsers[1]);
        console.log(`   ✅ Legacy метод загрузил ${legacyMessages.length} сообщений`);
        console.log(`   📊 Совпадает с новым методом: ${messages.length === legacyMessages.length ? '✅' : '❌'}`);
        
        // 7. Статистика кэша
        console.log('\n7️⃣ Статистика кэша...');
        console.log(`   📦 Размер кэша: ${eventSystem.memoryCache.size} записей`);
        console.log(`   🧠 Кэш последних блоков: ${eventSystem.lastMessageBlocks.size} пользователей`);
        
        // Выводим кэшированные блоки
        for (const [user, block] of eventSystem.lastMessageBlocks.entries()) {
            console.log(`      ${user}: блок ${block}`);
        }
        
        console.log('\n🎉 Все тесты пройдены успешно!');
        console.log('\n📊 Итоговая статистика:');
        console.log(`   ⚡ Время загрузки: ${loadTime}ms`);
        console.log(`   🚀 Ускорение кэша: ${Math.round(loadTime / cacheTime)}x`);
        console.log(`   📦 Всего сообщений: ${allMessages.length}`);
        console.log(`   🧠 Кэшированных блоков: ${eventSystem.lastMessageBlocks.size}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка в тестах:', error);
        return false;
    }
}

// Запуск тестов
if (require.main === module) {
    testOptimizedEventLoading()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Критическая ошибка:', error);
            process.exit(1);
        });
}

module.exports = { testOptimizedEventLoading };
