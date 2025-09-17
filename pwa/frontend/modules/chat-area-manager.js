/**
 * Менеджер UI для чата с пагинацией и real-time обновлениями
 */

class ChatAreaManager {
    constructor(appState, contract, web3) {
console.log('📦 ChatAreaManager v4.0.0 - Chat area management with invitations loaded');
console.log('🔧 File: modules/chat-area-manager.js');
        
        this.appState = appState;
        this.contract = contract;
        this.web3 = web3;
        this.messageLoader = new DecentralizedEventSystem(contract, appState.currentUser);
        this.lazyLoader = new LazyChatLoader(this.messageLoader);
        this.currentContact = null;
        this.messageCallbacks = new Map(); // contactAddress -> callback functions
        
        // Подписываемся на изменения текущего контакта
        this.appState.subscribe('currentContact', this.onContactChanged.bind(this));
    }

    /**
     * Обработчик изменения текущего контакта (Detail в Master-Detail)
     */
    async onContactChanged(contact) {
        if (contact) {
            console.log('💬 ChatAreaManager: Открываем чат с новым контактом:', contact.name);
            await this.openChat(contact.address);
            await this.updateChatPanels();
        } else {
            console.log('💬 ChatAreaManager: Контакт не выбран, показываем приветствие');
            this.showWelcomeArea();
        }
    }

    /**
     * Открытие чата с контактом
     */
    async openChat(contactAddress, onNewMessage = null, onHistoryLoaded = null) {
        console.log(`💬 Открываем чат с ${contactAddress}`);
        
        this.currentContact = contactAddress;
        
        // Сохраняем callbacks
        if (onNewMessage) {
            this.messageCallbacks.set(contactAddress, { onNewMessage, onHistoryLoaded });
        }
        
        try {
            // 1. Загружаем последние 200 сообщений
            const messages = await this.messageLoader.loadChatMessages(contactAddress, 200);
            
            // 2. Отображаем сообщения
            this.renderMessages(messages);
            
            // 3. Инициализируем ленивую подгрузку
            const chatContainer = document.getElementById('chat-messages');
            if (chatContainer && chatContainer.parentElement) {
                this.lazyLoader.initScrollListener(contactAddress, chatContainer.parentElement, (newMessages, startIndex) => {
                    this.insertMessagesAtTop(newMessages, startIndex);
                    if (onHistoryLoaded) {
                        onHistoryLoaded(newMessages, startIndex);
                    }
                });
            }
            
            // 4. Подписываемся на новые сообщения
            this.subscribeToNewMessages(contactAddress, onNewMessage);
            
            console.log(`✅ Чат с ${contactAddress} открыт`);
            return messages;
            
        } catch (error) {
            console.error(`❌ Ошибка открытия чата с ${contactAddress}:`, error);
            throw error;
        }
    }

    /**
     * Подписка на новые сообщения
     */
    subscribeToNewMessages(contactAddress, callback) {
        this.messageLoader.subscribeToNewMessages(contactAddress, (newMessages, event) => {
            console.log('🆕 Новое сообщение получено!');
            
            // Добавляем сообщения в UI
            this.appendMessages(newMessages);
            
            // Вызываем callback
            if (callback) {
                callback(newMessages, event);
            }
        });
    }

    /**
     * Отписка от событий
     */
    unsubscribeFromMessages(contactAddress) {
        this.messageLoader.unsubscribeFromMessages(contactAddress);
        this.messageCallbacks.delete(contactAddress);
    }

    /**
     * Отображение сообщений в UI
     */
    renderMessages(messages) {
        const container = document.getElementById('chat-messages');
        if (!container) {
            console.warn('⚠️ Контейнер chat-messages не найден');
            return;
        }
        
        container.innerHTML = '';
        
        // Сортируем сообщения по времени (от старых к новым)
        const sortedMessages = [...messages].sort((a, b) => {
            const timeA = parseInt(a.messageTimestamp) || 0;
            const timeB = parseInt(b.messageTimestamp) || 0;
            return timeA - timeB; // По возрастанию времени
        });
        
        sortedMessages.forEach((message, index) => {
            const messageElement = this.createMessageElement(message, index);
            container.appendChild(messageElement);
        });
        
        // Прокручиваем вниз с задержкой для корректного рендеринга
        setTimeout(() => {
            this.scrollToBottom();
            // Дополнительная попытка
            setTimeout(() => this.scrollToBottom(), 200);
        }, 150);
    }

    /**
     * Вставка сообщений в начало (для истории)
     */
    insertMessagesAtTop(newMessages, startIndex) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        
        // Сохраняем текущую позицию скролла
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        
        newMessages.forEach((message, index) => {
            const messageElement = this.createMessageElement(message, startIndex + index);
            container.insertBefore(messageElement, container.firstChild);
        });
        
        // Восстанавливаем позицию скролла
        const newScrollHeight = container.scrollHeight;
        const heightDiff = newScrollHeight - scrollHeight;
        container.scrollTop = scrollTop + heightDiff;
        
        console.log(`📚 Добавлено ${newMessages.length} сообщений в начало`);
    }

    /**
     * Добавление сообщений в конец (для новых сообщений)
     */
    appendMessages(newMessages) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        
        // Сортируем новые сообщения по времени (от старых к новым)
        const sortedMessages = [...newMessages].sort((a, b) => {
            const timeA = parseInt(a.messageTimestamp) || 0;
            const timeB = parseInt(b.messageTimestamp) || 0;
            return timeA - timeB;
        });
        
        sortedMessages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            container.appendChild(messageElement);
        });
        
        // Прокручиваем вниз
        this.scrollToBottom();
        
        console.log(`📨 Добавлено ${newMessages.length} новых сообщений`);
    }

    /**
     * Создание элемента сообщения
     */
    createMessageElement(message, index = 0) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.isOutgoing ? 'outgoing' : 'incoming'}`;
        messageDiv.setAttribute('data-index', index);
        
        // Временная метка
        const timestamp = new Date(parseInt(message.messageTimestamp) * 1000);
        const timeString = timestamp.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Зашифрованные данные (показываем как есть, в реальности нужно расшифровать)
        // В v2 контракте: encryptedForSmaller и encryptedForLarger
        // Определяем, какое поле использовать в зависимости от адреса пользователя
        const currentUserAddress = this.appState.currentUser;
        const contactAddress = this.appState.currentContact?.address;
        
        if (!currentUserAddress) {
            console.error('❌ [V2] window.currentUser не определен');
            return messageDiv;
        }
        
        if (!contactAddress) {
            console.error('❌ [V2] this.currentContactAddress не определен');
            return messageDiv;
        }
        
        // Определяем правильное поле для расшифровки
        const encryptedData = CryptoUtils.getEncryptedFieldForUser(currentUserAddress, contactAddress, message);
        
        // Пытаемся расшифровать сообщение
        const decryptedText = CryptoUtils.decryptMessage(encryptedData);
        const displayText = decryptedText || CryptoUtils.formatEncryptedMessage(encryptedData);
        
        // Определяем направление сообщения
        const isOutgoing = CryptoUtils.isOutgoingMessage(currentUserAddress, contactAddress, message);
        
        // Устанавливаем правильный CSS класс для направления
        if (isOutgoing) {
            messageDiv.classList.add('outgoing');
        }
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${displayText}</div>
                <div class="message-time">${timeString}</div>
            </div>
        `;
        
        return messageDiv;
    }


    /**
     * Прокрутка вниз чата
     */
    scrollToBottom() {
        const container = document.getElementById('chat-messages');
        if (container && container.parentElement) {
            const scrollableArea = container.parentElement;
            // Принудительная прокрутка с несколькими попытками
            const scrollToMax = () => {
                const maxScroll = scrollableArea.scrollHeight - scrollableArea.clientHeight;
                scrollableArea.scrollTop = maxScroll > 0 ? maxScroll : 0;
            };
            
            // Немедленная попытка
            scrollToMax();
            
            // Дополнительные попытки с задержками
            setTimeout(scrollToMax, 50);
            setTimeout(scrollToMax, 150);
            setTimeout(scrollToMax, 300);
            setTimeout(scrollToMax, 500); // Ещё одна попытка
        }
    }

    /**
     * Загрузка истории чата
     */
    async loadChatHistory(contactAddress) {
        console.log(`📚 Загружаем историю чата с ${contactAddress}`);
        
        try {
            const messages = await this.messageLoader.loadChatHistory(contactAddress, (pageMessages, startIndex) => {
                this.insertMessagesAtTop(pageMessages, startIndex);
            });
            
            console.log(`✅ История загружена: ${messages.length} сообщений`);
            return messages;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки истории:', error);
            throw error;
        }
    }

    /**
     * Проверка новых сообщений
     */
    async checkForNewMessages(contactAddress) {
        try {
            const newMessages = await this.messageLoader.checkForNewMessages(contactAddress);
            if (newMessages.length > 0) {
                this.appendMessages(newMessages);
            }
            return newMessages;
        } catch (error) {
            console.error('❌ Ошибка проверки новых сообщений:', error);
            return [];
        }
    }

    /**
     * Получение статистики чата
     */
    getChatStats(contactAddress) {
        return this.messageLoader.getChatStats(contactAddress);
    }

    /**
     * Очистка кэша чата
     */
    clearChatCache(contactAddress = null) {
        this.messageLoader.clearChatCache(contactAddress);
        if (contactAddress) {
            this.unsubscribeFromMessages(contactAddress);
        }
    }

    /**
     * Закрытие чата
     */
    closeChat(contactAddress) {
        this.unsubscribeFromMessages(contactAddress);
        this.currentContact = null;
        console.log(`💬 Чат с ${contactAddress} закрыт`);
    }

    // ========== ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ В КОНТЕКСТЕ ЧАТА ==========

    /**
     * Отправка сообщения через смарт-контракт
     * @param {string} messageText - Текст сообщения
     * @returns {Promise<Object>} Результат транзакции
     */
    async sendMessage(messageText) {
        try {
            if (!this.appState.currentContact) {
                throw new Error('Контакт не выбран');
            }

            const contactAddress = this.appState.currentContact.address;
            console.log(`📤 ChatAreaManager: Отправляем сообщение "${messageText}" к ${contactAddress}`);
            
            // Получаем публичный ключ получателя
            const recipientPublicKey = await this.contract.methods.getPublicKey(contactAddress).call();
            
            // Шифруем сообщение для получателя (ECIES)
            const encryptedForRecipient = CryptoUtils.encryptMessage(messageText, recipientPublicKey);
            
            // Шифруем сообщение для отправителя (ECIES)
            const encryptedForSender = CryptoUtils.encryptMessage(messageText, this.appState.userPublicKey);
            
            console.log('🔐 ChatAreaManager: Сообщение зашифровано ECIES для обеих сторон');
            
            // Отправляем в блокчейн
            const result = await this.contract.methods.sendMessage(
                contactAddress,
                encryptedForRecipient,
                encryptedForSender
            ).send({ 
                from: this.appState.currentUser,
                gas: 300000
            });
            
            console.log('✅ ChatAreaManager: Сообщение отправлено:', result.transactionHash);
            return result;
            
        } catch (error) {
            console.error('❌ ChatAreaManager: Ошибка отправки сообщения:', error);
            throw error;
        }
    }

    /**
     * Отправка приглашения
     * @param {string} message - Текст приглашения
     * @param {number} fee - Комиссия в ETH
     * @returns {Promise<Object>} Результат транзакции
     */
    async sendInvitation(message, fee) {
        try {
            if (!this.appState.currentContact) {
                throw new Error('Контакт не выбран');
            }

            const recipientAddress = this.appState.currentContact.address;
            console.log(`📤 ChatAreaManager: Отправляем приглашение к ${recipientAddress}`);
            
            // Получаем публичный ключ получателя
            const recipientPublicKey = await this.contract.methods.getPublicKey(recipientAddress).call();
            
            // Шифруем сообщение для получателя и отправителя
            const encryptedForRecipient = CryptoUtils.encryptMessage(message, recipientPublicKey);
            const encryptedForSender = CryptoUtils.encryptMessage(message, this.appState.userPublicKey);
            
            // Конвертируем fee в wei
            const feeInWei = this.web3.utils.toWei(fee.toString(), 'ether');
            
            // Отправляем приглашение
            const result = await this.contract.methods.invitationSend(
                recipientAddress,
                encryptedForRecipient,
                encryptedForSender
            ).send({ 
                from: this.appState.currentUser,
                value: feeInWei,
                gas: 300000
            });
            
            console.log('✅ ChatAreaManager: Приглашение отправлено:', result.transactionHash);
            return result;
            
        } catch (error) {
            console.error('❌ ChatAreaManager: Ошибка отправки приглашения:', error);
            throw error;
        }
    }

    /**
     * Принятие приглашения
     * @returns {Promise<Object>} Результат транзакции
     */
    async acceptInvitation() {
        try {
            if (!this.appState.currentContact) {
                throw new Error('Контакт не выбран');
            }

            const inviterAddress = this.appState.currentContact.address;
            console.log(`✅ ChatAreaManager: Принимаем приглашение от ${inviterAddress}`);
            
            const result = await this.contract.methods.invitationAccept(inviterAddress).send({ 
                from: this.appState.currentUser,
                gas: 200000
            });
            
            console.log('✅ ChatAreaManager: Приглашение принято:', result.transactionHash);
            return result;
            
        } catch (error) {
            console.error('❌ ChatAreaManager: Ошибка принятия приглашения:', error);
            throw error;
        }
    }

    /**
     * Отклонение приглашения
     * @returns {Promise<Object>} Результат транзакции
     */
    async rejectInvitation() {
        try {
            if (!this.appState.currentContact) {
                throw new Error('Контакт не выбран');
            }

            const inviterAddress = this.appState.currentContact.address;
            console.log(`❌ ChatAreaManager: Отклоняем приглашение от ${inviterAddress}`);
            
            const result = await this.contract.methods.invitationReject(inviterAddress).send({ 
                from: this.appState.currentUser,
                gas: 200000
            });
            
            console.log('✅ ChatAreaManager: Приглашение отклонено:', result.transactionHash);
            return result;
            
        } catch (error) {
            console.error('❌ ChatAreaManager: Ошибка отклонения приглашения:', error);
            throw error;
        }
    }

    /**
     * Отзыв отправленного приглашения
     * @returns {Promise<Object>} Результат транзакции
     */
    async cancelInvitation() {
        try {
            if (!this.appState.currentContact) {
                throw new Error('Контакт не выбран');
            }

            const recipientAddress = this.appState.currentContact.address;
            console.log(`🔄 ChatAreaManager: Отзываем приглашение к ${recipientAddress}`);
            
            const result = await this.contract.methods.invitationWithdraw(recipientAddress).send({ 
                from: this.appState.currentUser,
                gas: 200000
            });
            
            console.log('✅ ChatAreaManager: Приглашение отозвано:', result.transactionHash);
            return result;
            
        } catch (error) {
            console.error('❌ ChatAreaManager: Ошибка отзыва приглашения:', error);
            throw error;
        }
    }

    // ========== УПРАВЛЕНИЕ ОБЛАСТЯМИ И ПАНЕЛЯМИ ЧАТА ==========

    /**
     * Показ области приветствия (когда контакт не выбран)
     */
    showWelcomeArea() {
        const welcomeMessage = document.querySelector('#chat-messages .message.incoming');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'block';
        }
        
        // Скрываем область сообщений и все панели
        this.hideChatMessagesArea();
        this.hideAllPanels();
        
        console.log('👋 ChatAreaManager: Показана область приветствия');
    }

    /**
     * Показ области сообщений чата (когда контакт выбран)
     */
    showChatMessagesArea() {
        // Скрываем приветствие
        const welcomeMessage = document.querySelector('#chat-messages .message.incoming');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
        
        // Показываем сообщения чата
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const messages = chatMessages.querySelectorAll('.message:not(.message.incoming:first-child)');
            messages.forEach(message => {
                message.style.display = 'block';
            });
        }
        
        console.log('💬 ChatAreaManager: Показана область сообщений чата');
    }

    /**
     * Скрытие области сообщений чата
     */
    hideChatMessagesArea() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const messages = chatMessages.querySelectorAll('.message:not(.message.incoming:first-child)');
            messages.forEach(message => {
                message.style.display = 'none';
            });
        }
    }

    /**
     * Показ панели ввода сообщений
     */
    showMessageInputPanel() {
        this.hideAllPanels();
        const inputArea = document.getElementById('inputArea');
        if (inputArea) {
            inputArea.style.display = 'block';
        }
        console.log('✍️ ChatAreaManager: Показана панель ввода сообщений');
    }

    /**
     * Показ панели принятия приглашения
     */
    showInvitationAcceptPanel() {
        this.hideAllPanels();
        const invitationPanel = document.getElementById('invitationPanel');
        if (invitationPanel && this.appState.currentContact) {
            invitationPanel.style.display = 'block';
            
            // Обновляем информацию об отправителе
            const invitationFrom = document.getElementById('invitationFrom');
            if (invitationFrom) {
                invitationFrom.textContent = `От: ${this.appState.currentContact.address}`;
            }
            
            invitationPanel.setAttribute('data-inviter-address', this.appState.currentContact.address);
        }
        console.log('📨 ChatAreaManager: Показана панель принятия приглашения');
    }

    /**
     * Показ панели ожидания принятия приглашения
     */
    showInvitationWaitingPanel() {
        this.hideAllPanels();
        const waitingPanel = document.getElementById('waitingPanel');
        if (waitingPanel && this.appState.currentContact) {
            waitingPanel.style.display = 'block';
            
            // Обновляем информацию о получателе
            const waitingTo = document.getElementById('waitingTo');
            if (waitingTo) {
                waitingTo.textContent = `Кому: ${this.appState.currentContact.address}`;
            }
        }
        console.log('⏳ ChatAreaManager: Показана панель ожидания приглашения');
    }

    /**
     * Показ панели создания приглашения
     */
    showCreateInvitationPanel() {
        this.hideAllPanels();
        const createPanel = document.getElementById('createInvitationPanel');
        if (createPanel && this.appState.currentContact) {
            createPanel.style.display = 'block';
            
            // Обновляем информацию о получателе
            const createInvitationTo = document.getElementById('createInvitationTo');
            if (createInvitationTo) {
                createInvitationTo.textContent = `Кому: ${this.appState.currentContact.address}`;
            }
            
            createPanel.setAttribute('data-recipient-address', this.appState.currentContact.address);
        }
        console.log('📝 ChatAreaManager: Показана панель создания приглашения');
    }

    /**
     * Скрытие всех панелей
     */
    hideAllPanels() {
        const panels = ['inputArea', 'invitationPanel', 'waitingPanel', 'createInvitationPanel'];
        panels.forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.style.display = 'none';
            }
        });
    }

    /**
     * Определение и показ правильной панели на основе статуса чата
     */
    async updateChatPanels() {
        if (!this.appState.currentContact) {
            this.showWelcomeArea();
            return;
        }

        this.showChatMessagesArea();

        // Получаем информацию о чате
        const chatId = await this.contract.methods.getChatId(
            this.appState.currentUser, 
            this.appState.currentContact.address
        ).call();
        
        if (chatId && chatId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            const chat = await this.contract.methods.getChat(chatId).call();
            this.appState.setCurrentChat(chat);
            
            if (chat.isActive) {
                this.showMessageInputPanel();
            } else if (chat.isNeedAcceptance) {
                if (chat.inviter.toLowerCase() === this.appState.currentUser.toLowerCase()) {
                    this.showInvitationWaitingPanel();
                } else {
                    this.showInvitationAcceptPanel();
                }
            } else {
                this.showCreateInvitationPanel();
            }
        } else {
            this.appState.setCurrentChat(null);
            this.showCreateInvitationPanel();
        }
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatAreaManager;
}

// Глобальный экспорт для браузера
if (typeof window !== 'undefined') {
    window.ChatAreaManager = ChatAreaManager;
}
