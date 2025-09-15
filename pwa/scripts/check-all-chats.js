#!/usr/bin/env node

/**
 * Скрипт для проверки всех чатов пользователя
 * Проверяет все контакты и их сообщения
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

// Реальные адреса пользователей из предыдущих запусков
const testUsers = {
    user02: '0x016b67764012166A8d9Ed3502eA542A061B771f8',
    user03: '0x1b804e7A8365768a8e554a848C393A522655b947',
    user04: '0x2c915e7B8365768a8e554a848C393A522655b948',
    user05: '0x78e8d258d29395B4506d838931A5ED2bcBEDE5c3'
};

async function checkAllChats() {
    console.log('🔍 Проверка всех чатов пользователей...\n');
    
    for (const [userId, userAddress] of Object.entries(testUsers)) {
        console.log(`👤 ${userId}: ${userAddress}`);
        
        try {
            // Получаем контакты
            const contacts = await contract.methods.getUserContacts(userAddress).call();
            console.log(`   📞 Контактов: ${contacts.length}`);
            
            for (const contactAddress of contacts) {
                console.log(`   📞 Контакт: ${contactAddress}`);
                
                // Получаем количество сообщений
                const messageCount = await contract.methods.getChatMessages(userAddress, contactAddress).call();
                console.log(`      💬 Сообщений: ${messageCount[0]}`);
                
                if (messageCount[0] > 0) {
                    // Получаем последние 5 сообщений
                    const lastMessages = await contract.methods.getLastChatMessages(userAddress, contactAddress, 5).call();
                    console.log(`      📨 Последние сообщения: ${lastMessages.length}`);
                    
                    for (let i = 0; i < lastMessages.length; i++) {
                        const msg = lastMessages[i];
                        console.log(`         ${i + 1}. Время: ${new Date(Number(msg.messageTimestamp) * 1000).toLocaleString()}`);
                        console.log(`            Исходящее: ${msg.isOutgoing}`);
                        console.log(`            Данные: ${msg.encryptedForReader.substring(0, 50)}...`);
                    }
                }
            }
            
        } catch (error) {
            console.log(`   ❌ Ошибка: ${error.message}`);
        }
        
        console.log('');
    }
}

checkAllChats().catch(console.error);
