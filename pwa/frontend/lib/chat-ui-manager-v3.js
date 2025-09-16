/**
 * Менеджер UI для чата с пагинацией и real-time обновлениями
 */

class ChatUIManager {
    constructor(contract, userAddress) {
console.log('📦 ChatUIManager v3.0.0 - CryptoMessenger v2 contract support (no avatars) loaded');
console.log('🔧 File: chat-ui-manager-v3.js');
        
        this.contract = contract;
        this.userAddress = userAddress;
        this.messageLoader = new DecentralizedEventSystem(contract, userAddress);
        this.lazyLoader = new LazyChatLoader(this.messageLoader);
        this.currentContact = null;
        this.messageCallbacks = new Map(); // contactAddress -> callback functions
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
            if (chatContainer) {
                this.lazyLoader.initScrollListener(contactAddress, chatContainer, (newMessages, startIndex) => {
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
        
        messages.forEach((message, index) => {
            console.log(`🔍 [V2] Обрабатываем сообщение ${index}:`, message);
            console.log(`🔍 [V2] Структура сообщения:`, {
                encryptedForSmaller: message.encryptedForSmaller,
                encryptedForLarger: message.encryptedForLarger,
                messageTimestamp: message.messageTimestamp
            });
            
            const messageElement = this.createMessageElement(message, index);
            container.appendChild(messageElement);
        });
        
        // Прокручиваем вниз
        this.scrollToBottom();
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
        
        newMessages.forEach(message => {
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
        const currentUserAddress = window.currentUser || this.userAddress;
        const contactAddress = this.currentContactAddress || this.currentContact;
        
        console.log('🔍 [V2] createMessageElement - проверяем переменные:');
        console.log('   👤 currentUserAddress:', currentUserAddress);
        console.log('   👥 contactAddress:', contactAddress);
        console.log('   📄 message:', message);
        
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
        
        console.log(`🔍 [V2] Определяем поле для расшифровки:`);
        console.log(`   👤 Текущий пользователь: ${currentUserAddress}`);
        console.log(`   👥 Собеседник: ${contactAddress}`);
        console.log(`   📄 Данные для расшифровки:`, encryptedData);
        
        // Пытаемся расшифровать сообщение
        const decryptedText = CryptoUtils.decryptMessage(encryptedData, contactAddress, currentUserAddress);
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
        if (container) {
            container.scrollTop = container.scrollHeight;
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

    /**
     * Отправка сообщения (заглушка для будущей реализации)
     */
    async sendMessage(contactAddress, messageText) {
        console.log(`📤 Отправляем сообщение: "${messageText}"`);
        // Здесь будет реализация отправки сообщения
        // Пока что просто логируем
        console.log('⚠️ Отправка сообщений пока не реализована');
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatUIManager;
}

// Глобальный экспорт для браузера
if (typeof window !== 'undefined') {
    window.ChatUIManager = ChatUIManager;
}
