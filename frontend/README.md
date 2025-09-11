# CryptoMessenger Frontend - Тестирование ECIES Шифрования

## 🔐 Описание

Этот модуль содержит тестовую реализацию ECIES шифрования для проекта CryptoMessenger. Тестирование включает в себя:

- Генерацию ключей из SEED фраз
- Шифрование сообщений с использованием ECIES
- Дешифрование сообщений
- Полный цикл тестирования

## 📋 Используемые библиотеки

- **crypto-js** (^4.1.1) - для AES шифрования
- **@noble/secp256k1** (^2.0.0) - для работы с secp256k1 кривыми
- **@noble/ciphers** (^0.7.0) - для ECIES операций

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd frontend
npm install
```

### 2. Тестирование в Node.js

```bash
npm test
```

### 3. Тестирование в браузере

```bash
# Запуск локального сервера
npx http-server -p 8080

# Откройте в браузере
open http://localhost:8080/test-encryption.html
```

## 📁 Структура файлов

```
frontend/
├── test-encryption.js      # Основной класс для ECIES шифрования
├── test-encryption.html    # HTML интерфейс для тестирования
├── package.json           # Зависимости и скрипты
└── README.md             # Этот файл
```

## 🧪 Как работает тест

### 1. Генерация ключей
```javascript
const senderSeed = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const recipientSeed = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";

const senderKeys = crypto.generateKeyPairFromSeed(senderSeed);
const recipientKeys = crypto.generateKeyPairFromSeed(recipientSeed);
```

### 2. Шифрование сообщения
```javascript
const message = "Привет! Это секретное сообщение!";
const encrypted = crypto.encryptMessage(message, recipientKeys.publicKey);
```

### 3. Дешифрование сообщения
```javascript
const decrypted = crypto.decryptMessage(encrypted, recipientKeys.privateKey);
```

## 🔧 API Класса CryptoMessengerEncryption

### `generateKeyPairFromSeed(seedPhrase)`
Генерирует пару ключей (приватный и публичный) из SEED фразы.

**Параметры:**
- `seedPhrase` (string) - SEED фраза для генерации ключей

**Возвращает:**
```javascript
{
    privateKey: Uint8Array,      // Приватный ключ
    publicKey: Uint8Array,       // Публичный ключ
    privateKeyHex: string,       // Приватный ключ в hex
    publicKeyHex: string         // Публичный ключ в hex
}
```

### `encryptMessage(message, recipientPublicKey)`
Шифрует сообщение с использованием ECIES.

**Параметры:**
- `message` (string) - Сообщение для шифрования
- `recipientPublicKey` (Uint8Array) - Публичный ключ получателя

**Возвращает:**
```javascript
{
    encryptedMessage: string,    // Зашифрованное сообщение
    ephemeralPublicKey: string, // Эфемерный публичный ключ
    algorithm: string           // Алгоритм шифрования
}
```

### `decryptMessage(encryptedData, privateKey)`
Дешифрует сообщение.

**Параметры:**
- `encryptedData` (Object) - Зашифрованные данные
- `privateKey` (Uint8Array) - Приватный ключ получателя

**Возвращает:**
- `string` - Расшифрованное сообщение

### `testEncryptionCycle()`
Запускает полный цикл тестирования шифрования/дешифрования.

## ✅ Ожидаемые результаты

При успешном тестировании вы должны увидеть:

```
🔐 Начинаем тест ECIES шифрования...

1. Генерируем ключи...
   Отправитель публичный ключ: 02a1b2c3d4e5f6...
   Получатель публичный ключ: 02f6e5d4c3b2a1...

2. Исходное сообщение: Привет! Это секретное сообщение для CryptoMessenger! 🔐

3. Шифруем сообщение...
   Зашифрованное сообщение: U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K1Y=...
   Эфемерный публичный ключ: 02b1a2c3d4e5f6...

4. Дешифруем сообщение...
   Расшифрованное сообщение: Привет! Это секретное сообщение для CryptoMessenger! 🔐

5. Результат теста: ✅ УСПЕХ!

🎉 ECIES шифрование работает корректно!
📋 Готово к интеграции в CryptoMessenger
```

## 🐛 Устранение неполадок

### Ошибка: "CryptoJS не загружен"
- Убедитесь, что библиотека crypto-js подключена
- Проверьте интернет-соединение для CDN

### Ошибка: "@noble/secp256k1 не загружен"
- Убедитесь, что библиотека @noble/secp256k1 подключена
- Проверьте версию библиотеки

### Ошибка при шифровании/дешифровании
- Проверьте корректность ключей
- Убедитесь, что используете правильные типы данных

## 🔒 Безопасность

⚠️ **Важно:** Этот код предназначен только для тестирования. Для продакшена:

1. Используйте криптографически стойкие генераторы случайных чисел
2. Добавьте проверку целостности сообщений
3. Реализуйте ротацию ключей
4. Добавьте подпись сообщений для аутентификации

## 📞 Поддержка

При возникновении проблем:
1. Проверьте консоль браузера на наличие ошибок
2. Убедитесь, что все зависимости установлены
3. Проверьте совместимость версий библиотек

## 🎯 Следующие шаги

После успешного тестирования:
1. Интеграция с смарт-контрактом CryptoMessenger
2. Создание пользовательского интерфейса
3. Интеграция с MetaMask
4. Реализация хранения сообщений

---

**Дата создания:** $(date)  
**Версия:** 1.0.0  
**Статус:** Тестирование
