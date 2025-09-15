#!/usr/bin/env node

/**
 * Скрипт для проверки запросов на добавление в контакты
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
const testUsers = {
    user02: '0x016b67764012166A8d9Ed3502eA542A061B771f8',
    user03: '0x1b804e7A8365768a8e554a848C393A522655b947',
    user04: '0x2c915e7B8365768a8e554a848C393A522655b948',
    user05: '0x78e8d258d29395B4506d838931A5ED2bcBEDE5c3'
};

async function checkContactRequests() {
    console.log('🔍 Проверка запросов на добавление в контакты...\n');
    
    for (const [userId, userAddress] of Object.entries(testUsers)) {
        console.log(`👤 ${userId}: ${userAddress}`);
        
        try {
            // Проверяем входящие запросы
            const incomingRequests = await contract.methods.getUserContacts(userAddress).call();
            console.log(`   📥 Входящие запросы: ${incomingRequests.length}`);
            
            // Проверяем исходящие запросы
            const outgoingRequests = await contract.methods.getUserContacts(userAddress).call();
            console.log(`   📤 Исходящие запросы: ${outgoingRequests.length}`);
            
            // Проверяем контакты
            const contacts = await contract.methods.getUserContacts(userAddress).call();
            console.log(`   📞 Контакты: ${contacts.length}`);
            
            // Проверяем конкретные запросы
            for (const [otherUserId, otherUserAddress] of Object.entries(testUsers)) {
                if (userId === otherUserId) continue;
                
                try {
                    const request = await contract.methods.getContactRequest(userAddress, otherUserAddress).call();
                    if (request.isActive) {
                        console.log(`   📨 Активный запрос от ${otherUserId}: ${request.requesterAddress}`);
                        console.log(`      Плата: ${web3.utils.fromWei(request.paymentAmount, 'ether')} ETH`);
                        console.log(`      Время: ${new Date(Number(request.requestTimestamp) * 1000).toLocaleString()}`);
                    }
                } catch (error) {
                    // Игнорируем ошибки для несуществующих запросов
                }
            }
            
        } catch (error) {
            console.log(`   ❌ Ошибка: ${error.message}`);
        }
        
        console.log('');
    }
}

checkContactRequests().catch(console.error);
