/**
 * Менеджер данных CryptoMessenger
 * Управляет локальным хранением и синхронизацией с блокчейном
 * Версия: v1.0 - 2025-01-11
 */

class DataManager {
    constructor() {
        this.storageKey = 'cryptoMessenger';
        this.defaultData = {
            userProfile: null,
            contacts: {},
            conversations: {},
            settings: {
                theme: 'dark',
                notifications: true,
                autoSync: true,
                lastSyncBlock: 0
            }
        };
        this.data = this.loadData();
    }

    /**
     * Загрузка данных из localStorage
     */
    loadData() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...this.defaultData, ...parsed };
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
        }
        return { ...this.defaultData };
    }

    /**
     * Сохранение данных в localStorage
     */
    saveData() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            console.log('💾 Данные сохранены в localStorage');
        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
        }
    }

    /**
     * Инициализация профиля пользователя
     */
    initUserProfile(walletAddress, publicKey, privateKey) {
        this.data.userProfile = {
            walletAddress,
            publicKey,
            privateKey,
            lastSyncBlock: 0,
            createdAt: Date.now()
        };
        this.saveData();
    }

    /**
     * Получение последнего синхронизированного блока
     */
    getLastSyncBlock() {
        return this.data.settings.lastSyncBlock || 0;
    }

    /**
     * Обновление последнего синхронизированного блока
     */
    updateLastSyncBlock(blockNumber) {
        this.data.settings.lastSyncBlock = blockNumber;
        this.saveData();
        console.log(`🔄 Последний синхронизированный блок: ${blockNumber}`);
    }

    /**
     * Добавление контакта
     */
    addContact(address, publicKey, name = null) {
        this.data.contacts[address] = {
            address,
            publicKey,
            name: name || address.slice(0, 8), // Используем адрес как имя по умолчанию
            lastMessageTime: 0,
            unreadCount: 0,
            addedAt: Date.now()
        };
        this.saveData();
        console.log(`👤 Контакт добавлен: ${address}`);
    }

    /**
     * Получение списка контактов
     */
    getContacts() {
        return Object.values(this.data.contacts);
    }

    /**
     * Обновление имени контакта
     */
    updateContactName(address, newName) {
        if (this.data.contacts[address]) {
            this.data.contacts[address].name = newName || address;
            this.saveData();
            console.log(`✏️ Имя контакта обновлено: ${address} -> ${newName}`);
            return true;
        }
        return false;
    }

    /**
     * Получение контакта по адресу
     */
    getContact(address) {
        return this.data.contacts[address] || null;
    }

    /**
     * Добавление сообщения в разговор
     */
    addMessage(conversationId, message) {
        if (!this.data.conversations[conversationId]) {
            this.data.conversations[conversationId] = [];
        }

        // Проверяем, нет ли уже такого сообщения (по txHash)
        const exists = this.data.conversations[conversationId].some(
            msg => msg.txHash === message.txHash
        );
        
        if (!exists) {
            this.data.conversations[conversationId].push(message);
            
            // Сортируем по времени
            this.data.conversations[conversationId].sort((a, b) => a.timestamp - b.timestamp);
            
            // Обновляем время последнего сообщения в контакте
            if (this.data.contacts[conversationId]) {
                this.data.contacts[conversationId].lastMessageTime = message.timestamp;
            }
            
            this.saveData();
            console.log(`💬 Сообщение добавлено в разговор ${conversationId}`);
        }
    }

    /**
     * Получение сообщений разговора
     */
    getConversation(conversationId) {
        return this.data.conversations[conversationId] || [];
    }

    /**
     * Получение всех разговоров
     */
    getAllConversations() {
        return this.data.conversations;
    }

    /**
     * Очистка старых данных (оптимизация)
     */
    cleanupOldData(daysToKeep = 30) {
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        let cleanedCount = 0;

        Object.keys(this.data.conversations).forEach(conversationId => {
            const messages = this.data.conversations[conversationId];
            const filteredMessages = messages.filter(msg => msg.timestamp > cutoffTime);
            
            if (filteredMessages.length !== messages.length) {
                cleanedCount += messages.length - filteredMessages.length;
                this.data.conversations[conversationId] = filteredMessages;
            }
        });

        if (cleanedCount > 0) {
            console.log(`🧹 Очищено ${cleanedCount} старых сообщений`);
            this.saveData();
        }
    }

    /**
     * Экспорт данных для резервного копирования
     */
    exportData() {
        const exportData = {
            ...this.data,
            exportedAt: Date.now(),
            version: '1.0'
        };
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Импорт данных из резервной копии
     */
    importData(jsonData) {
        try {
            const imported = JSON.parse(jsonData);
            this.data = { ...this.defaultData, ...imported };
            this.saveData();
            console.log('📥 Данные успешно импортированы');
            return true;
        } catch (error) {
            console.error('❌ Ошибка импорта данных:', error);
            return false;
        }
    }

    /**
     * Получение статистики
     */
    getStats() {
        const totalContacts = Object.keys(this.data.contacts).length;
        const totalConversations = Object.keys(this.data.conversations).length;
        const totalMessages = Object.values(this.data.conversations)
            .reduce((sum, conv) => sum + conv.length, 0);

        return {
            totalContacts,
            totalConversations,
            totalMessages,
            lastSyncBlock: this.getLastSyncBlock(),
            storageSize: JSON.stringify(this.data).length
        };
    }

    /**
     * Форматирование адреса для отображения
     */
    formatAddress(address, short = true) {
        if (!address) return '';
        
        if (short) {
            return `${address.slice(0, 6)}...${address.slice(-4)}`;
        }
        return address;
    }

    /**
     * Получение отображаемого имени контакта
     */
    getDisplayName(address) {
        const contact = this.getContact(address);
        if (contact && contact.name !== address) {
            return contact.name;
        }
        return this.formatAddress(address);
    }
}

// Экспортируем для использования в других модулях
window.DataManager = DataManager;
