#!/usr/bin/env node

/**
 * Скрипт для диагностики проблемы с отправкой сообщений
 */

const path = require('path');
const fs = require('fs');

// Загружаем конфигурацию
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../frontend/config.js'), 'utf8'));

const Web3 = require(path.join(__dirname, '../frontend/node_modules/web3')).default || require(path.join(__dirname, '../frontend/node_modules/web3'));
const web3 = new Web3(window.CryptoMessengerConfig.network.rpcUrls[0]);
const contractAddress = window.CryptoMessengerConfig.contractAddress;
const contract = new web3.eth.Contract(window.CryptoMessengerConfig.contractABI, contractAddress);

// Тестовые адреса (user02 и user03 уже в контактах друг друга)
const user02 = '0x016b67764012166A8d9Ed3502eA542A061B771f8';
const user03 = '0x1b804e7A8365768a8e554a848C393A522655b947';

async function debugSendMessage() {
    console.log('🔍 Диагностика проблемы с отправкой сообщений...\n');
    
    try {
        // 1. Проверяем регистрацию пользователей
        console.log('1️⃣ Проверка регистрации:');
        const user02Registered = await contract.methods.isUserRegistered(user02).call();
        const user03Registered = await contract.methods.isUserRegistered(user03).call();
        console.log(`   user02 зарегистрирован: ${user02Registered}`);
        console.log(`   user03 зарегистрирован: ${user03Registered}`);
        
        // 2. Проверяем контакты
        console.log('\n2️⃣ Проверка контактов:');
        const isContact02to03 = await contract.methods.checkContact(user02, user03).call();
        const isContact03to02 = await contract.methods.checkContact(user03, user02).call();
        console.log(`   user02 → user03: ${isContact02to03}`);
        console.log(`   user03 → user02: ${isContact03to02}`);
        
        // 3. Проверяем размер зашифрованных данных
        console.log('\n3️⃣ Проверка размера данных:');
        const testMessage = "Привет! Это тестовое сообщение";
        const encryptedForRecipient = web3.utils.utf8ToHex(`RECIPIENT:${testMessage}`);
        const encryptedForSender = web3.utils.utf8ToHex(`SENDER:${testMessage}`);
        
        console.log(`   Исходное сообщение: "${testMessage}" (${testMessage.length} символов)`);
        console.log(`   encryptedForRecipient: ${encryptedForRecipient.length} байт`);
        console.log(`   encryptedForSender: ${encryptedForSender.length} байт`);
        
        // 4. Пробуем оценить газ с разными размерами данных
        console.log('\n4️⃣ Оценка газа:');
        
        // Короткое сообщение
        const shortMessage = "Hi";
        const shortEncryptedForRecipient = web3.utils.utf8ToHex(`RECIPIENT:${shortMessage}`);
        const shortEncryptedForSender = web3.utils.utf8ToHex(`SENDER:${shortMessage}`);
        
        try {
            const shortGasEstimate = await contract.methods.sendMessage(
                user03,
                shortEncryptedForRecipient,
                shortEncryptedForSender
            ).estimateGas({ from: user02 });
            console.log(`   Короткое сообщение: ${shortGasEstimate} gas`);
        } catch (error) {
            console.log(`   Короткое сообщение: ОШИБКА - ${error.message}`);
        }
        
        // Длинное сообщение
        const longMessage = "A".repeat(1000); // 1000 символов
        const longEncryptedForRecipient = web3.utils.utf8ToHex(`RECIPIENT:${longMessage}`);
        const longEncryptedForSender = web3.utils.utf8ToHex(`SENDER:${longMessage}`);
        
        try {
            const longGasEstimate = await contract.methods.sendMessage(
                user03,
                longEncryptedForRecipient,
                longEncryptedForSender
            ).estimateGas({ from: user02 });
            console.log(`   Длинное сообщение (1000 символов): ${longGasEstimate} gas`);
        } catch (error) {
            console.log(`   Длинное сообщение: ОШИБКА - ${error.message}`);
        }
        
        // 5. Проверяем текущую цену газа
        console.log('\n5️⃣ Цена газа:');
        const gasPrice = await web3.eth.getGasPrice();
        console.log(`   Текущая цена: ${web3.utils.fromWei(gasPrice, 'gwei')} gwei`);
        
        // 6. Проверяем баланс пользователя
        console.log('\n6️⃣ Баланс пользователя:');
        const balance = await web3.eth.getBalance(user02);
        console.log(`   user02 баланс: ${web3.utils.fromWei(balance, 'ether')} ETH`);
        
    } catch (error) {
        console.error('❌ Ошибка диагностики:', error.message);
    }
}

debugSendMessage().catch(console.error);
