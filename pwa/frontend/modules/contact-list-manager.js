/**
 * ContactListManager - Управление списком контактов (левая панель)
 * CryptoMessenger v4.0.0
 */

class ContactListManager {
    constructor(appState, contract, eventSystem) {
        this.appState = appState;
        this.contract = contract;
        this.eventSystem = eventSystem;
        
        // Кэш для оптимизации
        this.contactsCache = new Map();
        this.publicKeysCache = new Map();
        this.chatInfoCache = new Map();
        
        // Подписываемся на изменения состояния
        this.appState.subscribe('contacts', this.onContactsChanged.bind(this));
        this.appState.subscribe('currentContact', this.onCurrentContactChanged.bind(this));
        
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
                    
                    // Определяем тип чата
                    const chatType = this.classifyContact(chatInfo);
                    
                    // Устанавливаем unreadCount в зависимости от типа
                    let unreadCount = 0;
                    if (chatType === 'incoming-request' || chatType === 'outgoing-request') {
                        unreadCount = '!'; // Приглашения всегда показывают "!"
                    }
                    
                    // Создаём объект контакта
                    const contact = {
                        address: address,
                        name: contactName,
                        publicKey: contactPublicKey,
                        chatId: chatInfo.chatId,
                        lastMessage: 'Загрузка...',
                        lastMessageTime: null,
                        unreadCount: unreadCount,
                        chatType: chatType,
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
                    if (this.eventSystem) {
                        const messages = await this.eventSystem.loadChatMessages(contact.address, 1);
                        
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
                            
                            // Для обычных контактов - показываем количество (временно 1-3)
                            if (contact.chatType === 'contact') {
                                contact.unreadCount = Math.floor(Math.random() * 3) + 1;
                            }
                            // Для приглашений unreadCount уже установлен как "!"
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
        
        // Уведомляем о изменении контактов для обновления UI
        this.appState.setContacts([...this.appState.contacts]);
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
            const userName = await this.contract.methods.getContactName(contactAddress).call();
            
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
     * Обновление интерфейса списка контактов
     */
    updateContactsUI() {
        console.log('🎨 ContactListManager: Обновляем UI контактов');
        console.log('📋 Контакты в appState:', this.appState.contacts.length, this.appState.contacts);
        
        const contactsList = document.getElementById('contactsList');
        if (!contactsList) {
            console.warn('⚠️ ContactListManager: Контейнер contactsList не найден');
            return;
        }
        
        contactsList.innerHTML = '';
        
        if (this.appState.contacts.length === 0) {
            console.warn('⚠️ ContactListManager: Контакты в appState пусты, показываем заглушку');
            contactsList.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">Контакты не найдены</div>';
            return;
        }
        
        // Отображаем все контакты
        this.appState.contacts.forEach((contact, index) => {
            const unreadCount = contact.unreadCount || 0;
            const contactWithUnread = { ...contact, unreadCount: unreadCount };
            const contactItem = this.createContactItem(contactWithUnread, contact.chatType, `contact-${index}`);
            contactsList.appendChild(contactItem);
        });
        
        // Настраиваем обработчики кликов для новых элементов
        this.setupContactClickHandlers();
    }

    /**
     * Создание элемента контакта для списка
     * @param {Object} contact - Объект контакта
     * @param {string} type - Тип контакта ('contact', 'incoming-request', 'outgoing-request')
     * @param {string} id - ID элемента
     * @returns {HTMLElement} Созданный элемент контакта
     */
    createContactItem(contact, type, id) {
        const contactItem = document.createElement('div');
        contactItem.className = `contact-item ${type}`;
        contactItem.setAttribute('data-contact-id', id);
        contactItem.setAttribute('data-address', contact.address);
        
        // Добавляем класс active если это текущий выбранный контакт
        if (this.appState.currentContact && 
            this.appState.currentContact.address.toLowerCase() === contact.address.toLowerCase()) {
            contactItem.classList.add('active');
        }
        
        const timeStr = contact.lastMessageTime ? 
            Utils.formatTime(contact.lastMessageTime) : 
            (contact.timestamp ? Utils.formatTime(contact.timestamp) : '');
        
        // Формируем бейдж для непрочитанных сообщений или приглашений
        let badge = '';
        
        if (type === 'incoming-request') {
            // Для входящих приглашений ВСЕГДА показываем красный "!" (приглашение нельзя "прочитать")
            badge = `<div class="contact-badge single-digit" style="background: #dc3545;">!</div>`;
        } else if (type === 'outgoing-request') {
            // Для исходящих приглашений показываем жёлтый "!" (постоянный)
            badge = `<div class="contact-badge single-digit" style="background: #ffc107; color: #000;">!</div>`;
        } else if (contact.unreadCount === '!' || contact.unreadCount > 0) {
            // Для обычных контактов показываем количество непрочитанных
            const badgeText = contact.unreadCount;
            const badgeClass = badgeText.toString().length > 1 ? 'multi-digit' : 'single-digit';
            badge = `<div class="contact-badge ${badgeClass}">${badgeText}</div>`;
        }

        // Генерируем цветной аватар
        const avatarColor = Utils.getAvatarColor(contact.address);

        contactItem.innerHTML = `
            <div class="contact-avatar" style="background: ${avatarColor};">${contact.name.charAt(0).toUpperCase()}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="contact-last-message">${contact.lastMessage || 'Нет сообщений'}</div>
            </div>
            <div class="contact-meta">
                <div class="contact-time">${timeStr}</div>
                ${badge}
            </div>
        `;

        return contactItem;
    }

    /**
     * Обновление подсветки активного контакта
     */
    updateActiveContactHighlight() {
        // Убираем класс active у всех контактов
        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Добавляем класс active текущему контакту
        if (this.appState.currentContact) {
            document.querySelectorAll('.contact-item').forEach(item => {
                const itemAddress = item.getAttribute('data-address');
                if (itemAddress && itemAddress.toLowerCase() === this.appState.currentContact.address.toLowerCase()) {
                    item.classList.add('active');
                }
            });
        }
    }

    /**
     * Обработка клика по контакту (Master в Master-Detail)
     * @param {string} contactAddress - Адрес выбранного контакта
     * @param {string} contactName - Имя контакта
     */
    selectContact(contactAddress, contactName) {
        console.log('👆 ContactListManager: Выбран контакт:', contactName);
        
        // Обновляем заголовок чата
        const chatTitle = document.getElementById('chatTitle');
        const chatSubtitle = document.getElementById('chatSubtitle');
        if (chatTitle) chatTitle.textContent = contactName;
        if (chatSubtitle) chatSubtitle.textContent = Utils.shortenAddress(contactAddress);
        
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

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ СОСТОЯНИЯ ==========

    /**
     * Обработчик изменения списка контактов
     * @param {Array} contacts - Новый список контактов
     */
    onContactsChanged(contacts) {
        console.log('📋 ContactListManager: Список контактов изменён:', contacts.length);
        this.updateContactsUI();
    }

    /**
     * Обработчик изменения текущего контакта
     * @param {Object} contact - Новый контакт
     */
    onCurrentContactChanged(contact) {
        console.log('👆 ContactListManager: Текущий контакт изменён:', contact?.name);
        this.updateActiveContactHighlight();
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContactListManager;
}
