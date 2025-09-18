/**
 * ContactListManager V3 - Управление списком контактов для polling архитектуры
 * Работает через callbacks от DecentralizedEventSystem V3
 */

class ContactListManagerV3 {
    constructor(appState, contract, eventSystem) {
        this.appState = appState;
        this.contract = contract;
        this.eventSystem = eventSystem;
        
        // Кэш контактов и их состояний
        this.contactsCache = new Map(); // address -> {name, publicKey}
        this.chatStatesCache = new Map(); // chatID -> frontendState
        
        // Подписываемся на изменения состояния
        this.appState.subscribe('currentContact', this.onCurrentContactChanged.bind(this));
        
        // Настраиваем поиск контактов
        this.setupContactSearch();
        
        console.log('📦 ContactListManager v3.0.0 - V3 polling architecture loaded');
        console.log('🔧 File: modules/contact-list-manager-v3.js');
    }

    /**
     * Добавление новых контактов в UI (вызывается из polling callback)
     */
    addContactsToUI(contactsData) {
        console.log('👥 V3: Добавляем контакты в UI:', {
            count: contactsData.contacts.length
        });
        
        const contactsList = document.getElementById('contactsList');
        if (!contactsList) {
            console.error('❌ V3: Список контактов не найден в DOM');
            return;
        }
        
        // Добавляем каждый контакт
        for (let i = 0; i < contactsData.contacts.length; i++) {
            const address = contactsData.contacts[i];
            const name = contactsData.names[i];
            const publicKey = contactsData.publicKeys[i];
            
            // Сохраняем в кэш
            this.contactsCache.set(address.toLowerCase(), {
                name: name,
                publicKey: publicKey
            });
            
            // Создаем элемент контакта
            this.createContactElement(address, name);
        }
        
        console.log(`✅ V3: Добавлено ${contactsData.contacts.length} контактов в UI`);
    }

    /**
     * Создание DOM элемента контакта
     */
    createContactElement(address, name) {
        const contactsList = document.getElementById('contactsList');
        
        // Проверяем, что контакт еще не существует
        const existingContact = contactsList.querySelector(`[data-address="${address}"]`);
        if (existingContact) {
            console.log(`⚠️ V3: Контакт ${name} уже существует в UI`);
            return;
        }
        
        const contactDiv = document.createElement('div');
        contactDiv.className = 'contact-item';
        contactDiv.setAttribute('data-address', address);
        contactDiv.setAttribute('data-name', name);
        
        contactDiv.innerHTML = `
            <div class="contact-avatar">
                <span class="contact-initial">${name.charAt(0).toUpperCase()}</span>
            </div>
            <div class="contact-info">
                <div class="contact-name">${name}</div>
                <div class="contact-address">${address.slice(0, 6)}...${address.slice(-4)}</div>
            </div>
            <div class="contact-status" id="status-${address.toLowerCase()}">
                <!-- Статус будет обновлен через updateChatStateIcon -->
            </div>
        `;
        
        // Добавляем обработчик клика
        contactDiv.addEventListener('click', () => {
            this.selectContact(address, name);
        });
        
        contactsList.appendChild(contactDiv);
        
        console.log(`👤 V3: Контакт ${name} добавлен в UI`);
    }

    /**
     * Выбор контакта (клик по элементу списка)
     */
    selectContact(address, name) {
        console.log(`👆 V3: Выбран контакт:`, { address, name });
        
        // Убираем активность с других контактов
        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Добавляем активность к выбранному
        const contactElement = document.querySelector(`[data-address="${address}"]`);
        if (contactElement) {
            contactElement.classList.add('active');
        }
        
        // Обновляем состояние приложения
        this.appState.setCurrentContact({
            address: address,
            name: name,
            publicKey: this.contactsCache.get(address.toLowerCase())?.publicKey
        });
    }

    /**
     * Обновление иконки состояния чата
     */
    updateChatStateIcon(chatID, frontendState) {
        console.log(`🔄 V3: Обновляем иконку состояния чата:`, {
            chatID: chatID.substring(0, 8),
            frontendState: frontendState
        });
        
        // Сохраняем состояние в кэш
        this.chatStatesCache.set(chatID, frontendState);
        
        // Находим соответствующий элемент контакта
        const contactAddress = this.findContactByChartID(chatID);
        if (!contactAddress) {
            console.warn('⚠️ V3: Не найден контакт для chatID:', chatID.substring(0, 8));
            return;
        }
        
        const statusElement = document.getElementById(`status-${contactAddress}`);
        if (!statusElement) {
            console.warn('⚠️ V3: Не найден элемент статуса для контакта:', contactAddress);
            return;
        }
        
        // Обновляем иконку в зависимости от состояния
        switch (frontendState) {
            case 'allowedWrite':
                statusElement.innerHTML = '💬'; // Обычный чат
                statusElement.className = 'contact-status active';
                break;
                
            case 'notAllowedWrite':
                statusElement.innerHTML = '🚫'; // Заблокированный
                statusElement.className = 'contact-status blocked';
                break;
                
            case 'waitingAcceptanceFromMe':
                statusElement.innerHTML = '📥'; // Входящее приглашение
                statusElement.className = 'contact-status incoming-request';
                break;
                
            case 'waitingAcceptanceFromOther':
                statusElement.innerHTML = '⏳'; // Ожидание принятия
                statusElement.className = 'contact-status outgoing-request';
                break;
                
            default:
                statusElement.innerHTML = '❓';
                statusElement.className = 'contact-status unknown';
        }
    }

    /**
     * Поиск адреса контакта по chatID
     */
    findContactByChartID(chatID) {
        // Проверяем все известные контакты
        for (const [contactAddress, contactData] of this.contactsCache) {
            const testChatID = this.generateChatId(this.appState.currentUser, contactAddress);
            if (testChatID === chatID) {
                return contactAddress;
            }
        }
        return null;
    }

    /**
     * Генерация chatID (аналогично контракту)
     */
    generateChatId(address1, address2) {
        return CryptoUtils.generateChatId(address1, address2);
    }

    /**
     * Обновление счетчика непрочитанных сообщений
     */
    updateUnreadCount(chatID, messageCount) {
        const contactAddress = this.findContactByChartID(chatID);
        if (!contactAddress) return;
        
        const contactElement = document.querySelector(`[data-address="${contactAddress}"]`);
        if (!contactElement) return;
        
        // Добавляем или обновляем счетчик
        let unreadBadge = contactElement.querySelector('.unread-count');
        if (!unreadBadge) {
            unreadBadge = document.createElement('div');
            unreadBadge.className = 'unread-count';
            contactElement.appendChild(unreadBadge);
        }
        
        unreadBadge.textContent = messageCount;
        unreadBadge.style.display = messageCount > 0 ? 'block' : 'none';
        
        console.log(`🔔 V3: Обновлен счетчик непрочитанных для ${contactAddress}:`, messageCount);
    }

    /**
     * Обработчик изменения текущего контакта
     */
    onCurrentContactChanged(contact) {
        if (contact) {
            console.log('👤 V3: Выбран контакт:', contact.name);
            
            // Сбрасываем счетчик непрочитанных для выбранного контакта
            const contactElement = document.querySelector(`[data-address="${contact.address}"]`);
            if (contactElement) {
                const unreadBadge = contactElement.querySelector('.unread-count');
                if (unreadBadge) {
                    unreadBadge.style.display = 'none';
                }
            }
        }
    }

    /**
     * Получение данных контакта из кэша
     */
    getContactData(address) {
        return this.contactsCache.get(address.toLowerCase());
    }

    /**
     * Получение состояния чата
     */
    getChatState(chatID) {
        return this.chatStatesCache.get(chatID) || 'unknown';
    }

    /**
     * Очистка кэшей
     */
    clearCache() {
        this.contactsCache.clear();
        this.chatStatesCache.clear();
        
        // Очищаем UI
        const contactsList = document.getElementById('contactsList');
        if (contactsList) {
            contactsList.innerHTML = '';
        }
        
        console.log('🗑️ V3: Кэш ContactListManager очищен');
    }

    /**
     * Получение статистики
     */
    getStats() {
        return {
            contactsCount: this.contactsCache.size,
            chatStatesCount: this.chatStatesCache.size,
            knownContacts: Array.from(this.contactsCache.keys())
        };
    }

    /**
     * Открытие модального окна приглашения
     */
    openInvitationModal(recipientAddress = '', isReadOnly = false) {
        const modal = document.getElementById('invitationModal');
        const addressField = document.getElementById('recipientAddress');
        
        // Заполняем адрес получателя
        addressField.value = recipientAddress;
        
        // Устанавливаем режим readonly если нужно
        if (isReadOnly) {
            addressField.readOnly = true;
            addressField.style.backgroundColor = '#3a3a3a';
            addressField.style.color = '#aaa';
            addressField.title = 'Адрес получателя зафиксирован для этого контакта';
        } else {
            addressField.readOnly = false;
            addressField.style.backgroundColor = '#2a2a2a';
            addressField.style.color = '#fff';
            addressField.title = '';
        }
        
        // Показываем модальное окно
        modal.style.display = 'flex';
        
        console.log('📤 V3: Открыто модальное окно приглашения:', {
            recipientAddress: recipientAddress,
            isReadOnly: isReadOnly
        });
    }

    /**
     * Закрытие модального окна приглашения
     */
    closeInvitationModal() {
        const modal = document.getElementById('invitationModal');
        const addressField = document.getElementById('recipientAddress');
        
        // Сбрасываем состояние поля адреса
        addressField.readOnly = false;
        addressField.style.backgroundColor = '#2a2a2a';
        addressField.style.color = '#fff';
        addressField.title = '';
        
        // Закрываем модальное окно
        modal.style.display = 'none';
        
        console.log('❌ V3: Модальное окно приглашения закрыто');
    }

    /**
     * Отправка приглашения V3 (перенесено из ChatAreaManagerV3)
     */
    async sendInvitation(recipientAddress, message, fee) {
        try {
            console.log('📤 V3: Отправляем приглашение:', {
                recipient: recipientAddress,
                message: message,
                fee: fee
            });
            
            // Проверяем валидность адреса
            if (!recipientAddress || !recipientAddress.startsWith('0x') || recipientAddress.length !== 42) {
                throw new Error('Неверный формат адреса получателя');
            }
            
            // Проверяем, что не пытаемся добавить самого себя
            if (recipientAddress.toLowerCase() === this.appState.currentUser.toLowerCase()) {
                throw new Error('Нельзя отправить приглашение самому себе');
            }
            
            // Проверяем, что контакт не добавлен уже
            if (this.contactsCache.has(recipientAddress.toLowerCase())) {
                const contactData = this.contactsCache.get(recipientAddress.toLowerCase());
                throw new Error(`Контакт "${contactData.name || recipientAddress}" уже есть в вашем списке`);
            }
            
            // Получаем публичный ключ получателя
            const recipientPublicKey = await this.getContactPublicKey(recipientAddress);
            
            // Шифруем сообщение для обеих сторон
            const encryptedForRecipient = CryptoUtils.encryptMessage(message, recipientPublicKey);
            const encryptedForSender = CryptoUtils.encryptMessage(message, this.appState.userPublicKey);
            
            // Отправляем приглашение через контракт
            await this.contract.methods.invitationSend(
                recipientAddress,
                encryptedForRecipient,
                encryptedForSender
            ).send({ 
                from: this.appState.currentUser,
                value: web3.utils.toWei(fee.toString(), 'ether')
            });
            
            console.log('✅ V3: Приглашение отправлено');
            
            // Закрываем модальное окно
            this.closeInvitationModal();
            
        } catch (error) {
            console.error('❌ V3: Ошибка отправки приглашения:', error);
            
            // Показываем понятное сообщение пользователю
            if (this.appState.showNotification) {
                if (error.message.includes('не зарегистрирован')) {
                    this.appState.showNotification('Получатель не зарегистрирован в системе', 'error');
                } else if (error.message.includes('уже есть в вашем списке')) {
                    this.appState.showNotification(error.message, 'warning');
                } else if (error.message.includes('самому себе')) {
                    this.appState.showNotification('Нельзя отправить приглашение самому себе', 'warning');
                } else if (error.message.includes('Неверный формат адреса')) {
                    this.appState.showNotification('Неверный формат адреса получателя', 'error');
                } else {
                    this.appState.showNotification('Ошибка отправки приглашения: ' + error.message, 'error');
                }
            }
            
            throw error;
        }
    }

    /**
     * Получение публичного ключа контакта
     */
    async getContactPublicKey(contactAddress) {
        try {
            const userSettings = await this.contract.methods.userSettings(contactAddress).call();
            const contactPublicKey = userSettings.publicKeyForEncode;
            
            console.log('🔑 V3: Публичный ключ контакта:', {
                contactAddress: contactAddress,
                publicKey: contactPublicKey.substring(0, 20) + '...',
                fullLength: contactPublicKey.length
            });
            
            // Проверяем, что пользователь зарегистрирован
            if (!contactPublicKey || contactPublicKey === '0x' || contactPublicKey.length < 60) {
                throw new Error(`Пользователь ${contactAddress} не зарегистрирован в системе или имеет неверный публичный ключ`);
            }
            
            return contactPublicKey;
        } catch (error) {
            console.error('❌ V3: Ошибка получения публичного ключа:', error);
            throw error;
        }
    }

    /**
     * Настройка поиска контактов (перенесено из main.html)
     */
    setupContactSearch() {
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                this.filterContacts(event.target.value);
            });
            console.log('🔍 V3: Поиск контактов настроен');
        } else {
            console.warn('⚠️ V3: Поле поиска контактов не найдено');
        }
    }

    /**
     * Фильтрация контактов по поисковому запросу
     */
    filterContacts(searchTerm) {
        const term = searchTerm.toLowerCase();
        const contacts = document.querySelectorAll('.contact-item');
        
        contacts.forEach(contact => {
            const nameElement = contact.querySelector('.contact-name');
            const messageElement = contact.querySelector('.contact-last-message');
            
            if (nameElement) {
                const name = nameElement.textContent.toLowerCase();
                const message = messageElement ? messageElement.textContent.toLowerCase() : '';
                
                if (name.includes(term) || message.includes(term)) {
                    contact.style.display = 'flex';
                } else {
                    contact.style.display = 'none';
                }
            }
        });
        
        console.log(`🔍 V3: Фильтрация контактов по запросу: "${searchTerm}"`);
    }
}
