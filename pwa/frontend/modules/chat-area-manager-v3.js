/**
 * ChatAreaManager V3 - Управление областью чата и сообщениями
 * 
 * 🎯 ЗОНА ОТВЕТСТВЕННОСТИ:
 * ✅ UI области чата (панели, заголовки, приветствие)
 * ✅ Загрузка и отображение сообщений (loadAllUserMessages, renderMessages)
 * ✅ Определение состояний чата (determineFrontendChatState, updateChatState)
 * ✅ Панели приглашений (setVisiblePanel*, checkInvitationTimeout)
 * ✅ Отправка сообщений (sendMessage)
 * ✅ Действия с приглашениями (acceptInvitation, rejectInvitation, cancelInvitation)
 * ✅ Фильтрация сообщений по чатам (filterMessagesForCurrentChat)
 * ✅ Polling сообщений (messLastIndex, addMessageToUI)
 * ✅ Прокрутка и навигация в чате (scrollToBottom)
 * 
 * ❌ НЕ ОТВЕЧАЕТ ЗА:
 * ❌ Список контактов и их данные (→ ContactListManagerV3)
 * ❌ Криптографию и шифрование (→ CryptoUtils)
 * ❌ Глобальное состояние пользователя (→ AppState)
 * ❌ Сортировку и позиционирование контактов (→ ContactListManagerV3)
 * 
 * CryptoMessenger v3.0.0
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
        this.allUserMessages = [];
        this.allUserMessagesLoaded = false;
        
        // 🆕 Polling состояние для сообщений (согласно алгоритму)
        this.messagesBatchSize = window.CryptoMessengerConfig.pollingConfig.MESSAGES_BATCH_SIZE;
        this.messLastIndex = -1; // Нулевая индексация → первый polling с 0
        
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
            this.setVisiblePanelInvitationCancel(isTimeoutExpired);
            console.log(`Панель отзыта показана для состояния waitingAcceptanceFromOther: ${isTimeoutExpired}`);
        } else {
            // Для всех остальных состояний скрываем панель отзыва
            this.setVisiblePanelInvitationCancel(false);
            console.log(`Панель отзыта скрыта для состояния ${frontendState}`);
        }

        // Для notAllowedWrite проверяем, кто отправил последнее сообщение
        if (frontendState === 'notAllowedWrite') {
            const isLastMessageFromMe = this.isLastMessageFromCurrentUser();            
            if (isLastMessageFromMe) {
                // Панель 5: Я последний писал → могу отправить новое приглашение
                this.setVisiblePanelInvitationSend(true);
                this.setVisiblePanelNOTallowedWrite(false);
                console.log(`Панель отправки приглашения показана (последнее сообщение от меня)`);
            } else {
                // Панель 6: Собеседник последний писал → только ждем
                this.setVisiblePanelInvitationSend(false);
                this.setVisiblePanelNOTallowedWrite(true);
                console.log(`Панель "чат не активен" показана (последнее сообщение НЕ от меня)`);
            }
        } else {
            // Для всех остальных состояний скрываем обе панели
            this.setVisiblePanelInvitationSend(false);
            this.setVisiblePanelNOTallowedWrite(false);
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
                this.allUserMessagesLoaded = true;
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
     * Отображение сообщений в UI (использует currentChatMessages из модели)
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
        
        // Прокручиваем вниз (с небольшой задержкой для корректного рендеринга DOM)
        setTimeout(() => {
            this.scrollToBottom();
            console.log(`📜 V3: Выполнена автопрокрутка к последнему сообщению`);
        }, 50);
        
        console.log(`✅ V3: Отображено ${this.currentChatMessages.length} сообщений`);
    }

    /**
     * Отображение сообщений в UI (принимает сообщения как параметр, НЕ изменяет модель)
     */
    renderMessagesForChat(messages) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) {
            console.error('❌ V3: Контейнер сообщений не найден');
            return;
        }
        
        // Очищаем контейнер
        messagesContainer.innerHTML = '';
        
        // Отображаем каждое сообщение (НЕ изменяем currentChatMessages)
        messages.forEach(msg => {
            this.addMessageToUI(msg);
        });
        
        // Прокручиваем вниз
        this.scrollToBottom();
        
        console.log(`✅ V3: Отображено ${messages.length} сообщений (без изменения модели)`);
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
            const messageElement = Utils.createMessageElement(
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

    // ❌ УДАЛЕНО: createMessageElement() - перенесено в Utils.createMessageElement()

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
                // Используем централизованную функцию расчета дней
                const invitationDays = this.calculateInvitationDays();
                
                // Обновляем количество дней до отзыва
                const daysSpan = document.getElementById('daysUntilCancel');
                if (daysSpan) {
                    daysSpan.textContent = invitationDays.daysUntil;
                }
                
                // Скрываем/показываем надпись о сроках в зависимости от daysUntil
                const noteElement = document.querySelector('#panelWaitingAcceptanceFromOther .invitation-note');
                if (noteElement) {
                    if (invitationDays.daysUntil <= 0) {
                        noteElement.style.display = 'none';
                        console.log(`🔍 V3: Надпись о сроках скрыта (daysUntil: ${invitationDays.daysUntil})`);
                    } else {
                        noteElement.style.display = 'block';
                        console.log(`🔍 V3: Надпись о сроках показана (daysUntil: ${invitationDays.daysUntil})`);
                    }
                }
                
                console.log(`⏰ V3: Панель исходящего приглашения - дней до отзыва: ${invitationDays.daysUntil}`);
            }
        }
    }

    /**
     * Панель 5: ОТПРАВКА ПРИГЛАШЕНИЯ (чат не активен)
     * Условие показа: frontendState === 'notAllowedWrite' И последнее сообщение от меня
     */
    setVisiblePanelInvitationSend(visible) {
        const panel = document.getElementById('panelInvitationSend');
        if (panel) {
            panel.style.display = visible ? 'block' : 'none';
            console.log(`🎨 Панель отправки приглашения: ${visible ? 'показана' : 'скрыта'}`);
            
            if (visible) {
                // Настраиваем обработчик кнопки отправки приглашения
                const sendBtn = document.getElementById('sendInvitationToChatBtn');
                if (sendBtn) {
                    sendBtn.onclick = () => this.openInvitationModalForCurrentContact();
                }
            }
        }
    }

    /**
     * Открытие модального окна приглашения для текущего контакта
     */
    openInvitationModalForCurrentContact() {
        const currentContact = this.appState.currentContact;
        if (currentContact) {
            // Используем ContactListManager для открытия модального окна с зафиксированным адресом
            this.appState.contactListManager.openInvitationModal(currentContact.address, true);
        }
    }

    /**
     * Панель 6: ЧАТ НЕ АКТИВЕН (последнее сообщение не от меня)
     * Условие показа: frontendState === 'notAllowedWrite' И последнее сообщение НЕ от меня
     */
    setVisiblePanelNOTallowedWrite(visible) {
        const panel = document.getElementById('panelNOTallowedWrite');
        if (panel) {
            panel.style.display = visible ? 'block' : 'none';
            console.log(`🎨 Панель "чат не активен": ${visible ? 'показана' : 'скрыта'}`);
        }
    }

    /**
     * Панель 4: ОТЗЫВ ПРИГЛАШЕНИЯ (после таймаута)
     * Условие показа: Состояние == waitingAcceptanceFromOther И прошло более INVITATION_TIMEOUT времени
     */
    setVisiblePanelInvitationCancel(visible) {
        const panel = document.getElementById('panelInvitationCancel');
        console.log(`🔍 V3: setVisiblePanelInvitationCancel вызвана:`, {
            visible: visible,
            panelFound: !!panel,
            currentDisplay: panel ? panel.style.display : 'элемент не найден'
        });
        
        if (panel) {
            panel.style.display = visible ? 'block' : 'none';
            console.log(`🎨 Панель отзыва приглашения: ${visible ? 'показана' : 'скрыта'} (display: ${panel.style.display})`);
            
            if (visible) {
                // Используем централизованную функцию расчета дней
                const invitationDays = this.calculateInvitationDays();
                
                // Обновляем заголовок с количеством дней
                const daysSinceSpan = document.getElementById('daysSinceInvitation');
                if (daysSinceSpan) {
                    daysSinceSpan.textContent = invitationDays.daysSince;
                }
                
                // Настраиваем обработчик кнопки отзыва
                const cancelBtn = document.getElementById('cancelInvitationTimeoutBtn');
                if (cancelBtn) cancelBtn.onclick = () => this.cancelInvitation();
                
                console.log(`⏰ V3: Панель отзыва приглашения - дней с момента приглашения: ${invitationDays.daysSince}`);
            }
        }
    }

    /**
     * Проверка, является ли последнее сообщение от текущего пользователя
     * @returns {boolean} true если последнее сообщение от меня
     */
    isLastMessageFromCurrentUser() {
        if (!this.currentChatMessages || this.currentChatMessages.length === 0) {
            return false; // Нет сообщений
        }
        
        const lastMessage = this.currentChatMessages[this.currentChatMessages.length - 1];
        const isFromMe = lastMessage.isFromMe;
        
        console.log(`🔍 V3: Проверка последнего сообщения:`, {
            messIndex: lastMessage.messIndex,
            isFromMe: isFromMe,
            messageTimestamp: lastMessage.messageTimestamp
        });
        
        return isFromMe;
    }

    /**
     * Расчет дней с момента последнего сообщения и до возможности отзыва
     * @returns {Object} {daysSince, daysUntil, timeoutDays, isExpired}
     */
    calculateInvitationDays() {
        if (!this.currentChatMessages || this.currentChatMessages.length === 0) {
            return {
                daysSince: 0,
                daysUntil: 3,
                timeoutDays: 3,
                isExpired: false
            };
        }
        
        // Оптимизация: получаем время из кэша контакта вместо поиска в currentChatMessages
        const currentContact = this.appState.currentContact;
        if (!currentContact) {
            return {
                daysSince: 0,
                daysUntil: 3,
                timeoutDays: 3,
                isExpired: false
            };
        }
        
        // Получаем данные контакта из ContactListManager
        const contactData = this.appState.pollingCoordinator?.contactListManager?.getContactData(currentContact.address);
        if (!contactData || !contactData.lastMessageTime) {
            console.log(`⚠️ V3: Данные контакта не найдены, используем текущее время`);
            return {
                daysSince: 0,
                daysUntil: 3,
                timeoutDays: 3,
                isExpired: false
            };
        }
        
        const lastMessageTime = contactData.lastMessageTime;
        console.log(`🔍 V3: Время последнего сообщения из кэша контакта: ${Utils.formatTimeDebug(lastMessageTime)}`);
        const timeoutThreshold = window.CryptoMessengerConfig.INVITATION_TIMEOUT;
        const timeoutDays = Math.floor(timeoutThreshold / (24 * 60 * 60 * 1000));
        
        const daysSince = Utils.calculateDaysSince(lastMessageTime);
        const daysUntil = Math.max(0, timeoutDays - daysSince);
        const isExpired = Utils.checkTimeout(lastMessageTime, timeoutThreshold);
        
        return {
            daysSince: daysSince,
            daysUntil: daysUntil,
            timeoutDays: timeoutDays,
            isExpired: isExpired
        };
    }

    /**
     * Проверка истечения таймаута приглашения
     */
    checkInvitationTimeout() {
        const invitationDays = this.calculateInvitationDays();
        
        console.log(`⏰ V3: Проверка таймаута приглашения:`, {
            daysSince: invitationDays.daysSince,
            daysUntil: invitationDays.daysUntil,
            timeoutDays: invitationDays.timeoutDays,
            isExpired: invitationDays.isExpired
        });
        
        return invitationDays.isExpired;
    }

    // ❌ УДАЛЕНО: calculateDaysSinceLastMessage() - заменено на Utils.calculateDaysSince()

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
            const encryptedForRecipient = await CryptoUtils.encryptForContact(acceptMessage, currentContactAddress, this.contract, this.contactListManager.contactsCache);
            const encryptedForSender = CryptoUtils.encryptForSelf(acceptMessage, this.appState.userPublicKey, this.appState.userPrivateKey);

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
            const encryptedForRecipient = await CryptoUtils.encryptForContact(rejectMessage, currentContactAddress, this.contract, this.contactListManager.contactsCache);
            const encryptedForSender = CryptoUtils.encryptForSelf(rejectMessage, this.appState.userPublicKey, this.appState.userPrivateKey);

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
            const encryptedForRecipient = await CryptoUtils.encryptForContact(cancelMessage, currentContactAddress, this.contract, this.contactListManager.contactsCache);
            const encryptedForSender = CryptoUtils.encryptForSelf(cancelMessage, this.appState.userPublicKey, this.appState.userPrivateKey);

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
            const encryptedForRecipient = await CryptoUtils.encryptForContact(messageText, currentContact.address, this.contract, this.contactListManager.contactsCache);
            const encryptedForSender = CryptoUtils.encryptForSelf(messageText, this.appState.userPublicKey, this.appState.userPrivateKey);
            
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
            const encryptedForRecipient = await CryptoUtils.encryptForContact(deactivateMessage, currentContactAddress, this.contract, this.contactListManager.contactsCache);
            const encryptedForSender = CryptoUtils.encryptForSelf(deactivateMessage, this.appState.userPublicKey, this.appState.userPrivateKey);

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

    // ❌ УДАЛЕНЫ дублированные функции шифрования:
    // encryptForContact() - заменено на CryptoUtils.encryptForContact()
    // encryptForSelf() - заменено на CryptoUtils.encryptForSelf()  
    // getContactPublicKey() - заменено на CryptoUtils.getContactPublicKey()

    // ❌ УДАЛЕНО: generateChatId() - дублирует CryptoUtils.generateChatId()

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
