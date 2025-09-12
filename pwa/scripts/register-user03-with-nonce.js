#!/usr/bin/env node

/**
 * Скрипт для регистрации user03 (Боб) с явным указанием nonce
 */

const fs = require('fs');
const path = require('path');

// Загружаем Web3 из локального node_modules
const web3Path = path.join(__dirname, '../frontend/node_modules/web3');
const Web3Module = require(web3Path);
const Web3 = Web3Module.default || Web3Module;

// Загружаем CryptoJS из локального node_modules
const cryptoJsPath = path.join(__dirname, '../frontend/node_modules/crypto-js');
const CryptoJS = require(cryptoJsPath);

// Загружаем конфигурацию из config.js
const configPath = path.join(__dirname, '../frontend/config.js');
const configCode = fs.readFileSync(configPath, 'utf8');

// Создаем глобальный объект window для config.js
global.window = {};

// Выполняем config.js для получения конфигурации
eval(configCode);

const contractAddress = global.window.CryptoMessengerConfig.contractAddress;
const contractABI = global.window.CryptoMessengerConfig.contractABI;
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
const contract = new web3.eth.Contract(contractABI, contractAddress);

function generateEncryptionKeys(userId, userAddress) {
    const mockSignature = `Mock signature for ${userId} - ${Date.now()}`;
    const seed = CryptoJS.SHA256(mockSignature).toString();
    const privateKeyForEncode = CryptoJS.SHA256(seed + userAddress).toString();
    const publicKeyForEncode = CryptoJS.SHA256(privateKeyForEncode + 'public').toString();
    return { privateKeyForEncode, publicKeyForEncode };
}

async function registerUser03WithNonce() {
    try {
        console.log('📝 Регистрация user03 (Боб) с явным nonce...');
        
        const privateKey = envVars.PRIVATE_KEY_03;
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const address = account.address;
        
        console.log(`👤 Адрес: ${address}`);
        
        // Получаем текущий nonce
        const nonce = await web3.eth.getTransactionCount(address);
        console.log(`🔢 Текущий nonce: ${nonce}`);
        
        // Проверяем, не зарегистрирован ли уже
        const isRegistered = await contract.methods.isUserRegistered(address).call();
        if (isRegistered) {
            console.log(`⚠️  user03 уже зарегистрирован (пропускаем)`);
            return;
        }
        
        // Генерируем ключи шифрования
        const encryptionKeys = generateEncryptionKeys('user03', address);
        const publicKeyHex = '0x' + encryptionKeys.publicKeyForEncode;
        
        console.log(`🔑 Публичный ключ: ${publicKeyHex}`);
        
        // Регистрируем пользователя с явным nonce
        const tx = contract.methods.registerPublicKey(publicKeyHex);
        const gas = await tx.estimateGas({ from: address });
        
        const signedTx = await web3.eth.accounts.signTransaction({
            from: address,
            to: contractAddress,
            data: tx.encodeABI(),
            gas: gas,
            gasPrice: '20000000000',
            nonce: nonce
        }, privateKey);
        
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        console.log(`✅ user03 успешно зарегистрирован!`);
        console.log(`   TX Hash: ${receipt.transactionHash}`);
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed}`);
        
    } catch (error) {
        console.error(`❌ Ошибка регистрации user03: ${error.message}`);
        console.error(`📊 Детали ошибки:`, error);
    }
}

// Запускаем регистрацию
registerUser03WithNonce();
