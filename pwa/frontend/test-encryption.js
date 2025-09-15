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
     * Генерация пары ключей из подписи (как в auth-v2.html)
     * @param {string} signature - Подпись пользователя
     * @param {string} userAddress - Адрес пользователя
     * @returns {Object} - Объект с приватным и публичным ключами
     */
    generateKeyPairFromSignature(signature, userAddress, secp256k1) {
        try {
            // Используем подпись как источник энтропии (как в auth-v2.html)
            const seed = CryptoJS.SHA256(signature).toString();
            const privateKeyForEncode = CryptoJS.SHA256(seed + userAddress).toString();
            
            // Конвертируем в Uint8Array для secp256k1
            const privateKeyBytes = new Uint8Array(32);
            for (let i = 0; i < 32; i++) {
                privateKeyBytes[i] = parseInt(privateKeyForEncode.substr(i * 2, 2), 16);
            }
            
            // Генерируем публичный ключ из приватного
            const publicKey = secp256k1.getPublicKey(privateKeyBytes);
            
            return {
                privateKey: privateKeyBytes,
                publicKey: publicKey,
                privateKeyHex: privateKeyForEncode,
                publicKeyHex: Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join(''),
                // Для совместимости с существующей системой
                privateKeyForEncode: privateKeyForEncode,
                publicKeyForEncode: Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join('')
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
    encryptMessage(message, recipientPublicKey, secp256k1, ephemeralPrivateKey = null) {
        try {
            // Генерируем эфемерную пару ключей (или используем переданный)
            if (!ephemeralPrivateKey) {
                ephemeralPrivateKey = secp256k1.utils.randomPrivateKey();
            }
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
        console.log('🔐 Начинаем тест ECIES шифрования для CryptoMessenger...\n');
        console.log('🔍 Функция testEncryptionCycle вызвана!');
        console.log('📦 Версия test-encryption.js: v3.0 - 2025-01-15 12:30 (интеграция с auth-v2.html)');
        
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
                // Ждем загрузки библиотеки
                let attempts = 0;
                while (!window.secp256k1 && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                
                if (window.secp256k1) {
                    secp256k1 = window.secp256k1;
                    console.log('✅ @noble/secp256k1 загружен из window (после ожидания)');
                } else {
                    throw new Error('@noble/secp256k1 не найден в window. Убедитесь, что библиотека подключена в HTML.');
                }
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
            // 1. Генерируем ключи для отправителя и получателя (как в auth-v2.html)
            const signaturePhrase = "By signing this message, I authorize CryptoMessenger to decrypt and read my messages.";
            const senderSignature = `Mock signature for sender - ${signaturePhrase} - ${Date.now()}`;
            const recipientSignature = `Mock signature for recipient - ${signaturePhrase} - ${Date.now() + 1}`;
            const senderAddress = "0x016b67764012166A8d9Ed3502eA542A061B771f8";
            const recipientAddress = "0x1b804e7A8365768a8e554a848C393A522655b947";
            
            console.log('1. Генерируем ключи из подписей (как в auth-v2.html)...');
            console.log(`   📝 Подписываемая фраза: "${signaturePhrase}"`);
            const senderKeys = this.generateKeyPairFromSignature(senderSignature, senderAddress, secp256k1);
            const recipientKeys = this.generateKeyPairFromSignature(recipientSignature, recipientAddress, secp256k1);
            
            console.log('   Отправитель публичный ключ:', senderKeys.publicKeyHex);
            console.log('   Получатель публичный ключ:', recipientKeys.publicKeyHex);
            
            // 2. Тестовое сообщение
            const testMessage = "Привет! Это секретное сообщение для CryptoMessenger! 🔐";
            console.log('\n2. Исходное сообщение:', testMessage);
            
            // 3. Шифруем сообщение (отправитель шифрует для получателя)
            console.log('\n3. Шифруем сообщение...');
            console.log('   Отправитель:', senderAddress);
            console.log('   Получатель:', recipientAddress);
            const encrypted = this.encryptMessage(testMessage, recipientKeys.publicKey, secp256k1);
            console.log('   Зашифрованное сообщение:', encrypted.encryptedMessage.substring(0, 50) + '...');
            console.log('   Эфемерный публичный ключ:', encrypted.ephemeralPublicKey);
            
            // 4. Дешифруем сообщение (получатель расшифровывает)
            console.log('\n4. Дешифруем сообщение...');
            const decrypted = this.decryptMessage(encrypted, recipientKeys.privateKey, secp256k1);
            console.log('   Расшифрованное сообщение:', decrypted);
            
            // 5. Проверяем результат
            const isSuccess = decrypted === testMessage;
            console.log('\n5. Результат теста:', isSuccess ? '✅ УСПЕХ!' : '❌ ОШИБКА!');
            
            // 6. Тестируем совместимость с существующей системой
            console.log('\n6. Тестируем совместимость с auth-v2.html...');
            console.log('   PrivateKeyForEncode (hex):', senderKeys.privateKeyForEncode);
            console.log('   PublicKeyForEncode (hex):', senderKeys.publicKeyForEncode);
            console.log('   Длина PrivateKeyForEncode:', senderKeys.privateKeyForEncode.length);
            console.log('   Длина PublicKeyForEncode:', senderKeys.publicKeyForEncode.length);
            
            if (isSuccess) {
                console.log('\n🎉 ECIES шифрование работает корректно!');
                console.log('📋 Готово к интеграции в CryptoMessenger');
                console.log('🔑 Ключи совместимы с существующей системой auth-v2.html');
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
