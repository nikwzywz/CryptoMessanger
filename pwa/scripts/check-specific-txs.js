#!/usr/bin/env node

/**
 * Проверка конкретных транзакций user02
 */

const path = require('path');
const fs = require('fs');

// Загружаем конфигурацию
const configPath = path.join(__dirname, '../frontend/config.js');
const configCode = fs.readFileSync(configPath, 'utf8');

// Создаем глобальные объекты для Node.js
global.window = {};
global.navigator = { onLine: true };

// Выполняем конфигурацию
eval(configCode);

// Инициализируем Web3 из frontend
const web3Path = path.join(__dirname, '../frontend/node_modules/web3');
const Web3Module = require(web3Path);
const Web3 = Web3Module.default || Web3Module;
const web3 = new Web3('https://mainnet.base.org');

// Транзакции user02 из логов
const user02Txs = [
    {
        hash: '0x2a6dd9f5a1d09a54b1cf08516824ef99f1ba693db6ae5e8d2a3e7abe7c674eab',
        description: 'Регистрация user02'
    },
    {
        hash: '0xeb9eccf156855a8246ea5b4dcfdf82cb6aa7b24574bdf8399cfde916d8c3bd2b',
        description: 'Запрос к user03'
    },
    {
        hash: '0xd3265d12714dfe3e512fb318d03d3cc8bb183b0d2e7a981b234578bcfa8e0a3b',
        description: 'Запрос к user04'
    },
    {
        hash: '0xd775dbde87c50b936b58744b3dfd92e3a77cf419063e315d431814225be16b71',
        description: 'Запрос к user05'
    }
];

console.log('🔍 Проверка конкретных транзакций user02');

async function checkTransactions() {
    try {
        let totalGasCost = 0;
        
        for (let i = 0; i < user02Txs.length; i++) {
            const txInfo = user02Txs[i];
            console.log(`\n📄 Транзакция ${i + 1}: ${txInfo.description}`);
            console.log(`   Hash: ${txInfo.hash}`);
            
            try {
                // Получаем детали транзакции
                const tx = await web3.eth.getTransaction(txInfo.hash);
                const receipt = await web3.eth.getTransactionReceipt(txInfo.hash);
                
                if (tx && receipt) {
                    const value = web3.utils.fromWei(tx.value, 'ether');
                    const gasUsed = receipt.gasUsed;
                    const gasPrice = tx.gasPrice;
                    const gasCost = web3.utils.fromWei((gasUsed * gasPrice).toString(), 'ether');
                    
                    totalGasCost += parseFloat(gasCost);
                    
                    console.log(`   ✅ Найдена транзакция`);
                    console.log(`   От: ${tx.from}`);
                    console.log(`   К: ${tx.to}`);
                    console.log(`   Значение: ${value} ETH`);
                    console.log(`   Gas Used: ${gasUsed}`);
                    console.log(`   Gas Price: ${web3.utils.fromWei(gasPrice, 'gwei')} gwei`);
                    console.log(`   Стоимость газа: ${gasCost} ETH`);
                    console.log(`   Статус: ${receipt.status ? '✅ Успешно' : '❌ Ошибка'}`);
                    
                    // Получаем блок для времени
                    const block = await web3.eth.getBlock(receipt.blockNumber);
                    const timestamp = new Date(block.timestamp * 1000);
                    console.log(`   Время: ${timestamp.toLocaleString('ru-RU')}`);
                    console.log(`   Блок: ${receipt.blockNumber}`);
                    
                } else {
                    console.log(`   ❌ Транзакция не найдена или еще не подтверждена`);
                }
                
            } catch (error) {
                console.log(`   ❌ Ошибка получения транзакции: ${error.message}`);
            }
        }
        
        console.log(`\n💰 Общая стоимость газа: ${totalGasCost.toFixed(6)} ETH`);
        
        // Получаем цену ETH для конвертации в USD
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
            const data = await response.json();
            const ethPrice = data.ethereum.usd;
            const totalCostUsd = totalGasCost * ethPrice;
            console.log(`   Цена ETH: $${ethPrice}`);
            console.log(`   Общая стоимость в USD: $${totalCostUsd.toFixed(2)}`);
        } catch (error) {
            console.log('   ⚠️ Не удалось получить цену ETH');
        }
        
    } catch (error) {
        console.error('❌ Ошибка проверки транзакций:', error);
    }
}

// Запуск проверки
checkTransactions()
    .then(() => {
        console.log('\n✅ Проверка завершена');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Ошибка проверки:', error);
        process.exit(1);
    });
