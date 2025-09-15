#!/usr/bin/env node

/**
 * Проверка баланса и транзакций пользователя
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

// Адрес пользователя 02
const user02Address = '0x016b67764012166A8d9Ed3502eA542A061B771f8';

console.log('🔍 Проверка баланса и транзакций пользователя 02');
console.log('📍 Адрес:', user02Address);

async function checkUserBalance() {
    try {
        // 1. Проверяем текущий баланс
        console.log('\n💰 Текущий баланс:');
        const balance = await web3.eth.getBalance(user02Address);
        const balanceInEth = web3.utils.fromWei(balance, 'ether');
        console.log(`   ETH: ${balanceInEth}`);
        
        // 2. Получаем цену ETH в USD
        console.log('\n💱 Получение цены ETH...');
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
            const data = await response.json();
            const ethPrice = data.ethereum.usd;
            const balanceInUsd = parseFloat(balanceInEth) * ethPrice;
            console.log(`   Цена ETH: $${ethPrice}`);
            console.log(`   Баланс в USD: $${balanceInUsd.toFixed(2)}`);
        } catch (error) {
            console.log('   ⚠️ Не удалось получить цену ETH');
        }
        
        // 3. Получаем последние транзакции
        console.log('\n📋 Последние транзакции:');
        const currentBlock = await web3.eth.getBlockNumber();
        const fromBlock = Number(currentBlock) - 1000; // Последние ~1000 блоков
        
        try {
            const events = await web3.eth.getPastLogs({
                address: user02Address,
                fromBlock: fromBlock,
                toBlock: 'latest'
            });
            
            console.log(`   Найдено событий: ${events.length}`);
            
            // Показываем последние 10 транзакций
            const recentTxs = events.slice(-10);
            for (let i = 0; i < recentTxs.length; i++) {
                const tx = recentTxs[i];
                const block = await web3.eth.getBlock(tx.blockNumber);
                const txDetails = await web3.eth.getTransaction(tx.transactionHash);
                
                console.log(`\n   📄 Транзакция ${i + 1}:`);
                console.log(`      Hash: ${tx.transactionHash}`);
                console.log(`      Блок: ${tx.blockNumber}`);
                console.log(`      Время: ${new Date(block.timestamp * 1000).toLocaleString('ru-RU')}`);
                
                if (txDetails) {
                    const value = web3.utils.fromWei(txDetails.value, 'ether');
                    const gasPrice = web3.utils.fromWei(txDetails.gasPrice, 'gwei');
                    console.log(`      Значение: ${value} ETH`);
                    console.log(`      Gas Price: ${gasPrice} gwei`);
                    console.log(`      Gas Limit: ${txDetails.gas}`);
                    console.log(`      To: ${txDetails.to}`);
                }
            }
            
        } catch (error) {
            console.log('   ⚠️ Ошибка получения транзакций:', error.message);
        }
        
        // 4. Проверяем транзакции нашего контракта
        console.log('\n🔍 Транзакции с нашим контрактом:');
        try {
            const contractAddress = '0x0831D41Ca8BDDa2aF6DfBb77B05a2F3B3BA9eC20';
            const contractEvents = await web3.eth.getPastLogs({
                address: contractAddress,
                fromBlock: fromBlock,
                toBlock: 'latest',
                topics: [
                    null, // Любое событие
                    web3.utils.padLeft(user02Address, 64) // user02Address в первом параметре
                ]
            });
            
            console.log(`   Найдено событий с контрактом: ${contractEvents.length}`);
            
            for (let i = 0; i < contractEvents.length; i++) {
                const event = contractEvents[i];
                const block = await web3.eth.getBlock(event.blockNumber);
                const txDetails = await web3.eth.getTransaction(event.transactionHash);
                
                console.log(`\n   📄 Событие ${i + 1}:`);
                console.log(`      Hash: ${event.transactionHash}`);
                console.log(`      Блок: ${event.blockNumber}`);
                console.log(`      Время: ${new Date(block.timestamp * 1000).toLocaleString('ru-RU')}`);
                
                if (txDetails) {
                    const value = web3.utils.fromWei(txDetails.value, 'ether');
                    const gasPrice = web3.utils.fromWei(txDetails.gasPrice, 'gwei');
                    console.log(`      Значение: ${value} ETH`);
                    console.log(`      Gas Price: ${gasPrice} gwei`);
                    console.log(`      Gas Limit: ${txDetails.gas}`);
                }
            }
            
        } catch (error) {
            console.log('   ⚠️ Ошибка получения событий контракта:', error.message);
        }
        
    } catch (error) {
        console.error('❌ Ошибка проверки баланса:', error);
    }
}

// Запуск проверки
checkUserBalance()
    .then(() => {
        console.log('\n✅ Проверка завершена');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Ошибка проверки:', error);
        process.exit(1);
    });
