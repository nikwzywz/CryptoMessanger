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
            <div class="contact-status" id="status-${address}">
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
}
