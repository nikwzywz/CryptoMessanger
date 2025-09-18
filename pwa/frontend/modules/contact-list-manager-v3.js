/**
 * ContactListManager V3 - Управление списком контактов для polling архитектуры
 * Работает через callbacks от DecentralizedEventSystem V3
 */

class ContactListManagerV3 {
    constructor(appState, contract, eventSystem) {
        this.appState = appState;
        this.contract = contract;
        this.eventSystem = eventSystem;
        
        // Расширенный кэш контактов со всей необходимой информацией
        this.contactsCache = new Map(); // address -> {name, publicKeyForEncode, lastMessageTime, lastMessageIndex, lastMessageText, frontendState, chatID, unreadCount, orderIndex}
        // chatStatesCache удален - состояния теперь хранятся в contactsCache.frontendState
        
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
    addContactsToUI(contacts) {
        console.log(`👥 V3: Добавляем контакты в UI:`, { count: contacts.length });
        if (contacts.length === 0) return;

        let newContactsAdded = false;
        for (const contact of contacts) {
            let { address, name, publicKeyForEncode, lastMessageTimestamp } = contact;
            
            // 🛡️ ПРАВИЛО: Все адреса храним и используем в lowerCase
            const addressLower = address.toLowerCase();

            // Проверяем наличие в кэше по lowercase адресу
            if (this.contactsCache.has(addressLower)) {
                console.log(`🔍 V3: Контакт ${addressLower} уже в кэше, пропускаем добавление в UI`);
                continue;
            }

            // Передаем в DOM lowercase адрес
            this.createContactElement(addressLower, name, lastMessageTimestamp);
            newContactsAdded = true;

            // Определяем orderIndex до добавления в кэш
            const currentContactsCount = this.contactsCache.size;

            // Сохраняем в кэш с lowercase адресом
            this.contactsCache.set(addressLower, {
                name: name,
                publicKeyForEncode: publicKeyForEncode,
                lastMessageTime: parseInt(lastMessageTimestamp) * 1000,
                lastMessageIndex: -1,
                lastMessageText: '',
                frontendState: 'unknown',      // Будет определено при анализе сообщений
                chatID: CryptoUtils.generateChatId(this.appState.currentUser, addressLower), // Предвычисленный chatID для оптимизации
                unreadCount: 0,                // Количество непрочитанных сообщений
                orderIndex: currentContactsCount // Начальная позиция в конце списка
            });
            console.log(`✅ V3: Контакт ${name} (${addressLower}) добавлен в кэш с orderIndex: ${currentContactsCount}`);
        }

        if (newContactsAdded) {
            console.log(`✅ V3: Добавлено ${newContactsAdded} контактов в UI`);
            
            // Применяем полную сортировку только при инициальной загрузке
            this.performInitialSort();
        }
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
        contactDiv.setAttribute('data-address', address.toLowerCase()); // Консистентный lowercase
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
    async selectContact(address, name) {
        try {
            const addressLower = address.toLowerCase();
            console.log('💬 V3: Выбираем контакт:', addressLower);

            // Обновляем активный контакт в UI
            document.querySelectorAll('.contact-item').forEach(item => {
                item.classList.remove('active');
            });
            const contactElement = document.querySelector(`[data-address="${addressLower}"]`);
            if (contactElement) {
                contactElement.classList.add('active');
            }

            // V3: Открываем чат через AppState, передавая lowercase адрес
            const contactData = this.contactsCache.get(addressLower);
            if (contactData) {
                this.appState.setCurrentContact({ address: addressLower, name: contactData.name });
            } else {
                console.error(`❌ V3: Не удалось найти данные для контакта ${addressLower} в кэше`);
                // Временное решение, чтобы избежать полной поломки
                this.appState.setCurrentContact({ address: addressLower, name: `User ${addressLower.slice(0, 6)}` });
            }
            
        } catch (error) {
            console.error('❌ Ошибка выбора контакта:', error);
            this.appState.showNotification('Ошибка открытия чата: ' + error.message, 'error');
        }
    }

    /**
     * Обновление иконки состояния чата
     */
    updateChatStateIcon(chatID, frontendState) {
        console.log(`🔄 V3: Обновляем иконку состояния чата:`, {
            chatID: chatID.substring(0, 8),
            frontendState: frontendState
        });
        
        // Обновляем состояние в contactsCache
        this.setChatState(chatID, frontendState);
        
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
        if (contact && contact.address) {
            console.log('👤 V3: Выбран контакт:', contact.name);
            
            // Сбрасываем счетчик непрочитанных сообщений для выбранного контакта
            this.resetUnreadCount(contact.address);
            
            if (this.resetUnreadCount(contact.address)) {
                console.log('📖 V3: Счетчик непрочитанных сброшен для активного контакта');
            }
            
            // Обновляем подсветку активного контакта
            this.updateActiveContactHighlight(contact.address);
        }
    }

    /**
     * Обновление подсветки активного контакта
     */
    updateActiveContactHighlight(activeAddress) {
        // Убираем активный класс у всех контактов
        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Добавляем активный класс к выбранному контакту
        const activeElement = document.querySelector(`[data-address="${activeAddress}"]`);
        if (activeElement) {
            activeElement.classList.add('active');
        }
    }

    /**
     * Получение данных контакта из кэша
     */
    getContactData(address) {
        return this.contactsCache.get(address.toLowerCase());
    }

    /**
     * Обновление данных контакта в кэше
     */
    updateContactData(address, updates) {
        console.log(`📊 V3: updateContactData НАЧАТ для ${address}:`, {
            updates: updates,
            caller: new Error().stack.split('\n')[2].trim() // Показываем кто вызвал
        });
        
        const existingData = this.contactsCache.get(address.toLowerCase());
        if (existingData) {
            // Обновляем только переданные поля
            const updatedData = { ...existingData, ...updates };
            this.contactsCache.set(address.toLowerCase(), updatedData);
            
            console.log(`📋 V3: Обновлены данные контакта ${address}:`, {
                updates: updates,
                newData: updatedData
            });
            
            // Обновляем UI элемент контакта если нужно
            console.log(`🎨 V3: Вызываем updateContactElementUI для ${address}`);
            this.updateContactElementUI(address, updatedData);
        } else {
            console.warn(`⚠️ V3: Попытка обновить несуществующий контакт:`, address);
        }
    }

    /**
     * Обновление UI элемента контакта
     */
    updateContactElementUI(address, contactData) {
        console.log(`🎨 V3: updateContactElementUI начат для ${address}:`, {
            frontendState: contactData.frontendState,
            orderIndex: contactData.orderIndex,
            lastMessageText: contactData.lastMessageText?.substring(0, 30)
        });
        
        // Ищем элемент по lowercase адресу (консистентно с data-address)
        const contactElement = document.querySelector(`[data-address="${address.toLowerCase()}"]`);
        if (!contactElement) {
            // Диагностика: показываем все существующие data-address
            const allElements = document.querySelectorAll('[data-address]');
            const existingAddresses = Array.from(allElements).map(el => el.getAttribute('data-address'));
            
            console.warn(`⚠️ V3: DOM элемент для ${address} не найден в updateContactElementUI`);
            console.warn(`🔍 V3: Существующие data-address в DOM:`, existingAddresses);
            console.warn(`🔍 V3: Искали адрес (lower):`, address.toLowerCase());
            return;
        }

        // Обновляем последнее сообщение
        const lastMessageElement = contactElement.querySelector('.contact-last-message');
        if (lastMessageElement) {
            if (contactData.lastMessageText) {
                // Показываем время и текст последнего сообщения
                const timeStr = contactData.lastMessageTime ? 
                    Utils.formatTime(new Date(contactData.lastMessageTime)) : '';
                
                // Ограничиваем длину текста сообщения
                const shortText = contactData.lastMessageText.length > 50 ? 
                    contactData.lastMessageText.substring(0, 50) + '...' : 
                    contactData.lastMessageText;
                
                lastMessageElement.textContent = `${timeStr}: ${shortText}`;
                lastMessageElement.title = `${timeStr} - ${contactData.lastMessageText}`;
            } else {
                // Показываем статус если нет сообщений
                const statusText = this.getStatusText(contactData.frontendState);
                lastMessageElement.textContent = statusText;
                lastMessageElement.title = statusText;
            }
        }

        // Обновляем иконку состояния
        this.updateChatStateIcon(contactData.chatID, contactData.frontendState);
        
        // Обновляем бейдж с количеством непрочитанных сообщений
        this.updateUnreadBadge(address, contactData.unreadCount);
        
        // Двухэтапное обновление позиций: сначала модель, потом DOM
        console.log(`🔄 V3: Запускаем двухэтапное обновление позиций для ${address}`);
        this.recalculateContactOrder(address);
        this.syncDOMWithModel();
    }

    /**
     * Обновление бейджа с количеством непрочитанных сообщений
     */
    updateUnreadBadge(address, unreadCount) {
        const contactElement = document.querySelector(`[data-address="${address}"]`);
        if (!contactElement) return;

        let unreadBadge = contactElement.querySelector('.unread-count');
        
        if (unreadCount > 0) {
            // Создаем бейдж если его нет
            if (!unreadBadge) {
                unreadBadge = document.createElement('div');
                unreadBadge.className = 'unread-count';
                contactElement.appendChild(unreadBadge);
            }
            
            // Обновляем текст и показываем
            unreadBadge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
            unreadBadge.style.display = 'block';
            
            console.log(`🔔 V3: Показан бейдж непрочитанных для ${address}: ${unreadCount}`);
        } else {
            // Скрываем бейдж если нет непрочитанных
            if (unreadBadge) {
                unreadBadge.style.display = 'none';
            }
        }
    }

    /**
     * Получение текста статуса для отображения
     */
    getStatusText(frontendState) {
        switch (frontendState) {
            case 'allowedWrite':
                return 'Активный чат';
            case 'notAllowedWrite':
                return 'Чат заблокирован';
            case 'waitingAcceptanceFromMe':
                return 'Входящее приглашение';
            case 'waitingAcceptanceFromOther':
                return 'Ожидание ответа';
            case 'unknown':
            default:
                return 'Новый контакт';
        }
    }

    /**
     * Получение состояния чата по chatID
     */
    getChatState(chatID) {
        // Ищем контакт с данным chatID
        for (const contactData of this.contactsCache.values()) {
            if (contactData.chatID === chatID) {
                return contactData.frontendState || 'unknown';
            }
        }
        return 'unknown';
    }

    /**
     * Установка состояния чата
     */
    setChatState(chatID, frontendState) {
        console.log(`🔄 V3: setChatState вызван:`, {
            chatID: chatID.substring(0, 8),
            frontendState: frontendState
        });
        
        // Находим контакт по chatID и обновляем его состояние
        for (const [address, contactData] of this.contactsCache.entries()) {
            if (contactData.chatID === chatID) {
                console.log(`📍 V3: Найден контакт для обновления состояния:`, {
                    address: address,
                    oldState: contactData.frontendState,
                    newState: frontendState,
                    currentOrderIndex: contactData.orderIndex
                });
                
                console.log(`🔄 V3: setChatState → updateContactData для ${address}`);
                this.updateContactData(address, { frontendState: frontendState });
                console.log(`✅ V3: Состояние чата ${chatID.substring(0, 8)} установлено: ${frontendState}`);
                return;
            }
        }
        console.warn(`⚠️ V3: Не найден контакт для chatID: ${chatID.substring(0, 8)}`);
    }

    /**
     * Очистка кэшей
     */
    clearCache() {
        this.contactsCache.clear();
        // chatStatesCache удален - состояния хранятся в contactsCache
        
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
            // chatStatesCount удален - состояния хранятся в contactsCache
            knownContacts: Array.from(this.contactsCache.keys()),
            contactsWithStates: Array.from(this.contactsCache.values()).map(c => ({
                address: Object.keys(this.contactsCache).find(addr => this.contactsCache.get(addr) === c),
                frontendState: c.frontendState,
                lastMessageTime: c.lastMessageTime
            }))
        };
    }

    /**
     * Обновление данных последнего сообщения для контакта
     */
    updateLastMessage(chatID, messageIndex, messageText, messageTime, frontendState, isFromCurrentUser = false) {
        // Находим контакт по chatID
        for (const [address, contactData] of this.contactsCache.entries()) {
            if (contactData.chatID === chatID) {
                // Обновляем только если это более новое сообщение
                if (messageIndex > contactData.lastMessageIndex) {
                    const updates = {
                        lastMessageIndex: messageIndex,
                        lastMessageText: messageText,
                        lastMessageTime: messageTime,
                        frontendState: frontendState
                    };
                    
                    // Увеличиваем счетчик непрочитанных, если это НЕ текущий активный контакт
                    // и сообщение НЕ от текущего пользователя
                    const currentContact = this.appState.currentContact;
                    const isCurrentActiveContact = currentContact && currentContact.address.toLowerCase() === address.toLowerCase();
                    
                    if (!isFromCurrentUser && !isCurrentActiveContact) {
                        updates.unreadCount = contactData.unreadCount + 1;
                        console.log(`🔔 V3: Увеличен счетчик непрочитанных для ${address}: ${updates.unreadCount}`);
                    }
                    
                    console.log(`📨 V3: updateLastMessage → updateContactData для ${address} с обновлениями:`, updates);
                    this.updateContactData(address, updates);
                    
                    console.log(`📨 V3: Обновлено последнее сообщение для ${address}:`, {
                        messageIndex: messageIndex,
                        messageText: messageText.substring(0, 50) + '...',
                        frontendState: frontendState,
                        unreadCount: updates.unreadCount || contactData.unreadCount
                    });
                }
                return;
            }
        }
        console.warn(`⚠️ V3: Не найден контакт для обновления сообщения chatID: ${chatID.substring(0, 8)}`);
    }

    /**
     * Сброс счетчика непрочитанных сообщений для контакта
     */
    resetUnreadCount(address) {
        // 🛡️ ПРАВИЛО: Используем lowercase для поиска
        const addressLower = address.toLowerCase();
        const contactData = this.contactsCache.get(addressLower);
        if (contactData && contactData.unreadCount > 0) {
            console.log(`💬 V3: Сбрасываем счетчик непрочитанных для ${addressLower}`);
            contactData.unreadCount = 0;
            this.updateUnreadBadge(addressLower, 0);
        }
    }

    /**
     * Инкремент счетчика непрочитанных сообщений для контакта
     */
    incrementUnreadCount(address, increment = 1) {
        const contactData = this.contactsCache.get(address.toLowerCase());
        if (contactData) {
            const newCount = contactData.unreadCount + increment;
            this.updateContactData(address, { unreadCount: newCount });
            console.log(`🔔 V3: Увеличен счетчик непрочитанных для ${address}: ${newCount}`);
            return newCount;
        }
        return 0;
    }

    /**
     * Определение приоритета состояния контакта для сортировки
     */
    getStatePriority(frontendState) {
        const statePriority = {
            'waitingAcceptanceFromMe': 1,    // Входящие приглашения - высший приоритет
            'waitingAcceptanceFromOther': 2, // Исходящие приглашения
            'allowedWrite': 3,               // Активные чаты
            'notAllowedWrite': 4,            // Заблокированные чаты
            'unknown': 5                     // Неизвестное состояние - низший приоритет
        };
        return statePriority[frontendState] || 5;
    }

    /**
     * Сравнение двух контактов для определения порядка
     */
    compareContacts(contactA, contactB) {
        // Сначала по приоритету состояния
        const priorityA = this.getStatePriority(contactA.frontendState);
        const priorityB = this.getStatePriority(contactB.frontendState);
        
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }
        
        // Затем по времени последнего сообщения (новые сначала)
        const timeA = contactA.lastMessageTime || 0;
        const timeB = contactB.lastMessageTime || 0;
        
        return timeB - timeA;
    }

    /**
     * Этап 1: Перерасчет orderIndex в модели данных (без изменения DOM)
     */
    recalculateContactOrder(address) {
        console.log(`📊 V3: Перерасчет orderIndex для ${address}`);
        
        const contactData = this.contactsCache.get(address.toLowerCase());
        if (!contactData) {
            console.warn(`⚠️ V3: Контакт ${address} не найден для перерасчета`);
            return;
        }

        // 1.1. Определяем новую позицию без изменения модели
        const updatedContact = { address, ...contactData };
        const sortedContacts = this.sortAllContacts();
        
        let orderIndexNew = 0;
        for (let i = 0; i < sortedContacts.length; i++) {
            if (this.compareContacts(updatedContact, sortedContacts[i]) < 0) {
                orderIndexNew = i;
                break;
            }
            orderIndexNew = i + 1;
        }

        const oldOrderIndex = contactData.orderIndex;
        
        console.log(`📊 V3: Рассчитана новая позиция:`, {
            address: address,
            oldOrderIndex: oldOrderIndex,
            orderIndexNew: orderIndexNew,
            priority: this.getStatePriority(contactData.frontendState)
        });

        // Если позиция не изменилась, ничего не делаем
        if (oldOrderIndex === orderIndexNew) {
            console.log(`📋 V3: Позиция ${address} не изменилась (${orderIndexNew}), перерасчет не нужен`);
            return;
        }

        // 1.2. Устанавливаем новый orderIndex обновляемому контакту
        contactData.orderIndex = orderIndexNew;

        // 1.3. Инкрементируем orderIndex всем контактам, которые сдвигаются
        for (const [otherAddress, otherData] of this.contactsCache.entries()) {
            if (otherAddress.toLowerCase() !== address.toLowerCase()) {
                if (orderIndexNew < oldOrderIndex) {
                    // Контакт поднимается вверх - сдвигаем вниз тех, кто был выше новой позиции
                    if (otherData.orderIndex >= orderIndexNew && otherData.orderIndex < oldOrderIndex) {
                        otherData.orderIndex++;
                    }
                } else {
                    // Контакт опускается вниз - сдвигаем вверх тех, кто был ниже старой позиции
                    if (otherData.orderIndex > oldOrderIndex && otherData.orderIndex <= orderIndexNew) {
                        otherData.orderIndex--;
                    }
                }
            }
        }

        console.log(`✅ V3: Перерасчет orderIndex завершен для ${address}: ${oldOrderIndex} → ${orderIndexNew}`);
    }

    /**
     * Этап 2: Синхронизация DOM с моделью данных
     */
    syncDOMWithModel() {
        console.log(`🔄 V3: Синхронизация DOM с моделью данных`);
        
        const contactsList = document.getElementById('contactsList');
        if (!contactsList) {
            console.warn(`⚠️ V3: Контейнер contactsList не найден`);
            return;
        }

        // Получаем все контакты отсортированные по orderIndex
        const contactsArray = Array.from(this.contactsCache.entries())
            .map(([address, data]) => ({ address, ...data }))
            .sort((a, b) => a.orderIndex - b.orderIndex);

        // Перестраиваем DOM в соответствии с orderIndex
        const contactElements = [];
        contactsArray.forEach(contact => {
            const element = document.querySelector(`[data-address="${contact.address}"]`);
            if (element) {
                contactElements.push(element);
                element.remove(); // Временно удаляем
            }
        });

        // Добавляем в правильном порядке
        contactElements.forEach(element => {
            contactsList.appendChild(element);
        });

        console.log(`✅ V3: DOM синхронизирован с моделью (${contactElements.length} контактов)`);
    }

    /**
     * Устаревший метод - заменен на recalculateContactOrder + syncDOMWithModel
     * Находит новую позицию для обновленного контакта без полной пересортировки
     * 
     * Примеры:
     * - Контакт №537 получил сообщение → перемещается на позицию №3 (после приглашений)
     * - Контакт №12 деактивировал чат → перемещается на позицию №974 (в конец)
     */
    repositionContactInList(address) {
        console.log(`🔄 V3: repositionContactInList вызван для:`, {
            address: address,
            contactExists: this.contactsCache.has(address.toLowerCase())
        });
        
        const contactData = this.contactsCache.get(address.toLowerCase());
        if (!contactData) {
            console.warn(`⚠️ V3: Контакт ${address} не найден в кэше`);
            return;
        }

        const contactElement = document.querySelector(`[data-address="${address}"]`);
        if (!contactElement) {
            console.warn(`⚠️ V3: DOM элемент для ${address} не найден`);
            return;
        }

        const contactsList = document.getElementById('contactsList');
        if (!contactsList) {
            console.warn(`⚠️ V3: Контейнер contactsList не найден`);
            return;
        }

        console.log(`📊 V3: Данные контакта для сортировки:`, {
            address: address,
            frontendState: contactData.frontendState,
            lastMessageTime: contactData.lastMessageTime,
            orderIndex: contactData.orderIndex,
            priority: this.getStatePriority(contactData.frontendState)
        });

        try {
            // 1️⃣ Получаем текущую позицию контакта из модели данных (Model-View принцип)
            const currentPosition = contactData.orderIndex;

            if (currentPosition === -1) {
                console.warn(`⚠️ V3: Контакт ${address} не имеет orderIndex в модели данных - принудительно обновляем индексы`);
                this.updateAllContactIndices();
                
                // После обновления индексов получаем новую позицию
                const updatedContactData = this.contactsCache.get(address.toLowerCase());
                if (updatedContactData && updatedContactData.orderIndex !== -1) {
                    console.log(`✅ V3: orderIndex обновлен до ${updatedContactData.orderIndex}, продолжаем сортировку`);
                    // Рекурсивно вызываем себя с обновленными данными
                    this.repositionContactInList(address);
                }
                return;
            }

            // 2️⃣ Создаем объект контакта для сравнения с обновленными данными
            const updatedContact = { address, ...contactData };

            // 3️⃣ СНАЧАЛА определяем новую позицию используя модель данных (Model-View принцип)
            let newPosition = 0;
            let targetElement = null;

            // Получаем все контакты отсортированные по приоритету
            const sortedContacts = this.sortAllContacts();
            
            // Находим позицию обновленного контакта в отсортированном списке
            for (let i = 0; i < sortedContacts.length; i++) {
                if (this.compareContacts(updatedContact, sortedContacts[i]) < 0) {
                    newPosition = i;
                    break;
                }
                newPosition = i + 1;
            }

            // Находим целевой элемент в DOM по новой позиции
            const allContactElements = Array.from(contactsList.querySelectorAll('.contact-item'));
            if (newPosition < allContactElements.length) {
                // Если новая позиция до текущей, целевой элемент остается на месте
                if (newPosition <= currentPosition) {
                    targetElement = allContactElements[newPosition];
                } else {
                    // Если новая позиция после текущей, учитываем что текущий элемент удалится
                    targetElement = allContactElements[newPosition] || null;
                }
            } else {
                targetElement = null; // appendChild в конец
            }

            // 4️⃣ Проверяем, нужно ли вообще перемещать
            if (newPosition === currentPosition) {
                console.log(`📋 V3: Контакт ${address} остается на позиции ${currentPosition + 1} (перемещение не требуется)`);
                return;
            }

            // 5️⃣ ТРАНЗАКЦИОННОЕ перемещение: удаляем и сразу вставляем
            contactElement.remove();
            
            if (targetElement) {
                contactsList.insertBefore(contactElement, targetElement);
            } else {
                contactsList.appendChild(contactElement);
            }

            // 6️⃣ Обновляем orderIndex в модели данных после успешного перемещения
            contactData.orderIndex = newPosition;
            
            // Обновляем индексы всех контактов для синхронизации модели с DOM
            this.updateAllContactIndices();

            console.log(`📋 V3: Контакт ${address} успешно перемещен с позиции ${currentPosition + 1} на позицию ${newPosition + 1} (Model-View синхронизирован)`);

        } catch (error) {
            console.error(`❌ V3: Ошибка при перемещении контакта ${address}:`, error);
            
            // Восстанавливаем элемент в DOM если что-то пошло не так
            if (!document.querySelector(`[data-address="${address}"]`)) {
                console.log(`🔄 V3: Восстанавливаем контакт ${address} в конец списка`);
                contactsList.appendChild(contactElement);
            }
        }
    }

    /**
     * Полная сортировка контактов (используется только при инициализации)
     */
    sortAllContacts() {
        const contactsArray = Array.from(this.contactsCache.entries()).map(([address, data]) => ({
            address,
            ...data
        }));

        contactsArray.sort((a, b) => this.compareContacts(a, b));
        return contactsArray;
    }

    /**
     * Обновление индексов всех контактов в модели данных
     */
    updateAllContactIndices() {
        // Получаем отсортированный массив контактов
        const sortedContacts = this.sortAllContacts();
        
        // Обновляем orderIndex для каждого контакта в кэше
        sortedContacts.forEach((contact, index) => {
            const contactData = this.contactsCache.get(contact.address.toLowerCase());
            if (contactData) {
                contactData.orderIndex = index;
            }
        });
        
        console.log(`📊 V3: Обновлены orderIndex для ${sortedContacts.length} контактов в модели данных`);
        return sortedContacts;
    }

    /**
     * Выполнение начальной сортировки всех контактов (двухэтапная)
     */
    performInitialSort() {
        console.log(`🚀 V3: Начальная сортировка контактов`);
        
        // Этап 1: Обновляем orderIndex для всех контактов в модели
        this.updateAllContactIndices();
        
        // Этап 2: Синхронизируем DOM с моделью
        this.syncDOMWithModel();
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
            // 🛡️ ПРАВИЛО: Всегда приводим адрес к lowercase
            const recipientAddressLower = recipientAddress.toLowerCase();

            console.log('📤 V3: Отправляем приглашение:', {
                recipient: recipientAddressLower,
                message: message,
                fee: fee
            });
            
            // Валидация
            if (!recipientAddressLower || !recipientAddressLower.startsWith('0x') || recipientAddressLower.length !== 42) {
                throw new Error('Неверный формат адреса получателя');
            }
            if (recipientAddressLower === this.appState.currentUser.toLowerCase()) {
                throw new Error('Нельзя отправить приглашение самому себе');
            }
            if (this.contactsCache.has(recipientAddressLower)) {
                const contactData = this.contactsCache.get(recipientAddressLower);
                throw new Error(`Контакт "${contactData.name || recipientAddressLower}" уже есть в вашем списке`);
            }

            console.log('🔍 V3: Получаем публичный ключ для', recipientAddressLower);
            const recipientPublicKey = await this.getContactPublicKey(recipientAddressLower);
            
            console.log('✅ V3: Публичный ключ получен, начинаем шифрование...');
            const encryptedForRecipient = CryptoUtils.encryptMessage(message, recipientPublicKey);
            const encryptedForSender = CryptoUtils.encryptMessage(message, this.appState.userPublicKey);

            console.log('⛓️ V3: Отправляем транзакцию `invitationSend`...');
            await this.contract.methods.invitationSend(
                recipientAddressLower,
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
            
            console.log('🔑 V3: Публичный ключ для шифрования контакта:', {
                contactAddress: contactAddress,
                publicKeyForEncode: contactPublicKey.substring(0, 20) + '...',
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
    filterContacts(filterText) {
        const lowerCaseFilter = filterText.toLowerCase();
        const contactsList = document.getElementById('contactsList');
        if (!contactsList) return;

        // 🛡️ ПРАВИЛО: Итерируемся по кэшу, где адреса уже в lowercase
        this.contactsCache.forEach((contactData, address) => {
            const contactElement = contactsList.querySelector(`[data-address="${address}"]`);
            if (contactElement) {
                const name = contactData.name || '';
                // Сравниваем с lowercase адресом и именем
                if (name.toLowerCase().includes(lowerCaseFilter) || address.includes(lowerCaseFilter)) {
                    contactElement.style.display = '';
                } else {
                    contactElement.style.display = 'none';
                }
            }
        });
        
        console.log(`🔍 V3: Фильтрация контактов по запросу: "${filterText}"`);
    }
}
