/**
 * Утилиты для управления газом в транзакциях
 * Обеспечивает экономию средств при работе с Base сетью
 */

/**
 * Ограничивает gas limit для экономии средств
 * @param {number} estimatedGas - Оцененный газ
 * @param {number} maxGas - Максимальный газ (по умолчанию 2,500 для лимита $0.01)
 * @returns {number} Ограниченный gas limit
 */
function limitGas(estimatedGas, maxGas = 2500) {
    const limitedGas = Math.min(estimatedGas, maxGas);
    console.log(`   Gas estimated: ${estimatedGas}, using: ${limitedGas}`);
    return limitedGas;
}

/**
 * Ограничивает gas limit исходя из максимальной стоимости транзакции
 * @param {number} estimatedGas - Оцененный газ
 * @param {string} gasPrice - Цена газа в wei
 * @param {number} maxCostUsd - Максимальная стоимость в долларах (по умолчанию $0.10)
 * @param {number} ethPrice - Цена ETH в долларах (по умолчанию 4600)
 * @returns {number} Ограниченный gas limit
 */
function limitGasByCost(estimatedGas, gasPrice, maxCostUsd = 0.10, ethPrice = 4600) {
    // Рассчитываем максимальный gas limit для заданной стоимости
    const gasPriceWei = BigInt(gasPrice);
    const maxCostEth = maxCostUsd / ethPrice;
    const maxCostWei = BigInt(Math.floor(maxCostEth * 1e18));
    const maxGasByCost = Number(maxCostWei / gasPriceWei);
    
    // Ограничиваем gas limit
    const limitedGas = Math.min(estimatedGas, maxGasByCost);
    
    // Рассчитываем фактическую стоимость
    const actualCostWei = gasPriceWei * BigInt(limitedGas);
    const actualCostEth = Number(actualCostWei) / 1e18;
    const actualCostUsd = actualCostEth * ethPrice;
    
    console.log(`   Gas estimated: ${estimatedGas}, max by cost: ${maxGasByCost}, using: ${limitedGas}`);
    console.log(`   💰 Фактическая стоимость: ${actualCostEth.toFixed(8)} ETH ($${actualCostUsd.toFixed(4)})`);
    
    if (limitedGas < estimatedGas) {
        console.log(`   ⚠️  Gas limit ограничен по стоимости (бюджет: $${maxCostUsd})`);
    }
    
    return limitedGas;
}

/**
 * Получает оптимальный gas price для Base сети
 * @param {object} web3Instance - Экземпляр Web3
 * @returns {Promise<string>} Gas price в wei
 */
async function getOptimalGasPrice(web3Instance = null) {
    if (web3Instance) {
        try {
            // Получаем актуальную цену газа из сети
            const networkGasPrice = await web3Instance.eth.getGasPrice();
            const networkGasPriceGwei = Number(networkGasPrice) / 1e9;
            
            console.log(`   📊 Сетевая цена газа: ${networkGasPriceGwei.toFixed(2)} gwei`);
            
            // Используем сетевую цену, но не меньше 0.01 gwei
            const minGasPrice = '10000000'; // 0.01 gwei
            const optimalPrice = networkGasPrice > minGasPrice ? networkGasPrice : minGasPrice;
            
            const optimalGwei = Number(optimalPrice) / 1e9;
            console.log(`   ⚡ Используем цену: ${optimalGwei.toFixed(2)} gwei`);
            
            return optimalPrice;
        } catch (error) {
            console.warn(`   ⚠️  Ошибка получения цены газа: ${error.message}`);
            console.log(`   🔄 Используем фиксированную цену: 0.01 gwei`);
        }
    }
    
    // Fallback: фиксированная цена 0.01 gwei
    return '10000000'; // 0.01 gwei (дешевый газ для Base)
}

/**
 * Рассчитывает максимальную стоимость транзакции в ETH
 * @param {number} gasLimit - Лимит газа
 * @param {string} gasPrice - Цена газа в wei
 * @param {number} ethPrice - Цена ETH в долларах (по умолчанию 4600)
 * @param {number} maxCostUsd - Максимальная стоимость в долларах (по умолчанию 0.05)
 * @returns {boolean} true если стоимость в пределах лимита
 */
function validateGasCost(gasLimit, gasPrice, ethPrice = 4600, maxCostUsd = 0.05) {
    const gasPriceWei = BigInt(gasPrice);
    const gasLimitBig = BigInt(gasLimit);
    const totalWei = gasPriceWei * gasLimitBig;
    
    // Конвертируем в ETH
    const totalEth = Number(totalWei) / 1e18;
    
    // Конвертируем в доллары
    const totalUsd = totalEth * ethPrice;
    
    console.log(`   💰 Стоимость транзакции: ${totalEth.toFixed(8)} ETH ($${totalUsd.toFixed(4)})`);
    
    if (totalUsd > maxCostUsd) {
        console.warn(`   ⚠️  Стоимость превышает лимит $${maxCostUsd}!`);
        return false;
    }
    
    return true;
}

/**
 * Рассчитывает стоимость газа в долларах
 * @param {number} gas - Gas limit
 * @param {string} gasPrice - Gas price в wei
 * @param {number} ethPrice - Цена ETH в долларах (по умолчанию 4600)
 * @returns {object} Объект с ETH и USD стоимостью
 */
function calculateGasCost(gas, gasPrice, ethPrice = 4600) {
    const gasPriceWei = BigInt(gasPrice);
    const gasLimitBig = BigInt(gas);
    const totalWei = gasPriceWei * gasLimitBig;
    const totalEth = Number(totalWei) / 1e18;
    const totalUsd = totalEth * ethPrice;
    
    return {
        eth: totalEth,
        usd: totalUsd,
        gas: gas,
        gasPrice: gasPrice
    };
}

module.exports = {
    limitGas,
    limitGasByCost,
    getOptimalGasPrice,
    validateGasCost,
    calculateGasCost
};
