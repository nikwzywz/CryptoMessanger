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
            
            // Генерируем chatID для контакта
            const chatID = CryptoUtils.generateChatId(this.appState.currentUser, address);
            
            // Сохраняем в расширенный кэш
            this.contactsCache.set(address.toLowerCase(), {
                name: name,
                publicKeyForEncode: publicKey, // Специальный ключ для шифрования (не кошелек!)
                lastMessageTime: null,         // Будет обновлено при получении сообщений
                lastMessageIndex: -1,          // -1 означает отсутствие сообщений
                lastMessageText: '',           // Пустая строка по умолчанию
                frontendState: 'unknown',      // Будет определено при анализе сообщений
                chatID: chatID,                // Предвычисленный chatID для оптимизации
                unreadCount: 0,                // Количество непрочитанных сообщений
                orderIndex: -1                 // Позиция в отсортированном списке (-1 = не определена)
            });
            
            // Создаем элемент контакта
            this.createContactElement(address, name);
        }
        
        console.log(`✅ V3: Добавлено ${contactsData.contacts.length} контактов в UI`);
        
        // Применяем полную сортировку только при инициальной загрузке
        this.performInitialSort();
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
            publicKeyForEncode: this.contactsCache.get(address.toLowerCase())?.publicKeyForEncode
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
            const wasReset = this.resetUnreadCount(contact.address);
            
            if (wasReset) {
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
            this.updateContactElementUI(address, updatedData);
        } else {
            console.warn(`⚠️ V3: Попытка обновить несуществующий контакт:`, address);
        }
    }

    /**
     * Обновление UI элемента контакта
     */
    updateContactElementUI(address, contactData) {
        const contactElement = document.querySelector(`[data-address="${address}"]`);
        if (!contactElement) return;

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
        
        // Оптимизированное перемещение: находим новую позицию для обновленного контакта
        this.repositionContactInList(address);
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
        // Находим контакт по chatID и обновляем его состояние
        for (const [address, contactData] of this.contactsCache.entries()) {
            if (contactData.chatID === chatID) {
                this.updateContactData(address, { frontendState: frontendState });
                console.log(`🔄 V3: Состояние чата ${chatID.substring(0, 8)} установлено: ${frontendState}`);
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
        const contactData = this.contactsCache.get(address.toLowerCase());
        if (contactData && contactData.unreadCount > 0) {
            this.updateContactData(address, { unreadCount: 0 });
            console.log(`📖 V3: Сброшен счетчик непрочитанных для ${address}`);
            return true;
        }
        return false;
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
     * Оптимизированное перемещение контакта в правильную позицию в списке
     * Находит новую позицию для обновленного контакта без полной пересортировки
     * 
     * Примеры:
     * - Контакт №537 получил сообщение → перемещается на позицию №3 (после приглашений)
     * - Контакт №12 деактивировал чат → перемещается на позицию №974 (в конец)
     */
    repositionContactInList(address) {
        const contactData = this.contactsCache.get(address.toLowerCase());
        if (!contactData) return;

        const contactElement = document.querySelector(`[data-address="${address}"]`);
        if (!contactElement) return;

        const contactsList = document.getElementById('contactsList');
        if (!contactsList) return;

        try {
            // 1️⃣ Получаем текущую позицию контакта из модели данных (Model-View принцип)
            const currentPosition = contactData.orderIndex;

            if (currentPosition === -1) {
                console.warn(`⚠️ V3: Контакт ${address} не имеет orderIndex в модели данных`);
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
     * Выполнение начальной сортировки всех контактов в DOM
     */
    performInitialSort() {
        const contactsList = document.getElementById('contactsList');
        if (!contactsList) return;

        // Обновляем индексы в модели данных и получаем отсортированный массив
        const sortedContacts = this.updateAllContactIndices();
        
        // Перестраиваем DOM в правильном порядке (View следует за Model)
        const contactElements = [];
        sortedContacts.forEach(contact => {
            const element = document.querySelector(`[data-address="${contact.address}"]`);
            if (element) {
                contactElements.push(element);
                element.remove(); // Временно удаляем из DOM
            }
        });
        
        // Добавляем элементы в правильном порядке
        contactElements.forEach(element => {
            contactsList.appendChild(element);
        });
        
        console.log(`📋 V3: DOM синхронизирован с моделью данных (${sortedContacts.length} контактов)`);
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
