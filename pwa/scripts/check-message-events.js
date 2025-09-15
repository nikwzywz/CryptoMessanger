#!/usr/bin/env node

/**
 * Скрипт для проверки событий MessageSent
 * Ищет сообщения в событиях блокчейна
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

// Реальные адреса пользователей
const testUsers = {
    user02: '0x016b67764012166A8d9Ed3502eA542A061B771f8',
    user03: '0x1b804e7A8365768a8e554a848C393A522655b947',
    user05: '0x78e8d258d29395B4506d838931A5ED2bcBEDE5c3'
};

async function checkMessageEvents() {
    console.log('🔍 Поиск событий MessageSent...\n');
    
    try {
        // Получаем текущий блок
        const currentBlock = await web3.eth.getBlockNumber();
        console.log(`📦 Текущий блок: ${currentBlock}`);
        
        // Ищем события за последние 1000 блоков
        const fromBlock = Number(currentBlock) - 1000;
        console.log(`🔍 Поиск с блока: ${fromBlock}`);
        
        // Получаем события MessageSent
        const events = await contract.getPastEvents('MessageSent', {
            fromBlock: fromBlock,
            toBlock: 'latest'
        });
        
        console.log(`📨 Найдено событий MessageSent: ${events.length}\n`);
        
        if (events.length > 0) {
            for (let i = 0; i < Math.min(events.length, 10); i++) {
                const event = events[i];
                console.log(`📨 Событие ${i + 1}:`);
                console.log(`   Блок: ${event.blockNumber}`);
                console.log(`   Отправитель: ${event.returnValues.sender}`);
                console.log(`   Получатель: ${event.returnValues.recipient}`);
                console.log(`   Время: ${new Date(Number(event.returnValues.timestamp) * 1000).toLocaleString()}`);
                console.log(`   TX Hash: ${event.transactionHash}`);
                console.log('');
            }
        } else {
            console.log('❌ События MessageSent не найдены');
            console.log('💡 Возможно, сообщения не были отправлены или отправлены в другом формате');
        }
        
    } catch (error) {
        console.error('❌ Ошибка при поиске событий:', error.message);
    }
}

checkMessageEvents().catch(console.error);
