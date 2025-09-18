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
     * Открытие чата с контактом
     */
    async openChat(contactAddress) {
        console.log(`💬 V3: Открываем чат с ${contactAddress}`);
        
        this.currentContact = contactAddress;
        this.currentChatID = CryptoUtils.generateChatId(this.appState.currentUser, contactAddress);
        this.currentChatMessages = [];
        
        console.log(`🔍 V3: Генерируем chatID:`, {
            currentUser: this.appState.currentUser,
            contactAddress: contactAddress,
            generatedChatID: this.currentChatID
        });
        
        try {
            // 1. Загружаем все сообщения для текущего пользователя
            await this.loadAllUserMessages();
            
            // 2. Фильтруем сообщения для текущего чата
            this.filterMessagesForCurrentChat();
            
            // 3. Отображаем сообщения
            this.renderMessages();
            
            // 4. Определяем состояние чата и обновляем UI
            await this.updateChatState();
            
            console.log(`✅ V3: Чат открыт, сообщений: ${this.currentChatMessages.length}`);
            
        } catch (error) {
            console.error('❌ V3: Ошибка открытия чата:', error);
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
        
        const frontendState = this.determineFrontendChatState(lastMessage);
        
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
    determineFrontendChatState(message) {
        const contractState = parseInt(message.newChatState);
        
        console.log(`🔍 V3: determineFrontendChatState:`, {
            contractState: contractState,
            isFromMe: message.isFromMe,
            rawNewChatState: message.newChatState
        });
        
        if (contractState === 0) {
            console.log('✅ V3: Состояние = allowedWrite');
            return 'allowedWrite';
        }
        if (contractState === 1) {
            console.log('✅ V3: Состояние = notAllowedWrite');
            return 'notAllowedWrite';
        }
        
        if (contractState === 2) { // waitingAcceptance
            const result = message.isFromMe ? 'waitingAcceptanceFromOther' : 'waitingAcceptanceFromMe';
            console.log(`✅ V3: Состояние = ${result} (isFromMe: ${message.isFromMe})`);
            return result;
        }
        
        console.warn('⚠️ V3: Неизвестное состояние:', contractState);
        return 'unknown';
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
     * Принятие приглашения
     */
    async acceptInvitation() {
        const currentContact = this.appState.currentContact;
        if (!currentContact) return;
        
        try {
            console.log('✅ V3: Принимаем приглашение от:', currentContact.address);
            
            // Используем стандартную фразу из конфигурации
            const acceptMessage = window.CryptoMessengerConfig.invitationMessages.accept;
            console.log('📝 V3: Сообщение принятия:', acceptMessage);
            
            // Шифруем сообщения для обеих сторон
            const encryptedForRecipient = await this.encryptForContact(acceptMessage, currentContact.address);
            const encryptedForSender = await this.encryptForSelf(acceptMessage);
            
            // Вызываем функцию контракта V3
            await this.contract.methods.invitationAccept(
                currentContact.address,
                encryptedForRecipient,
                encryptedForSender
            ).send({ from: this.appState.currentUser });
            
            console.log('✅ V3: Приглашение принято');
            
        } catch (error) {
            console.error('❌ V3: Ошибка принятия приглашения:', error);
        }
    }

    /**
     * Отклонение приглашения
     */
    async rejectInvitation() {
        const currentContact = this.appState.currentContact;
        if (!currentContact) return;
        
        try {
            console.log('❌ V3: Отклоняем приглашение от:', currentContact.address);
            
            // Используем стандартную фразу из конфигурации
            const rejectMessage = window.CryptoMessengerConfig.invitationMessages.reject;
            console.log('📝 V3: Сообщение отклонения:', rejectMessage);
            
            // Шифруем сообщения для обеих сторон
            const encryptedForRecipient = await this.encryptForContact(rejectMessage, currentContact.address);
            const encryptedForSender = await this.encryptForSelf(rejectMessage);
            
            // Вызываем функцию контракта V3
            await this.contract.methods.invitationReject(
                currentContact.address,
                encryptedForRecipient,
                encryptedForSender
            ).send({ from: this.appState.currentUser });
            
            console.log('✅ V3: Приглашение отклонено');
            
        } catch (error) {
            console.error('❌ V3: Ошибка отклонения приглашения:', error);
        }
    }

    /**
     * Отзыв приглашения
     */
    async cancelInvitation() {
        const currentContact = this.appState.currentContact;
        if (!currentContact) return;
        
        try {
            console.log('🔄 V3: Отзываем приглашение для:', currentContact.address);
            
            // Используем стандартную фразу из конфигурации
            const cancelMessage = window.CryptoMessengerConfig.invitationMessages.cancel;
            console.log('📝 V3: Сообщение отзыва:', cancelMessage);
            
            // Шифруем сообщения для обеих сторон
            const encryptedForRecipient = await this.encryptForContact(cancelMessage, currentContact.address);
            const encryptedForSender = await this.encryptForSelf(cancelMessage);
            
            // Вызываем функцию контракта V3
            await this.contract.methods.invitationCancel(
                currentContact.address,
                encryptedForRecipient,
                encryptedForSender
            ).send({ from: this.appState.currentUser });
            
            console.log('✅ V3: Приглашение отозвано');
            
        } catch (error) {
            console.error('❌ V3: Ошибка отзыва приглашения:', error);
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
        const currentContact = this.appState.currentContact;
        if (!currentContact) return;
        
        try {
            console.log('🚫 V3: Деактивируем чат с:', currentContact.address);
            
            // Используем стандартную фразу из конфигурации
            const deactivateMessage = window.CryptoMessengerConfig.invitationMessages.deactivate;
            console.log('📝 V3: Сообщение деактивации:', deactivateMessage);
            
            // Шифруем сообщения для обеих сторон
            const encryptedForRecipient = await this.encryptForContact(deactivateMessage, currentContact.address);
            const encryptedForSender = await this.encryptForSelf(deactivateMessage);
            
            // Вызываем функцию контракта V3
            await this.contract.methods.deactivateChat(
                currentContact.address,
                encryptedForRecipient,
                encryptedForSender
            ).send({ from: this.appState.currentUser });
            
            console.log('✅ V3: Чат деактивирован');
            
        } catch (error) {
            console.error('❌ V3: Ошибка деактивации чата:', error);
        }
    }

    /**
     * Шифрование сообщения для контакта
     */
    async encryptForContact(message, contactAddress) {
        const contactPublicKey = await this.getContactPublicKey(contactAddress);
        return CryptoUtils.encryptMessage(message, contactPublicKey);
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
            const userSettings = await this.contract.methods.userSettings(contactAddress).call();
            const contactPublicKey = userSettings.publicKeyForEncode;
            
            console.log('🔑 V3: Публичный ключ для шифрования контакта:', {
                contactAddress: contactAddress,
                publicKeyForEncode: contactPublicKey.substring(0, 20) + '...',
                fullLength: contactPublicKey.length
            });
            
            return contactPublicKey;
        } catch (error) {
            console.error('❌ V3: Ошибка получения публичного ключа:', error);
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
