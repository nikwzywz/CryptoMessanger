/**
 * ABI Fetcher для CryptoMessenger
 * Автоматически получает актуальный ABI контракта из Basescan
 */

class ABIFetcher {
    constructor(contractAddress) {
        this.contractAddress = contractAddress;
        this.basescanApiUrl = 'https://api.basescan.org/api';
        this.cacheKey = `cryptoMessenger_abi_${contractAddress}`;
    }

    /**
     * Получает ABI контракта из Basescan API
     * @returns {Promise<Array>} ABI контракта
     */
    async fetchABI() {
        try {
            console.log(`🔍 Получение ABI для контракта ${this.contractAddress}...`);
            
            const response = await fetch(`${this.basescanApiUrl}?module=contract&action=getabi&address=${this.contractAddress}`);
            const data = await response.json();
            
            if (data.status === '1' && data.result) {
                const abi = JSON.parse(data.result);
                console.log('✅ ABI успешно получен из Basescan');
                
                // Кэшируем ABI
                this.cacheABI(abi);
                
                return abi;
            } else {
                throw new Error(`Ошибка получения ABI: ${data.message || 'Неизвестная ошибка'}`);
            }
        } catch (error) {
            console.error('❌ Ошибка получения ABI:', error);
            
            // Пытаемся загрузить из кэша
            const cachedABI = this.getCachedABI();
            if (cachedABI) {
                console.log('📦 Используем кэшированный ABI');
                return cachedABI;
            }
            
            throw error;
        }
    }

    /**
     * Кэширует ABI в localStorage
     * @param {Array} abi - ABI для кэширования
     */
    cacheABI(abi) {
        try {
            const cacheData = {
                abi: abi,
                timestamp: Date.now(),
                contractAddress: this.contractAddress
            };
            localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
            console.log('💾 ABI сохранен в кэш');
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить ABI в кэш:', error);
        }
    }

    /**
     * Получает ABI из кэша
     * @returns {Array|null} Кэшированный ABI или null
     */
    getCachedABI() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (cached) {
                const cacheData = JSON.parse(cached);
                
                // Проверяем, что кэш актуален (не старше 24 часов)
                const isExpired = Date.now() - cacheData.timestamp > 24 * 60 * 60 * 1000;
                
                if (!isExpired && cacheData.contractAddress === this.contractAddress) {
                    return cacheData.abi;
                } else {
                    console.log('🗑️ Кэш ABI устарел, удаляем');
                    localStorage.removeItem(this.cacheKey);
                }
            }
        } catch (error) {
            console.warn('⚠️ Ошибка чтения кэша ABI:', error);
        }
        return null;
    }

    /**
     * Получает ABI (сначала из кэша, потом из API)
     * @returns {Promise<Array>} ABI контракта
     */
    async getABI() {
        // Сначала пытаемся загрузить из кэша
        const cachedABI = this.getCachedABI();
        if (cachedABI) {
            console.log('📦 Используем кэшированный ABI');
            return cachedABI;
        }

        // Если кэша нет, загружаем из API
        return await this.fetchABI();
    }

    /**
     * Принудительно обновляет ABI из Basescan
     * @returns {Promise<Array>} Обновленный ABI
     */
    async refreshABI() {
        console.log('🔄 Принудительное обновление ABI...');
        return await this.fetchABI();
    }

    /**
     * Проверяет, есть ли обновления ABI
     * @returns {Promise<boolean>} true если есть обновления
     */
    async checkForUpdates() {
        try {
            const response = await fetch(`${this.basescanApiUrl}?module=contract&action=getabi&address=${this.contractAddress}`);
            const data = await response.json();
            
            if (data.status === '1' && data.result) {
                const newABI = JSON.parse(data.result);
                const cachedABI = this.getCachedABI();
                
                if (!cachedABI) {
                    return true; // Нет кэша, значит нужны обновления
                }
                
                // Сравниваем ABI (простая проверка по длине)
                return JSON.stringify(newABI) !== JSON.stringify(cachedABI);
            }
            
            return false;
        } catch (error) {
            console.warn('⚠️ Ошибка проверки обновлений ABI:', error);
            return false;
        }
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ABIFetcher;
} else {
    window.ABIFetcher = ABIFetcher;
}

console.log('📦 ABI Fetcher загружен v1.0.0');
