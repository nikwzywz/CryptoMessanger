/**
 * Менеджер UI для чата V3 с поддержкой TypeMessage и frontend состояний
 */

class ChatAreaManagerV3 {
    constructor(appState, contract, web3) {
        console.log('📦 ChatAreaManager v3.0.0 - TypeMessage and frontend states support loaded');
        console.log('🔧 File: modules/chat-area-manager-v3.js');
        
        this.appState = appState;
        this.contract = contract;
        this.web3 = web3;
        this.currentContact = null;
        this.currentChatID = null;
        this.currentFrontendState = null;
        
        // Кэш сообщений для текущего чата
        this.currentChatMessages = [];
        
        // 🆕 Polling состояние для сообщений
        this.lastMessageIndex = -1;
        this.messagesBatchSize = 100;
        
        // Подписываемся на изменения текущего контакта
        this.appState.subscribe('currentContact', this.onContactChanged.bind(this));
    }

    /**
     * Обновление области чата в зависимости от состояния (перенесено из main.html)
     */
    updateChatAreaForState(frontendState) {
        console.log(`🎨 V3: Обновляем UI для состояния:`, frontendState);        
        // Независимо определяем видимость панелей
        this.setVisiblePanelInputAndSendMessage((frontendState === 'allowedWrite') && (this.appState.currentContact));
        this.setVisiblePanelWaitingAcceptanceFromMe(frontendState === 'waitingAcceptanceFromMe');
        this.setVisiblePanelWaitingAcceptanceFromOther(frontendState === 'waitingAcceptanceFromOther');

        // Для waitingAcceptanceFromOther проверяем таймаут
        if (frontendState === 'waitingAcceptanceFromOther') {
            const isTimeoutExpired = this.checkInvitationTimeout();
            this.setVisiblePanelInvitationCancel((frontendState === 'waitingAcceptanceFromOther')&&(isTimeoutExpired));
        }
    }


    /**
     * Обработчик изменения текущего контакта (Detail в Master-Detail)
     */
    async onContactChanged(contact) {
        if (contact) {
            console.log('💬 ChatAreaManager V3: Открываем чат с контактом:', contact.name);
            await this.openChat(contact.address);
        } else {
            console.log('💬 ChatAreaManager V3: Контакт не выбран, показываем приветствие');
            this.showWelcomeArea();
        }
    }

    /**
     * Открывает чат с указанным контактом
     * @param {string} contactAddress Адрес контакта
     */
    async openChat(contactAddress) {
        try {
            // 🛡️ ПРАВИЛО: Убеждаемся, что адрес в lowerCase
            const addressLower = contactAddress.toLowerCase();
            console.log(`📬 V3: Открываем чат с ${addressLower}`);
            
            this.currentContactAddress = addressLower;
            
            // 🛠️ ИСПРАВЛЕНИЕ: Генерируем chatID для текущего чата
            this.currentChatID = CryptoUtils.generateChatId(this.appState.currentUser, addressLower);
            console.log(`🔑 V3: Сгенерирован chatID: ${this.currentChatID}`);
            
            document.getElementById('chat-messages').innerHTML = ''; // Очищаем предыдущие сообщения

            // Загружаем все сообщения пользователя один раз при первом открытии любого чата
            if (!this.allUserMessagesLoaded) {
                await this.loadAllUserMessages();
            }

            // Фильтруем и отображаем сообщения для текущего чата
            this.filterMessagesForCurrentChat();
            
            // 🛠️ ИСПРАВЛЕНИЕ: Отображаем отфильтрованные сообщения
            this.renderMessages();

            // Определяем и применяем состояние чата
            this.updateChatState();

        } catch (error) {
            console.error('❌ V3: Ошибка открытия чата:', error);
            this.appState.showNotification('Ошибка открытия чата: ' + error.message, 'error');
        }
    }

    /**
     * Загрузка всех сообщений пользователя
     */
    async loadAllUserMessages() {
        try {
            const messagesCount = await this.contract.methods.getMessagesCount().call({ 
                from: this.appState.currentUser 
            });
            
            if (parseInt(messagesCount) === 0) {
                console.log('📭 V3: У пользователя нет сообщений');
                return;
            }
            
            // Загружаем все сообщения (в V3 они уже отфильтрованы по пользователю)
            const allMessages = await this.contract.methods.getMessagesPaginated(
                0, parseInt(messagesCount) - 1
            ).call({ from: this.appState.currentUser });
            
            this.allUserMessages = allMessages;
            console.log(`📨 V3: Загружено ${allMessages.length} сообщений пользователя`);
            
        } catch (error) {
            console.error('❌ V3: Ошибка загрузки сообщений:', error);
            this.allUserMessages = [];
        }
    }

    /**
     * Фильтрация сообщений для текущего чата
     */
    filterMessagesForCurrentChat() {
        if (!this.allUserMessages || !this.currentChatID) {
            this.currentChatMessages = [];
            return;
        }
        
        // Фильтруем сообщения по chatID
        console.log(`🔍 V3: Фильтруем сообщения:`, {
            currentChatID: this.currentChatID,
            totalMessages: this.allUserMessages.length,
            messagesChatIDs: this.allUserMessages.map(msg => msg.chatID)
        });
        
        if (this.allUserMessages[0]) {
            console.log(`🔍 V3: Детали первого сообщения:`, {
                chatID: this.allUserMessages[0].chatID,
                messIndex: this.allUserMessages[0].messIndex,
                isFromMe: this.allUserMessages[0].isFromMe,
                newChatState: this.allUserMessages[0].newChatState,
                messageTimestamp: this.allUserMessages[0].messageTimestamp
            });
            
            console.log(`🔍 V3: Сравнение chatID:`, {
                fromMessage: this.allUserMessages[0].chatID,
                generated: this.currentChatID,
                match: this.allUserMessages[0].chatID === this.currentChatID,
                lengthMessage: this.allUserMessages[0].chatID.length,
                lengthGenerated: this.currentChatID.length
            });
        }
        
        this.currentChatMessages = this.allUserMessages.filter(msg => 
            msg.chatID === this.currentChatID
        );
        
        // Сортируем по messIndex для правильного порядка
        this.currentChatMessages.sort((a, b) => 
            parseInt(a.messIndex) - parseInt(b.messIndex)
        );
        
        console.log(`🔍 V3: Отфильтровано ${this.currentChatMessages.length} сообщений для текущего чата`);
    }

    /**
     * Отображение сообщений в UI
     */
    renderMessages() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) {
            console.error('❌ V3: Контейнер сообщений не найден');
            return;
        }
        
        // Очищаем контейнер
        messagesContainer.innerHTML = '';
        
        // Отображаем каждое сообщение
        this.currentChatMessages.forEach(msg => {
            this.addMessageToUI(msg);
        });
        
        // Прокручиваем вниз
        this.scrollToBottom();
        
        console.log(`✅ V3: Отображено ${this.currentChatMessages.length} сообщений`);
    }

    /**
     * Добавление одного сообщения в UI (для real-time обновлений)
     */
    addMessageToUI(message) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        // Проверяем, не добавлено ли уже это сообщение
        const existingMessage = messagesContainer.querySelector(`[data-mess-index="${message.messIndex}"]`);
        if (existingMessage) {
            console.log(`⚠️ V3: Сообщение ${message.messIndex} уже отображено, пропускаем`);
            return;
        }
        
        try {
            // Убраны избыточные логи расшифровки
            
            // Расшифровываем сообщение
            const decryptedText = CryptoUtils.decryptMessage(
                message.encryptedMessage, 
                this.appState.userPrivateKey
            );
            
            // Показываем только результат расшифровки
            if (decryptedText.length > 0) {
                console.log(`✅ V3: Сообщение ${message.messIndex} расшифровано: "${decryptedText}"`);
            }
            
            // Создаем элемент сообщения
            const messageElement = this.createMessageElement(
                decryptedText,
                message.isFromMe,
                new Date(parseInt(message.messageTimestamp) * 1000),
                message.messIndex
            );
            
            messagesContainer.appendChild(messageElement);
            
            // Добавляем в кэш текущего чата
            this.currentChatMessages.push(message);
            
        } catch (error) {
            console.error('❌ V3: Ошибка добавления сообщения в UI:', error);
            console.error('❌ V3: Детали ошибки:', {
                messageIndex: message.messIndex,
                encryptedMessage: message.encryptedMessage.substring(0, 100),
                error: error.message
            });
        }
    }

    /**
     * Создание DOM элемента сообщения
     */
    createMessageElement(text, isFromMe, timestamp, messIndex) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isFromMe ? 'outgoing' : 'incoming'}`;
        messageDiv.setAttribute('data-mess-index', messIndex);
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = text;
        
        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = timestamp.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);
        
        return messageDiv;
    }

    /**
     * Определение и обновление состояния чата
     */
    async updateChatState() {
        if (this.currentChatMessages.length === 0) {
            // Новый чат - определяем состояние через getChat
            await this.updateChatStateFromContract();
            return;
        }
        
        // Берем последнее сообщение для определения актуального состояния
        const lastMessage = this.currentChatMessages[this.currentChatMessages.length - 1];
        
        console.log(`🔍 V3: Анализируем последнее сообщение:`, {
            messIndex: lastMessage.messIndex,
            isFromMe: lastMessage.isFromMe,
            newChatState: lastMessage.newChatState,
            newChatStateInt: parseInt(lastMessage.newChatState),
            encryptedMessage: lastMessage.encryptedMessage.substring(0, 20) + '...'
        });
        
        const frontendState = this.determineFrontendChatState();
        
        console.log(`🎯 V3: Определено frontend состояние:`, frontendState);
        
        this.updateChatUI(frontendState);
        
        console.log(`🔄 V3: Состояние чата обновлено:`, {
            chatID: this.currentChatID.substring(0, 8),
            frontendState: frontendState
        });
    }

    /**
     * Получение состояния чата из контракта (для новых чатов)
     */
    async updateChatStateFromContract() {
        try {
            const chatData = await this.contract.methods.getChat(this.currentChatID).call();
            
            // Для новых чатов без сообщений используем состояние из контракта
            if (parseInt(chatData.state) === 0) {
                this.updateChatUI('allowedWrite');
            } else if (parseInt(chatData.state) === 1) {
                this.updateChatUI('notAllowedWrite');
            } else if (parseInt(chatData.state) === 2) {
                // Для waitingAcceptance нужно определить роль через inviter
                const isInviter = chatData.inviter.toLowerCase() === this.appState.currentUser.toLowerCase();
                const frontendState = isInviter ? 'waitingAcceptanceFromOther' : 'waitingAcceptanceFromMe';
                this.updateChatUI(frontendState);
            }
            
        } catch (error) {
            console.error('❌ V3: Ошибка получения состояния чата:', error);
            this.updateChatUI('allowedWrite'); // Fallback
        }
    }

    /**
     * Определение frontend состояния из TypeMessage
     */
    determineFrontendChatState() {
        if (!this.currentChatMessages || this.currentChatMessages.length === 0) {
            return 'notAllowedWrite'; // Безопасное значение по умолчанию для чатов без сообщений
        }

        // Берем последнее сообщение для определения актуального состояния
        const lastMessage = this.currentChatMessages[this.currentChatMessages.length - 1];
        return this.determineFrontendChatStateFromMessage(lastMessage);
    }

    /**
     * Обновление UI чата в зависимости от состояния
     */
    updateChatUI(frontendState) {
        this.currentFrontendState = frontendState;
        
        const chatSubtitle = document.getElementById('chatSubtitle');
        
        // НЕ затираем chatSubtitle - там должен оставаться адрес контакта
        // Статус чата отображается через панели, а не в заголовке
        console.log(`🎨 V3: Обновляем UI для состояния ${frontendState}, chatSubtitle остается с адресом контакта`);
        
        // Управляем панелями напрямую
        this.updateChatAreaForState(frontendState);
    }

    /**
     * Панель 1: Область ввода и отправки сообщений
     * Условие показа: Состояние == allowedWrite
     */
    setVisiblePanelInputAndSendMessage(visible) {
        const panel = document.getElementById('panelInputAndSendMessage');
        if (panel) {
            panel.style.display = visible ? 'block' : 'none';
            console.log(`🎨 Панель ввода сообщений: ${visible ? 'показана' : 'скрыта'}`);
            
            if (visible) {
                // Особенность: если не выбран никакой чат, показываем приветствие
                const currentContact = this.appState.currentContact;
                if (!currentContact) {
                    const messagesContainer = document.getElementById('chat-messages');
                    if (messagesContainer) {
                        messagesContainer.innerHTML = `
                            <div class="message incoming">
                                <div class="message-content">
                                    <div class="message-text">Добро пожаловать в CryptoMessenger! Выберите контакт для начала общения.</div>
                                    <div class="message-time">Система</div>
                                </div>
                            </div>
                        `;
                    }
                }
            }
        }
    }

    /**
     * Панель 2: ВХОДЯЩЕЕ ПРИГЛАШЕНИЕ
     * Условие показа: Состояние == waitingAcceptanceFromMe
     */
    setVisiblePanelWaitingAcceptanceFromMe(visible) {
        const panel = document.getElementById('panelWaitingAcceptanceFromMe');
        if (panel) {
            panel.style.display = visible ? 'block' : 'none';
            console.log(`🎨 Панель входящего приглашения: ${visible ? 'показана' : 'скрыта'}`);
            
            if (visible) {
                // Заполняем данные текущего контакта
                const currentContact = this.appState.currentContact;
                if (currentContact) {
                    const fromContactName = document.getElementById('fromContactName');
                    const fromContactAddress = document.getElementById('fromContactAddress');
                    
                    if (fromContactName) fromContactName.textContent = currentContact.name;
                    if (fromContactAddress) {
                        // Показываем полный адрес для максимальной безопасности
                        fromContactAddress.textContent = currentContact.address;
                        fromContactAddress.title = currentContact.address; // Полный адрес в tooltip
                    }
                    
                    // Настраиваем обработчики кнопок
                    const acceptBtn = document.getElementById('acceptInvitationBtn');
                    const rejectBtn = document.getElementById('rejectInvitationBtn');
                    
                    if (acceptBtn) acceptBtn.onclick = () => this.acceptInvitation();
                    if (rejectBtn) rejectBtn.onclick = () => this.rejectInvitation();
                }
            }
        }
    }

    /**
     * Панель 3: ИСХОДЯЩЕЕ ПРИГЛАШЕНИЕ
     * Условие показа: Состояние == waitingAcceptanceFromOther
     */
    setVisiblePanelWaitingAcceptanceFromOther(visible) {
        const panel = document.getElementById('panelWaitingAcceptanceFromOther');
        if (panel) {
            panel.style.display = visible ? 'block' : 'none';
            console.log(`🎨 Панель исходящего приглашения: ${visible ? 'показана' : 'скрыта'}`);
            
            if (visible) {
                // Заполняем данные текущего контакта
                const currentContact = this.appState.currentContact;
                if (currentContact) {
                    const toContactName = document.getElementById('toContactName');
                    const toContactAddress = document.getElementById('toContactAddress');
                    
                    if (toContactName) toContactName.textContent = currentContact.name;
                    if (toContactAddress) {
                        // Показываем полный адрес для максимальной безопасности
                        toContactAddress.textContent = currentContact.address;
                        toContactAddress.title = currentContact.address; // Полный адрес в tooltip
                    }
                    
                    // Настраиваем обработчик кнопки отзыва
                    const cancelBtn = document.getElementById('cancelInvitationBtn');
                    if (cancelBtn) cancelBtn.onclick = () => this.cancelInvitation();
                }
            }
        }
    }

    /**
     * Панель 4: ОТЗЫВ ПРИГЛАШЕНИЯ (после таймаута)
     * Условие показа: Состояние == waitingAcceptanceFromOther И прошло более INVITATION_TIMEOUT времени
     */
    setVisiblePanelInvitationCancel(visible) {
        const panel = document.getElementById('panelInvitationCancel');
        if (panel) {
            panel.style.display = visible ? 'block' : 'none';
            console.log(`🎨 Панель отзыва приглашения: ${visible ? 'показана' : 'скрыта'}`);
            
            if (visible) {
                // Заполняем данные текущего контакта и рассчитываем дни
                const currentContact = this.appState.currentContact;
                if (currentContact) {
                    const daysSince = this.calculateDaysSinceLastMessage();
                    
                    // Обновляем заголовок с количеством дней
                    const daysSinceSpan = document.getElementById('daysSinceInvitation');
                    if (daysSinceSpan) {
                        daysSinceSpan.textContent = daysSince;
                    }
                    
                    // Настраиваем обработчик кнопки отзыва
                    const cancelBtn = document.getElementById('cancelInvitationTimeoutBtn');
                    if (cancelBtn) cancelBtn.onclick = () => this.cancelInvitation();
                }
            }
        }
    }

    /**
     * Проверка истечения таймаута приглашения
     */
    checkInvitationTimeout() {
        if (!this.currentChatMessages || this.currentChatMessages.length === 0) {
            return false; // Нет сообщений - таймаут не применяется
        }
        
        // Берем последнее сообщение
        const lastMessage = this.currentChatMessages[this.currentChatMessages.length - 1];
        const lastMessageTime = parseInt(lastMessage.messageTimestamp) * 1000; // Конвертируем в миллисекунды
        const now = Date.now();
        
        const timeSinceLastMessage = now - lastMessageTime;
        const timeoutThreshold = window.CryptoMessengerConfig.INVITATION_TIMEOUT;
        
        console.log(`⏰ V3: Проверка таймаута приглашения:`, {
            lastMessageTime: new Date(lastMessageTime).toLocaleString(),
            timeSinceLastMessage: Math.floor(timeSinceLastMessage / (24 * 60 * 60 * 1000)) + ' дней',
            timeoutThreshold: Math.floor(timeoutThreshold / (24 * 60 * 60 * 1000)) + ' дней',
            isExpired: timeSinceLastMessage > timeoutThreshold
        });
        
        return timeSinceLastMessage > timeoutThreshold;
    }

    /**
     * Расчет количества дней с последнего сообщения
     */
    calculateDaysSinceLastMessage() {
        if (!this.currentChatMessages || this.currentChatMessages.length === 0) {
            return 0;
        }
        
        const lastMessage = this.currentChatMessages[this.currentChatMessages.length - 1];
        const lastMessageTime = parseInt(lastMessage.messageTimestamp) * 1000;
        const now = Date.now();
        
        const daysSince = Math.floor((now - lastMessageTime) / (24 * 60 * 60 * 1000));
        return daysSince;
    }

    // Удален устаревший метод showInvitationButtons()
    // Заменен компонентной функцией setVisiblePanelWaitingAcceptanceFromMe() в main.html

    // Удален устаревший метод showWaitingStatus()
    // Заменен компонентной функцией setVisiblePanelWaitingAcceptanceFromOther() в main.html

    /**
     * Отправляет стандартное сообщение для принятия приглашения
     */
    async acceptInvitation() {
        const currentContactAddress = this.appState.currentContact?.address;
        if (!currentContactAddress) {
            this.appState.showNotification('Ошибка: контакт не выбран', 'error');
            return;
        }
        console.log(`✅ V3: Принимаем приглашение от ${currentContactAddress}`);
        try {
            const acceptMessage = window.CryptoMessengerConfig.invitationMessages.accept;
            // 🛡️ ПРАВИЛО: Адрес уже должен быть в lowerCase из appState
            const encryptedForRecipient = await this.encryptForContact(acceptMessage, currentContactAddress);
            const encryptedForSender = await this.encryptForSelf(acceptMessage);

            await this.contract.methods.invitationAccept(
                currentContactAddress, 
                encryptedForRecipient, 
                encryptedForSender
            ).send({ from: this.appState.currentUser });
            
            this.appState.showNotification('Приглашение принято!', 'success');

        } catch (error) {
            console.error('❌ V3: Ошибка принятия приглашения:', error);
            this.appState.showNotification(`Ошибка: ${error.message}`, 'error');
        }
    }

    /**
     * Отправляет стандартное сообщение для отклонения приглашения
     */
    async rejectInvitation() {
        const currentContactAddress = this.appState.currentContact?.address;
        if (!currentContactAddress) {
            this.appState.showNotification('Ошибка: контакт не выбран', 'error');
            return;
        }
        console.log(`❌ V3: Отклоняем приглашение от ${currentContactAddress}`);
        try {
            const rejectMessage = window.CryptoMessengerConfig.invitationMessages.reject;
            // 🛡️ ПРАВИЛО: Адрес уже должен быть в lowerCase из appState
            const encryptedForRecipient = await this.encryptForContact(rejectMessage, currentContactAddress);
            const encryptedForSender = await this.encryptForSelf(rejectMessage);

            await this.contract.methods.invitationReject(
                currentContactAddress, 
                encryptedForRecipient, 
                encryptedForSender
            ).send({ from: this.appState.currentUser });

            this.appState.showNotification('Приглашение отклонено', 'info');

        } catch (error) {
            console.error('❌ V3: Ошибка отклонения приглашения:', error);
            this.appState.showNotification(`Ошибка: ${error.message}`, 'error');
        }
    }

    /**
     * Отправляет стандартное сообщение для отмены ранее отправленного приглашения
     */
    async cancelInvitation() {
        const currentContactAddress = this.appState.currentContact?.address;
        if (!currentContactAddress) {
            this.appState.showNotification('Ошибка: контакт не выбран', 'error');
            return;
        }
        console.log(`🔄 V3: Отменяем приглашение для ${currentContactAddress}`);
        try {
            const cancelMessage = window.CryptoMessengerConfig.invitationMessages.cancel;
            // 🛡️ ПРАВИЛО: Адрес уже должен быть в lowerCase из appState
            const encryptedForRecipient = await this.encryptForContact(cancelMessage, currentContactAddress);
            const encryptedForSender = await this.encryptForSelf(cancelMessage);

            await this.contract.methods.invitationCancel(
                currentContactAddress, 
                encryptedForRecipient, 
                encryptedForSender
            ).send({ from: this.appState.currentUser });

            this.appState.showNotification('Приглашение отменено', 'info');

        } catch (error) {
            console.error('❌ V3: Ошибка отмены приглашения:', error);
            this.appState.showNotification(`Ошибка: ${error.message}`, 'error');
        }
    }

    // sendInvitation перенесен в ContactListManagerV3

    /**
     * Отправка сообщения V3
     */
    async sendMessage(messageText) {
        const currentContact = this.appState.currentContact;
        if (!currentContact || !messageText.trim()) return;
        
        try {
            console.log('📤 V3: Отправляем сообщение:', messageText);
            
            // Шифруем сообщения для обеих сторон
            const encryptedForRecipient = await this.encryptForContact(messageText, currentContact.address);
            const encryptedForSender = await this.encryptForSelf(messageText);
            
            // Отправляем через контракт V3
            await this.contract.methods.sendMessage(
                currentContact.address,
                encryptedForRecipient,
                encryptedForSender
            ).send({ from: this.appState.currentUser });
            
            console.log('✅ V3: Сообщение отправлено в блокчейн');
            
        } catch (error) {
            console.error('❌ V3: Ошибка отправки сообщения:', error);
        }
    }

    /**
     * Деактивация чата
     */
    async deactivateChat() {
        const currentContactAddress = this.appState.currentContact?.address;
        if (!currentContactAddress) {
            this.appState.showNotification('Ошибка: контакт не выбран', 'error');
            return;
        }
        console.log(`🚫 V3: Деактивируем чат с ${currentContactAddress}`);
        try {
            const deactivateMessage = window.CryptoMessengerConfig.invitationMessages.deactivate;
            // 🛡️ ПРАВИЛО: Адрес уже должен быть в lowerCase из appState
            const encryptedForRecipient = await this.encryptForContact(deactivateMessage, currentContactAddress);
            const encryptedForSender = await this.encryptForSelf(deactivateMessage);

            await this.contract.methods.deactivateChat(
                currentContactAddress, 
                encryptedForRecipient, 
                encryptedForSender
            ).send({ from: this.appState.currentUser });

            this.appState.showNotification('Чат деактивирован', 'info');

        } catch (error) {
            console.error('❌ V3: Ошибка деактивации чата:', error);
            this.appState.showNotification(`Ошибка: ${error.message}`, 'error');
        }
    }

    /**
     * Шифрование сообщения для контакта
     */
    async encryptForContact(message, contactAddress) {
        try {
            // 🛡️ ПРАВИЛО: Убеждаемся, что адрес в lowerCase
            const addressLower = contactAddress.toLowerCase();
            const contactPublicKey = await this.getContactPublicKey(addressLower);
            return CryptoUtils.encryptMessage(message, contactPublicKey);
        } catch (error) {
            console.error(`❌ V3: Ошибка шифрования для контакта ${contactAddress}:`, error);
            throw error;
        }
    }

    /**
     * Шифрование сообщения для себя
     */
    async encryptForSelf(message) {
        console.log('🔐 V3: Шифруем для себя:', {
            message: message,
            userPublicKey: this.appState.userPublicKey.substring(0, 20) + '...',
            userPrivateKey: this.appState.userPrivateKey.substring(0, 20) + '...'
        });
        
        // Шифруем сообщение
        const encryptedForSelf = CryptoUtils.encryptMessage(message, this.appState.userPublicKey);
        
        // 🧪 ТЕСТ: Сразу же расшифровываем то, что зашифровали
        console.log('🧪 V3: ТЕСТ ШИФРОВКИ/РАСШИФРОВКИ:');
        console.log('  📝 Исходное сообщение:', message);
        console.log('  🔐 Зашифрованное сообщение для отправителя (для нас):', encryptedForSelf);
        
        try {
            const decryptedBack = CryptoUtils.decryptMessage(encryptedForSelf, this.appState.userPrivateKey);
            console.log('  🔓 Расшифрованное сообщение:', decryptedBack);
            
            if (decryptedBack === message) {
                console.log('  ✅ ТЕСТ ПРОШЕЛ: Шифровка/расшифровка работает!');
            } else {
                console.log('  ❌ ТЕСТ НЕ ПРОШЕЛ: Расшифрованное сообщение не совпадает!');
                console.log('    - Ожидалось:', message);
                console.log('    - Получено:', decryptedBack);
            }
        } catch (testError) {
            console.log('  ❌ ТЕСТ НЕ ПРОШЕЛ: Ошибка расшифровки:', testError.message);
        }
        
        return encryptedForSelf;
    }

    /**
     * Получение публичного ключа контакта
     */
    async getContactPublicKey(contactAddress) {
        try {
            // 🛡️ ПРАВИЛО: Используем lowercase для получения данных из кэша
            const addressLower = contactAddress.toLowerCase();
            const contactData = this.contactListManager.contactsCache.get(addressLower);
            
            if (contactData && contactData.publicKeyForEncode) {
                console.log(`🔑 V3: Ключ для ${addressLower} найден в кэше`);
                return contactData.publicKeyForEncode;
            }

            // Если в кэше нет, запрашиваем у контракта
            console.log(`🔍 V3: Ключ для ${addressLower} не найден в кэше, запрашиваем у контракта...`);
            const userSettings = await this.contract.methods.userSettings(addressLower).call();
            const contactPublicKey = userSettings.publicKeyForEncode;

            if (!contactPublicKey || contactPublicKey === '0x' || contactPublicKey.length < 60) {
                throw new Error(`Пользователь ${addressLower} не зарегистрирован или имеет неверный ключ.`);
            }

            // Сохраняем в кэш для будущего использования
            if (contactData) {
                contactData.publicKeyForEncode = contactPublicKey;
            } else {
                // Этого быть не должно, если контакт есть в списке, но на всякий случай
                console.warn(`⚠️ V3: Контакт ${addressLower} не был в кэше, но для него запрошен ключ.`);
            }

            console.log('🔑 V3: Публичный ключ для шифрования (publicKeyForEncode):', {
                contactAddress: addressLower,
                publicKey: contactPublicKey.substring(0, 20) + '...',
                fullLength: contactPublicKey.length
            });

            return contactPublicKey;

        } catch (error) {
            console.error(`❌ V3: Не удалось получить публичный ключ для ${contactAddress}:`, error);
            this.appState.showNotification(`Не удалось получить ключ для ${contactAddress.slice(0, 8)}...`, 'error');
            throw error;
        }
    }

    /**
     * Генерация chatID (аналогично контракту)
     */
    generateChatId(address1, address2) {
        return CryptoUtils.generateChatId(address1, address2);
    }

    /**
     * Прокрутка к последнему сообщению
     */
    scrollToBottom() {
        const container = document.getElementById('chat-messages');
        if (container && container.parentElement) {
            const scrollableArea = container.parentElement;
            scrollableArea.scrollTop = scrollableArea.scrollHeight;
        }
    }

    /**
     * Показ приветственной области
     */
    showWelcomeArea() {
        const chatArea = document.getElementById('chatArea');
        const welcomeArea = document.getElementById('welcomeArea');
        
        if (chatArea) chatArea.style.display = 'none';
        if (welcomeArea) welcomeArea.style.display = 'flex';
        
        this.currentContact = null;
        this.currentChatID = null;
        this.currentFrontendState = null;
    }

    /**
     * Получение текущего состояния чата
     */
    getCurrentFrontendState() {
        return this.currentFrontendState;
    }

    /**
     * Получение статистики чата (для совместимости с V2)
     */
    getChatStats() {
        return {
            totalMessages: this.currentChatMessages.length,
            loadedMessages: this.currentChatMessages.length,
            isFullyLoaded: true,
            currentChatID: this.currentChatID,
            frontendState: this.currentFrontendState
        };
    }

    //================================================================================
    // 🆕 POLLING МЕТОДЫ ДЛЯ СООБЩЕНИЙ (перенесено из DecentralizedEventSystemV3)
    //================================================================================

    /**
     * Инициализация индекса последнего сообщения
     */
    async initializeMessageIndex() {
        try {
            const messagesCount = await this.contract.methods.getMessagesCount().call({ from: this.appState.currentUser });
            this.lastMessageIndex = parseInt(messagesCount) - 1;
            console.log(`📊 V3: Найдено сообщений: ${parseInt(messagesCount)}, последний индекс: ${this.lastMessageIndex}`);
        } catch (error) {
            console.error('❌ V3: Ошибка получения количества сообщений:', error);
            this.lastMessageIndex = -1;
        }
    }

    /**
     * Polling новых сообщений
     */
    async pollForNewMessages() {
        try {
            const startIndex = this.lastMessageIndex + 1;
            const endIndex = startIndex + this.messagesBatchSize - 1;
            
            // Проверяем, есть ли новые сообщения
            const messagesCount = await this.contract.methods.getMessagesCount().call({ 
                from: this.appState.currentUser 
            });
            
            if (startIndex >= parseInt(messagesCount)) {
                return []; // Новых сообщений нет
            }
            
            const newMessages = await this.contract.methods.getMessagesPaginated(
                startIndex,
                endIndex
            ).call({ from: this.appState.currentUser });
            
            if (newMessages.length === 0) {
                return [];
            }
            
            console.log(`📨 V3: Получено ${newMessages.length} новых сообщений`);
            
            // Обновляем lastMessageIndex
            const maxIndex = Math.max(...newMessages.map(msg => parseInt(msg.messIndex)));
            this.lastMessageIndex = maxIndex;
            
            return newMessages;
            
        } catch (error) {
            console.error('❌ V3: Ошибка polling сообщений:', error);
            return [];
        }
    }

    /**
     * Определение frontend состояния чата из TypeMessage
     */
    determineFrontendChatStateFromMessage(message) {
        const contractState = parseInt(message.newChatState);
        
        // 0 = allowedWrite, 1 = notAllowedWrite, 2 = waitingAcceptance
        if (contractState === 0) {
            return 'allowedWrite';
        }
        
        if (contractState === 1) {
            return 'notAllowedWrite';
        }
        
        if (contractState === 2) { // waitingAcceptance
            if (message.isFromMe) {
                return 'waitingAcceptanceFromOther'; // Жду принятия от собеседника
            } else {
                return 'waitingAcceptanceFromMe'; // Нужно принять или отклонить
            }
        }
        
        return 'unknown';
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        this.currentContact = null;
        this.currentChatID = null;
        this.currentChatMessages = [];
        this.allUserMessages = [];
        
        console.log('🗑️ ChatAreaManager V3 очищен');
    }
}
