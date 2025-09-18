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
