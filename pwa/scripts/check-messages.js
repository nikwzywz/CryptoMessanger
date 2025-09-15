#!/usr/bin/env node

/**
 * Скрипт для проверки сообщений в блокчейне
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

const CONTRACT_ADDRESS = global.window.CryptoMessengerConfig.contractAddress;
const CONTRACT_ABI = global.window.CryptoMessengerConfig.contractABI;
const BASE_RPC_URL = global.window.CryptoMessengerConfig.network.rpcUrls[0];

// Альтернативные RPC endpoints (актуальные рабочие)
const RPC_ENDPOINTS = [
    'https://base-rpc.publicnode.com',           // 0.157s
    'https://base.api.onfinality.io/public',     // 0.194s
    'https://base.therpc.io',                    // 0.213s
    'https://mainnet.base.org',                  // 0.209s - официальный
    'https://base.drpc.org',                     // 0.255s
    'https://base.lava.build',                   // 0.267s
    'https://api.zan.top/base-mainnet',          // 0.298s
    'https://base.public.blockpi.network/v1/rpc/public', // 0.299s
    'https://1rpc.io/base',                      // 0.229s
    'https://base.rpc.subquery.network/public'   // 0.097s - самый быстрый (но иногда нестабильный)
];

// Инициализация Web3 и контракта
let web3;
let contract;

// Адреса пользователей из тестовых данных
const user02 = '0x016b67764012166A8d9Ed3502eA542A061B771f8';
const user05 = '0x1b804e7A8365768a8e554a848C393A522655b947';

async function initializeWeb3() {
    // Пробуем разные RPC endpoints
    for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
        try {
            console.log(`🔄 Пробуем RPC ${i + 1}: ${RPC_ENDPOINTS[i]}`);
            web3 = new Web3(RPC_ENDPOINTS[i]);
            contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
            
            // Тестируем подключение
            await web3.eth.getBlockNumber();
            console.log(`✅ RPC ${i + 1} работает!`);
            return true;
        } catch (error) {
            console.log(`❌ RPC ${i + 1} недоступен: ${error.message}`);
            if (i === RPC_ENDPOINTS.length - 1) {
                throw new Error('Все RPC endpoints недоступны');
            }
        }
    }
}

async function checkMessages() {
    console.log('🔍 Проверяем сообщения в блокчейне...');
    console.log(`📋 Контракт: ${CONTRACT_ADDRESS}`);
    console.log(`👤 user02: ${user02}`);
    console.log(`👤 user05: ${user05}`);
    
    try {
        // Инициализируем Web3
        await initializeWeb3();
        // Получаем текущий блок
        const currentBlock = await web3.eth.getBlockNumber();
        console.log(`📊 Текущий блок: ${currentBlock}`);
        
        // Используем указанный диапазон блоков где были отправлены сообщения
        const fromBlock = 35464000;
        const toBlock = 35464999;
        console.log(`📊 Диапазон блоков: ${fromBlock} - ${toBlock}`);
        
        // Получаем события MessageSent
        console.log('\n📨 Загружаем события MessageSent...');
        const messageEvents = await contract.getPastEvents('MessageSent', {
            fromBlock: fromBlock,
            toBlock: toBlock
        });
        
        console.log(`📊 Всего событий MessageSent: ${messageEvents.length}`);
        
        // Фильтруем сообщения между user02 и user05
        // В Web3.js indexed параметры находятся в topics, а не в returnValues
        const chatMessages = messageEvents.filter(event => {
            // topics[0] = event signature
            // topics[1] = from (sender) - indexed
            // topics[2] = to (recipient) - indexed
            const senderAddress = event.topics[1] ? '0x' + event.topics[1].slice(26) : null;
            const recipientAddress = event.topics[2] ? '0x' + event.topics[2].slice(26) : null;
            
            // Сравниваем в нижнем регистре для точности
            const isMatch = (senderAddress?.toLowerCase() === user02.toLowerCase() && recipientAddress?.toLowerCase() === user05.toLowerCase()) ||
                           (senderAddress?.toLowerCase() === user05.toLowerCase() && recipientAddress?.toLowerCase() === user02.toLowerCase());
            
            return isMatch;
        });
        
        console.log(`💬 Сообщений между user02 и user05: ${chatMessages.length}`);
        
        if (chatMessages.length > 0) {
            console.log('\n📋 Детали сообщений между user02 и user05:');
            chatMessages.forEach((event, index) => {
                // Извлекаем данные из topics и raw data
                const sender = event.topics[1] ? '0x' + event.topics[1].slice(26) : null;
                const recipient = event.topics[2] ? '0x' + event.topics[2].slice(26) : null;
                const encryptedMessage = event.returnValues.encryptedData || 'N/A';
                const timestamp = event.returnValues.timestamp ? new Date(parseInt(event.returnValues.timestamp) * 1000) : new Date();
                const blockNumber = event.blockNumber;
                const txHash = event.transactionHash;
                
                console.log(`   ${index + 1}. ${sender === user02 ? 'user02' : 'user05'} → ${recipient === user02 ? 'user02' : 'user05'}`);
                console.log(`      Зашифровано: ${encryptedMessage.slice(0, 30)}...`);
                console.log(`      Время: ${timestamp.toLocaleString()}`);
                console.log(`      Блок: ${blockNumber}`);
                console.log(`      TX: ${txHash}`);
                console.log('');
            });
        } else {
            console.log('❌ Сообщения между user02 и user05 не найдены');
        }
        
        // Показываем все сообщения для анализа
        console.log('\n📋 Все найденные сообщения:');
        messageEvents.forEach((event, index) => {
            const sender = event.topics[1] ? '0x' + event.topics[1].slice(26) : 'N/A';
            const recipient = event.topics[2] ? '0x' + event.topics[2].slice(26) : 'N/A';
            console.log(`   ${index + 1}. ${sender} → ${recipient}`);
            console.log(`      Блок: ${event.blockNumber}, TX: ${event.transactionHash}`);
        });
        
        // Проверяем все сообщения
        console.log('\n📊 Статистика всех сообщений:');
        const allMessages = messageEvents.map(event => ({
            sender: event.topics[1] ? '0x' + event.topics[1].slice(26) : 'N/A',
            recipient: event.topics[2] ? '0x' + event.topics[2].slice(26) : 'N/A',
            timestamp: event.returnValues.timestamp ? new Date(parseInt(event.returnValues.timestamp) * 1000) : new Date()
        }));
        
        // Группируем по парам пользователей
        const chatPairs = {};
        allMessages.forEach(msg => {
            const pair = [msg.sender, msg.recipient].sort().join(' ↔ ');
            if (!chatPairs[pair]) {
                chatPairs[pair] = 0;
            }
            chatPairs[pair]++;
        });
        
        Object.entries(chatPairs).forEach(([pair, count]) => {
            console.log(`   ${pair}: ${count} сообщений`);
        });
        
    } catch (error) {
        console.error('❌ Ошибка при проверке сообщений:', error);
    }
}

// Запуск скрипта
if (require.main === module) {
    checkMessages();
}

module.exports = { checkMessages };
