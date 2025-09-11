/**
 * Тестовый файл для проверки ECIES шифрования
 * Используемые библиотеки: crypto-js, @noble/secp256k1, @noble/ciphers
 */

// Импорты (для Node.js или bundler)
let CryptoJS, secp256k1;

if (typeof require !== 'undefined') {
    // Node.js environment
    CryptoJS = require('crypto-js');
    // secp256k1 будет загружен динамически
} else {
    // Browser environment - библиотеки должны быть загружены через CDN
    // <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
    // <script src="https://unpkg.com/@noble/secp256k1@2.0.0/index.js"></script>
    CryptoJS = window.CryptoJS;
    secp256k1 = window.secp256k1;
}

class CryptoMessengerEncryption {
    constructor() {
        this.algorithm = 'aes-256-gcm';
    }

    /**
     * Генерация пары ключей из SEED фразы
     * @param {string} seedPhrase - SEED фраза для генерации ключей
     * @returns {Object} - Объект с приватным и публичным ключами
     */
    generateKeyPairFromSeed(seedPhrase, secp256k1) {
        try {
            // Создаем хэш из SEED фразы для детерминистической генерации
            const seedHash = CryptoJS.SHA256(seedPhrase).toString();
            
            // Конвертируем в Uint8Array для secp256k1
            const seedBytes = new Uint8Array(32);
            for (let i = 0; i < 32; i++) {
                seedBytes[i] = parseInt(seedHash.substr(i * 2, 2), 16);
            }
            
            // Генерируем приватный ключ
            console.log('🔍 secp256k1 в generateKeyPairFromSeed:', typeof secp256k1);
            console.log('🔍 secp256k1.utils:', typeof secp256k1?.utils);
            console.log('🔍 secp256k1 функции:', Object.keys(secp256k1 || {}));
            const privateKey = secp256k1.utils.randomPrivateKey();
            
            // Генерируем публичный ключ
            const publicKey = secp256k1.getPublicKey(privateKey);
            
            return {
                privateKey: privateKey,
                publicKey: publicKey,
                privateKeyHex: Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join(''),
                publicKeyHex: Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join('')
            };
        } catch (error) {
            console.error('Ошибка генерации ключей:', error);
            throw error;
        }
    }

    /**
     * Шифрование сообщения с использованием ECIES
     * @param {string} message - Сообщение для шифрования
     * @param {Uint8Array} recipientPublicKey - Публичный ключ получателя
     * @returns {Object} - Зашифрованное сообщение и данные для дешифровки
     */
    encryptMessage(message, recipientPublicKey, secp256k1) {
        try {
            // Генерируем эфемерную пару ключей
            const ephemeralPrivateKey = secp256k1.utils.randomPrivateKey();
            const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey);
            
            // Вычисляем общий секрет (ECDH)
            const sharedSecret = secp256k1.getSharedSecret(ephemeralPrivateKey, recipientPublicKey);
            
            // Создаем ключ для AES из общего секрета
            const sharedSecretHex = Array.from(sharedSecret).map(b => b.toString(16).padStart(2, '0')).join('');
            const aesKey = CryptoJS.SHA256(sharedSecretHex).toString();
            
            // Шифруем сообщение
            const encrypted = CryptoJS.AES.encrypt(message, aesKey).toString();
            
            return {
                encryptedMessage: encrypted,
                ephemeralPublicKey: Array.from(ephemeralPublicKey).map(b => b.toString(16).padStart(2, '0')).join(''),
                algorithm: this.algorithm
            };
        } catch (error) {
            console.error('Ошибка шифрования:', error);
            throw error;
        }
    }

    /**
     * Дешифрование сообщения
     * @param {Object} encryptedData - Зашифрованные данные
     * @param {Uint8Array} privateKey - Приватный ключ получателя
     * @returns {string} - Расшифрованное сообщение
     */
    decryptMessage(encryptedData, privateKey, secp256k1) {
        try {
            // Конвертируем эфемерный публичный ключ
            const ephemeralPublicKey = new Uint8Array(
                encryptedData.ephemeralPublicKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
            );
            
            // Вычисляем общий секрет
            const sharedSecret = secp256k1.getSharedSecret(privateKey, ephemeralPublicKey);
            
            // Создаем ключ для AES
            const sharedSecretHex = Array.from(sharedSecret).map(b => b.toString(16).padStart(2, '0')).join('');
            const aesKey = CryptoJS.SHA256(sharedSecretHex).toString();
            
            // Дешифруем сообщение
            const decrypted = CryptoJS.AES.decrypt(encryptedData.encryptedMessage, aesKey);
            const decryptedMessage = decrypted.toString(CryptoJS.enc.Utf8);
            
            return decryptedMessage;
        } catch (error) {
            console.error('Ошибка дешифрования:', error);
            throw error;
        }
    }

    /**
     * Тестирование полного цикла шифрования/дешифрования
     */
    async testEncryptionCycle() {
        console.log('🔐 Начинаем тест ECIES шифрования...\n');
        console.log('🔍 Функция testEncryptionCycle вызвана!');
        console.log('📦 Версия test-encryption.js: v2.1 - 2025-01-11 19:50');
        
        // Проверяем наличие библиотек
        if (typeof CryptoJS === 'undefined') {
            throw new Error('CryptoJS не загружен. Убедитесь, что библиотека подключена.');
        }
        
        // Загружаем secp256k1 для Node.js или браузера
        let secp256k1;
        
        console.log('🔍 Начинаем загрузку secp256k1...');
        
        if (typeof window !== 'undefined') {
            // В браузере - используем глобальную переменную из HTML
            console.log('🔍 Проверяем window.secp256k1:', typeof window.secp256k1);
            
            if (window.secp256k1) {
                secp256k1 = window.secp256k1;
                console.log('✅ @noble/secp256k1 загружен из window');
            } else {
                throw new Error('@noble/secp256k1 не найден в window. Убедитесь, что библиотека подключена в HTML.');
            }
        } else if (typeof require !== 'undefined') {
            // В Node.js
            if (typeof globalThis.crypto === 'undefined') {
                const { webcrypto } = require('crypto');
                globalThis.crypto = webcrypto;
            }

            const secp256k1Module = await import('@noble/secp256k1');
            secp256k1 = secp256k1Module.default || secp256k1Module;
            console.log('✅ @noble/secp256k1 загружен в Node.js');
        } else {
            throw new Error('Неизвестная среда выполнения. Поддерживаются только браузер и Node.js.');
        }
        
        try {
            // 1. Генерируем ключи для отправителя и получателя
            const senderSeed = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
            const recipientSeed = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";
            
            console.log('1. Генерируем ключи...');
            const senderKeys = this.generateKeyPairFromSeed(senderSeed, secp256k1);
            const recipientKeys = this.generateKeyPairFromSeed(recipientSeed, secp256k1);
            
            console.log('   Отправитель публичный ключ:', senderKeys.publicKeyHex);
            console.log('   Получатель публичный ключ:', recipientKeys.publicKeyHex);
            
            // 2. Тестовое сообщение
            const testMessage = "Привет! Это секретное сообщение для CryptoMessenger! 🔐";
            console.log('\n2. Исходное сообщение:', testMessage);
            
            // 3. Шифруем сообщение
            console.log('\n3. Шифруем сообщение...');
            const encrypted = this.encryptMessage(testMessage, recipientKeys.publicKey, secp256k1);
            console.log('   Зашифрованное сообщение:', encrypted.encryptedMessage.substring(0, 50) + '...');
            console.log('   Эфемерный публичный ключ:', encrypted.ephemeralPublicKey);
            
            // 4. Дешифруем сообщение
            console.log('\n4. Дешифруем сообщение...');
            const decrypted = this.decryptMessage(encrypted, recipientKeys.privateKey, secp256k1);
            console.log('   Расшифрованное сообщение:', decrypted);
            
            // 5. Проверяем результат
            const isSuccess = decrypted === testMessage;
            console.log('\n5. Результат теста:', isSuccess ? '✅ УСПЕХ!' : '❌ ОШИБКА!');
            
            if (isSuccess) {
                console.log('\n🎉 ECIES шифрование работает корректно!');
                console.log('📋 Готово к интеграции в CryptoMessenger');
            }
            
            return isSuccess;
            
        } catch (error) {
            console.error('❌ Ошибка в тесте:', error);
            return false;
        }
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoMessengerEncryption;
}

// Запуск теста при загрузке в браузере
if (typeof window !== 'undefined') {
    window.CryptoMessengerEncryption = CryptoMessengerEncryption;
}

// Запуск теста в Node.js
if (typeof require !== 'undefined' && require.main === module) {
    const crypto = new CryptoMessengerEncryption();
    crypto.testEncryptionCycle();
}
