#!/usr/bin/env node

/**
 * Базовый тест интеграции системы пагинации
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

// Инициализируем Web3 из frontend
const web3Path = path.join(__dirname, '../frontend/node_modules/web3');
const Web3Module = require(web3Path);
const Web3 = Web3Module.default || Web3Module;
const web3 = new Web3('https://mainnet.base.org');

// Инициализируем контракт с новым адресом
const contractAddress = '0x0831D41Ca8BDDa2aF6DfBb77B05a2F3B3BA9eC20';
const contract = new web3.eth.Contract(
    window.CryptoMessengerConfig.contractABI,
    contractAddress
);

// Тестовый адрес пользователя
const testUserAddress = '0x1b804e7A8365768a8e554a848C393A522655b947';

console.log('🧪 Базовый тест интеграции системы пагинации');
console.log('📄 Контракт:', contractAddress);
console.log('👤 Тестовый пользователь:', testUserAddress);

async function testBasicIntegration() {
    try {
        console.log('\n🚀 Тестирование базовой функциональности...');
        
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
        
        // Тест 2: Получение общего количества сообщений
        console.log('\n💬 Тест 2: Получение количества сообщений');
        const result = await contract.methods.getChatMessages(testUserAddress, testContact).call();
        const messageCount = result[0];
        console.log(`✅ Всего сообщений в чате: ${messageCount}`);
        
        // Тест 3: Получение последних сообщений
        if (messageCount > 0) {
            console.log('\n📨 Тест 3: Получение последних сообщений');
            const lastMessages = await contract.methods.getLastChatMessages(testUserAddress, testContact, 10).call();
            console.log(`✅ Получено последних сообщений: ${lastMessages.length}`);
            
            if (lastMessages.length > 0) {
                const firstMessage = lastMessages[0];
                console.log('📄 Пример сообщения:', {
                    encryptedForReader: firstMessage.encryptedForReader.substring(0, 50) + '...',
                    messageTimestamp: firstMessage.messageTimestamp,
                    isOutgoing: firstMessage.isOutgoing
                });
            }
        } else {
            console.log('\n📨 Тест 3: Пропущен (нет сообщений)');
        }
        
        // Тест 4: Пагинация (если есть много сообщений)
        if (messageCount > 20) {
            console.log('\n📄 Тест 4: Пагинация сообщений');
            const pageMessages = await contract.methods.getChatMessagesPaginated(testUserAddress, testContact, 0, 10).call();
            console.log(`✅ Получено сообщений со страницы: ${pageMessages.length}`);
        } else {
            console.log('\n📄 Тест 4: Пропущен (мало сообщений для пагинации)');
        }
        
        // Тест 5: Проверка структуры данных
        console.log('\n🔍 Тест 5: Проверка структуры данных');
        console.log('✅ ABI контракта загружен:', window.CryptoMessengerConfig.contractABI.length, 'функций');
        console.log('✅ Адрес контракта:', window.CryptoMessengerConfig.contractAddress);
        console.log('✅ Сеть:', window.CryptoMessengerConfig.network);
        
        console.log('\n🎉 Все базовые тесты завершены успешно!');
        console.log('\n📊 Результаты:');
        console.log(`   📋 Контакты: ${contacts.length}`);
        console.log(`   💬 Сообщения: ${messageCount}`);
        console.log(`   📄 ABI функции: ${window.CryptoMessengerConfig.contractABI.length}`);
        
    } catch (error) {
        console.error('❌ Ошибка тестирования:', error);
        throw error;
    }
}

// Запуск тестов
testBasicIntegration()
    .then(() => {
        console.log('\n✅ Базовое тестирование завершено');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Базовое тестирование провалено:', error);
        process.exit(1);
    });
