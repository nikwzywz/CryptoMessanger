#!/usr/bin/env node

/**
 * Скрипт для вывода ETH со старого контракта
 * Использует функцию withdrawETH() для владельца контракта
 */

const fs = require('fs');
const path = require('path');

// Загружаем Web3 из локального node_modules
const web3Path = path.join(__dirname, '../frontend/node_modules/web3');
const Web3Module = require(web3Path);
const Web3 = Web3Module.default || Web3Module;

// Загружаем переменные окружения из .env файла
let envVars = {};
try {
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        for (const line of lines) {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key.trim()] = value.trim();
            }
        }
        console.log('✅ Переменные окружения загружены из .env файла');
    }
} catch (error) {
    console.warn('⚠️ Не удалось загрузить .env файл:', error.message);
}

// Загружаем конфигурацию из config.js
const configPath = path.join(__dirname, '../frontend/config.js');
const configCode = fs.readFileSync(configPath, 'utf8');

// Создаем глобальный объект window для config.js
global.window = {};

// Выполняем config.js для получения конфигурации
eval(configCode);

const OLD_CONTRACT_ADDRESS = '0xc8F47D1A4018D3e4Df136832d42c479A2C5eB4df';
const BASE_RPC_URL = global.window.CryptoMessengerConfig.network.rpcUrls[0];
const CONTRACT_ABI = global.window.CryptoMessengerConfig.contractABI;

// Инициализация Web3
const web3 = new Web3(BASE_RPC_URL);
const contract = new web3.eth.Contract(CONTRACT_ABI, OLD_CONTRACT_ADDRESS);

// Приватный ключ владельца контракта (из .env)
const OWNER_PRIVATE_KEY = envVars.PRIVATE_KEY_OWNER || envVars.PRIVATE_KEY_01;

if (!OWNER_PRIVATE_KEY) {
    console.error('❌ Не найден PRIVATE_KEY_OWNER или PRIVATE_KEY_01 в .env файле');
    process.exit(1);
}

/**
 * Получает адрес из приватного ключа
 */
function getAddressFromPrivateKey(privateKey) {
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    return account.address;
}

/**
 * Выводит ETH с контракта
 */
async function withdrawETH() {
    try {
        console.log('🚀 Начинаем вывод ETH со старого контракта...');
        
        const ownerAddress = getAddressFromPrivateKey(OWNER_PRIVATE_KEY);
        console.log(`👤 Владелец контракта: ${ownerAddress}`);
        
        // Проверяем баланс контракта
        const contractBalance = await web3.eth.getBalance(OLD_CONTRACT_ADDRESS);
        const balanceInEth = web3.utils.fromWei(contractBalance, 'ether');
        const balanceInUsd = parseFloat(balanceInEth) * 4600; // Фиксированный курс $4600
        
        console.log(`💰 Баланс контракта: ${balanceInEth} ETH ($${balanceInUsd.toFixed(2)})`);
        
        if (contractBalance === '0') {
            console.log('⚠️ На контракте нет ETH для вывода');
            return;
        }
        
        // Проверяем, что мы владелец контракта
        const contractOwner = await contract.methods.contractOwner().call();
        console.log(`👑 Владелец контракта: ${contractOwner}`);
        
        if (contractOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
            console.error(`❌ Ошибка: ${ownerAddress} не является владельцем контракта`);
            return;
        }
        
        // Вызываем функцию withdrawETH
        console.log('💸 Вызываем withdrawETH()...');
        const tx = contract.methods.withdrawETH();
        const estimatedGas = await tx.estimateGas({ from: ownerAddress });
        
        const gasPrice = await web3.eth.getGasPrice();
        const gas = Math.floor(estimatedGas * 1.2); // Добавляем 20% запас
        
        console.log(`⛽ Газ: ${gas} (цена: ${web3.utils.fromWei(gasPrice, 'gwei')} gwei)`);
        
        const signedTx = await web3.eth.accounts.signTransaction({
            from: ownerAddress,
            to: OLD_CONTRACT_ADDRESS,
            data: tx.encodeABI(),
            gas: gas,
            gasPrice: gasPrice
        }, OWNER_PRIVATE_KEY);
        
        console.log('📤 Отправляем транзакцию...');
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        console.log('✅ ETH успешно выведен!');
        console.log(`📄 TX Hash: ${receipt.transactionHash}`);
        console.log(`💰 Выведено: ${balanceInEth} ETH ($${balanceInUsd.toFixed(2)})`);
        
        // Проверяем новый баланс контракта
        const newBalance = await web3.eth.getBalance(OLD_CONTRACT_ADDRESS);
        const newBalanceInEth = web3.utils.fromWei(newBalance, 'ether');
        console.log(`💰 Новый баланс контракта: ${newBalanceInEth} ETH`);
        
    } catch (error) {
        console.error('❌ Ошибка вывода ETH:', error.message);
        if (error.message.includes('revert')) {
            console.log('💡 Возможно, функция withdrawETH не существует в старом контракте');
        }
    }
}

// Запуск скрипта
if (require.main === module) {
    withdrawETH();
}

module.exports = { withdrawETH };
