#!/usr/bin/env node

/**
 * Скрипт для получения актуальной цены газа в сети Base
 * Версия: 1.0.0
 * Дата: 2025-01-12
 */

const Web3 = require('../frontend/node_modules/web3').default;
const fs = require('fs');

// Загружаем конфигурацию
const configPath = 'frontend/config.js';
const configCode = fs.readFileSync(configPath, 'utf8');

// Создаем глобальный объект window для eval
global.window = {};
eval(configCode);

const config = global.window.CryptoMessengerConfig;

// Проверяем, что конфигурация загружена
if (!config || !config.network) {
    console.error('❌ Ошибка загрузки конфигурации');
    console.log('Доступные свойства:', Object.keys(global.window));
    process.exit(1);
}

console.log('🔍 Получение актуальной цены газа в сети Base...');
console.log('🌐 RPC URL:', config.network.rpcUrls[0]);

async function getGasPrice() {
    try {
        // Создаем экземпляр Web3
        const web3 = new Web3(config.network.rpcUrls[0]);
        
        console.log('\n📊 Получаем цену газа из сети...');
        
        // Получаем цену газа
        const gasPrice = await web3.eth.getGasPrice();
        const gasPriceGwei = web3.utils.fromWei(gasPrice, 'gwei');
        const gasPriceEth = web3.utils.fromWei(gasPrice, 'ether');
        
        console.log('✅ Цена газа получена:');
        console.log(`   Wei: ${gasPrice}`);
        console.log(`   Gwei: ${parseFloat(gasPriceGwei).toFixed(6)}`);
        console.log(`   ETH: ${parseFloat(gasPriceEth).toFixed(12)}`);
        
        // Получаем информацию о блоке
        console.log('\n📦 Информация о последнем блоке:');
        const blockNumber = await web3.eth.getBlockNumber();
        const block = await web3.eth.getBlock(blockNumber);
        
        console.log(`   Номер блока: ${blockNumber}`);
        console.log(`   Время блока: ${new Date(Number(block.timestamp) * 1000).toLocaleString()}`);
        console.log(`   Gas Limit блока: ${block.gasLimit}`);
        console.log(`   Gas Used: ${block.gasUsed}`);
        console.log(`   Процент использования: ${((Number(block.gasUsed) / Number(block.gasLimit)) * 100).toFixed(2)}%`);
        
        // Получаем информацию о сети
        console.log('\n🌐 Информация о сети:');
        const networkId = await web3.eth.net.getId();
        const chainId = await web3.eth.getChainId();
        
        console.log(`   Network ID: ${networkId}`);
        console.log(`   Chain ID: ${chainId}`);
        
        // Проверяем подключение
        const isConnected = await web3.eth.isSyncing();
        console.log(`   Синхронизация: ${isConnected === false ? '✅ Синхронизирована' : '⏳ В процессе'}`);
        
        // Рекомендации по цене газа
        console.log('\n💡 Рекомендации:');
        const currentGwei = parseFloat(gasPriceGwei);
        
        if (currentGwei < 0.01) {
            console.log('   🟢 Очень низкая цена газа - отличное время для транзакций');
        } else if (currentGwei < 0.05) {
            console.log('   🟡 Низкая цена газа - хорошее время для транзакций');
        } else if (currentGwei < 0.1) {
            console.log('   🟠 Средняя цена газа - приемлемо для транзакций');
        } else {
            console.log('   🔴 Высокая цена газа - рассмотрите ожидание');
        }
        
        // Рекомендуемые цены для разных типов транзакций
        console.log('\n🎯 Рекомендуемые цены для транзакций:');
        console.log(`   Быстрые транзакции: ${(currentGwei * 1.2).toFixed(6)} Gwei`);
        console.log(`   Стандартные транзакции: ${currentGwei.toFixed(6)} Gwei`);
        console.log(`   Медленные транзакции: ${(currentGwei * 0.8).toFixed(6)} Gwei`);
        
        // Расчет стоимости для разных лимитов газа
        console.log('\n💰 Стоимость транзакций (при текущей цене газа):');
        const ethPrice = 4600; // USD за ETH
        
        const gasLimits = [2500, 10000, 50000, 100000, 200000];
        gasLimits.forEach(limit => {
            const costWei = BigInt(gasPrice) * BigInt(limit);
            const costEth = web3.utils.fromWei(costWei.toString(), 'ether');
            const costUsd = parseFloat(costEth) * ethPrice;
            
            console.log(`   ${limit.toLocaleString()} gas: ${parseFloat(costEth).toFixed(8)} ETH ($${costUsd.toFixed(4)})`);
        });
        
        return {
            gasPrice: gasPrice,
            gasPriceGwei: gasPriceGwei,
            gasPriceEth: gasPriceEth,
            blockNumber: blockNumber,
            networkId: networkId,
            chainId: chainId
        };
        
    } catch (error) {
        console.error('❌ Ошибка при получении цены газа:', error.message);
        
        // Fallback значения
        console.log('\n🔄 Используем fallback значения:');
        console.log('   Gwei: 0.01 (минимальная рекомендуемая цена)');
        console.log('   Wei: 10000000');
        
        return {
            gasPrice: '10000000',
            gasPriceGwei: '0.01',
            gasPriceEth: '0.00000001',
            blockNumber: 0,
            networkId: 0,
            chainId: 0
        };
    }
}

// Запускаем скрипт
if (require.main === module) {
    getGasPrice()
        .then(result => {
            console.log('\n✅ Скрипт завершен успешно');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Критическая ошибка:', error);
            process.exit(1);
        });
}

module.exports = { getGasPrice };
