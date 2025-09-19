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
     * Форматирование времени в формате YYYY-MM-DD hh:mm:ss для debug режима
     * @param {Date|number} timestamp - Временная метка
     * @returns {string} Отформатированное время в формате YYYY-MM-DD hh:mm:ss
     */
    static formatTimeDebug(timestamp) {
        try {
            const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            
        } catch (error) {
            console.error('❌ Utils: Ошибка форматирования времени debug:', error);
            return 'invalid-date';
        }
    }

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
     * Получение цвета аватара на основе адреса (детерминированный)
     * @param {string} address - Адрес для генерации цвета
     * @returns {string} Цвет в формате hex
     */
    static getAvatarColor(address) {
        // Расширенная палитра приятных цветов для аватаров
        const colors = [
            '#3B82F6', // Синий
            '#EF4444', // Красный  
            '#10B981', // Зеленый
            '#F59E0B', // Желтый
            '#8B5CF6', // Фиолетовый
            '#06B6D4', // Голубой
            '#84CC16', // Лайм
            '#F97316', // Оранжевый
            '#EC4899', // Розовый
            '#6366F1', // Индиго
            '#14B8A6', // Бирюзовый
            '#A855F7', // Пурпурный
            '#22C55E', // Изумрудный
            '#F43F5E', // Малиновый
            '#0EA5E9', // Небесный
            '#8B5A2B'  // Коричневый
        ];
        
        // Более качественный хэш на основе адреса
        let hash = 0;
        const cleanAddress = address.toLowerCase().replace('0x', '');
        
        for (let i = 0; i < cleanAddress.length; i++) {
            const char = cleanAddress.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Конвертируем в 32-битное число
        }
        
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Тестовая функция для демонстрации цветов аватаров
     * @param {string[]} addresses - Массив адресов для тестирования
     * @returns {Object[]} - Массив объектов {address, color, initial}
     */
    static testAvatarColors(addresses) {
        console.log('🎨 Тестирование цветов аватаров:');
        const results = addresses.map(address => {
            const color = this.getAvatarColor(address);
            const initial = address.charAt(2).toUpperCase(); // Берем первый символ после 0x
            console.log(`📍 ${address} → 🎨 ${color} → 🔤 ${initial}`);
            return { address, color, initial };
        });
        return results;
    }

    /**
     * Тестовая функция для демонстрации форматирования времени сообщений
     */
    static testMessageTimeFormatting() {
        const now = new Date();
        console.log('🕒 Тестирование простого форматирования времени сообщений:');
        
        // Сегодня
        const today = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 часа назад
        console.log(`📅 Сегодня (2 часа назад): "${this.formatMessageTime(today)}"`);
        
        // Вчера
        const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 часов назад
        console.log(`📅 Вчера: "${this.formatMessageTime(yesterday)}"`);
        
        // Неделю назад
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        console.log(`📅 Неделю назад: "${this.formatMessageTime(weekAgo)}"`);
        
        // Месяц назад
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        console.log(`📅 Месяц назад: "${this.formatMessageTime(monthAgo)}"`);
        
        console.log('ℹ️ Логика: сегодня = только время, остальное = дата+время');
    }

    /**
     * Тестирование форматирования времени в разных локалях
     */
    static testMessageTimeInDifferentLocales() {
        const now = new Date();
        const today = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 часа назад
        const yesterday = new Date(now.getTime() - 25 * 60 * 60 * 1000); // вчера
        
        console.log('🌍 Тестирование в разных локалях:');
        
        // Русская локаль
        console.log('🇷🇺 Русская локаль (ru-RU):');
        console.log(`   Сегодня: "${today.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}"`);
        console.log(`   Вчера: "${yesterday.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}"`);
        
        // Американская локаль
        console.log('🇺🇸 Американская локаль (en-US):');
        console.log(`   Сегодня: "${today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}"`);
        console.log(`   Вчера: "${yesterday.toLocaleString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}"`);
        
        // Автоматическая локаль (браузера)
        console.log('🌐 Автоматическая локаль браузера ([]):');
        console.log(`   Сегодня: "${today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}"`);
        console.log(`   Вчера: "${yesterday.toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}"`);
        
        // Показываем текущую локаль браузера
        console.log(`🔍 Текущая локаль браузера: ${Intl.DateTimeFormat().resolvedOptions().locale}`);
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

    /**
     * Умное сокращение адреса в зависимости от доступного места
     * @param {string} address - Полный адрес
     * @param {number} maxLength - Максимальная длина для отображения
     * @returns {string} Сокращенный адрес или полный если места достаточно
     */
    static smartShortenAddress(address, maxLength) {
        if (!address) return '';
        
        // Если адрес помещается полностью, возвращаем как есть
        if (address.length <= maxLength) {
            return address;
        }
        
        // Если места очень мало, используем стандартное сокращение
        if (maxLength < 20) {
            return this.shortenAddress(address, 6, 4);
        }
        
        // Умное сокращение: оставляем начало и конец, убираем середину
        const prefixLength = Math.floor((maxLength - 3) / 2); // -3 для "..."
        const suffixLength = maxLength - 3 - prefixLength;
        
        return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
    }

    /**
     * Простое форматирование времени сообщения
     * @param {Date} timestamp - Время сообщения
     * @returns {string} Отформатированное время
     */
    static formatMessageTime(timestamp) {
        const now = new Date();
        const messageDate = new Date(timestamp);
        
        // Проверяем, сегодня ли сообщение (сравниваем даты)
        const isToday = now.toDateString() === messageDate.toDateString();
        
        if (isToday) {
            // Сегодня - показываем только время (используем локальные настройки пользователя)
            return messageDate.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            // Не сегодня - показываем дату + время (используем локальные настройки пользователя)
            return messageDate.toLocaleString([], {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    /**
     * Выбор и сокращение строки с fallback
     * @param {string} primaryString - Основная строка (например, имя)
     * @param {string} fallbackString - Резервная строка (например, адрес)
     * @param {number} maxLength - Максимальная длина результата
     * @returns {string} Сокращенная строка
     */
    static selectAndShortenString(primaryString, fallbackString, maxLength) {
        return (primaryString && primaryString.trim()) 
          ? primaryString.slice(0, maxLength)
          : this.smartShortenAddress(fallbackString, maxLength);
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
        messageTime.textContent = this.formatMessageTime(timestamp);
        
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
