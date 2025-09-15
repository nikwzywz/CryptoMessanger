#!/usr/bin/env node

/**
 * Проверка транзакций через Basescan API
 */

const user02Address = '0x016b67764012166A8d9Ed3502eA542A061B771f8';

console.log('🔍 Проверка транзакций через Basescan API');
console.log('📍 Адрес:', user02Address);

async function checkBasescan() {
    try {
        // Получаем последние транзакции через Basescan API
        console.log('\n📋 Получение транзакций...');
        
        const response = await fetch(`https://api.basescan.org/api?module=account&action=txlist&address=${user02Address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=YourApiKeyToken`);
        const data = await response.json();
        
        if (data.status === '1') {
            console.log(`✅ Найдено транзакций: ${data.result.length}`);
            
            for (let i = 0; i < data.result.length; i++) {
                const tx = data.result[i];
                const value = parseFloat(tx.value) / 1e18; // Конвертируем из wei в ETH
                const gasUsed = parseInt(tx.gasUsed);
                const gasPrice = parseInt(tx.gasPrice);
                const gasCost = (gasUsed * gasPrice) / 1e18; // Стоимость газа в ETH
                const timestamp = new Date(parseInt(tx.timeStamp) * 1000);
                
                console.log(`\n📄 Транзакция ${i + 1}:`);
                console.log(`   Hash: ${tx.hash}`);
                console.log(`   Время: ${timestamp.toLocaleString('ru-RU')}`);
                console.log(`   Блок: ${tx.blockNumber}`);
                console.log(`   От: ${tx.from}`);
                console.log(`   К: ${tx.to}`);
                console.log(`   Значение: ${value.toFixed(6)} ETH`);
                console.log(`   Gas Used: ${gasUsed}`);
                console.log(`   Gas Price: ${gasPrice} wei`);
                console.log(`   Стоимость газа: ${gasCost.toFixed(6)} ETH`);
                console.log(`   Статус: ${tx.isError === '0' ? '✅ Успешно' : '❌ Ошибка'}`);
                
                if (tx.methodId) {
                    console.log(`   Method ID: ${tx.methodId}`);
                }
            }
        } else {
            console.log('❌ Ошибка API:', data.message);
        }
        
    } catch (error) {
        console.error('❌ Ошибка проверки:', error);
    }
}

// Запуск проверки
checkBasescan()
    .then(() => {
        console.log('\n✅ Проверка завершена');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Ошибка проверки:', error);
        process.exit(1);
    });
