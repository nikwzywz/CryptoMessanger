/**
 * ContactListManager - Управление списком контактов (левая панель)
 * CryptoMessenger v4.0.0
 */

class ContactListManager {
    constructor(appState, contract) {
        this.appState = appState;
        this.contract = contract;
        
        // Кэш для оптимизации
        this.contactsCache = new Map();
        this.publicKeysCache = new Map();
        this.chatInfoCache = new Map();
        
        console.log('📦 ContactListManager v4.0.0 - Contact list management loaded');
        console.log('🔧 File: modules/contact-list-manager.js');
    }

    // ========== 1. ЗАГРУЗКА КОНТАКТОВ ==========

    /**
     * Загрузка всех контактов пользователя
     */
    async loadContacts() {
        try {
            console.log('📞 ContactListManager: Загружаем контакты из блокчейна...');
            console.log('🔍 Контракт:', this.contract._address);
            console.log('👤 Текущий пользователь:', this.appState.currentUser);

            // Получаем список адресов контактов
            const contactAddresses = await this.contract.methods.getContacts(this.appState.currentUser).call();
            console.log('📋 РЕЗУЛЬТАТ getContacts():', contactAddresses.length);
            console.log('📋 Адреса контактов:', contactAddresses);

            const contacts = [];

            for (const address of contactAddresses) {
                try {
                    // Получаем публичный ключ контакта
                    const contactPublicKey = await this.getContactPublicKey(address);
                    
                    // Получаем информацию о чате
                    const chatInfo = await this.getChatInfo(address);
                    
                    // Получаем настоящее имя контакта из смарт-контракта
                    const contactName = await this.getContactName(address);
                    
                    // Создаём объект контакта
                    const contact = {
                        address: address,
                        name: contactName,
                        publicKey: contactPublicKey,
                        chatId: chatInfo.chatId,
                        lastMessage: 'Загрузка...',
                        lastMessageTime: null,
                        unreadCount: 0,
                        chatType: this.classifyContact(chatInfo),
                        invitationInfo: chatInfo.chat
                    };

                    contacts.push(contact);
                    console.log(`📊 Статус чата с ${contactName}:`, {
                        isActive: chatInfo.chat?.isActive,
                        isNeedAcceptance: chatInfo.chat?.isNeedAcceptance,
                        inviter: chatInfo.chat?.inviter
                    });

                } catch (contactError) {
                    console.error(`❌ Ошибка обработки контакта ${address}:`, contactError);
                }
            }

            // Обновляем состояние
            this.appState.setContacts(contacts);
            console.log('✅ ContactListManager: Контакты загружены:', contacts.length);
            
            // Загружаем последние сообщения для превью
            await this.loadLastMessagesForContacts();
            
            return contacts;
            
        } catch (error) {
            console.error('❌ ContactListManager: Ошибка загрузки контактов:', error);
            return [];
        }
    }

    /**
     * Загрузка последних сообщений для превью в списке контактов
     */
    async loadLastMessagesForContacts() {
        console.log('💬 ContactListManager: Загружаем последние сообщения для контактов...');
        
        for (const contact of this.appState.contacts) {
            try {
                if (contact.chatId && contact.chatId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                    // Используем DecentralizedEventSystem для загрузки последнего сообщения
                    const eventSystem = this.appState.eventSystem;
                    if (eventSystem) {
                        const messages = await eventSystem.loadChatMessages(contact.address, 1);
                        
                        if (messages && messages.length > 0) {
                            const lastMsg = messages[messages.length - 1];
                            
                            // Расшифровываем сообщение
                            const encryptedMessage = CryptoUtils.getEncryptedFieldForUser(
                                this.appState.currentUser, 
                                contact.address, 
                                lastMsg
                            );
                            const decryptedText = CryptoUtils.decryptMessage(encryptedMessage);
                            
                            // Обновляем контакт
                            contact.lastMessage = decryptedText || 'Зашифрованное сообщение';
                            contact.lastMessageTime = lastMsg.timestamp || new Date(parseInt(lastMsg.messageTimestamp) * 1000);
                            contact.unreadCount = 0; // Будет вычисляться системой V2
                        } else {
                            contact.lastMessage = 'Нет сообщений';
                            contact.unreadCount = 0;
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ Ошибка загрузки сообщений для ${contact.name}:`, error);
                contact.lastMessage = 'Ошибка загрузки';
            }
        }
        
        console.log('✅ ContactListManager: Последние сообщения загружены');
    }

    // ========== 2. АНАЛИЗ СТАТУСА ЧАТОВ ==========

    /**
     * Получение информации о чате с контактом
     * @param {string} contactAddress - Адрес контакта
     * @returns {Object} Информация о чате
     */
    async getChatInfo(contactAddress) {
        try {
            // Проверяем кэш
            const cacheKey = `${this.appState.currentUser}-${contactAddress}`;
            if (this.chatInfoCache.has(cacheKey)) {
                return this.chatInfoCache.get(cacheKey);
            }

            // Получаем chatId
            const chatId = await this.contract.methods.getChatId(this.appState.currentUser, contactAddress).call();
            
            let chat = null;
            if (chatId && chatId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                chat = await this.contract.methods.getChat(chatId).call();
            }

            const result = { chatId, chat };
            
            // Кэшируем результат
            this.chatInfoCache.set(cacheKey, result);
            
            return result;
            
        } catch (error) {
            console.error(`❌ ContactListManager: Ошибка получения информации о чате с ${contactAddress}:`, error);
            return { chatId: null, chat: null };
        }
    }

    // ========== 3. РАБОТА С КЛЮЧАМИ ==========

    /**
     * Получение публичного ключа контакта
     * @param {string} contactAddress - Адрес контакта
     * @returns {string} Публичный ключ в hex формате
     */
    async getContactPublicKey(contactAddress) {
        try {
            // Проверяем кэш
            if (this.publicKeysCache.has(contactAddress)) {
                return this.publicKeysCache.get(contactAddress);
            }

            // Получаем из контракта
            const publicKey = await this.contract.methods.getPublicKey(contactAddress).call();
            
            // Кэшируем
            this.publicKeysCache.set(contactAddress, publicKey);
            
            return publicKey;
            
        } catch (error) {
            console.error(`❌ ContactListManager: Ошибка получения публичного ключа ${contactAddress}:`, error);
            return null;
        }
    }

    /**
     * Получение имени контакта из смарт-контракта
     * @param {string} contactAddress - Адрес контакта
     * @returns {string} Имя контакта
     */
    async getContactName(contactAddress) {
        try {
            // Получаем имя из контракта
            const userName = await this.contract.methods.getUserName(contactAddress).call();
            
            if (userName && userName.trim()) {
                return userName;
            } else {
                // Fallback - короткий адрес если имя не задано
                return `${contactAddress.slice(0, 6)}...${contactAddress.slice(-4)}`;
            }
            
        } catch (error) {
            console.error(`❌ ContactListManager: Ошибка получения имени ${contactAddress}:`, error);
            // Fallback - короткий адрес
            return `${contactAddress.slice(0, 6)}...${contactAddress.slice(-4)}`;
        }
    }

    // ========== 4. КЛАССИФИКАЦИЯ КОНТАКТОВ ==========

    /**
     * Определение типа контакта на основе статуса чата
     * @param {Object} chatInfo - Информация о чате
     * @returns {string} Тип контакта
     */
    classifyContact(chatInfo) {
        const { chat } = chatInfo;
        
        if (!chat) {
            return 'contact'; // Нет чата - обычный контакт
        }

        if (chat.isActive) {
            return 'contact'; // Активный чат - обычный контакт
        }

        if (chat.isNeedAcceptance) {
            // Есть приглашение - определяем направление
            if (chat.inviter.toLowerCase() === this.appState.currentUser.toLowerCase()) {
                return 'outgoing-request'; // Мы отправили приглашение
            } else {
                return 'incoming-request'; // Нам прислали приглашение
            }
        }

        return 'contact'; // По умолчанию обычный контакт
    }

    // ========== 5. СИНХРОНИЗАЦИЯ СОСТОЯНИЯ ==========

    /**
     * Полная перезагрузка списка контактов
     */
    async refreshContacts() {
        console.log('🔄 ContactListManager: Обновляем список контактов...');
        
        // Очищаем кэш
        this.chatInfoCache.clear();
        
        // Перезагружаем контакты
        await this.loadContacts();
        
        console.log('✅ ContactListManager: Список контактов обновлён');
    }

    /**
     * Обновление конкретного контакта
     * @param {string} contactAddress - Адрес контакта для обновления
     */
    async updateContact(contactAddress) {
        try {
            // Находим контакт в списке
            const contactIndex = this.appState.contacts.findIndex(c => 
                c.address.toLowerCase() === contactAddress.toLowerCase()
            );
            
            if (contactIndex >= 0) {
                // Обновляем информацию о чате
                const chatInfo = await this.getChatInfo(contactAddress);
                const contact = this.appState.contacts[contactIndex];
                
                contact.chatType = this.classifyContact(chatInfo);
                contact.invitationInfo = chatInfo.chat;
                
                // Уведомляем о изменении
                this.appState.setContacts([...this.appState.contacts]);
                
                console.log(`✅ ContactListManager: Контакт ${contact.name} обновлён`);
            }
        } catch (error) {
            console.error(`❌ ContactListManager: Ошибка обновления контакта ${contactAddress}:`, error);
        }
    }

    // ========== 6. UI СПИСКА КОНТАКТОВ ==========

    /**
     * Обработка клика по контакту (Master в Master-Detail)
     * @param {string} contactAddress - Адрес выбранного контакта
     * @param {string} contactName - Имя контакта
     */
    selectContact(contactAddress, contactName) {
        console.log('👆 ContactListManager: Выбран контакт:', contactName);
        
        // Обновляем заголовок чата
        const chatTitle = document.getElementById('chatTitle');
        if (chatTitle) chatTitle.textContent = contactName;
        
        // Устанавливаем текущий контакт в AppState (Master-Detail)
        this.appState.setCurrentContact({ address: contactAddress, name: contactName });
        
        console.log('✅ ContactListManager: currentContact установлен, ChatAreaManager получит уведомление');
    }

    /**
     * Настройка обработчиков кликов по контактам
     */
    setupContactClickHandlers() {
        document.querySelectorAll('.contact-item').forEach(item => {
            item.addEventListener('click', () => {
                const contactAddress = item.getAttribute('data-address');
                const contactName = item.querySelector('.contact-name').textContent;
                
                // Вызываем метод выбора контакта
                this.selectContact(contactAddress, contactName);
            });
        });
    }

    // ========== УТИЛИТНЫЕ МЕТОДЫ ==========


    /**
     * Очистка всех кэшей
     */
    clearCache() {
        this.contactsCache.clear();
        this.publicKeysCache.clear();
        this.chatInfoCache.clear();
        console.log('🧹 ContactListManager: Кэш очищен');
    }

    /**
     * Получение статистики для отладки
     * @returns {Object} Статистика модуля
     */
    getDebugInfo() {
        return {
            contactsCount: this.appState.contacts.length,
            cacheSize: {
                contacts: this.contactsCache.size,
                publicKeys: this.publicKeysCache.size,
                chatInfo: this.chatInfoCache.size
            },
            currentContact: this.appState.currentContact?.name || 'не выбран'
        };
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContactListManager;
}
