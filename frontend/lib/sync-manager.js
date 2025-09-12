/**
 * Менеджер синхронизации CryptoMessenger
 * Управляет загрузкой сообщений из блокчейна
 * Версия: v1.0 - 2025-01-11
 */

class SyncManager {
    constructor(web3, contract, dataManager) {
        this.web3 = web3;
        this.contract = contract;
        this.dataManager = dataManager;
        this.isSyncing = false;
        this.syncInterval = null;
        this.batchSize = 1000; // сообщений за раз
        this.maxBlocksPerSync = 10000; // максимум блоков за синхронизацию
    }

    /**
     * Запуск автоматической синхронизации
     */
    startAutoSync(intervalMs = 30000) { // каждые 30 секунд
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(() => {
            if (!this.isSyncing) {
                this.syncNewMessages();
            }
        }, intervalMs);

        console.log(`🔄 Автосинхронизация запущена (каждые ${intervalMs/1000}с)`);
    }

    /**
     * Остановка автоматической синхронизации
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('⏹️ Автосинхронизация остановлена');
        }
    }

    /**
     * Синхронизация новых сообщений
     */
    async syncNewMessages() {
        if (this.isSyncing) {
            console.log('⏳ Синхронизация уже выполняется...');
            return;
        }

        try {
            this.isSyncing = true;
            console.log('🔄 Начинаем синхронизацию сообщений...');

            const currentBlock = await this.web3.eth.getBlockNumber();
            const lastSyncBlock = this.dataManager.getLastSyncBlock();
            
            if (currentBlock <= lastSyncBlock) {
                console.log('✅ Нет новых сообщений');
                return;
            }

            // Ограничиваем количество блоков для синхронизации
            const fromBlock = Math.max(lastSyncBlock + 1, currentBlock - this.maxBlocksPerSync);
            
            console.log(`📊 Синхронизация блоков: ${fromBlock} - ${currentBlock}`);

            // Получаем события MessageSent
            const events = await this.contract.getPastEvents('MessageSent', {
                fromBlock: fromBlock,
                toBlock: currentBlock,
                filter: {
                    to: this.dataManager.data.userProfile.walletAddress
                }
            });

            console.log(`📨 Найдено ${events.length} новых сообщений`);

            if (events.length > 0) {
                await this.processMessageEvents(events);
            }

            // Обновляем последний синхронизированный блок
            this.dataManager.updateLastSyncBlock(currentBlock);

            console.log('✅ Синхронизация завершена');

        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Обработка событий сообщений
     */
    async processMessageEvents(events) {
        console.log(`🔄 Обрабатываем ${events.length} событий...`);

        for (let i = 0; i < events.length; i += this.batchSize) {
            const batch = events.slice(i, i + this.batchSize);
            await this.processMessageBatch(batch);
            
            // Небольшая пауза между батчами
            if (i + this.batchSize < events.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    /**
     * Обработка батча сообщений
     */
    async processMessageBatch(events) {
        for (const event of events) {
            try {
                const message = {
                    id: `msg_${event.transactionHash}_${event.logIndex}`,
                    from: event.returnValues.from,
                    to: event.returnValues.to,
                    encryptedData: event.returnValues.encryptedData,
                    timestamp: parseInt(event.returnValues.timestamp) * 1000, // конвертируем в мс
                    blockNumber: event.blockNumber,
                    txHash: event.transactionHash,
                    logIndex: event.logIndex,
                    decrypted: null // будет расшифровано позже
                };

                // Добавляем сообщение в разговор
                this.dataManager.addMessage(message.from, message);

                console.log(`💬 Обработано сообщение от ${message.from.slice(0, 6)}...`);

            } catch (error) {
                console.error('❌ Ошибка обработки сообщения:', error);
            }
        }
    }

    /**
     * Полная синхронизация (с самого начала)
     */
    async fullSync() {
        console.log('🔄 Начинаем полную синхронизацию...');
        
        try {
            this.isSyncing = true;
            
            // Сбрасываем последний синхронизированный блок
            this.dataManager.updateLastSyncBlock(0);
            
            // Запускаем обычную синхронизацию
            await this.syncNewMessages();
            
            console.log('✅ Полная синхронизация завершена');
            
        } catch (error) {
            console.error('❌ Ошибка полной синхронизации:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Синхронизация контактов
     */
    async syncContacts() {
        try {
            console.log('👥 Синхронизируем контакты...');

            const userAddress = this.dataManager.data.userProfile.walletAddress;
            
            // Получаем список контактов из контракта
            const contactList = await this.contract.methods.getUserContacts(userAddress).call();
            
            for (const contactAddress of contactList) {
                // Получаем публичный ключ контакта
                const publicKey = await this.contract.methods.getUserPublicKey(contactAddress).call();
                
                // Добавляем контакт, если его еще нет
                if (!this.dataManager.data.contacts[contactAddress]) {
                    this.dataManager.addContact(contactAddress, publicKey);
                }
            }

            console.log(`✅ Синхронизировано ${contactList.length} контактов`);

        } catch (error) {
            console.error('❌ Ошибка синхронизации контактов:', error);
        }
    }

    /**
     * Получение статуса синхронизации
     */
    getSyncStatus() {
        return {
            isSyncing: this.isSyncing,
            lastSyncBlock: this.dataManager.getLastSyncBlock(),
            autoSyncEnabled: this.syncInterval !== null
        };
    }

    /**
     * Принудительная синхронизация
     */
    async forceSync() {
        console.log('🔄 Принудительная синхронизация...');
        await this.syncNewMessages();
    }
}

// Экспортируем для использования в других модулях
window.SyncManager = SyncManager;
