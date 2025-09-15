#!/usr/bin/env node

/**
 * Скрипт для проверки конкретного запроса user02 → user05
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

// Тестовые адреса
const user02 = '0x016b67764012166A8d9Ed3502eA542A061B771f8';
const user05 = '0x78e8d258d29395B4506d838931A5ED2bcBEDE5c3';

async function checkSpecificRequest() {
    console.log('🔍 Проверка конкретного запроса user02 → user05...\n');
    
    try {
        // 1. Проверяем контакты user02
        console.log('1️⃣ Контакты user02:');
        const user02Contacts = await contract.methods.getUserContacts(user02).call();
        console.log(`   Количество контактов: ${user02Contacts.length}`);
        for (let i = 0; i < user02Contacts.length; i++) {
            console.log(`   Контакт ${i + 1}: ${user02Contacts[i]}`);
        }
        
        // 2. Проверяем контакты user05
        console.log('\n2️⃣ Контакты user05:');
        const user05Contacts = await contract.methods.getUserContacts(user05).call();
        console.log(`   Количество контактов: ${user05Contacts.length}`);
        for (let i = 0; i < user05Contacts.length; i++) {
            console.log(`   Контакт ${i + 1}: ${user05Contacts[i]}`);
        }
        
        // 3. Проверяем статус контакта между user02 и user05
        console.log('\n3️⃣ Статус контакта user02 ↔ user05:');
        const isContact02to05 = await contract.methods.checkContact(user02, user05).call();
        const isContact05to02 = await contract.methods.checkContact(user05, user02).call();
        console.log(`   user02 → user05: ${isContact02to05}`);
        console.log(`   user05 → user02: ${isContact05to02}`);
        
        // 4. Проверяем запрос user02 → user05
        console.log('\n4️⃣ Запрос user02 → user05:');
        try {
            const request = await contract.methods.getContactRequest(user05, user02).call();
            console.log(`   Активен: ${request.isActive}`);
            console.log(`   Отправитель: ${request.requesterAddress}`);
            console.log(`   Плата: ${web3.utils.fromWei(request.paymentAmount, 'ether')} ETH`);
            console.log(`   Время: ${new Date(Number(request.requestTimestamp) * 1000).toLocaleString()}`);
        } catch (error) {
            console.log(`   Ошибка получения запроса: ${error.message}`);
        }
        
        // 5. Проверяем запрос user05 → user02
        console.log('\n5️⃣ Запрос user05 → user02:');
        try {
            const request = await contract.methods.getContactRequest(user02, user05).call();
            console.log(`   Активен: ${request.isActive}`);
            console.log(`   Отправитель: ${request.requesterAddress}`);
            console.log(`   Плата: ${web3.utils.fromWei(request.paymentAmount, 'ether')} ETH`);
            console.log(`   Время: ${new Date(Number(request.requestTimestamp) * 1000).toLocaleString()}`);
        } catch (error) {
            console.log(`   Ошибка получения запроса: ${error.message}`);
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

checkSpecificRequest().catch(console.error);
