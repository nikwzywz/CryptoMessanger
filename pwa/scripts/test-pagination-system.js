#!/usr/bin/env node

/**
 * Тест системы пагинации и real-time обновлений
 */

const path = require('path');
const fs = require('fs');

// Загружаем конфигурацию
const configPath = path.join(__dirname, '../frontend/config.js');
const configCode = fs.readFileSync(configPath, 'utf8');

// Создаем глобальные объекты для Node.js
global.window = {};
global.navigator = { onLine: true };

// Выполняем конфигурацию
eval(configCode);

// Загружаем классы для Node.js
const eventSystemPath = path.join(__dirname, '../frontend/lib/decentralized-event-system-browser.js');
const eventSystemCode = fs.readFileSync(eventSystemPath, 'utf8');
eval(eventSystemCode);

const chatUIManagerPath = path.join(__dirname, '../frontend/lib/chat-ui-manager.js');
const chatUIManagerCode = fs.readFileSync(chatUIManagerPath, 'utf8');
eval(chatUIManagerCode);

// Получаем классы из глобальной области
const { DecentralizedEventSystem, ChatUIManager } = global;

// Инициализируем Web3 из frontend
const web3Path = path.join(__dirname, '../frontend/node_modules/web3');
const Web3Module = require(web3Path);
const Web3 = Web3Module.default || Web3Module;
const web3 = new Web3('https://mainnet.base.org');

// Инициализируем контракт
const contract = new web3.eth.Contract(
    window.CryptoMessengerConfig.contractABI,
    window.CryptoMessengerConfig.contractAddress
);

// Тестовый адрес пользователя
const testUserAddress = '0x1b804e7A8365768a8e554a848C393A522655b947';

console.log('🧪 Тестирование системы пагинации и real-time обновлений');
console.log('📄 Контракт:', window.CryptoMessengerConfig.contractAddress);
console.log('👤 Тестовый пользователь:', testUserAddress);

async function testPaginationSystem() {
    try {
        console.log('\n🚀 Инициализация системы...');
        
        // Инициализируем системы
        const eventSystem = new DecentralizedEventSystem(contract, testUserAddress);
        const chatUIManager = new ChatUIManager(contract, testUserAddress);
        
        console.log('✅ Системы инициализированы');
        
        // Тест 1: Загрузка контактов
        console.log('\n📋 Тест 1: Загрузка контактов');
        const contacts = await contract.methods.getUserContacts(testUserAddress).call();
        console.log(`✅ Найдено контактов: ${contacts.length}`);
        
        if (contacts.length === 0) {
            console.log('⚠️ Нет контактов для тестирования');
            return;
        }
        
        const testContact = contacts[0];
        console.log(`📞 Тестовый контакт: ${testContact}`);
        
        // Тест 2: Загрузка сообщений чата
        console.log('\n💬 Тест 2: Загрузка сообщений чата');
        const messages = await chatUIManager.loadChatMessages(testContact, 50);
        console.log(`✅ Загружено сообщений: ${messages.length}`);
        
        // Тест 3: Статистика чата
        console.log('\n📊 Тест 3: Статистика чата');
        const stats = chatUIManager.getChatStats(testContact);
        console.log('📈 Статистика:', {
            totalMessages: stats.totalMessages,
            loadedMessages: stats.loadedMessages,
            oldestIndex: stats.oldestIndex,
            newestIndex: stats.newestIndex,
            isFullyLoaded: stats.isFullyLoaded
        });
        
        // Тест 4: Загрузка истории (если есть)
        if (stats.totalMessages > stats.loadedMessages) {
            console.log('\n📚 Тест 4: Загрузка истории');
            const historyMessages = await chatUIManager.loadChatHistory(testContact);
            console.log(`✅ Загружено истории: ${historyMessages.length} сообщений`);
            
            // Обновленная статистика
            const updatedStats = chatUIManager.getChatStats(testContact);
            console.log('📈 Обновленная статистика:', {
                totalMessages: updatedStats.totalMessages,
                loadedMessages: updatedStats.loadedMessages,
                isFullyLoaded: updatedStats.isFullyLoaded
            });
        } else {
            console.log('\n📚 Тест 4: Пропущен (вся история уже загружена)');
        }
        
        // Тест 5: Проверка новых сообщений
        console.log('\n🆕 Тест 5: Проверка новых сообщений');
        const newMessages = await chatUIManager.checkForNewMessages(testContact);
        console.log(`✅ Новых сообщений: ${newMessages.length}`);
        
        // Тест 6: Тест подписки на события (заглушка)
        console.log('\n🔔 Тест 6: Подписка на события');
        console.log('⚠️ Подписка на события требует браузерной среды');
        console.log('✅ Тест подписки пропущен (требует браузера)');
        
        console.log('\n🎉 Все тесты завершены успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка тестирования:', error);
        throw error;
    }
}

// Запуск тестов
testPaginationSystem()
    .then(() => {
        console.log('\n✅ Тестирование завершено');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Тестирование провалено:', error);
        process.exit(1);
    });
