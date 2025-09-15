# Система шифрования CryptoMessenger

## 🔐 Обзор

CryptoMessenger использует ECIES (Elliptic Curve Integrated Encryption Scheme) с кривой secp256k1 для end-to-end шифрования сообщений.

## 🔑 Система ключей

### Генерация ключей
Ключи генерируются детерминистически из подписи пользователя:

```javascript
// 1. Пользователь подписывает сообщение через MetaMask (или иной web3-кошелёк)
const signature = await ethereum.request({
    method: 'personal_sign',
    params: [message, userAddress]
});

// 2. Генерация ключей шифрования
const seed = CryptoJS.SHA256(signature).toString();
const privateKeyForEncode = CryptoJS.SHA256(seed + userAddress).toString();
const privateKeyBytes = convertHexIntoUint8Array(privateKeyForEncode);
const publicKeyForEncode = secp256k1.getPublicKey(privateKeyBytes);
```

### Хранение ключей
- **PublicKeyForEncode**: Регистрируется в смарт-контракте
- **PrivateKeyForEncode**: Хранится в localStorage браузера

## 🔒 ECIES шифрование с двойным шифрованием

### Проблема восстановления исходящих сообщений
При переходе на новое устройство пользователь не может восстановить свои исходящие сообщения, так как они зашифрованы публичными ключами получателей.

### Решение: Двойное шифрование
Каждое сообщение шифруется **дважды**:
1. **Публичным ключом получателя** - для получателя
2. **Публичным ключом отправителя** - для отправителя

### Шифрование сообщения
```javascript
// 1. Получить публичные ключи
const recipientPublicKey = await contract.methods.getPublicKey(recipientAddress).call();
const senderPublicKey = await contract.methods.getPublicKey(senderAddress).call();

// 2. Зашифровать сообщение для получателя
const encryptedForRecipient = crypto.encryptMessage(message, recipientPublicKey, secp256k1);

// 3. Зашифровать сообщение для отправителя
const encryptedForSender = crypto.encryptMessage(message, senderPublicKey, secp256k1);

// 4. Отправить в контракт
const messageData = {
    recipient: recipientAddress,
    encryptedForRecipient: JSON.stringify(encryptedForRecipient),
    encryptedForSender: JSON.stringify(encryptedForSender)
};
```

### Дешифрование сообщения
```javascript
// 1. Получить приватный ключ из localStorage
const encryptionKeys = JSON.parse(localStorage.getItem('cryptoMessengerKeys'));
const privateKeyForEncode = encryptionKeys.privateKeyForEncode;

// 2. Определить тип сообщения по адресам
function decryptMessage(encryptedData, privateKey, myAddress, senderAddress, recipientAddress) {
    if (myAddress === recipientAddress) {
        // Входящее сообщение - расшифровываем для получателя
        const encryptedForRecipient = JSON.parse(encryptedData.encryptedForRecipient);
        return crypto.decryptMessage(encryptedForRecipient, privateKey, secp256k1);
    } else if (myAddress === senderAddress) {
        // Исходящее сообщение - расшифровываем для отправителя
        const encryptedForSender = JSON.parse(encryptedData.encryptedForSender);
        return crypto.decryptMessage(encryptedForSender, privateKey, secp256k1);
    }
    throw new Error('Неизвестный тип сообщения');
}
```

### Преимущества двойного шифрования
- **✅ Полное восстановление** - все сообщения доступны на новом устройстве
- **✅ Децентрализованность** - не нужен централизованный сервер
- **✅ Безопасность** - каждое сообщение зашифровано дважды
- **✅ Совместимость** - работает с существующей системой ключей

## 🛠️ Технические детали

### Библиотеки
- **@noble/secp256k1**: Работа с кривой secp256k1
- **CryptoJS**: AES шифрование
- **Web3.js**: Взаимодействие с блокчейном

### Алгоритм
1. **ECDH**: Вычисление общего секрета
2. **AES-256-GCM**: Симметричное шифрование сообщения
3. **Эфемерные ключи**: Для каждого сообщения

## 🔐 getRandomValues в ECIES шифровании

### Зачем нужен getRandomValues?

`getRandomValues` используется в ECIES шифровании для генерации **эфемерных приватных ключей** (ephemeral private keys). Это критически важно для безопасности:

#### 1. **Эфемерные ключи в ECIES**
```javascript
// В функции encryptMessage:
if (!ephemeralPrivateKey) {
    ephemeralPrivateKey = secp256k1Lib.utils.randomPrivateKey(); // ← Здесь используется getRandomValues
}
const ephemeralPublicKey = secp256k1Lib.getPublicKey(ephemeralPrivateKey);
```

#### 2. **Почему эфемерные ключи?**
- **Безопасность**: Каждое сообщение использует новый уникальный ключ
- **Perfect Forward Secrecy**: Компрометация одного сообщения не влияет на другие
- **Криптографическая стойкость**: Предотвращает атаки по повторному использованию ключей

#### 3. **Где используется getRandomValues?**
- **В библиотеке @noble/secp256k1**: `randomPrivateKey()` → `randomBytes()` → `crypto.getRandomValues()`
- **В нашем коде**: Не напрямую, а через `secp256k1Lib.utils.randomPrivateKey()`

#### 4. **Проблема в Node.js**
```javascript
// В браузере:
crypto.getRandomValues() // ✅ Доступно

// В Node.js:
crypto.getRandomValues() // ❌ Недоступно
globalThis.crypto = webcrypto // ✅ Полифилл
```

#### 5. **Наш полифилл**
```javascript
// Добавляем полифилл для crypto.getRandomValues в Node.js
if (typeof globalThis.crypto === 'undefined') {
    const { webcrypto } = require('crypto');
    globalThis.crypto = webcrypto;
}
```

### Схема работы ECIES с getRandomValues

```
1. Сообщение "Привет!"
   ↓
2. secp256k1Lib.utils.randomPrivateKey() 
   ↓ (использует getRandomValues)
3. Эфемерный приватный ключ: [0x1a, 0x2b, 0x3c, ...]
   ↓
4. Эфемерный публичный ключ: [0x02, 0x4d, 0x5e, ...]
   ↓
5. ECDH: ephemeralPrivateKey + recipientPublicKey = sharedSecret
   ↓
6. AES-256-GCM: sharedSecret + message = encryptedMessage
   ↓
7. Результат: {encryptedMessage, ephemeralPublicKey, algorithm}
```

## 🧪 Тестирование

Тестирование проводится в `test-encryption.html`:
- Генерация ключей из подписей
- ECIES шифрование/дешифрование
- Совместимость с существующей системой

## 📝 Подписываемая фраза

**Фраза**: `"By signing this message, I authorize CryptoMessenger to decrypt and read my messages."`

**Использование**:
- Генерация ключей шифрования
- Авторизация доступа к сообщениям
- Связывание кошелька с ключами шифрования