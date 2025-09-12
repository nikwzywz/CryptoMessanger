#!/usr/bin/env node

/**
 * Скрипт для проверки балансов пользователей
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

const BASE_RPC_URL = global.window.CryptoMessengerConfig.network.rpcUrls[0];

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
const web3 = new Web3(BASE_RPC_URL);

// Пользователи для проверки
const users = [
    { id: 'user02', privateKey: envVars.PRIVATE_KEY_02, name: 'Алиса' },
    { id: 'user03', privateKey: envVars.PRIVATE_KEY_03, name: 'Боб' },
    { id: 'user04', privateKey: envVars.PRIVATE_KEY_04, name: 'Чарли' },
    { id: 'user05', privateKey: envVars.PRIVATE_KEY_05, name: 'Дэвид' }
];

async function checkBalances() {
    console.log('💰 Проверяем балансы пользователей...\n');
    
    for (const user of users) {
        try {
            const account = web3.eth.accounts.privateKeyToAccount(user.privateKey);
            const address = account.address;
            
            const balance = await web3.eth.getBalance(address);
            const balanceEth = web3.utils.fromWei(balance, 'ether');
            
            console.log(`👤 ${user.id} (${user.name}): ${address}`);
            console.log(`   Баланс: ${balanceEth} ETH`);
            console.log(`   Баланс (wei): ${balance}`);
            console.log('');
            
        } catch (error) {
            console.error(`❌ Ошибка для ${user.id}: ${error.message}`);
        }
    }
}

// Запускаем проверку
checkBalances();
