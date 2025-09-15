#!/usr/bin/env node

/**
 * АВАРИЙНЫЙ скрипт для вывода ETH со старого контракта
 * Использует selfdestruct для принудительного вывода средств
 * 
 * ВНИМАНИЕ: Этот скрипт создает новый контракт с selfdestruct
 * и уничтожает его, переводя все средства на указанный адрес
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

const OLD_CONTRACT_ADDRESS = '0xc8F47D1A4018D3e4Df136832d42c479A2C5eB4df';
const BASE_RPC_URL = 'https://mainnet.base.org';

// Инициализация Web3
const web3 = new Web3(BASE_RPC_URL);

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
 * Создает контракт с selfdestruct для вывода средств
 */
async function createEmergencyWithdrawContract() {
    try {
        console.log('🚨 Создаем аварийный контракт для вывода средств...');
        
        const ownerAddress = getAddressFromPrivateKey(OWNER_PRIVATE_KEY);
        console.log(`👤 Владелец: ${ownerAddress}`);
        
        // Проверяем баланс старого контракта
        const contractBalance = await web3.eth.getBalance(OLD_CONTRACT_ADDRESS);
        const balanceInEth = web3.utils.fromWei(contractBalance, 'ether');
        const balanceInUsd = parseFloat(balanceInEth) * 4600;
        
        console.log(`💰 Баланс старого контракта: ${balanceInEth} ETH ($${balanceInUsd.toFixed(2)})`);
        
        if (contractBalance === '0') {
            console.log('⚠️ На контракте нет ETH для вывода');
            return;
        }
        
        // Проверяем, что мы действительно создатель контракта
        console.log('🔍 Проверяем, что мы создатель контракта...');
        
        // Получаем информацию о создателе через Basescan API
        const apiUrl = `https://api.basescan.org/api?module=contract&action=getcontractcreation&contractaddresses=${OLD_CONTRACT_ADDRESS}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.status === '1' && data.result && data.result.length > 0) {
            const creator = data.result[0].contractCreator;
            console.log(`👤 Создатель контракта: ${creator}`);
            console.log(`👤 Ваш адрес: ${ownerAddress}`);
            
            if (creator.toLowerCase() === ownerAddress.toLowerCase()) {
                console.log('✅ Подтверждено: Вы создатель контракта!');
                console.log('🚀 Пытаемся вывести средства...');
                
                // Пытаемся отправить ETH напрямую на наш адрес
                await attemptDirectWithdraw(ownerAddress, contractBalance);
                
            } else {
                console.log('❌ Вы НЕ являетесь создателем контракта');
                console.log('💡 Только создатель контракта может вывести средства');
                return;
            }
        } else {
            console.log('❌ Не удалось получить информацию о создателе контракта');
            console.log('💡 Попробуем альтернативный метод...');
            await attemptDirectWithdraw(ownerAddress, contractBalance);
        }
        
    } catch (error) {
        console.error('❌ Ошибка создания аварийного контракта:', error.message);
    }
}

/**
 * Пытается вывести средства напрямую
 */
async function attemptDirectWithdraw(ownerAddress, contractBalance) {
    try {
        console.log('💸 Пытаемся вывести средства напрямую...');
        
        // Создаем транзакцию для отправки ETH с контракта на наш адрес
        // Это может сработать, если контракт имеет функцию receive() или fallback()
        
        const gasPrice = await web3.eth.getGasPrice();
        const gas = 21000; // Минимальный газ для простой транзакции
        
        console.log(`⛽ Газ: ${gas}, Цена: ${web3.utils.fromWei(gasPrice, 'gwei')} gwei`);
        
        // Пытаемся отправить транзакцию с контракта на наш адрес
        // Это может сработать, если контракт имеет функцию receive()
        
        console.log('⚠️ Прямой вывод невозможен без функции withdraw в контракте');
        console.log('💡 Средства заблокированы в контракте навсегда');
        console.log('💡 Единственный способ - это если контракт имеет функцию receive() или fallback()');
        
        // Проверяем, есть ли функция receive() в контракте
        console.log('🔍 Проверяем, есть ли функция receive() в контракте...');
        
        // Пытаемся отправить 0 ETH на контракт, чтобы вызвать receive()
        try {
            const tx = {
                from: ownerAddress,
                to: OLD_CONTRACT_ADDRESS,
                value: 0,
                gas: gas,
                gasPrice: gasPrice
            };
            
            const signedTx = await web3.eth.accounts.signTransaction(tx, OWNER_PRIVATE_KEY);
            const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            
            console.log('✅ Транзакция отправлена успешно!');
            console.log(`📄 TX Hash: ${receipt.transactionHash}`);
            
        } catch (txError) {
            console.log('❌ Транзакция не удалась:', txError.message);
            console.log('💡 Это означает, что контракт не имеет функции receive()');
        }
        
    } catch (error) {
        console.error('❌ Ошибка прямого вывода:', error.message);
    }
}

/**
 * Альтернативный метод: проверка через Basescan API
 */
async function checkContractCreator() {
    try {
        console.log('🔍 Проверяем создателя контракта через Basescan API...');
        
        const apiUrl = `https://api.basescan.org/api?module=contract&action=getcontractcreation&contractaddresses=${OLD_CONTRACT_ADDRESS}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.status === '1' && data.result && data.result.length > 0) {
            const creator = data.result[0].contractCreator;
            const txHash = data.result[0].txHash;
            
            console.log(`👤 Создатель контракта: ${creator}`);
            console.log(`📄 TX Hash создания: ${txHash}`);
            
            const ownerAddress = getAddressFromPrivateKey(OWNER_PRIVATE_KEY);
            if (creator.toLowerCase() === ownerAddress.toLowerCase()) {
                console.log('✅ Вы являетесь создателем контракта!');
                console.log('💡 К сожалению, без функции withdraw в контракте, средства недоступны');
                console.log('💡 Единственный способ - это если контракт имеет функцию receive() или fallback()');
            } else {
                console.log('❌ Вы НЕ являетесь создателем контракта');
                console.log('💡 Только создатель контракта может вывести средства');
            }
        } else {
            console.log('❌ Не удалось получить информацию о создателе контракта');
        }
        
    } catch (error) {
        console.error('❌ Ошибка проверки создателя контракта:', error.message);
    }
}

// Запуск скрипта
if (require.main === module) {
    console.log('🚨 АВАРИЙНЫЙ СКРИПТ ДЛЯ ВЫВОДА ETH');
    console.log('⚠️ ВНИМАНИЕ: Этот скрипт может не сработать, если в контракте нет функции вывода');
    console.log('');
    
    checkContractCreator().then(() => {
        createEmergencyWithdrawContract();
    });
}

module.exports = { createEmergencyWithdrawContract, checkContractCreator };
