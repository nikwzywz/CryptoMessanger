#!/usr/bin/env node

/**
 * Скрипт для проверки статуса пользователей в контракте
 */

const fs = require('fs');
const path = require('path');

// Загружаем Web3 из локального node_modules
const web3Path = path.join(__dirname, '../frontend/node_modules/web3');
const Web3Module = require(web3Path);
const Web3 = Web3Module.default || Web3Module;

// Загружаем конфигурацию из config.js
const configPath = path.join(__dirname, '../frontend/config.js');
const configCode = fs.readFileSync(configPath, 'utf8');

// Создаем глобальный объект window для config.js
global.window = {};

// Выполняем config.js для получения конфигурации
eval(configCode);

const contractAddress = global.window.CryptoMessengerConfig.contractAddress;
const contractABI = global.window.CryptoMessengerConfig.contractABI;

// Загружаем переменные окружения
let envVars = {};
try {
    const envPath = path.join(__dirname, '../../.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            envVars[key.trim()] = value.trim();
        }
    });
} catch (error) {
    console.error('❌ Ошибка загрузки .env:', error.message);
    process.exit(1);
}

// Настройка Web3
const BASE_RPC_URL = 'https://mainnet.base.org';
const web3 = new Web3(BASE_RPC_URL);
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Тестовые пользователи
const testUsers = {
    user02: { privateKey: envVars.PRIVATE_KEY_02, name: 'Алиса' },
    user03: { privateKey: envVars.PRIVATE_KEY_03, name: 'Боб' },
    user04: { privateKey: envVars.PRIVATE_KEY_04, name: 'Чарли' },
    user05: { privateKey: envVars.PRIVATE_KEY_05, name: 'Дэвид' }
};

// Функция для паузы
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для вызова контракта с таймаутом
async function callWithTimeout(contractMethod, timeout = 10000) {
    return Promise.race([
        contractMethod.call(),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
        )
    ]);
}

async function checkUserStatus() {
    console.log('🔍 Проверяем статус пользователей в контракте...\n');
    
    for (const [userId, userData] of Object.entries(testUsers)) {
        try {
            console.log(`⏳ Обрабатываем ${userId}...`);
            
            const account = web3.eth.accounts.privateKeyToAccount(userData.privateKey);
            const address = account.address;
            
            console.log(`👤 ${userId} (${userData.name}): ${address}`);
            
            // Проверяем, зарегистрирован ли пользователь
            console.log('   🔍 Проверяем регистрацию...');
            const isRegistered = await callWithTimeout(contract.methods.isUserRegistered(address));
            console.log(`   Зарегистрирован: ${isRegistered ? '✅ Да' : '❌ Нет'}`);
            
            if (isRegistered) {
                // Пауза между вызовами
                console.log('   ⏸️ Пауза 2 секунды между вызовами...');
                await sleep(2000);
                
                // Получаем публичный ключ
                console.log('   🔑 Получаем публичный ключ...');
                const publicKey = await callWithTimeout(contract.methods.userPublicKeys(address));
                console.log(`   Публичный ключ: ${publicKey.substring(0, 20)}...`);
                
                // Пауза между вызовами
                console.log('   ⏸️ Пауза 2 секунды между вызовами...');
                await sleep(2000);
                
                // Получаем настройки пользователя
                console.log('   ⚙️ Получаем настройки...');
                const settings = await callWithTimeout(contract.methods.userSettings(address));
                console.log(`   Плата за запрос: ${web3.utils.fromWei(settings.contactRequestFee, 'ether')} ETH`);
            }
            
            console.log('   ✅ Готово!\n');
            
            // Пауза между пользователями
            console.log('⏸️ Пауза 5 секунд...\n');
            await sleep(5000);
            
        } catch (error) {
            console.error(`❌ Ошибка для ${userId}: ${error.message}`);
            console.log('⏸️ Пауза 10 секунд перед следующим пользователем...\n');
            await sleep(10000);
        }
    }
    
    console.log('🎉 Проверка завершена!');
}

// Запускаем проверку
checkUserStatus();
