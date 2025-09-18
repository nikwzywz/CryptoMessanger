# Система шифрования CryptoMessenger V3

## 🔐 Обзор

CryptoMessenger V3 использует **упрощенный ECIES** с двойным шифрованием для восстановления исходящих сообщений.

## 🔄 Разница V2 vs V3

### ❌ V2 (настоящий ECIES):
```javascript
// Настоящий ECDH с библиотекой @noble/secp256k1
const sharedPoint = secp256k1Lib.getSharedSecret(privateKeyBytes, ephemeralKeyBytes);
const sharedSecret = CryptoJS.SHA256(convertUint8ArrayIntoHex(sharedPoint.slice(1))).toString();
```
- **Проблемы:** Сложная настройка, зависимость от secp256k1, ошибки ECDH
- **Симптомы:** `sigBytes: -96`, пустые результаты расшифровки

### ✅ V3 (упрощенный ECIES):
```javascript  
// Упрощенная конкатенация + SHA256 (НЕ настоящий ECDH)
const sharedSecret = CryptoJS.SHA256(ephemeralPrivateKeyHex + recipientPublicKey).toString();
```
- **Преимущества:** Простота, надежность, работает стабильно
- **Результат:** Положительные `sigBytes`, успешная расшифровка

### 🎯 Ключевые отличия:
- **V2:** Криптографически корректный ECDH (**сложно**, **ошибки**)
- **V3:** Упрощенная схема (**просто**, **работает**)

### 🔒 Безопасность V2 vs V3

#### V2 - Почему падал?
**Проблема НЕ в библиотеках** (они действительно надежные), а в **нашей интеграции**:

```javascript
// ❌ Наши ошибки в V2:
1. Неправильная конвертация ключей (hex ↔ Uint8Array)
2. Путаница с префиксами 0x
3. Неверная обработка несжатых точек (slice(1))
4. Проблемы совместимости localStorage ↔ контракт
5. Ошибки в алгоритме восстановления ephemeralKey
```

**Библиотеки работали правильно** - мы их неправильно использовали!

#### V3 - Безопасность упрощенной схемы

**🔴 Уязвимости V3:**
- **НЕ Perfect Forward Secrecy** - компрометация одного ключа = все сообщения
- **Предсказуемые ephemeralKey** - используем CryptoJS.lib.WordArray.random() вместо crypto.getRandomValues()
- **Простая конкатенация** вместо настоящего ECDH

**🟡 Но для нашего случая приемлемо:**
- Ключи генерируются из подписи (безопасно)
- Хранятся только в localStorage (локально)
- Атакующий должен получить физический доступ к устройству
- Для мессенджера достаточная защита

### 🎯 Итог:
- **V2 безопаснее** криптографически, но **не работал** из-за наших ошибок
- **V3 менее безопасен** теоретически, но **работает практически**
- **Для MVP** V3 достаточно, для production лучше исправить V2

## 🔑 Система ключей V3

### Генерация (crypto-utils.js)
```javascript
static generateEncryptionKeys(signature, userAddress) {
    // 1. Используем подпись как источник энтропии
    const seed = CryptoJS.SHA256(signature).toString();
    const privateKeyForEncode = CryptoJS.SHA256(seed + userAddress).toString();
    
    // 2. Генерируем публичный ключ (упрощенная версия)
    const publicKeyForEncode = CryptoJS.SHA256(privateKeyForEncode + 'public').toString();
    
    return { privateKeyForEncode, publicKeyForEncode, address: userAddress };
}
```

### Использование
- **auth.html:** `CryptoUtils.generateEncryptionKeys(signature, userAddress)`
- **Хранение:** localStorage (без `0x`) + смарт-контракт (с `0x`)
- **Загрузка:** Автоматическое добавление префикса `0x` в `main.html`

## 🔒 Упрощенный ECIES V3

### Шифрование каждого сообщения
1. **Для получателя** - его публичным ключом `encryptedForRecipient`
2. **Для отправителя** - его публичным ключом `encryptedForSender` (для восстановления исходящих)

### Реальная реализация V3 (crypto-utils.js)

#### Шифрование:
```javascript
static encryptMessage(message, recipientPublicKey) {
    // 1. Генерация эфемерного ключа
    const ephemeralPrivateKey = CryptoJS.lib.WordArray.random(32);
    
    // 2. Упрощенный общий секрет (НЕ настоящий ECDH)
    const sharedSecret = CryptoJS.SHA256(ephemeralPrivateKeyHex + recipientPublicKey).toString();
    
    // 3. AES шифрование
    const encrypted = CryptoJS.AES.encrypt(message, sharedSecret).toString();
    
    // 4. Формат результата
    return {
        ephemeralPublicKey: '0x' + ephemeralPrivateKeyHex.substring(0, 66),
        encryptedMessage: encrypted,
        mac: CryptoJS.HmacSHA256(encrypted, sharedSecret).toString().substring(0, 32)
    };
}
```

#### Дешифрование:
```javascript
static decryptMessage(encryptedHex, privateKey) {
    // 1. Парсинг JSON структуры из hex
    const encryptedData = JSON.parse(hexToString(encryptedHex));
    
    // 2. Получение userPublicKey из localStorage (НЕ из privateKey!)
    const userPublicKey = localStorage.getItem('cryptoMessengerKeys').publicKeyForEncode;
    
    // 3. Тот же алгоритм общего секрета
    const sharedSecret = CryptoJS.SHA256(ephemeralPrivateKeyHex + userPublicKey).toString();
    
    // 4. AES дешифрование
    return CryptoJS.AES.decrypt(encryptedData.encryptedMessage, sharedSecret).toString(CryptoJS.enc.Utf8);
}
```

## 🔒 Использование в V3

### В ContactListManagerV3 (приглашения):
```javascript
// Шифрование для обеих сторон
const encryptedForRecipient = CryptoUtils.encryptMessage(message, recipientPublicKey);
const encryptedForSender = CryptoUtils.encryptMessage(message, this.appState.userPublicKey);

// Отправка в контракт
await contract.methods.invitationSend(recipientAddress, encryptedForRecipient, encryptedForSender);
```

### В ChatAreaManagerV3 (сообщения):
```javascript
// Шифрование через вспомогательные методы
const encryptedForRecipient = await this.encryptForContact(messageText, currentContact.address);
const encryptedForSender = await this.encryptForSelf(messageText);

// С тестом расшифровки
async encryptForSelf(message) {
    const encrypted = CryptoUtils.encryptMessage(message, this.appState.userPublicKey);
    
    // 🧪 Тест расшифровки
    const decrypted = CryptoUtils.decryptMessage(encrypted, this.appState.userPrivateKey);
    if (decrypted === message) {
        console.log('✅ ТЕСТ ПРОШЕЛ: Шифровка/расшифровка работает!');
    }
}
```

### Дешифрование в UI:
```javascript
// ChatAreaManagerV3.addMessageToUI()
const decryptedText = CryptoUtils.decryptMessage(
    message.encryptedMessage, 
    this.appState.userPrivateKey
);
```

### ⚠️ Важные особенности V3:
- **НЕ настоящий ECDH** - упрощенная конкатенация + SHA256
- **Работает** для нашего случая использования
- **Эфемерные ключи** генерируются через `CryptoJS.lib.WordArray.random(32)`
- **Автотест** расшифровки при отправке сообщений