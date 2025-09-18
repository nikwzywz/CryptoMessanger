/**
 * AppState - Централизованное управление состоянием приложения
 * CryptoMessenger v3.0.0
 */

class AppState {
    constructor() {
        // Основные данные
        this.currentUser = null;
        this.currentContact = null;
        this.currentChat = null;
        // V2 contacts array удален - используется ContactListManagerV3.contactsCache
        this.messages = {};
        
        // Web3 и контракт
        this.web3 = null;
        this.contract = null;
        
        // Ключи шифрования
        this.userPrivateKey = null;
        this.userPublicKey = null;
        
        // Системы
        this.eventSystem = null;
        this.chatUIManager = null;
        
        // Подписчики на изменения состояния
        this.subscribers = new Map();
        
        console.log('📦 AppState v3.0.0 - Centralized state management loaded');
    }

    /**
     * Подписка на изменения состояния
     * @param {string} key - Ключ состояния для отслеживания
     * @param {Function} callback - Функция обратного вызова
     */
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key).add(callback);
    }

    /**
     * Отписка от изменений состояния
     * @param {string} key - Ключ состояния
     * @param {Function} callback - Функция обратного вызова
     */
    unsubscribe(key, callback) {
        if (this.subscribers.has(key)) {
            this.subscribers.get(key).delete(callback);
        }
    }

    /**
     * Уведомление подписчиков об изменении
     * @param {string} key - Ключ изменившегося состояния
     * @param {*} value - Новое значение
     */
    notify(key, value) {
        if (this.subscribers.has(key)) {
            this.subscribers.get(key).forEach(callback => {
                try {
                    callback(value, key);
                } catch (error) {
                    console.error(`❌ Ошибка в подписчике ${key}:`, error);
                }
            });
        }
    }

    // ========== ГЕТТЕРЫ И СЕТТЕРЫ ==========

    /**
     * Установка текущего пользователя
     * @param {string} userAddress - Адрес пользователя
     */
    setCurrentUser(userAddress) {
        const oldValue = this.currentUser;
        this.currentUser = userAddress;
        if (oldValue !== userAddress) {
            this.notify('currentUser', userAddress);
        }
    }

    /**
     * Установка публичного ключа пользователя
     * @param {string} publicKey - Публичный ключ пользователя
     */
    setUserPublicKey(publicKey) {
        const oldValue = this.userPublicKey;
        this.userPublicKey = publicKey;
        if (oldValue !== publicKey) {
            this.notify('userPublicKey', publicKey);
        }
    }
    
    setUserPrivateKey(privateKey) {
        const oldValue = this.userPrivateKey;
        this.userPrivateKey = privateKey;
        if (oldValue !== privateKey) {
            this.notify('userPrivateKey', privateKey);
        }
    }

    /**
     * Установка текущего контакта
     * @param {Object} contact - Объект контакта {address, name}
     */
    setCurrentContact(contact) {
        const oldValue = this.currentContact;
        this.currentContact = contact;
        if (JSON.stringify(oldValue) !== JSON.stringify(contact)) {
            this.notify('currentContact', contact);
        }
    }

    /**
     * Установка текущего чата
     * @param {Object} chat - Объект чата из смарт-контракта
     */
    setCurrentChat(chat) {
        const oldValue = this.currentChat;
        this.currentChat = chat;
        // Простое сравнение вместо JSON.stringify (проблема с BigInt)
        if (oldValue !== chat) {
            this.notify('currentChat', chat);
        }
    }

    /**
     * Обновление списка контактов
     * @param {Array} contacts - Массив контактов
     */
    // V2 метод setContacts удален

    // V2 метод addContact удален

    /**
     * Установка Web3 и контракта
     * @param {Object} web3 - Экземпляр Web3
     * @param {Object} contract - Экземпляр контракта
     */
    setWeb3AndContract(web3, contract) {
        this.web3 = web3;
        this.contract = contract;
        this.notify('web3', { web3, contract });
    }

    /**
     * Установка ключей шифрования
     * @param {string} privateKey - Приватный ключ
     * @param {string} publicKey - Публичный ключ
     */
    setEncryptionKeys(privateKey, publicKey) {
        this.userPrivateKey = privateKey;
        this.userPublicKey = publicKey;
        this.notify('encryptionKeys', { privateKey, publicKey });
    }

    /**
     * Установка систем (eventSystem, chatUIManager)
     * @param {Object} eventSystem - Система событий
     * @param {Object} chatUIManager - Менеджер UI чата
     */
    setSystems(eventSystem, chatUIManager) {
        this.eventSystem = eventSystem;
        this.chatUIManager = chatUIManager;
        this.notify('systems', { eventSystem, chatUIManager });
    }

    // ========== УТИЛИТНЫЕ МЕТОДЫ ==========

    /**
     * Проверка, выбран ли контакт
     * @returns {boolean}
     */
    isContactSelected() {
        return this.currentContact !== null;
    }

    /**
     * Проверка, активен ли текущий чат
     * @returns {boolean}
     */
    isChatActive() {
        return this.currentChat && this.currentChat.isActive;
    }

    /**
     * Проверка, ожидает ли чат принятия приглашения
     * @returns {boolean}
     */
    isChatNeedAcceptance() {
        return this.currentChat && this.currentChat.isNeedAcceptance;
    }

    /**
     * Проверка, является ли текущий пользователь отправителем приглашения
     * @returns {boolean}
     */
    isCurrentUserInviter() {
        return this.currentChat && 
               this.currentChat.inviter && 
               this.currentChat.inviter.toLowerCase() === this.currentUser?.toLowerCase();
    }

    /**
     * Полная очистка состояния
     */
    clearAll() {
        this.currentUser = null;
        this.currentContact = null;
        this.currentChat = null;
        // V2 contacts array удален
        this.messages = {};
        this.userPrivateKey = null;
        this.userPublicKey = null;
        
        this.notify('cleared', true);
    }

    /**
     * Получение полного состояния для отладки
     * @returns {Object}
     */
    getDebugState() {
        return {
            currentUser: this.currentUser,
            currentContact: this.currentContact,
            currentChat: this.currentChat,
            contactsCount: this.contacts.length,
            messagesCount: Object.keys(this.messages).length,
            hasEncryptionKeys: !!(this.userPrivateKey && this.userPublicKey),
            hasWeb3: !!this.web3,
            hasContract: !!this.contract,
            hasSystems: !!(this.eventSystem && this.chatUIManager)
        };
    }

    // ========== ГЛОБАЛЬНЫЕ УВЕДОМЛЕНИЯ ==========

    /**
     * Показ уведомления пользователю
     * @param {string} message - Текст уведомления
     * @param {'info'|'success'|'error'|'warning'} type - Тип уведомления
     */
    showNotification(message, type = 'info') {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 400px;
            font-size: 14px;
            font-weight: 500;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Анимация появления
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Автоматическое скрытие через 3 секунды
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);

        console.log(`🔔 AppState: Уведомление [${type}]: ${message}`);
    }

    /**
     * Получение цвета для типа уведомления
     * @param {string} type - Тип уведомления
     * @returns {string} CSS цвет
     */
    getNotificationColor(type) {
        const colors = {
            info: '#007bff',
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107'
        };
        return colors[type] || colors.info;
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppState;
}
