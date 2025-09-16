/**
 * UIManager - Управление пользовательским интерфейсом
 * CryptoMessenger v3.0.0
 */

class UIManager {
    constructor(appState) {
        this.appState = appState;
        
        // Подписываемся на изменения состояния
        this.appState.subscribe('currentContact', this.onContactChanged.bind(this));
        this.appState.subscribe('currentChat', this.onChatChanged.bind(this));
        this.appState.subscribe('contacts', this.onContactsChanged.bind(this));
        
        console.log('📦 UIManager v3.0.0 - Interface management loaded');
    }

    // ========== УПРАВЛЕНИЕ ОБЛАСТЯМИ ИНТЕРФЕЙСА ==========


    /**
     * Область приветствия (когда контакт не выбран)
     * @param {boolean} visible - Видимость области
     */
    setAreaNoMessagesVisibility(visible) {
        const welcomeMessage = document.querySelector('#chat-messages .message.incoming');
        if (welcomeMessage) {
            welcomeMessage.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Область сообщений выбранного чата
     * @param {boolean} visible - Видимость области
     */
    setAreaChatMessagesVisibility(visible) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            // Скрываем/показываем все сообщения кроме приветственного
            const messages = chatMessages.querySelectorAll('.message:not(.message.incoming:first-child)');
            messages.forEach(message => {
                message.style.display = visible ? 'block' : 'none';
            });
        }
    }

    /**
     * Панель отправки сообщений
     * @param {boolean} visible - Видимость панели
     */
    setAreaSendMessageVisibility(visible) {
        const inputArea = document.getElementById('inputArea');
        if (inputArea) {
            inputArea.style.display = visible ? 'block' : 'none';
        }
    }

    /**
     * Панель ожидания принятия приглашения (отправитель ждёт)
     * @param {boolean} visible - Видимость панели
     */
    setAreaWaitAcceptanceFromFriendVisibility(visible) {
        const waitingPanel = document.getElementById('waitingPanel');
        if (waitingPanel) {
            waitingPanel.style.display = visible ? 'block' : 'none';
            
            // Обновляем информацию о получателе если панель показывается
            if (visible && this.appState.currentContact) {
                const waitingTo = document.getElementById('waitingTo');
                if (waitingTo) {
                    waitingTo.textContent = `Кому: ${this.appState.currentContact.address}`;
                }
            }
        }
    }

    /**
     * Панель принятия приглашения (получатель решает)
     * @param {boolean} visible - Видимость панели
     */
    setAreaWaitAcceptanceFromYouVisibility(visible) {
        const invitationPanel = document.getElementById('invitationPanel');
        if (invitationPanel) {
            invitationPanel.style.display = visible ? 'block' : 'none';
            
            // Обновляем информацию об отправителе если панель показывается
            if (visible && this.appState.currentContact) {
                const invitationFrom = document.getElementById('invitationFrom');
                if (invitationFrom) {
                    invitationFrom.textContent = `От: ${this.appState.currentContact.address}`;
                }
                
                // Сохраняем адрес отправителя для кнопок принятия/отклонения
                invitationPanel.setAttribute('data-inviter-address', this.appState.currentContact.address);
            }
        }
    }

    /**
     * Панель отправки нового приглашения
     * @param {boolean} visible - Видимость панели
     */
    setAreaCanInviteVisibility(visible) {
        const createInvitationPanel = document.getElementById('createInvitationPanel');
        if (createInvitationPanel) {
            createInvitationPanel.style.display = visible ? 'block' : 'none';
            
            // Обновляем информацию о получателе если панель показывается
            if (visible && this.appState.currentContact) {
                const createInvitationTo = document.getElementById('createInvitationTo');
                if (createInvitationTo) {
                    createInvitationTo.textContent = `Кому: ${this.appState.currentContact.address}`;
                }
                
                // Сохраняем адрес получателя для кнопки отправки приглашения
                createInvitationPanel.setAttribute('data-recipient-address', this.appState.currentContact.address);
            }
        }
    }

    /**
     * Главная функция обновления видимости всех областей
     */
    updateAllAreasVisibility() {
        const contactSelected = this.appState.isContactSelected();
        const chat = this.appState.currentChat;
        
        console.log('🎨 UIManager: Обновляем видимость всех областей');
        console.log('🔍 Состояние:', {
            contactSelected,
            chat: chat,
            isActive: chat?.isActive,
            isNeedAcceptance: chat?.isNeedAcceptance,
            isInviter: this.appState.isCurrentUserInviter()
        });

        // Применяем логику видимости согласно требованиям
        
        // Область приветствия
        this.setAreaNoMessagesVisibility(!contactSelected);
        
        // Область сообщений чата
        this.setAreaChatMessagesVisibility(contactSelected);
        
        // Панель отправки сообщений
        this.setAreaSendMessageVisibility(contactSelected && this.appState.isChatActive());
        
        // Панель ожидания от друга (мы отправители)
        this.setAreaWaitAcceptanceFromFriendVisibility(
            contactSelected && 
            this.appState.isChatNeedAcceptance() && 
            this.appState.isCurrentUserInviter()
        );
        
        // Панель принятия от нас (мы получатели)
        this.setAreaWaitAcceptanceFromYouVisibility(
            contactSelected && 
            this.appState.isChatNeedAcceptance() && 
            !this.appState.isCurrentUserInviter()
        );
        
        // Панель отправки приглашения
        this.setAreaCanInviteVisibility(
            contactSelected && 
            chat && 
            !chat.isActive && 
            !chat.isNeedAcceptance
        );

        console.log('✅ UIManager: Видимость областей обновлена');
    }

    // ========== УПРАВЛЕНИЕ КОНТАКТАМИ ==========

    /**
     * Обновление интерфейса списка контактов
     */
    updateContactsUI() {
        const contactsList = document.getElementById('contactsList');
        contactsList.innerHTML = '';
        
        if (this.appState.contacts.length === 0) {
            contactsList.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">Контакты не найдены</div>';
            return;
        }
        
        // Отображаем все контакты
        this.appState.contacts.forEach((contact, index) => {
            const unreadCount = contact.unreadCount || 0;
            
            console.log(`🔍 UIManager: Контакт ${contact.name}:`, {
                chatType: contact.chatType,
                unreadCount: unreadCount,
                address: contact.address
            });
            
            const contactWithUnread = { ...contact, unreadCount: unreadCount };
            const contactItem = this.createContactItem(contactWithUnread, contact.chatType, `contact-${index}`);
            contactsList.appendChild(contactItem);
        });
        
        // Настраиваем обработчики кликов для новых элементов
        this.setupContactClickHandlers();
    }

    /**
     * Создание элемента контакта
     * @param {Object} contact - Объект контакта
     * @param {string} type - Тип контакта
     * @param {string} id - ID элемента
     * @returns {HTMLElement} Элемент контакта
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
            this.formatTime(contact.lastMessageTime) : 
            (contact.timestamp ? this.formatTime(contact.timestamp) : '');
        
        // Формируем бейдж для непрочитанных сообщений или приглашений
        let badge = '';
        
        if (type === 'incoming-request') {
            // Для входящих приглашений ВСЕГДА показываем красный "!" (приглашение нельзя "прочитать")
            badge = `<div class="contact-badge single-digit" style="background: #dc3545;">!</div>`;
            console.log(`📨 UIManager: Входящее приглашение от ${contact.name}: показываем красный бейдж "!"`);
        } else if (type === 'outgoing-request') {
            // Для исходящих приглашений показываем жёлтый "!" (постоянный)
            badge = `<div class="contact-badge single-digit" style="background: #ffc107; color: #000;">!</div>`;
            console.log(`📤 UIManager: Исходящее приглашение к ${contact.name}: показываем жёлтый бейдж "!"`);
        } else if (contact.unreadCount > 0) {
            // Для обычных контактов показываем количество непрочитанных
            const badgeClass = contact.unreadCount < 10 ? 'single-digit' : 'multi-digit';
            badge = `<div class="contact-badge ${badgeClass}">${contact.unreadCount}</div>`;
            console.log(`💬 UIManager: Контакт ${contact.name}: показываем синий бейдж "${contact.unreadCount}"`);
        } else {
            console.log(`📋 UIManager: Контакт ${contact.name}: бейдж не показываем (unreadCount: ${contact.unreadCount})`);
        }

        // Генерируем цветной аватар
        const colors = ['#2563eb', '#dc2626', '#059669', '#7c2d12', '#7c3aed'];
        const colorIndex = Math.abs(contact.address.charCodeAt(2) + contact.address.charCodeAt(3)) % colors.length;
        const avatarColor = colors[colorIndex];

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
     * Настройка обработчиков кликов по контактам
     */
    setupContactClickHandlers() {
        document.querySelectorAll('.contact-item').forEach(item => {
            item.addEventListener('click', async () => {
                // Получаем адрес контакта
                const contactAddress = item.getAttribute('data-address');
                const contactName = item.querySelector('.contact-name').textContent;
                
                // Обновляем заголовок чата
                const chatTitle = document.getElementById('chatTitle');
                if (chatTitle) chatTitle.textContent = contactName;
                
                // Устанавливаем текущий контакт ДО проверки статуса
                this.appState.setCurrentContact({ address: contactAddress, name: contactName });
                
                // Обновляем подсветку активного контакта
                this.updateActiveContactHighlight();
                
                // UI будет обновлён автоматически через подписки
            });
        });
    }

    // ========== УВЕДОМЛЕНИЯ ==========

    /**
     * Показ уведомления пользователю
     * @param {string} message - Текст уведомления
     * @param {string} type - Тип уведомления (info, success, error, warning)
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
        
        // Автоматическое скрытие
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
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

    // ========== УТИЛИТНЫЕ МЕТОДЫ ==========

    /**
     * Форматирование времени
     * @param {Date|number} timestamp - Временная метка
     * @returns {string} Отформатированное время
     */
    formatTime(timestamp) {
        try {
            const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) { // Меньше минуты
                return 'сейчас';
            } else if (diff < 3600000) { // Меньше часа
                return `${Math.floor(diff / 60000)}м`;
            } else if (diff < 86400000) { // Меньше дня
                return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            } else if (diff < 604800000) { // Меньше недели
                const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
                return days[date.getDay()];
            } else {
                return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            }
        } catch (error) {
            console.error('❌ Ошибка форматирования времени:', error);
            return '';
        }
    }

    /**
     * Обновление информации о пользователе в заголовке
     */
    updateUserInfoInHeader() {
        const userInfo = document.querySelector('.sidebar-subtitle');
        if (userInfo && this.appState.currentUser) {
            const shortAddress = `${this.appState.currentUser.substring(0, 6)}...${this.appState.currentUser.substring(38)}`;
            userInfo.textContent = `Пользователь: ${shortAddress}`;
        }
    }

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ СОСТОЯНИЯ ==========

    /**
     * Обработчик изменения текущего контакта
     * @param {Object} contact - Новый контакт
     */
    onContactChanged(contact) {
        console.log('🎨 UIManager: Контакт изменён:', contact);
        this.updateActiveContactHighlight();
        // updateAllAreasVisibility будет вызван после загрузки currentChat
    }

    /**
     * Обработчик изменения текущего чата
     * @param {Object} chat - Новый чат
     */
    onChatChanged(chat) {
        console.log('🎨 UIManager: Чат изменён:', chat);
        this.updateAllAreasVisibility();
    }

    /**
     * Обработчик изменения списка контактов
     * @param {Array} contacts - Новый список контактов
     */
    onContactsChanged(contacts) {
        console.log('🎨 UIManager: Список контактов изменён:', contacts.length);
        this.updateContactsUI();
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
}
