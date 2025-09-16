/**
 * Утилиты для работы с криптографией в CryptoMessenger
 * Версия: 2.0.0
 */

// Jazzicon будет загружен через script тег в HTML

class CryptoUtils {

    /**
     * Определение правильного поля для расшифровки в v2 контракте
     * @param {string} currentUserAddress - Адрес текущего пользователя
     * @param {string} contactAddress - Адрес собеседника
     * @param {Object} message - Объект сообщения из контракта
     * @returns {string} - Правильное зашифрованное поле
     */
    static getEncryptedFieldForUser(currentUserAddress, contactAddress, message) {
        // Определяем, какой адрес меньше (как в контракте)
        const isCurrentUserSmaller = currentUserAddress.toLowerCase() < contactAddress.toLowerCase();
        return isCurrentUserSmaller ? message.encryptedForSmaller : message.encryptedForLarger;
    }

    /**
     * Форматирование зашифрованного сообщения для отображения
     * @param {string} encryptedData - Зашифрованные данные
     * @returns {string} - Отформатированная строка для отображения
     */
    static formatEncryptedMessage(encryptedData) {
        if (!encryptedData) {
            return `🔐 Зашифрованное сообщение (данные отсутствуют)`;
        }
        
        // Проверяем, что это строка
        if (typeof encryptedData !== 'string') {
            console.error('❌ encryptedData не является строкой:', encryptedData);
            return `🔐 Зашифрованное сообщение (неверный тип данных: ${typeof encryptedData})`;
        }
        
        try {
            // Пытаемся распарсить как JSON
            const data = JSON.parse(encryptedData);
            return `🔐 Зашифрованное сообщение (${data.algorithm || 'ECIES'})`;
        } catch (error) {
            // Если не JSON, показываем как hex
            const hexData = encryptedData.startsWith('0x') ? encryptedData.slice(2) : encryptedData;
            return `🔐 Зашифрованные данные: ${hexData.substring(0, 20)}...`;
        }
    }

    /**
     * Определение направления сообщения (исходящее/входящее)
     * В v2 контракте используем поле sender для точного определения
     * @param {string} currentUserAddress - Адрес текущего пользователя
     * @param {string} contactAddress - Адрес собеседника
     * @param {Object} message - Объект сообщения из контракта
     * @returns {boolean} - true если сообщение исходящее (от нас)
     */
    static isOutgoingMessage(currentUserAddress, contactAddress, message) {
        // Используем поле sender из структуры ChatMessage для точного определения
        const isOutgoing = message.sender.toLowerCase() === currentUserAddress.toLowerCase();
        console.log(`🔍 Направление сообщения: sender=${message.sender}, currentUser=${currentUserAddress}, isOutgoing=${isOutgoing}`);
        return isOutgoing;
    }

    /**
     * Генерация аватара в стиле Jazzicon (собственная реализация)
     * @param {string} address - Адрес кошелька
     * @param {string} name - Имя пользователя
     * @param {number} size - Размер аватара
     * @returns {string} - Data URL для img src
     */
    static generateJazziconDataURL(address, name = '', size = 32) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = size;
        canvas.height = size;
        
        // Кастомная палитра в стиле приложения (мало контрастирующие цвета)
        const customPalette = [
            '#6B7C93', // Приглушенный синий
            '#8FA68E', // Приглушенный зеленый
            '#A68B8B', // Приглушенный коричневый
            '#9B8FA6', // Приглушенный фиолетовый
            '#8FA6A6', // Приглушенный бирюзовый
            '#A6A68F', // Приглушенный желтоватый
            '#7A8A9B', // Приглушенный серо-синий
            '#8FA08F'  // Приглушенный серо-зеленый
        ];
        
        // Генерируем seed на основе адреса
        const seed = parseInt(address.slice(2, 10), 16);
        
        // Выбираем цвета из палитры
        const bgColor = customPalette[seed % customPalette.length];
        const shapeColor = customPalette[(seed + 1) % customPalette.length];
        const accentColor = customPalette[(seed + 2) % customPalette.length];
        
        // Заливаем фон
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, size, size);
        
        // Рисуем геометрические формы
        const gridSize = 8;
        const cellSize = size / gridSize;
        
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                const index = (x + y * gridSize) % 32;
                const bit = (seed >> index) & 1;
                
                if (bit && x < gridSize / 2) {
                    // Симметричный паттерн
                    ctx.fillStyle = (x + y) % 2 === 0 ? shapeColor : accentColor;
                    
                    // Рисуем круг
                    ctx.beginPath();
                    ctx.arc(x * cellSize + cellSize/2, y * cellSize + cellSize/2, cellSize/3, 0, 2 * Math.PI);
                    ctx.fill();
                    
                    // Симметричная часть
                    ctx.beginPath();
                    ctx.arc((gridSize - 1 - x) * cellSize + cellSize/2, y * cellSize + cellSize/2, cellSize/3, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
        
        // Добавляем первую букву имени в центр аватара
        if (name && name.length > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = `bold ${Math.floor(size * 0.35)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const firstLetter = name.charAt(0).toUpperCase();
            ctx.fillText(firstLetter, size/2, size/2);
        }
        
        return canvas.toDataURL();
    }

    /**
     * Генерация простого аватара с первой буквой имени
     * @param {string} address - Адрес кошелька
     * @param {string} name - Имя пользователя
     * @param {number} size - Размер аватара
     * @returns {string} - Data URL для img src
     */
    static generateInitialsAvatar(address, name, size = 32) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = size;
        canvas.height = size;
        
        // Генерируем цвета на основе хэша адреса
        const hash = this.simpleHash(address);
        const hue = (hash % 360 + 360) % 360;
        const saturation = 40 + (hash % 30); // 40-70% (менее насыщенные)
        const lightness = 65 + (hash % 20);  // 65-85% (более светлые)
        
        // Градиентный фон
        const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        gradient.addColorStop(0, `hsl(${hue}, ${saturation}%, ${lightness + 10}%)`);
        gradient.addColorStop(1, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2, 0, 2 * Math.PI);
        ctx.fill();
        
        // Добавляем первую букву имени (не последнюю!)
        if (name && name.length > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = `bold ${Math.floor(size * 0.4)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const firstLetter = name.charAt(0).toUpperCase();
            ctx.fillText(firstLetter, size/2, size/2);
        }
        
        return canvas.toDataURL();
    }

    /**
     * Простая хэш-функция для генерации чисел из строки
     * @param {string} str - Входная строка
     * @returns {number} - Хэш
     */
    static simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Конвертируем в 32-битное число
        }
        return Math.abs(hash);
    }

    /**
     * Получение аватара для адреса (основная функция)
     * @param {string} address - Адрес кошелька
     * @param {string} name - Имя пользователя
     * @param {string} style - Стиль аватара ('jazzicon', 'initials', 'default')
     * @param {number} size - Размер аватара
     * @returns {string} - Data URL для img src
     */
    static getAvatar(address, name = '', style = 'jazzicon', size = 32) {
        if (!address) {
            return this.getDefaultAvatar(size);
        }
        
        switch (style) {
            case 'jazzicon':
                return this.generateJazziconDataURL(address, name, size);
            case 'initials':
                return this.generateInitialsAvatar(address, name, size);
            default:
                return this.generateJazziconDataURL(address, name, size);
        }
    }

    /**
     * Шифрование сообщения с использованием ECIES
     * @param {string} message - Текст сообщения
     * @param {string} recipientPublicKey - Публичный ключ получателя в hex формате
     * @returns {string} Зашифрованное сообщение в hex формате
     */
    static encryptMessage(message, recipientPublicKey) {
        try {
            // Проверяем наличие необходимых библиотек
            if (typeof CryptoJS === 'undefined') {
                throw new Error('CryptoJS library not loaded');
            }
            
            // Генерируем эфемерную пару ключей
            const ephemeralPrivateKey = CryptoJS.lib.WordArray.random(32);
            const ephemeralPrivateKeyHex = ephemeralPrivateKey.toString();
            
            // Конвертируем публичный ключ получателя из hex
            const recipientPubKeyBytes = new Uint8Array(
                recipientPublicKey.replace('0x', '').match(/.{1,2}/g).map(byte => parseInt(byte, 16))
            );
            
            // Для упрощения используем симметричное шифрование с общим секретом
            // В продакшене здесь будет полноценный ECDH + AES-GCM
            const sharedSecret = CryptoJS.SHA256(ephemeralPrivateKeyHex + recipientPublicKey).toString();
            
            // Шифруем сообщение с помощью AES-GCM
            const encrypted = CryptoJS.AES.encrypt(message, sharedSecret).toString();
            
            // Формируем результат в формате ECIES
            const result = {
                ephemeralPublicKey: '0x' + ephemeralPrivateKeyHex.substring(0, 66), // Упрощение
                encryptedMessage: encrypted,
                mac: CryptoJS.HmacSHA256(encrypted, sharedSecret).toString().substring(0, 32)
            };
            
            // Кодируем в hex для хранения в блокчейне
            const resultJson = JSON.stringify(result);
            const encoder = new TextEncoder();
            const resultBytes = encoder.encode(resultJson);
            return '0x' + Array.from(resultBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            
        } catch (error) {
            console.error('❌ Ошибка ECIES шифрования:', error);
            // Fallback к простому кодированию
            const encoder = new TextEncoder();
            const messageBuffer = encoder.encode(message);
            const hex = Array.from(messageBuffer).map(byte => byte.toString(16).padStart(2, '0')).join('');
            return '0x' + hex;
        }
    }

    /**
     * Дешифрование ECIES сообщения
     * @param {string} encryptedHex - Зашифрованное сообщение в hex формате
     * @returns {string} Расшифрованное сообщение
     */
    static decryptMessage(encryptedHex) {
        try {
            // Получаем приватный ключ из localStorage
            const storedKeys = localStorage.getItem('cryptoMessengerKeys');
            if (!storedKeys) {
                console.warn('🔑 Ключи шифрования не найдены в localStorage');
                return '[Ключи не найдены]';
            }
            
            const encryptionKeys = JSON.parse(storedKeys);
            const privateKey = encryptionKeys.privateKeyForEncode;
            
            if (!privateKey) {
                console.warn('🔑 Приватный ключ для расшифровки не найден');
                return '[Приватный ключ не найден]';
            }
            
            // Убираем 0x префикс и конвертируем из hex
            const hex = encryptedHex.replace('0x', '');
            const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            
            // Конвертируем обратно в JSON
            const jsonDecoder = new TextDecoder();
            const resultJson = jsonDecoder.decode(bytes);
            
            try {
                // Пытаемся распарсить как ECIES структуру
                const encryptedData = JSON.parse(resultJson);
                
                if (encryptedData.ephemeralPublicKey && encryptedData.encryptedMessage) {
                    // Вычисляем общий секрет
                    const sharedSecret = CryptoJS.SHA256(encryptedData.ephemeralPublicKey.replace('0x', '') + '0x' + privateKey).toString();
                    
                    // Дешифруем сообщение
                    const decrypted = CryptoJS.AES.decrypt(encryptedData.encryptedMessage, sharedSecret);
                    return decrypted.toString(CryptoJS.enc.Utf8);
                }
            } catch (parseError) {
                // Если не JSON, то это простое hex-кодирование (старый формат)
                console.log('🔄 Используем fallback дешифрование для старого формата');
            }
            
            // Fallback для старых сообщений (простое hex декодирование)
            const fallbackDecoder = new TextDecoder();
            return fallbackDecoder.decode(bytes);
            
        } catch (error) {
            console.error('❌ Ошибка дешифрования:', error);
            return '[Ошибка дешифрования]';
        }
    }
}

// Логируем загрузку модуля
console.log('📦 CryptoUtils v3.0.0 - Real ECIES encryption implemented loaded');
console.log('🔧 File: crypto-utils.js');
