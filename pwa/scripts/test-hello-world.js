#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки функции helloWorld
 * Проверяет, что Web3 вызовы работают корректно
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

if (!contractAddress || !contractABI) {
    console.error('❌ Не удалось загрузить адрес контракта или ABI из config.js');
    process.exit(1);
}

console.log('🔧 Конфигурация загружена:');
console.log(`   Контракт: ${contractAddress}`);
console.log(`   ABI функций: ${contractABI.filter(item => item.type === 'function').length}`);

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
    console.log('✅ Переменные окружения загружены');
} catch (error) {
    console.error('❌ Ошибка загрузки .env:', error.message);
    process.exit(1);
}

// Настройка Web3
const BASE_RPC_URL = 'https://mainnet.base.org';
const web3 = new Web3(BASE_RPC_URL);
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Тестовый приватный ключ
const PRIVATE_KEY_02 = envVars.PRIVATE_KEY_02;
if (!PRIVATE_KEY_02) {
    console.error('❌ PRIVATE_KEY_02 не найден в .env');
    process.exit(1);
}

async function testHelloWorld() {
    try {
        console.log('\n🧪 Тестируем функцию helloWorld...');
        
        // Получаем адрес из приватного ключа
        const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY_02);
        const address = account.address;
        
        console.log(`👤 Тестовый аккаунт: ${address}`);
        
        // Вызываем функцию helloWorld
        console.log('📞 Вызываем contract.methods.helloWorld().call()...');
        const result = await contract.methods.helloWorld().call({ from: address });
        
        console.log('✅ Функция helloWorld вызвана успешно!');
        console.log(`📤 Результат: ${result}`);
        console.log(`🔍 Ожидаемый адрес: ${address}`);
        console.log(`✅ Адреса совпадают: ${result.toLowerCase() === address.toLowerCase()}`);
        
        if (result.toLowerCase() === address.toLowerCase()) {
            console.log('🎉 ТЕСТ ПРОЙДЕН! Web3 вызовы работают корректно!');
        } else {
            console.log('❌ ТЕСТ НЕ ПРОЙДЕН! Адреса не совпадают!');
        }
        
    } catch (error) {
        console.error('❌ Ошибка при вызове helloWorld:', error.message);
        console.error('📊 Детали ошибки:', error);
    }
}

// Запускаем тест
testHelloWorld();
