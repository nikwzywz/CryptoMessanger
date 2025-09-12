#!/usr/bin/env node

/**
 * Скрипт для расчета максимальных затрат на газ
 * Проверяет, что все транзакции не превышают лимит в 5 центов
 */

const { limitGas, getOptimalGasPrice, validateGasCost } = require('./gas-utils');

// Параметры для расчета
const ETH_PRICE_USD = 4600; // Цена ETH в долларах
const MAX_COST_USD = 0.05; // Максимум 5 центов
const GAS_PRICE = '10000000'; // 0.01 gwei (фиксированная цена для расчета)

console.log('💰 Расчет максимальных затрат на газ\n');

// Функции контракта и их максимальные gas limits (обновленные для лимита $0.01)
const contractFunctions = [
    { name: 'registerPublicKey', maxGas: 2500, description: 'Регистрация пользователя' },
    { name: 'requestContact', maxGas: 30000, description: 'Запрос на добавление в контакты' },
    { name: 'acceptContactRequest', maxGas: 2500, description: 'Принятие запроса' },
    { name: 'rejectContactRequest', maxGas: 2500, description: 'Отклонение запроса' },
    { name: 'sendMessage', maxGas: 2500, description: 'Отправка сообщения' }
];

console.log(`📊 Параметры расчета:`);
console.log(`   Цена ETH: $${ETH_PRICE_USD}`);
console.log(`   Gas Price: ${GAS_PRICE} wei (0.01 gwei)`);
console.log(`   Максимальная стоимость: $${MAX_COST_USD}\n`);

let totalCost = 0;
let allWithinLimit = true;

contractFunctions.forEach(func => {
    console.log(`🔧 ${func.description} (${func.name}):`);
    
    // Рассчитываем стоимость с максимальным gas limit
    const gasLimit = func.maxGas;
    const gasPriceWei = BigInt(GAS_PRICE);
    const gasLimitBig = BigInt(gasLimit);
    const totalWei = gasPriceWei * gasLimitBig;
    
    // Конвертируем в ETH
    const totalEth = Number(totalWei) / 1e18;
    
    // Конвертируем в доллары
    const totalUsd = totalEth * ETH_PRICE_USD;
    
    console.log(`   Gas Limit: ${gasLimit.toLocaleString()}`);
    console.log(`   Стоимость: ${totalEth.toFixed(8)} ETH ($${totalUsd.toFixed(4)})`);
    
    if (totalUsd > MAX_COST_USD) {
        console.log(`   ❌ ПРЕВЫШЕНИЕ ЛИМИТА! ($${totalUsd.toFixed(4)} > $${MAX_COST_USD})`);
        allWithinLimit = false;
    } else {
        console.log(`   ✅ В пределах лимита`);
    }
    
    totalCost += totalUsd;
    console.log('');
});

console.log('📈 Итоговая статистика:');
console.log(`   Общая стоимость всех операций: $${totalCost.toFixed(4)}`);
console.log(`   Все операции в пределах лимита: ${allWithinLimit ? '✅ Да' : '❌ Нет'}`);

if (allWithinLimit) {
    console.log('\n🎉 Все транзакции безопасны! Можно запускать реальные скрипты.');
} else {
    console.log('\n⚠️  ВНИМАНИЕ! Некоторые транзакции превышают лимит!');
    console.log('   Необходимо уменьшить gas limits перед запуском.');
}

// Дополнительный расчет для сценария populate-contract
console.log('\n📋 Сценарий populate-contract:');
console.log('   Регистрация 4 пользователей: 4 × $' + (contractFunctions[0].maxGas * Number(GAS_PRICE) / 1e18 * ETH_PRICE_USD).toFixed(4));
console.log('   Запросы на контакты: 6 × $' + (contractFunctions[1].maxGas * Number(GAS_PRICE) / 1e18 * ETH_PRICE_USD).toFixed(4));
console.log('   Принятие/отклонение: 6 × $' + (contractFunctions[2].maxGas * Number(GAS_PRICE) / 1e18 * ETH_PRICE_USD).toFixed(4));
console.log('   Отправка сообщений: 15 × $' + (contractFunctions[4].maxGas * Number(GAS_PRICE) / 1e18 * ETH_PRICE_USD).toFixed(4));

const totalScenarioCost = 
    4 * (contractFunctions[0].maxGas * Number(GAS_PRICE) / 1e18 * ETH_PRICE_USD) +
    6 * (contractFunctions[1].maxGas * Number(GAS_PRICE) / 1e18 * ETH_PRICE_USD) +
    6 * (contractFunctions[2].maxGas * Number(GAS_PRICE) / 1e18 * ETH_PRICE_USD) +
    15 * (contractFunctions[4].maxGas * Number(GAS_PRICE) / 1e18 * ETH_PRICE_USD);

console.log(`   Общая стоимость сценария: $${totalScenarioCost.toFixed(4)}`);

if (totalScenarioCost > 1.0) {
    console.log(`   ⚠️  Сценарий может быть дорогим! ($${totalScenarioCost.toFixed(4)})`);
} else {
    console.log(`   ✅ Сценарий приемлем по стоимости`);
}
