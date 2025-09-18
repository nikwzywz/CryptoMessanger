/**
 * AppState - Минимальный глобальный менеджер состояния приложения
 * 
 * 🎯 ЗОНА ОТВЕТСТВЕННОСТИ:
 * ✅ Хранение глобальных данных пользователя (currentUser, ключи шифрования)
 * ✅ Управление текущим выбранным контактом (currentContact)
 * ✅ Система подписок для координации между модулями (subscribe/notify)
 * ✅ Глобальные уведомления пользователю (showNotification)
 * ✅ Централизованный Polling Coordinator для синхронизации данных
 * 
 * ❌ НЕ ОТВЕЧАЕТ ЗА:
 * ❌ Управление списком контактов (→ ContactListManagerV3)
 * ❌ Управление сообщениями и UI чата (→ ChatAreaManagerV3)
 * ❌ Работу с блокчейном и контрактами (→ менеджеры)
 * ❌ DOM манипуляции и UI логику (→ менеджеры)
 * 
 * CryptoMessenger v3.0.0
 */

class AppState {
    constructor() {
        // ✅ ТОЛЬКО глобальные данные пользователя
        this.currentUser = null;
        this.currentContact = null;
        this.userPrivateKey = null;
        this.userPublicKey = null;
        
        // ✅ Ссылки на менеджеры для координации
        this.contactListManager = null;
        this.chatUIManager = null;
        
        // ✅ Система подписок для координации между модулями
        this.subscribers = new Map();
        
        // ✅ PollingCoordinator для синхронизации данных
        this.pollingCoordinator = null;
        
        console.log('📦 AppState v3.0.0 - Minimal global state manager loaded');
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

    // ❌ УДАЛЕНЫ неиспользуемые методы:
    // setCurrentChat, setWeb3AndContract, setEncryptionKeys, setSystems

    // ✅ УТИЛИТНЫЕ МЕТОДЫ (только используемые)

    /**
     * Проверка, выбран ли контакт
     * @returns {boolean}
     */
    isContactSelected() {
        return this.currentContact !== null;
    }

    // ❌ УДАЛЕНЫ неиспользуемые V2 методы:
    // isChatActive, isChatNeedAcceptance, isCurrentUserInviter, clearAll, getDebugState

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

    //================================================================================
    // ✅ POLLING COORDINATOR - Централизованная координация обновлений данных
    //================================================================================

    /**
     * Инициализация PollingCoordinator
     */
    initializePollingCoordinator(chatManager, contactListManager, contract, currentUser) {
        this.pollingCoordinator = {
            chatManager: chatManager,
            contactListManager: contactListManager,
            contract: contract,
            currentUser: currentUser,
            pollingInterval: window.CryptoMessengerConfig.pollingConfig.POLLING_INTERVAL,
            checkInterval: 1000,
            isActive: false,
            intervalId: null,
            lastUpdateTime: new Date('2000-01-01').getTime()
        };
        
        console.log('🔄 V3: PollingCoordinator инициализирован');
    }

    /**
     * Запуск polling
     */
    startPolling() {
        if (!this.pollingCoordinator || this.pollingCoordinator.isActive) {
            return;
        }        
        this.pollingCoordinator.isActive = true;        
        this.pollingCoordinator.intervalId = setInterval(() => {
            this.checkForUpdates();
        }, this.pollingCoordinator.checkInterval);
        
        console.log('🔄 V3: Polling запущен через PollingCoordinator');
    }

    /**
     * Остановка polling
     */
    stopPolling() {
        if (this.pollingCoordinator && this.pollingCoordinator.intervalId) {
            clearInterval(this.pollingCoordinator.intervalId);
            this.pollingCoordinator.intervalId = null;
            this.pollingCoordinator.isActive = false;
            console.log('⏹️ V3: Polling остановлен');
        }
    }

    /**
     * Проверка обновлений (строго по алгоритму пункты 2-9)
     */
    async checkForUpdates() {
        if (!this.pollingCoordinator) return;
        
        const now = Date.now();
        const timeSinceLastUpdate = now - this.pollingCoordinator.lastUpdateTime;
        const pollingIntervalMs = this.pollingCoordinator.pollingInterval; // Уже в миллисекундах!
        
        if (timeSinceLastUpdate < pollingIntervalMs) {
            return;
        }
        
        this.pollingCoordinator.lastUpdateTime = now;
        
        try {
            // 🆕 ПУНКТ 2: Каждые 15 секунд polling проверяет наличие новых сообщений
            const startIndex = this.pollingCoordinator.chatManager.messLastIndex + 1;
            const endIndex = startIndex - 1 + window.CryptoMessengerConfig.pollingConfig.MESSAGES_BATCH_SIZE;
            
            console.log(`🔍 V3: Polling сообщений (алгоритм п.2): ${startIndex} - ${endIndex}`);
            
            const newMessages = await this.pollingCoordinator.contract.methods.getMessagesPaginated(
                startIndex, 
                endIndex
            ).call({ from: this.pollingCoordinator.currentUser });
            
            if (newMessages.length === 0) {
                console.log('📭 V3: Новых сообщений нет');
                return;
            }
            
            // 🆕 ПУНКТ 3: Создаём множество, извлекая chatID из новых полученных сообщений
            const newChatIDs = new Set(newMessages.map(msg => msg.chatID));
            console.log(`💬 V3: Обнаружены сообщения в ${newChatIDs.size} чатах`);
            
            // 🆕 ПУНКТ 4: Проверяем, есть ли среди этого множества chatID неизвестные чаты
            const unknownChatIDs = Array.from(newChatIDs).filter(chatID => {
                return !this.pollingCoordinator.contactListManager.getAddressByChatId(chatID); // O(1) поиск!
            });
            
            const isExistsNewChatIDs = unknownChatIDs.length > 0;
            console.log(`🔍 V3: isExistsNewChatIDs = ${isExistsNewChatIDs} (неизвестных чатов: ${unknownChatIDs.length})`);
            
            if (!isExistsNewChatIDs) {
                console.log(`✅ V3: Все чаты известны, переходим к пункту 7 - обработке сообщений`);
            }
            
            // 🆕 ПУНКТ 5: Если isExistsNewChatIDs==false, то переходим к пункту 7, иначе к пункту 6
            if (isExistsNewChatIDs) {
                // 🆕 ПУНКТ 6: Пытаемся загрузить очередные контакты
                await this.loadNewContactsBatch();
                
                // 🆕 ПУНКТЫ 10-12: Отдельный алгоритм отрисовки UI после загрузки контактов
                this.renderUIUpdates();
                
                // После этого ВЫХОДИМ из этого алгоритма!
                console.log('🚪 V3: Загружены новые контакты, ВЫХОДИМ из алгоритма (как требует пункт 6)');
                return;
            }
            
            // 🆕 ПУНКТ 7: Сохраняем новые сообщения в памяти (не в интерфейсе, а в данных)
            await this.saveNewMessagesToModel(newMessages);
            
            // 🆕 ПУНКТ 8: Если количество новых сообщений > 0, то вызываем пересортировку
            if (newMessages.length > 0) {
                this.pollingCoordinator.contactListManager.resortAllContacts();
            }
            
            // 🆕 ПУНКТ 9: Конец алгоритма загрузки данных
            console.log(`✅ V3: Алгоритм загрузки данных завершен, обработано ${newMessages.length} сообщений`);
            
            // 🆕 ПУНКТЫ 10-12: Отдельный алгоритм отрисовки UI (Model-View-Controller)
            this.renderUIUpdates();
            
        } catch (error) {
            // Подавляем ошибки сети
        }
    }

    /**
     * ПУНКТ 6: Загрузка новых контактов (строго по алгоритму)
     */
    async loadNewContactsBatch() {
        const startIndex = this.pollingCoordinator.contactListManager.contactLastIndex + 1;
        const endIndex = startIndex - 1 + window.CryptoMessengerConfig.pollingConfig.CONTACTS_BATCH_SIZE;
        
        console.log(`📇 V3: Загружаем контакты (алгоритм п.6): ${startIndex} - ${endIndex}`);
        
        const newContacts = await this.pollingCoordinator.contract.methods.getContactsPaginated(
            startIndex, 
            endIndex
        ).call({ from: this.pollingCoordinator.currentUser });
        
        if (newContacts && newContacts.contacts && newContacts.contacts.length > 0) {
            // Сохраняем новые контакты-чаты в памяти (маппинги) - НЕ в интерфейсе!
            const formattedContacts = [];
            for (let i = 0; i < newContacts.contacts.length; i++) {
                formattedContacts.push({
                    address: newContacts.contacts[i],
                    name: newContacts.names[i],
                    publicKeyForEncode: newContacts.publicKeys[i],
                    lastMessageTimestamp: 0
                });
                
                // Обновляем contactLastIndex
                this.pollingCoordinator.contactListManager.contactLastIndex = startIndex + i;
            }
            
            // Добавляем в данные (Model), но НЕ в UI (View)
            this.pollingCoordinator.contactListManager.addContactsToModel(formattedContacts);
            
            console.log(`✅ V3: Загружено ${formattedContacts.length} новых контактов в модель данных`);
        }
    }

    /**
     * ПУНКТ 7: Сохранение новых сообщений в памяти (строго по алгоритму)
     */
    async saveNewMessagesToModel(newMessages) {
        console.log(`💾 V3: Сохраняем ${newMessages.length} сообщений в модель данных (алгоритм п.7)`);
        
        // 🆕 Добавляем новые сообщения в allUserMessages для корректной фильтрации
        if (!this.pollingCoordinator.chatManager.allUserMessages) {
            this.pollingCoordinator.chatManager.allUserMessages = [];
        }
        
        // При сохранении каждого из сообщений, последовательно (по одному):
        newMessages.forEach((message, index) => {
            // Добавляем сообщение в allUserMessages для фильтрации по чатам
            this.pollingCoordinator.chatManager.allUserMessages.push(message);
            
            // 7.1. обновляем данные по контактам-чатам
            const contactAddress = this.pollingCoordinator.contactListManager.getAddressByChatId(message.chatID);
            console.log(`🔍 V3: Ищем контакт для chatID ${message.chatID}, найден адрес: ${contactAddress}`);
            
            if (contactAddress) {
                // Расшифровываем сообщение
                let decryptedText = '';
                try {
                    decryptedText = CryptoUtils.decryptMessage(message.encryptedMessage, this.userPrivateKey);
                    console.log(`🔓 V3: Расшифровано сообщение: "${decryptedText}"`);
                } catch (error) {
                    decryptedText = '[Не удалось расшифровать]';
                    console.log(`❌ V3: Ошибка расшифровки:`, error);
                }
                
                // Определяем frontend состояние
                const frontendState = this.pollingCoordinator.chatManager.determineFrontendChatStateFromMessage(message);
                
                // Обновляем данные контакта (поля: последнее сообщение, датавремя, статус)
                this.pollingCoordinator.contactListManager.updateLastMessage(
                    contactAddress,
                    parseInt(message.messIndex),
                    decryptedText,
                    parseInt(message.messageTimestamp) * 1000,
                    frontendState,
                    message.isFromMe
                );
                
                console.log(`📨 V3: Обновлены данные контакта ${contactAddress} (п.7.1)`);
                
                // ✅ Строго Model-View-Controller: только обновляем данные, НЕ отрисовываем UI
                console.log(`📊 V3: Данные контакта обновлены, отрисовка UI будет выполнена отдельно`);
            }
            
            // Обновляем messLastIndex
            this.pollingCoordinator.chatManager.messLastIndex = Math.max(this.pollingCoordinator.chatManager.messLastIndex, parseInt(message.messIndex));
        });
        
        console.log(`✅ V3: Все сообщения сохранены в модель, messLastIndex = ${this.pollingCoordinator.chatManager.messLastIndex}`);
    }

    //================================================================================
    // ✅ UI RENDERING ALGORITHM - Отдельный алгоритм отрисовки UI (пункты 10-12)
    //================================================================================

    /**
     * ПУНКТЫ 10-12: Отдельный алгоритм отрисовки UI (Model-View-Controller)
     * Выполняется ПОСЛЕ обновления данных, строго разделяя Model и View
     */
    renderUIUpdates() {
        console.log(`🎨 V3: Запуск алгоритма отрисовки UI (пункты 10-12)`);
        
        try {
            // ПУНКТ 10: отрисовка изменившихся контактов
            this.renderUpdatedContacts();
            
            // ПУНКТ 11: отрисовка новых сообщений в чате выбранного контакта-чата
            this.renderNewMessagesInCurrentChat();
            
            // ПУНКТ 12: обновление области чата в зависимости от состояния
            this.updateChatAreaForCurrentState();
            
            console.log(`✅ V3: Алгоритм отрисовки UI завершен`);
            
        } catch (error) {
            console.error(`❌ V3: Ошибка в алгоритме отрисовки UI:`, error);
        }
    }

    /**
     * ПУНКТ 10: Отрисовка изменившихся контактов
     */
    renderUpdatedContacts() {
        console.log(`🎨 V3: Пункт 10 - Отрисовка изменившихся контактов`);
        
        // Отрисовываем все контакты из модели данных в UI
        this.pollingCoordinator.contactListManager.renderContactsFromModel();
    }

    /**
     * ПУНКТ 11: Отрисовка новых сообщений в чате выбранного контакта-чата
     */
    renderNewMessagesInCurrentChat() {
        console.log(`🎨 V3: Пункт 11 - Отрисовка новых сообщений в текущем чате`);
        
        const currentContact = this.currentContact;
        if (!currentContact) {
            console.log(`ℹ️ V3: Нет выбранного контакта, пропускаем отрисовку сообщений`);
            return;
        }

        // Получаем новые сообщения для текущего чата из allUserMessages
        const chatManager = this.pollingCoordinator.chatManager;
        if (chatManager.allUserMessages && chatManager.allUserMessages.length > 0) {
            const currentChatID = CryptoUtils.generateChatId(this.currentUser, currentContact.address);
            
            // Фильтруем сообщения для текущего чата
            const currentChatMessages = chatManager.allUserMessages.filter(msg => msg.chatID === currentChatID);
            
            // ✅ ИСПРАВЛЕНИЕ MVC: НЕ изменяем данные модели, только передаем в View
            chatManager.renderMessagesForChat(currentChatMessages);
        }
    }

    /**
     * ПУНКТ 12: Обновление области чата в зависимости от состояния
     */
    updateChatAreaForCurrentState() {
        console.log(`🎨 V3: Пункт 12 - Обновление области чата в зависимости от состояния`);
        
        const currentContact = this.currentContact;
        if (!currentContact) {
            console.log(`ℹ️ V3: Нет выбранного контакта, пропускаем обновление области чата`);
            return;
        }

        // Определяем состояние чата и обновляем UI
        const chatManager = this.pollingCoordinator.chatManager;
        chatManager.updateChatState();
    }



}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppState;
}
