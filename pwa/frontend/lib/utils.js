/**
 * Утилиты общего назначения для CryptoMessenger
 * 
 * 🎯 ЗОНА ОТВЕТСТВЕННОСТИ:
 * ✅ Форматирование времени и дат (formatTime)
 * ✅ Работа с адресами (shortenAddress, getAvatarColor)
 * ✅ Статусы и приоритеты чатов (getStatusText, getStatePriority)
 * ✅ Временные вычисления (calculateDaysSince, checkTimeout)
 * ✅ Создание UI элементов сообщений (createMessageElement)
 * 
 * ❌ НЕ ОТВЕЧАЕТ ЗА:
 * ❌ Криптографию и шифрование (→ CryptoUtils)
 * ❌ Работу с блокчейном (→ менеджеры)
 * ❌ Управление состоянием (→ AppState, менеджеры)
 * 
 * v1.2.0 - Добавлены функции чатов и UI элементов
 */

class Utils {
    /**
     * Форматирование времени для отображения в UI
     * @param {Date|number} timestamp - Временная метка
     * @returns {string} Отформатированное время
     */
    static formatTime(timestamp) {
        try {
            const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            // Определяем язык пользователя
            const isRussian = navigator.language.startsWith('ru') || navigator.languages.some(lang => lang.startsWith('ru'));
            
            if (diff < 60000) { // Меньше минуты
                return isRussian ? 'сейчас' : 'now';
            } else if (diff < 3600000) { // Меньше часа
                const minutes = Math.floor(diff / 60000);
                return isRussian ? `${minutes}м` : `${minutes}m`;
            } else if (diff < 86400000) { // Меньше дня
                const locale = isRussian ? 'ru-RU' : 'en-US';
                return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
            } else if (diff < 604800000) { // Меньше недели
                if (isRussian) {
                    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
                    return days[date.getDay()];
                } else {
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    return days[date.getDay()];
                }
            } else {
                const locale = isRussian ? 'ru-RU' : 'en-US';
                return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
            }
        } catch (error) {
            console.error('❌ Utils: Ошибка форматирования времени:', error);
            return '';
        }
    }

    /**
     * Получение цвета аватара на основе адреса
     * @param {string} address - Адрес для генерации цвета
     * @returns {string} Цвет в формате hex
     */
    static getAvatarColor(address) {
        const colors = [
            '#2563eb', '#dc2626', '#059669', '#7c2d12', '#7c3aed', 
            '#ea580c', '#db2777', '#ca8a04', '#14b8a6', '#64748b'
        ];
        const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    /**
     * Сокращение длинного адреса для отображения
     * @param {string} address - Полный адрес
     * @param {number} startChars - Количество символов в начале (по умолчанию 6)
     * @param {number} endChars - Количество символов в конце (по умолчанию 4)
     * @returns {string} Сокращенный адрес
     */
    static shortenAddress(address, startChars = 6, endChars = 4) {
        if (!address || address.length <= startChars + endChars) {
            return address;
        }
        return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
    }

    //================================================================================
    // 🆕 ФУНКЦИИ ЧАТОВ И СТАТУСОВ (перенесено из менеджеров)
    //================================================================================

    /**
     * Получение текста статуса для отображения (перенесено из ContactListManagerV3)
     * @param {string} frontendState - Состояние чата
     * @returns {string} Текст статуса
     */
    static getStatusText(frontendState) {
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
     * Определение приоритета состояния контакта для сортировки (перенесено из ContactListManagerV3)
     * @param {string} frontendState - Состояние чата
     * @returns {number} Приоритет (чем меньше, тем выше)
     */
    static getStatePriority(frontendState) {
        const statePriority = {
            'waitingAcceptanceFromMe': 1,    // Входящие приглашения - САМЫЙ ВЫСОКИЙ
            'allowedWrite': 2,               // Активные чаты - высокий
            'waitingAcceptanceFromOther': 3, // Исходящие приглашения - средний
            'notAllowedWrite': 4,            // Заблокированные - САМЫЙ НИЗКИЙ
            'unknown': 5                     // Неизвестное состояние - низший приоритет
        };
        return statePriority[frontendState] || 5;
    }

    //================================================================================
    // 🆕 ВРЕМЕННЫЕ ВЫЧИСЛЕНИЯ (перенесено из ChatAreaManagerV3)
    //================================================================================

    /**
     * Расчет количества дней между двумя временными метками
     * @param {number} fromTimestamp - Начальная временная метка (миллисекунды)
     * @param {number} toTimestamp - Конечная временная метка (миллисекунды, по умолчанию текущее время)
     * @returns {number} Количество дней
     */
    static calculateDaysSince(fromTimestamp, toTimestamp = Date.now()) {
        if (!fromTimestamp || fromTimestamp <= 0) {
            return 0;
        }
        
        const daysSince = Math.floor((toTimestamp - fromTimestamp) / (24 * 60 * 60 * 1000));
        return Math.max(0, daysSince);
    }

    /**
     * Проверка истечения таймаута
     * @param {number} lastMessageTimestamp - Время последнего сообщения (миллисекунды)
     * @param {number} timeoutThreshold - Порог таймаута (миллисекунды)
     * @returns {boolean} true если таймаут истек
     */
    static checkTimeout(lastMessageTimestamp, timeoutThreshold) {
        if (!lastMessageTimestamp || lastMessageTimestamp <= 0) {
            return false;
        }
        
        const now = Date.now();
        const timeSinceLastMessage = now - lastMessageTimestamp;
        
        return timeSinceLastMessage > timeoutThreshold;
    }

    //================================================================================
    // 🆕 UI ЭЛЕМЕНТЫ (перенесено из ChatAreaManagerV3)
    //================================================================================

    /**
     * Создание DOM элемента сообщения (перенесено из ChatAreaManagerV3)
     * @param {string} text - Текст сообщения
     * @param {boolean} isFromMe - Исходящее ли сообщение
     * @param {Date} timestamp - Время сообщения
     * @param {number} messIndex - Индекс сообщения
     * @returns {HTMLElement} DOM элемент сообщения
     */
    static createMessageElement(text, isFromMe, timestamp, messIndex) {
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

}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}

// Глобальный экспорт для браузера
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}

console.log('📦 Utils v1.2.0 - Утилиты общего назначения загружены (English/Русский + чаты/UI)');
