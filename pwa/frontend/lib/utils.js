/**
 * Утилиты общего назначения для CryptoMessenger
 * v1.0.0
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

    /**
     * Проверка валидности Ethereum адреса
     * @param {string} address - Адрес для проверки
     * @returns {boolean} Валиден ли адрес
     */
    static isValidEthereumAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    /**
     * Безопасное копирование текста в буфер обмена
     * @param {string} text - Текст для копирования
     * @returns {Promise<boolean>} Успешность операции
     */
    static async copyToClipboard(text) {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback для старых браузеров
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const result = document.execCommand('copy');
                document.body.removeChild(textArea);
                return result;
            }
        } catch (error) {
            console.error('❌ Utils: Ошибка копирования в буфер:', error);
            return false;
        }
    }

    /**
     * Debounce функция для ограничения частоты вызовов
     * @param {Function} func - Функция для debounce
     * @param {number} wait - Задержка в миллисекундах
     * @returns {Function} Debounced функция
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle функция для ограничения частоты вызовов
     * @param {Function} func - Функция для throttle
     * @param {number} limit - Лимит в миллисекундах
     * @returns {Function} Throttled функция
     */
    static throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Генерация случайного ID
     * @param {number} length - Длина ID (по умолчанию 8)
     * @returns {string} Случайный ID
     */
    static generateId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Форматирование размера файла
     * @param {number} bytes - Размер в байтах
     * @returns {string} Отформатированный размер
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

console.log('📦 Utils v1.0.0 - Утилиты общего назначения загружены');
