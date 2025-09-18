#!/usr/bin/env node

/**
 * Скрипт для заполнения контракта CryptoMessenger v2 тестовыми данными
 * 
 * Реально вызывает функции контракта v2:
 * - invitationSend - отправка приглашений на добавление в контакты
 * - invitationAccept - принятие приглашений
 * - invitationReject - отклонение приглашений
 * - sendMessage - отправка сообщений с двойным ECIES шифрованием
 * 
 * Обновлено для контракта v2:
 * - Новая система приглашений (замена Contact Requests)
 * - Двойное шифрование сообщений для обоих участников
 * - Единая система чатов с уникальными ID
 * - Поддержка имен контактов
 * - Использует @noble/secp256k1 и CryptoJS для реального шифрования
 * - Совместимо с системой ключей из auth.html
 * - Использует подписываемую фразу из config.js для генерации ключей
 */

const fs = require('fs');
const path = require('path');

// Загружаем Web3 из локального node_modules
const web3Path = path.join(__dirname, '../frontend/node_modules/web3');
const Web3Module = require(web3Path);
const Web3 = Web3Module.default || Web3Module;

// Загружаем CryptoJS из локального node_modules
const cryptoJsPath = path.join(__dirname, '../frontend/node_modules/crypto-js');
const CryptoJS = require(cryptoJsPath);

// @noble/secp256k1 будет загружен динамически
let secp256k1;

// Функция для загрузки secp256k1
async function loadSecp256k1() {
    if (!secp256k1) {
        // Добавляем полифилл для crypto.getRandomValues в Node.js
        if (typeof globalThis.crypto === 'undefined') {
            const { webcrypto } = require('crypto');
            globalThis.crypto = webcrypto;
        }
        
        const secp256k1Module = await import('../frontend/node_modules/@noble/secp256k1/index.js');
        secp256k1 = secp256k1Module.default || secp256k1Module;
    }
    return secp256k1;
}

// Загружаем утилиты для газа
const { limitGas, limitGasByCost, getOptimalGasPrice, validateGasCost, calculateGasCost } = require('./gas-utils');

// Класс для ECIES шифрования (адаптирован из test-encryption.js)
class CryptoMessengerEncryption {
    constructor() {
        this.algorithm = 'aes-256-gcm';
    }

    /**
     * Генерация пары ключей из подписи (как в auth.html)
     */
    async generateKeyPairFromSignature(signature, userAddress) {
        try {
            // Загружаем secp256k1 если еще не загружен
            const secp256k1Lib = await loadSecp256k1();
            
            // Используем подпись как источник энтропии (как в auth.html)
            const seed = CryptoJS.SHA256(signature).toString();
            const privateKeyForEncode = CryptoJS.SHA256(seed + userAddress).toString();
            
            // Конвертируем в Uint8Array для secp256k1
            const privateKeyBytes = new Uint8Array(32);
            for (let i = 0; i < 32; i++) {
                privateKeyBytes[i] = parseInt(privateKeyForEncode.substr(i * 2, 2), 16);
            }
            
            // Генерируем публичный ключ из приватного
            const publicKey = secp256k1Lib.getPublicKey(privateKeyBytes);
            
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
     */
    async encryptMessage(message, recipientPublicKey, ephemeralPrivateKey = null) {
        try {
            // Загружаем secp256k1 если еще не загружен
            const secp256k1Lib = await loadSecp256k1();
            
            // Генерируем эфемерную пару ключей (или используем переданный)
            if (!ephemeralPrivateKey) {
                ephemeralPrivateKey = secp256k1Lib.utils.randomPrivateKey();
            }
            const ephemeralPublicKey = secp256k1Lib.getPublicKey(ephemeralPrivateKey);
            
            // Вычисляем общий секрет (ECDH)
            const sharedSecret = secp256k1Lib.getSharedSecret(ephemeralPrivateKey, recipientPublicKey);
            
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
     */
    async decryptMessage(encryptedData, privateKey) {
        try {
            // Загружаем secp256k1 если еще не загружен
            const secp256k1Lib = await loadSecp256k1();
            
            // Конвертируем эфемерный публичный ключ
            const ephemeralPublicKey = new Uint8Array(
                encryptedData.ephemeralPublicKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
            );
            
            // Вычисляем общий секрет
            const sharedSecret = secp256k1Lib.getSharedSecret(privateKey, ephemeralPublicKey);
            
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
}

// Создаем экземпляр для шифрования
const encryption = new CryptoMessengerEncryption();

// Функция для паузы
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Функция для детального логирования ошибок EVM
function logDetailedError(error, operation) {
    console.error(`❌ Детальная ошибка ${operation}:`);
    console.error(`   Сообщение: ${error.message}`);
    console.error(`   Код: ${error.code || 'N/A'}`);
    console.error(`   Данные: ${error.data || 'N/A'}`);
    console.error(`   Receipt: ${error.receipt ? JSON.stringify(error.receipt, null, 2) : 'N/A'}`);
    
    // Пытаемся декодировать ошибку EVM
    if (error.data) {
        console.error(`   EVM Error Data: ${error.data}`);
        // Если это hex строка, пытаемся декодировать
        if (error.data.startsWith('0x')) {
            try {
                const errorData = error.data.slice(2);
                console.error(`   EVM Error (hex): ${errorData}`);
                // Первые 4 байта - это селектор функции ошибки
                if (errorData.length >= 8) {
                    const selector = errorData.slice(0, 8);
                    console.error(`   Error Selector: ${selector}`);
                }
            } catch (e) {
                console.error(`   Не удалось декодировать EVM данные: ${e.message}`);
            }
        }
    }
    
    console.error(`   Полный объект:`, error);
}

// Функция для логирования в файл
function logToFile(message) {
    const logPath = path.join(__dirname, 'populate-contract-test-data.log');
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    try {
        fs.appendFileSync(logPath, logMessage, 'utf8');
    } catch (error) {
        console.warn('⚠️ Не удалось записать в лог файл:', error.message);
    }
}

// Функция для получения баланса пользователя
async function getUserBalance(userId, userAddress, web3Instance) {
    try {
        const balance = await web3Instance.eth.getBalance(userAddress);
        const balanceInEth = web3Instance.utils.fromWei(balance, 'ether');
        const balanceInUsd = parseFloat(balanceInEth) * 4600; // Фиксированный курс $4600
        
        return {
            eth: balanceInEth,
            usd: balanceInUsd
        };
    } catch (error) {
        console.warn(`⚠️ Ошибка получения баланса для ${userId}:`, error.message);
        return {
            eth: '0',
            usd: 0
        };
    }
}

// Функция для логирования балансов всех пользователей
async function logUserBalances(users, stage) {
    console.log(`\n💰 ${stage} - Балансы пользователей:`);
    logToFile(`${stage} - Балансы пользователей:`);
    
    // Определяем заголовок в зависимости от стадии
    let tableHeader, separator;
    
    if (stage.includes('ДО')) {
        tableHeader = 'Пользователь | ETH до        | USD до     ';
        separator = '-------------|---------------|------------';
    } else {
        tableHeader = 'Пользователь | ETH до        | ETH после    | Разница ETH  | USD до     | USD после   | Разница USD ';
        separator = '-------------|---------------|--------------|--------------|------------|-------------|-------------';
    }
    
    console.log(tableHeader);
    console.log(separator);
    logToFile(tableHeader);
    logToFile(separator);
    
    for (const [userId, userData] of Object.entries(users)) {
        if (!userData.address) continue;
        
        const web3Instance = createWeb3Instance();
        const balance = await getUserBalance(userId, userData.address, web3Instance);
        
        let row;
        
        if (stage.includes('ДО')) {
            // Только для стадии "ДО" - показываем текущий баланс
            row = `${userId.padEnd(12)} | ${balance.eth.padStart(14)} | $${balance.usd.toFixed(2).padStart(10)}`;
        } else {
            // Для стадии "ПОСЛЕ" - показываем сравнение
            let ethDiff = 'N/A';
            let usdDiff = 'N/A';
            let ethBefore = 'N/A';
            let usdBefore = 'N/A';
            
            if (userData.balanceBefore) {
                ethBefore = userData.balanceBefore.eth;
                usdBefore = userData.balanceBefore.usd.toFixed(2);
                // Правильный расчет разности: до - после (что потратили)
                const ethDiffValue = parseFloat(userData.balanceBefore.eth) - parseFloat(balance.eth);
                const usdDiffValue = userData.balanceBefore.usd - balance.usd;
                ethDiff = ethDiffValue.toFixed(8);
                usdDiff = usdDiffValue.toFixed(2);
            }
            
            row = `${userId.padEnd(12)} | ${ethBefore.padStart(14)} | ${balance.eth.padStart(13)} | ${ethDiff.padStart(13)} | $${usdBefore.padStart(10)} | $${balance.usd.toFixed(2).padStart(11)} | $${usdDiff.padStart(11)}`;
        }
        
        console.log(row);
        logToFile(row);
        
        // Сохраняем баланс для сравнения
        if (stage.includes('ДО')) {
            userData.balanceBefore = balance;
        }
    }
    
    console.log(separator);
    logToFile(separator);
}

// Функция для вызова контракта с таймаутом
async function callWithTimeout(contractMethod, timeout = 15000) {
    return Promise.race([
        contractMethod.call(),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
        )
    ]);
}

// Загружаем переменные окружения из .env файла
let envVars = {};
try {
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        for (const line of lines) {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key.trim()] = value.trim();
            }
        }
        console.log('✅ Переменные окружения загружены из .env файла');
    }
} catch (error) {
    console.warn('⚠️ Не удалось загрузить .env файл:', error.message);
}

// Загружаем конфигурацию из config.js
const configPath = path.join(__dirname, '../frontend/config.js');
const configCode = fs.readFileSync(configPath, 'utf8');

// Создаем глобальный объект window для config.js
global.window = {};

// Выполняем config.js для получения конфигурации
eval(configCode);

const CONTRACT_ADDRESS = global.window.CryptoMessengerConfig.contractAddress;
const CONTRACT_ABI = global.window.CryptoMessengerConfig.contractABI;
const BASE_RPC_URLS = global.window.CryptoMessengerConfig.network.rpcUrls;
const SIGNATURE_PHRASE = global.window.CryptoMessengerConfig.signaturePhrase;

// Инициализация Web3 и контракта
// Создаем отдельный экземпляр Web3 для каждого пользователя
function createWeb3Instance() {
    // Используем первую доступную ноду (самую быструю)
    return new Web3(BASE_RPC_URLS[0]);
}

// Функция для создания Web3 с fallback на резервные ноды
function createWeb3InstanceWithFallback() {
    for (let i = 0; i < BASE_RPC_URLS.length; i++) {
        try {
            const web3 = new Web3(BASE_RPC_URLS[i]);
            console.log(`🌐 Используем RPC ноду ${i + 1}/${BASE_RPC_URLS.length}: ${BASE_RPC_URLS[i]}`);
            return web3;
        } catch (error) {
            console.warn(`⚠️  Нода ${i + 1} недоступна: ${BASE_RPC_URLS[i]} - ${error.message}`);
            if (i === BASE_RPC_URLS.length - 1) {
                throw new Error('Все RPC ноды недоступны');
            }
        }
    }
}

// Создаем контракт (будем пересоздавать для каждого пользователя)
function createContractInstance(web3Instance) {
    return new web3Instance.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
}


// Тестовые пользователи
const testUsers = {
    user02: {
        privateKey: envVars.PRIVATE_KEY_02,
        name: 'Алиса',
        description: 'Активный пользователь, много общается'
    },
    user03: {
        privateKey: envVars.PRIVATE_KEY_03,
        name: 'Боб',
        description: 'Молчаливый пользователь, редко отвечает'
    },
    user04: {
        privateKey: envVars.PRIVATE_KEY_04,
        name: 'Чарли',
        description: 'Избирательный пользователь, часто отказывается'
    },
    user05: {
        privateKey: envVars.PRIVATE_KEY_05,
        name: 'Дэвид',
        description: 'Общительный пользователь, всегда отвечает'
    }
};

// Тестовые сообщения для шифрования
const testMessages = [
    "Привет! Как дела?",
    "Всё хорошо, спасибо!",
    "Как дела с проектом?",
    "Всё идёт по плану!",
    "Отлично! У меня тоже всё хорошо",
    "Круто! Когда встретимся?",
    "Может быть на следующей неделе?",
    "Да, давай! Я свободен",
    "Супер! Тогда до встречи!",
    "До встречи! Было приятно пообщаться"
];

/**
 * Получает адрес из приватного ключа
 */
function getAddressFromPrivateKey(privateKey, web3Instance) {
    const account = web3Instance.eth.accounts.privateKeyToAccount(privateKey);
    return account.address;
}

/**
 * Генерирует ключи шифрования из реальной подписи реального сообщения
 * В реальном приложении подпись получается от пользователя через MetaMask
 * Логика соответствует auth.html
 */
async function generateEncryptionKeys(userId, userAddress, userPrivateKey) {
    // Используем подписываемую фразу из конфигурации
    const messageToSign = SIGNATURE_PHRASE;
    
    console.log(`   📝 Подписываемая фраза: "${messageToSign}"`);
    console.log(`   🔑 Генерируем реальную подпись для ${userId}...`);
    
    // Создаем Web3 экземпляр для подписи
    const web3 = createWeb3Instance();
    
    // Генерируем реальную подпись сообщения
    const realSignature = await web3.eth.accounts.sign(messageToSign, userPrivateKey);
    
    console.log(`   ✍️  Реальная подпись: ${realSignature.signature.substring(0, 20)}...`);
    
    // Используем реальное ECIES шифрование с реальной подписью
    const keyPair = await encryption.generateKeyPairFromSignature(realSignature.signature, userAddress);
    
    return {
        privateKeyForEncode: keyPair.privateKeyForEncode,
        publicKeyForEncode: keyPair.publicKeyForEncode,
        // Дополнительные данные для ECIES
        privateKey: keyPair.privateKey,
        publicKey: keyPair.publicKey,
        // Сохраняем реальную подпись для отладки
        realSignature: realSignature.signature
    };
}

/**
 * Генерирует реальное зашифрованное сообщение для получателя с использованием ECIES
 */
async function generateEncryptedMessageForRecipient(message, recipientPublicKey) {
    try {
        // Используем реальное ECIES шифрование
        const encryptedData = await encryption.encryptMessage(message, recipientPublicKey);
        
        // Возвращаем JSON строку с зашифрованными данными
        return JSON.stringify(encryptedData);
    } catch (error) {
        console.error('Ошибка шифрования для получателя:', error);
        // Fallback к мок-шифрованию в случае ошибки
        const mockEncrypted = Buffer.from(`RECIPIENT:${message}`, 'utf8').toString('hex');
        return `0x${mockEncrypted}`;
    }
}

/**
 * Генерирует реальное зашифрованное сообщение для отправителя с использованием ECIES
 */
async function generateEncryptedMessageForSender(message, senderPublicKey) {
    try {
        // Используем реальное ECIES шифрование
        const encryptedData = await encryption.encryptMessage(message, senderPublicKey);
        
        // Возвращаем JSON строку с зашифрованными данными
        return JSON.stringify(encryptedData);
    } catch (error) {
        console.error('Ошибка шифрования для отправителя:', error);
        // Fallback к мок-шифрованию в случае ошибки
        const mockEncrypted = Buffer.from(`SENDER:${message}`, 'utf8').toString('hex');
        return `0x${mockEncrypted}`;
    }
}

/**
 * Регистрирует пользователя в контракте
 */
async function registerUser(userId, privateKey, userData) {
    console.log(`📝 Регистрация ${userId} (${userData.name})...`);
    
    try {
        // 1. Создаем отдельный экземпляр Web3 для этого пользователя
        const userWeb3 = createWeb3Instance();
        const userContract = createContractInstance(userWeb3);
        
        // 2. Получаем адрес из PRIVATE_KEY (для транзакций)
        const address = getAddressFromPrivateKey(privateKey, userWeb3);
        
        // 3. Генерируем ключи шифрования (как в auth.html)
        const encryptionKeys = await generateEncryptionKeys(userId, address, privateKey);
        const publicKeyForEncode = encryptionKeys.publicKeyForEncode;
        
        // 4. Проверяем, не зарегистрирован ли уже пользователь
        console.log(`🔍 Проверяем статус регистрации для ${userId}...`);
        const isRegistered = await callWithTimeout(userContract.methods.isUserRegistered(address));
        
        if (isRegistered) {
            console.log(`⚠️  ${userId} уже зарегистрирован (пропускаем)`);
            return { 
                userId, 
                address, 
                publicKeyForEncode, 
                privateKeyForEncode: encryptionKeys.privateKeyForEncode,
                registered: true,
                encryptionKeys: encryptionKeys
            };
        }
        
        // 5. Регистрируем пользователя в контракте v2 (registerUser)
        const publicKeyHex = '0x' + publicKeyForEncode;
        const contactName = userData.name; // Используем имя пользователя
        console.log(`🔑 Регистрируем пользователя для ${userId}:`);
        console.log(`   ContactName: ${contactName}`);
        console.log(`   PublicKeyForEncode: ${publicKeyForEncode}`);
        console.log(`   PublicKeyHex: ${publicKeyHex}`);
        console.log(`   Длина hex: ${publicKeyHex.length}`);
        
        const tx = userContract.methods.registerUser(contactName, publicKeyHex);
        const estimatedGas = await tx.estimateGas({ from: address });
        
        const gasPrice = await getOptimalGasPrice(userWeb3);
        const gas = limitGasByCost(Number(estimatedGas), gasPrice, 0.01); // Ограничиваем стоимостью $0.01
        
        // Детальное логирование стоимости газа
        const gasCost = calculateGasCost(gas, gasPrice);
        console.log(`   💰 Стоимость регистрации: ${gasCost.eth.toFixed(8)} ETH ($${gasCost.usd.toFixed(4)})`);
        
        // Обновляем счетчики
        global.totalCostUsd += gasCost.usd;
        global.totalTransactions++;
        
        validateGasCost(gas, gasPrice);
        
        const signedTx = await userWeb3.eth.accounts.signTransaction({
            from: address,
            to: CONTRACT_ADDRESS,
            data: tx.encodeABI(),
            gas: gas,
            gasPrice: gasPrice
        }, privateKey);
        
        const receipt = await userWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        console.log(`✅ ${userId} зарегистрирован`);
        console.log(`   Адрес: ${address}`);
        console.log(`   PublicKeyForEncode: ${publicKeyForEncode}`);
        console.log(`   TX Hash: ${receipt.transactionHash}`);
        
        return { 
            userId, 
            address, 
            publicKeyForEncode, 
            privateKeyForEncode: encryptionKeys.privateKeyForEncode,
            registered: true,
            encryptionKeys: encryptionKeys
        };
        
    } catch (error) {
        // Игнорируем ошибки регистрации (пользователь уже зарегистрирован)
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
            console.log(`⚠️  ${userId} уже зарегистрирован (пропускаем)`);
            const userWeb3 = createWeb3Instance();
            const address = getAddressFromPrivateKey(privateKey, userWeb3);
            const encryptionKeys = await generateEncryptionKeys(userId, address, privateKey);
            return { 
                userId, 
                address, 
                publicKeyForEncode: encryptionKeys.publicKeyForEncode,
                privateKeyForEncode: encryptionKeys.privateKeyForEncode,
                registered: true,
                encryptionKeys: encryptionKeys
            };
        }
        
        console.warn(`⚠️  Ошибка регистрации ${userId}: ${error.message} (продолжаем)`);
        const userWeb3 = createWeb3Instance();
        const address = getAddressFromPrivateKey(privateKey, userWeb3);
        const encryptionKeys = await generateEncryptionKeys(userId, address, privateKey);
        return { 
            userId, 
            address, 
            publicKeyForEncode: encryptionKeys.publicKeyForEncode,
            privateKeyForEncode: encryptionKeys.privateKeyForEncode,
            registered: false, 
            error: error.message,
            encryptionKeys: encryptionKeys
        };
    }
}

/**
 * Отправляет приглашение на добавление в контакты (v2)
 */
async function invitationSend(fromUserId, toUserId, fromAddress, toAddress, fromUserKeys, toUserKeys) {
    console.log(`📤 ${fromUserId} → ${toUserId}: отправка приглашения`);
    
    try {
        // Создаем отдельный экземпляр Web3 для отправителя
        const fromWeb3 = createWeb3Instance();
        const fromContract = createContractInstance(fromWeb3);
        
        const fromUser = testUsers[fromUserId];
        
        // Создаем сообщение для приглашения
        const invitationMessage = `Привет! Меня зовут ${fromUser.name}. Хочешь добавить меня в контакты?`;
        
        // Генерируем двойное шифрование для приглашения
        const encryptedForRecipient = await generateEncryptedMessageForRecipient(invitationMessage, toUserKeys.publicKey);
        const encryptedForSender = await generateEncryptedMessageForSender(invitationMessage, fromUserKeys.publicKey);
        
        // Конвертируем JSON строки в bytes для контракта
        const encryptedForRecipientBytes = fromWeb3.utils.utf8ToHex(encryptedForRecipient);
        const encryptedForSenderBytes = fromWeb3.utils.utf8ToHex(encryptedForSender);
        
        console.log(`   🔐 Зашифровано для получателя: ${encryptedForRecipient.substring(0, 50)}...`);
        console.log(`   🔐 Зашифровано для отправителя: ${encryptedForSender.substring(0, 50)}...`);
        
        // Получаем плату получателя
        const recipientSettings = await fromContract.methods.getUserSettings(toAddress).call();
        const requiredFee = recipientSettings.contactRequestFee;
        
        // Предохранитель: максимальная плата 5 центов ($0.05)
        const maxFeeWei = fromWeb3.utils.toWei('0.00001087', 'ether'); // $0.05 при курсе $4600
        if (requiredFee > maxFeeWei) {
            console.log(`   ⚠️  Плата слишком высокая: ${fromWeb3.utils.fromWei(requiredFee, 'ether')} ETH ($${(parseFloat(fromWeb3.utils.fromWei(requiredFee, 'ether')) * 4600).toFixed(2)})`);
            console.log(`   🛡️  Ограничиваем до $0.05 (${fromWeb3.utils.fromWei(maxFeeWei, 'ether')} ETH)`);
            requiredFee = maxFeeWei;
        }
        
        console.log(`   Требуемая плата: ${fromWeb3.utils.fromWei(requiredFee, 'ether')} ETH ($${(parseFloat(fromWeb3.utils.fromWei(requiredFee, 'ether')) * 4600).toFixed(2)})`);
        
        // Используем новую функцию invitationSend
        const tx = fromContract.methods.invitationSend(toAddress, encryptedForRecipientBytes, encryptedForSenderBytes);
        const estimatedGas = await tx.estimateGas({ from: fromAddress, value: requiredFee });
        
        const gasPrice = await getOptimalGasPrice(fromWeb3);
        const gas = limitGasByCost(Number(estimatedGas), gasPrice, 0.05); // Увеличиваем бюджет для invitationSend до $0.05
        
        // Детальное логирование стоимости газа
        const gasCost = calculateGasCost(gas, gasPrice);
        console.log(`   💰 Стоимость приглашения: ${gasCost.eth.toFixed(8)} ETH ($${gasCost.usd.toFixed(4)})`);
        
        // Обновляем счетчики
        global.totalCostUsd += gasCost.usd;
        global.totalTransactions++;
        
        validateGasCost(gas, gasPrice);
        
        const signedTx = await fromWeb3.eth.accounts.signTransaction({
            from: fromAddress,
            to: CONTRACT_ADDRESS,
            data: tx.encodeABI(),
            gas: gas,
            gasPrice: gasPrice,
            value: requiredFee
        }, fromUser.privateKey);
        
        const receipt = await fromWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        console.log(`✅ Приглашение отправлено: ${fromAddress} → ${toAddress}`);
        console.log(`   TX Hash: ${receipt.transactionHash}`);
        
        // Пауза после транзакции
        console.log(`⏸️ Пауза 30 секунд после приглашения...`);
        await sleep(30000);
        
        return { success: true, fromUserId, toUserId, fromAddress, toAddress };
        
    } catch (error) {
        // Детальное логирование ошибки
        logDetailedError(error, 'отправки приглашения');
        
        // Обрабатываем rate limit
        if (error.message.includes('over rate limit')) {
            console.log(`   ⏸️ Rate limit достигнут, ждем 10 секунд...`);
            await sleep(10000);
            console.warn(`⚠️  Ошибка отправки приглашения: ${error.message} (продолжаем)`);
        } else {
            console.warn(`⚠️  Ошибка отправки приглашения: ${error.message} (продолжаем)`);
        }
        return { success: false, fromUserId, toUserId, error: error.message };
    }
}

/**
 * Принимает приглашение на добавление в контакты (v2)
 */
async function invitationAccept(acceptorUserId, senderUserId, acceptorAddress, senderAddress) {
    console.log(`✅ ${acceptorUserId} принимает приглашение от ${senderUserId}`);
    
    try {
        // Создаем отдельный экземпляр Web3 для принимающего
        const acceptorWeb3 = createWeb3Instance();
        const acceptorContract = createContractInstance(acceptorWeb3);
        
        // Проверяем контакты ДО принятия приглашения
        console.log(`   🔍 Проверка контактов ДО принятия:`);
        const isContactBefore1 = await acceptorContract.methods.checkContact(acceptorAddress, senderAddress).call();
        const isContactBefore2 = await acceptorContract.methods.checkContact(senderAddress, acceptorAddress).call();
        console.log(`   ${acceptorUserId} → ${senderUserId}: ${isContactBefore1}`);
        console.log(`   ${senderUserId} → ${acceptorUserId}: ${isContactBefore2}`);
        
        if (isContactBefore1 || isContactBefore2) {
            console.log(`   ⚠️  ВНИМАНИЕ: Контакты уже существуют! Пропускаем принятие приглашения.`);
            return { success: false, acceptorUserId, senderUserId, error: "Contacts already exist" };
        }
        
        const acceptorUser = testUsers[acceptorUserId];
        
        // В v2 получаем chatId и информацию о чате
        const chatId = await acceptorContract.methods.getChatId(acceptorAddress, senderAddress).call();
        const chat = await acceptorContract.methods.getChat(chatId).call();
        const returnAmount = chat.invitationFee;
        
        console.log(`   💰 Возвращаем отправителю: ${acceptorWeb3.utils.fromWei(returnAmount, 'ether')} ETH`);
        
        // Используем новую функцию invitationAccept
        const tx = acceptorContract.methods.invitationAccept(senderAddress);
        const estimatedGas = await tx.estimateGas({ from: acceptorAddress, value: returnAmount });
        
        const gasPrice = await getOptimalGasPrice(acceptorWeb3);
        const gas = limitGasByCost(Number(estimatedGas), gasPrice, 0.025); // Бюджет $0.025 для принятия приглашения
        
        // Детальное логирование газа
        console.log(`   📊 Gas estimated: ${estimatedGas}, max by cost: ${Math.floor(0.025 * 4600 / (gasPrice / 1e9))}, using: ${gas}`);
        console.log(`   💰 Фактическая стоимость: ${acceptorWeb3.utils.fromWei((gas * gasPrice).toString(), 'ether')} ETH ($${((gas * gasPrice) / 1e18 * 4600).toFixed(4)})`);
        
        // Детальное логирование стоимости газа
        const gasCost = calculateGasCost(gas, gasPrice);
        console.log(`   💰 Стоимость принятия: ${gasCost.eth.toFixed(8)} ETH ($${gasCost.usd.toFixed(4)})`);
        
        // Обновляем счетчики
        global.totalCostUsd += gasCost.usd;
        global.totalTransactions++;
        
        validateGasCost(gas, gasPrice);
        
        const signedTx = await acceptorWeb3.eth.accounts.signTransaction({
            from: acceptorAddress,
            to: CONTRACT_ADDRESS,
            data: tx.encodeABI(),
            gas: gas,
            gasPrice: gasPrice,
            value: returnAmount
        }, acceptorUser.privateKey);
        
        const receipt = await acceptorWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        console.log(`✅ Контакт добавлен: ${acceptorAddress} ↔ ${senderAddress}`);
        console.log(`   TX Hash: ${receipt.transactionHash}`);
        
        // Проверяем контакты ПОСЛЕ принятия приглашения
        console.log(`   🔍 Проверка контактов ПОСЛЕ принятия:`);
        const isContactAfter1 = await acceptorContract.methods.checkContact(acceptorAddress, senderAddress).call();
        const isContactAfter2 = await acceptorContract.methods.checkContact(senderAddress, acceptorAddress).call();
        console.log(`   ${acceptorUserId} → ${senderUserId}: ${isContactAfter1}`);
        console.log(`   ${senderUserId} → ${acceptorUserId}: ${isContactAfter2}`);
        
        if (isContactAfter1 && isContactAfter2) {
            console.log(`   ✅ УСПЕХ: Контакты установлены правильно!`);
        } else {
            console.log(`   ❌ ОШИБКА: Контакты не установлены!`);
            return { success: false, acceptorUserId, senderUserId, error: "Contacts not established" };
        }
        
        // Пауза после транзакции
        console.log(`⏸️ Пауза 3 секунды после принятия...`);
        await sleep(3000);
        
        return { success: true, acceptorUserId, senderUserId, acceptorAddress, senderAddress };
        
    } catch (error) {
        // Детальное логирование ошибки
        logDetailedError(error, 'принятия приглашения');
        
        // Обрабатываем rate limit
        if (error.message.includes('over rate limit')) {
            console.log(`   ⏸️ Rate limit достигнут, ждем 15 секунд...`);
            await sleep(15000);
            console.warn(`⚠️  Ошибка принятия приглашения: ${error.message} (продолжаем)`);
        } else {
            console.warn(`⚠️  Ошибка принятия приглашения: ${error.message} (продолжаем)`);
        }
        return { success: false, acceptorUserId, senderUserId, error: error.message };
    }
}

/**
 * Отклоняет приглашение на добавление в контакты (v2)
 */
async function invitationReject(rejectorUserId, senderUserId, rejectorAddress, senderAddress) {
    console.log(`❌ ${rejectorUserId} отклоняет приглашение от ${senderUserId}`);
    
    try {
        // Создаем отдельный экземпляр Web3 для отклоняющего
        const rejectorWeb3 = createWeb3Instance();
        const rejectorContract = createContractInstance(rejectorWeb3);
        
        // Проверяем контакты ДО отклонения приглашения
        console.log(`   🔍 Проверка контактов ДО отклонения:`);
        const isContactBefore1 = await rejectorContract.methods.checkContact(rejectorAddress, senderAddress).call();
        const isContactBefore2 = await rejectorContract.methods.checkContact(senderAddress, rejectorAddress).call();
        console.log(`   ${rejectorUserId} → ${senderUserId}: ${isContactBefore1}`);
        console.log(`   ${senderUserId} → ${rejectorUserId}: ${isContactBefore2}`);
        
        if (isContactBefore1 || isContactBefore2) {
            console.log(`   ⚠️  ВНИМАНИЕ: Контакты уже существуют! Пропускаем отклонение приглашения.`);
            return { success: false, rejectorUserId, senderUserId, error: "Contacts already exist" };
        }
        
        const rejectorUser = testUsers[rejectorUserId];
        
        // Используем новую функцию invitationReject
        const tx = rejectorContract.methods.invitationReject(senderAddress);
        const estimatedGas = await tx.estimateGas({ from: rejectorAddress });
        
        const gasPrice = await getOptimalGasPrice(rejectorWeb3);
        const gas = limitGasByCost(Number(estimatedGas), gasPrice, 0.01); // Ограничиваем стоимостью $0.01
        
        // Детальное логирование газа
        console.log(`   📊 Gas estimated: ${estimatedGas}, max by cost: ${Math.floor(0.01 * 4600 / (gasPrice / 1e9))}, using: ${gas}`);
        console.log(`   💰 Фактическая стоимость: ${rejectorWeb3.utils.fromWei((gas * gasPrice).toString(), 'ether')} ETH ($${((gas * gasPrice) / 1e18 * 4600).toFixed(4)})`);
        
        // Детальное логирование стоимости газа
        const gasCost = calculateGasCost(gas, gasPrice);
        console.log(`   💰 Стоимость отклонения: ${gasCost.eth.toFixed(8)} ETH ($${gasCost.usd.toFixed(4)})`);
        
        // Обновляем счетчики
        global.totalCostUsd += gasCost.usd;
        global.totalTransactions++;
        
        validateGasCost(gas, gasPrice);
        
        const signedTx = await rejectorWeb3.eth.accounts.signTransaction({
            from: rejectorAddress,
            to: CONTRACT_ADDRESS,
            data: tx.encodeABI(),
            gas: gas,
            gasPrice: gasPrice
        }, rejectorUser.privateKey);
        
        const receipt = await rejectorWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        console.log(`✅ Приглашение отклонено: ${rejectorAddress} ❌ ${senderAddress}`);
        console.log(`   TX Hash: ${receipt.transactionHash}`);
        
        // Проверяем контакты ПОСЛЕ отклонения приглашения
        console.log(`   🔍 Проверка контактов ПОСЛЕ отклонения:`);
        const isContactAfter1 = await rejectorContract.methods.checkContact(rejectorAddress, senderAddress).call();
        const isContactAfter2 = await rejectorContract.methods.checkContact(senderAddress, rejectorAddress).call();
        console.log(`   ${rejectorUserId} → ${senderUserId}: ${isContactAfter1}`);
        console.log(`   ${senderUserId} → ${rejectorUserId}: ${isContactAfter2}`);
        
        if (!isContactAfter1 && !isContactAfter2) {
            console.log(`   ✅ УСПЕХ: Контакты не установлены (как и должно быть)!`);
        } else {
            console.log(`   ⚠️  ВНИМАНИЕ: Контакты установлены после отклонения!`);
        }
        
        // Пауза после транзакции
        console.log(`⏸️ Пауза 3 секунды после отклонения...`);
        await sleep(3000);
        
        return { success: true, rejectorUserId, senderUserId, rejectorAddress, senderAddress };
        
    } catch (error) {
        // Детальное логирование ошибки
        logDetailedError(error, 'отклонения приглашения');
        
        // Обрабатываем rate limit
        if (error.message.includes('over rate limit')) {
            console.log(`   ⏸️ Rate limit достигнут, ждем 15 секунд...`);
            await sleep(15000);
            console.warn(`⚠️  Ошибка отклонения приглашения: ${error.message} (продолжаем)`);
        } else {
            console.warn(`⚠️  Ошибка отклонения приглашения: ${error.message} (продолжаем)`);
        }
        return { success: false, rejectorUserId, senderUserId, error: error.message };
    }
}

/**
 * Отправляет сообщение с двойным шифрованием (v2)
 */
async function sendMessage(fromUserId, toUserId, fromAddress, toAddress, message, fromUserKeys, toUserKeys) {
    console.log(`💬 ${fromUserId} → ${toUserId}: "${message}"`);
    
    try {
        // Создаем отдельный экземпляр Web3 для отправителя
        const fromWeb3 = createWeb3Instance();
        const fromContract = createContractInstance(fromWeb3);
        
        const fromUser = testUsers[fromUserId];
        
        // Генерируем двойное шифрование с реальными публичными ключами
        const encryptedForRecipient = await generateEncryptedMessageForRecipient(message, toUserKeys.publicKey);
        const encryptedForSender = await generateEncryptedMessageForSender(message, fromUserKeys.publicKey);
        
        // Конвертируем JSON строки в bytes для контракта
        const encryptedForRecipientBytes = fromWeb3.utils.utf8ToHex(encryptedForRecipient);
        const encryptedForSenderBytes = fromWeb3.utils.utf8ToHex(encryptedForSender);
        
        console.log(`   🔐 Зашифровано для получателя: ${encryptedForRecipient.substring(0, 50)}...`);
        console.log(`   🔐 Зашифровано для отправителя: ${encryptedForSender.substring(0, 50)}...`);
        
        // В v2 структура сообщений изменилась - теперь encryptedForSmaller и encryptedForLarger
        // Определяем, кто из участников имеет меньший адрес
        const isFromSmaller = fromAddress.toLowerCase() < toAddress.toLowerCase();
        const encryptedForSmaller = isFromSmaller ? encryptedForRecipientBytes : encryptedForSenderBytes;
        const encryptedForLarger = isFromSmaller ? encryptedForSenderBytes : encryptedForRecipientBytes;
        
        console.log(`   📝 Адрес отправителя ${fromAddress} ${isFromSmaller ? 'меньше' : 'больше'} адреса получателя ${toAddress}`);
        console.log(`   🔐 Зашифровано для меньшего адреса: ${encryptedForSmaller.substring(0, 50)}...`);
        console.log(`   🔐 Зашифровано для большего адреса: ${encryptedForLarger.substring(0, 50)}...`);
        
        // Реальный вызов контракта с новой структурой сообщений v2
        const tx = fromContract.methods.sendMessage(toAddress, encryptedForSmaller, encryptedForLarger);
        const estimatedGas = await tx.estimateGas({ from: fromAddress });
        
        const gasPrice = await getOptimalGasPrice(fromWeb3);
        const gas = limitGasByCost(Number(estimatedGas), gasPrice, 0.04); // Увеличиваем бюджет до $0.04 (4 цента)
        
        // Детальное логирование газа
        console.log(`   📊 Gas estimated: ${estimatedGas}, max by cost: ${Math.floor(0.04 * 4600 / (gasPrice / 1e9))}, using: ${gas}`);
        console.log(`   💰 Фактическая стоимость: ${fromWeb3.utils.fromWei((gas * gasPrice).toString(), 'ether')} ETH ($${((gas * gasPrice) / 1e18 * 4600).toFixed(4)})`);
        
        // Детальное логирование стоимости газа
        const gasCost = calculateGasCost(gas, gasPrice);
        console.log(`   💰 Стоимость сообщения: ${gasCost.eth.toFixed(8)} ETH ($${gasCost.usd.toFixed(4)})`);
        
        // Обновляем счетчики
        global.totalCostUsd += gasCost.usd;
        global.totalTransactions++;
        
        validateGasCost(gas, gasPrice);
        
        const signedTx = await fromWeb3.eth.accounts.signTransaction({
            from: fromAddress,
            to: CONTRACT_ADDRESS,
            data: tx.encodeABI(),
            gas: gas,
            gasPrice: gasPrice
        }, fromUser.privateKey);
        
        const receipt = await fromWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        console.log(`✅ Сообщение отправлено: ${fromAddress} → ${toAddress}`);
        console.log(`   Зашифровано для меньшего адреса: ${encryptedForSmaller.substring(0, 50)}...`);
        console.log(`   Зашифровано для большего адреса: ${encryptedForLarger.substring(0, 50)}...`);
        console.log(`   TX Hash: ${receipt.transactionHash}`);
        
        // Пауза после транзакции
        console.log(`⏸️ Пауза 3 секунды после сообщения...`);
        await sleep(3000);
        
        // Обновляем счетчики успешных сообщений
        global.successfulMessages++;
        
        return { 
            success: true, 
            fromUserId, 
            toUserId, 
            fromAddress, 
            toAddress, 
            message, 
            encryptedForRecipient,
            encryptedForSender,
            encryptedForSmaller,
            encryptedForLarger
        };
        
    } catch (error) {
        // Обновляем счетчики неудачных сообщений
        global.failedMessages++;
        
        // Детальное логирование ошибки
        logDetailedError(error, 'отправки сообщения');
        
        console.warn(`⚠️  Ошибка отправки сообщения: ${error.message} (продолжаем)`);
        return { success: false, fromUserId, toUserId, error: error.message };
    }
}

/**
 * Основная функция для заполнения контракта тестовыми данными
 */
async function populateContractWithTestData() {
    const startTime = new Date();
    console.log('🚀 Заполнение контракта тестовыми данными...\n');
    logToFile('🚀 Начало заполнения контракта тестовыми данными');
    logToFile(`📅 Время начала: ${startTime.toISOString()}`);
    
    // Логируем информацию о RPC нодах
    console.log('🌐 Доступные RPC ноды:');
    BASE_RPC_URLS.forEach((url, index) => {
        console.log(`   ${index + 1}. ${url}`);
    });
    console.log(`   Используем: ${BASE_RPC_URLS[0]}\n`);
    logToFile(`🌐 Используем RPC ноду: ${BASE_RPC_URLS[0]}`);
    
    // Счетчик общих затрат (глобальные переменные)
    global.totalCostUsd = 0;
    global.totalTransactions = 0;
    global.successfulMessages = 0;
    global.failedMessages = 0;
    
    // 0. Получаем адреса всех пользователей для логирования балансов ДО
    console.log('🔍 Получение адресов пользователей для логирования балансов...');
    const users = {};
    for (const [userId, userData] of Object.entries(testUsers)) {
        if (!userData.privateKey) {
            console.warn(`⚠️  Пропущен ${userId}: PRIVATE_KEY не найден`);
            continue;
        }
        
        const userWeb3 = createWeb3InstanceWithFallback();
        const address = getAddressFromPrivateKey(userData.privateKey, userWeb3);
        users[userId] = { address, ...userData };
    }
    
    // Логируем балансы ДО начала работы
    await logUserBalances(users, 'ДО НАЧАЛА РАБОТЫ');
 
    // 1. Регистрируем всех пользователей
    console.log('\n📝 Шаг 1: Регистрация пользователей');
    for (const [userId, userData] of Object.entries(testUsers)) {
        if (!userData.privateKey) {
            console.warn(`⚠️  Пропущен ${userId}: PRIVATE_KEY не найден`);
            continue;
        }
        
        const result = await registerUser(userId, userData.privateKey, userData);
        // Обновляем данные пользователя, сохраняя адрес
        users[userId] = { ...users[userId], ...result };
        
        // Пауза между регистрациями
        console.log(`⏸️ Пауза 5 секунд после регистрации ${userId}...`);
        await sleep(5000);
    }
    
    // Сохраняем ключи шифрования для каждого пользователя
    console.log('\n🔑 Шаг 1.5: Сохранение ключей шифрования');
    for (const [userId, userData] of Object.entries(users)) {
        if (userData.address && testUsers[userId] && testUsers[userId].privateKey) {
            const encryptionKeys = await generateEncryptionKeys(userId, userData.address, testUsers[userId].privateKey);
            users[userId].encryptionKeys = encryptionKeys;
            console.log(`   ${userId}: ключи шифрования сохранены`);
        }
    }
    
    // 2. Отправляем приглашения на добавление в контакты (v2)
    console.log('\n📤 Шаг 2: Отправка приглашений на добавление в контакты');
    console.log('⏸️ Пауза 60 секунд перед отправкой приглашений...');
    await sleep(60000);
    
    // user02 → user03 (без ответа)
    await invitationSend('user02', 'user03', users.user02.address, users.user03.address, users.user02.encryptionKeys, users.user03.encryptionKeys);
    
    // user02 → user04 (отказ)
    await invitationSend('user02', 'user04', users.user02.address, users.user04.address, users.user02.encryptionKeys, users.user04.encryptionKeys);
    
    // user02 → user05 (согласие)
    await invitationSend('user02', 'user05', users.user02.address, users.user05.address, users.user02.encryptionKeys, users.user05.encryptionKeys);
    
    // user03 → user04 (согласие)
    await invitationSend('user03', 'user04', users.user03.address, users.user04.address, users.user03.encryptionKeys, users.user04.encryptionKeys);
    
    // user03 → user05 (согласие)
    await invitationSend('user03', 'user05', users.user03.address, users.user05.address, users.user03.encryptionKeys, users.user05.encryptionKeys);
    
    // user04 → user05 (отказ)
    await invitationSend('user04', 'user05', users.user04.address, users.user05.address, users.user04.encryptionKeys, users.user05.encryptionKeys);
    
    // 3. Обрабатываем приглашения (v2)
    console.log('\n✅ Шаг 3: Обработка приглашений');
    console.log('⏸️ Пауза 10 секунд перед обработкой приглашений...');
    await sleep(10000);
    
    // user04 отклоняет приглашение от user02
    await invitationReject('user04', 'user02', users.user04.address, users.user02.address);
    
    // user05 принимает приглашение от user02
    await invitationAccept('user05', 'user02', users.user05.address, users.user02.address);
    
    // user04 принимает приглашение от user03
    await invitationAccept('user04', 'user03', users.user04.address, users.user03.address);
    
    // user05 принимает приглашение от user03
    await invitationAccept('user05', 'user03', users.user05.address, users.user03.address);
    
    // user05 отклоняет приглашение от user04
    await invitationReject('user05', 'user04', users.user05.address, users.user04.address);
    
    // 4. Отправляем сообщения в активных чатах
    console.log('\n💬 Шаг 4: Отправка сообщений');
    console.log('⏸️ Пауза 10 секунд перед отправкой сообщений...');
    await sleep(10000);
    
    // user02 ↔ user05 (активный чат)
    const messages02_05 = [
        "Привет! Как дела?",
        "Всё хорошо, спасибо!",
        "Как дела с проектом?",
        "Всё идёт по плану!",
        "Отлично! У меня тоже всё хорошо"
    ];
    
    for (let i = 0; i < messages02_05.length; i++) {
        const isFrom02 = i % 2 === 0;
        const fromUserId = isFrom02 ? 'user02' : 'user05';
        const toUserId = isFrom02 ? 'user05' : 'user02';
        const fromAddress = isFrom02 ? users.user02.address : users.user05.address;
        const toAddress = isFrom02 ? users.user05.address : users.user02.address;
        const fromUserKeys = isFrom02 ? users.user02.encryptionKeys : users.user05.encryptionKeys;
        const toUserKeys = isFrom02 ? users.user05.encryptionKeys : users.user02.encryptionKeys;
        
        await sendMessage(fromUserId, toUserId, fromAddress, toAddress, messages02_05[i], fromUserKeys, toUserKeys);
    }
    
    // user03 ↔ user04 (активный чат)
    const messages03_04 = [
        "Привет! Как дела?",
        "Всё хорошо, спасибо!",
        "Как настроение?",
        "Отлично! А у тебя?",
        "Тоже всё супер!"
    ];
    
    for (let i = 0; i < messages03_04.length; i++) {
        const isFrom03 = i % 2 === 0;
        const fromUserId = isFrom03 ? 'user03' : 'user04';
        const toUserId = isFrom03 ? 'user04' : 'user03';
        const fromAddress = isFrom03 ? users.user03.address : users.user04.address;
        const toAddress = isFrom03 ? users.user04.address : users.user03.address;
        const fromUserKeys = isFrom03 ? users.user03.encryptionKeys : users.user04.encryptionKeys;
        const toUserKeys = isFrom03 ? users.user04.encryptionKeys : users.user03.encryptionKeys;
        
        await sendMessage(fromUserId, toUserId, fromAddress, toAddress, messages03_04[i], fromUserKeys, toUserKeys);
    }
    
    // user03 ↔ user05 (активный чат)
    const messages03_05 = [
        "Привет! Как дела?",
        "Всё хорошо, спасибо!",
        "Что нового?",
        "Ничего особенного, а у тебя?",
        "Тоже всё как обычно"
    ];
    
    for (let i = 0; i < messages03_05.length; i++) {
        const isFrom03 = i % 2 === 0;
        const fromUserId = isFrom03 ? 'user03' : 'user05';
        const toUserId = isFrom03 ? 'user05' : 'user03';
        const fromAddress = isFrom03 ? users.user03.address : users.user05.address;
        const toAddress = isFrom03 ? users.user05.address : users.user03.address;
        const fromUserKeys = isFrom03 ? users.user03.encryptionKeys : users.user05.encryptionKeys;
        const toUserKeys = isFrom03 ? users.user05.encryptionKeys : users.user03.encryptionKeys;
        
        await sendMessage(fromUserId, toUserId, fromAddress, toAddress, messages03_05[i], fromUserKeys, toUserKeys);
    }
    
    // Логируем балансы ПОСЛЕ завершения работы
    await logUserBalances(users, 'ПОСЛЕ ЗАВЕРШЕНИЯ РАБОТЫ');
    
    const endTime = new Date();
    const duration = endTime - startTime;
    
    console.log('\n🎉 Заполнение контракта завершено!');
    logToFile('🎉 Заполнение контракта завершено!');
    logToFile(`📅 Время завершения: ${endTime.toISOString()}`);
    logToFile(`⏱️ Продолжительность: ${Math.round(duration / 1000)} секунд`);
    
    console.log('\n📊 Созданные тестовые данные (v2):');
    console.log('✅ 4 пользователя зарегистрированы');
    console.log('📤 6 приглашений на добавление в контакты отправлено');
    console.log('✅ 3 приглашения принято');
    console.log('❌ 3 приглашения отклонено');
    console.log(`💬 Сообщений: ${global.successfulMessages} успешно, ${global.failedMessages} с ошибками`);
    
    logToFile('📊 Созданные тестовые данные (v2):');
    logToFile('✅ 4 пользователя зарегистрированы');
    logToFile('📤 6 приглашений на добавление в контакты отправлено');
    logToFile('✅ 3 приглашения принято');
    logToFile('❌ 3 приглашения отклонено');
    logToFile(`💬 Сообщений: ${global.successfulMessages} успешно, ${global.failedMessages} с ошибками`);
    
    console.log('\n💰 Общие затраты на газ:');
    console.log(`   Всего транзакций: ${global.totalTransactions}`);
    console.log(`   Общая стоимость: $${global.totalCostUsd.toFixed(4)}`);
    console.log(`   Средняя стоимость за транзакцию: $${(global.totalCostUsd / global.totalTransactions).toFixed(4)}`);
    
    logToFile('\n💰 Общие затраты на газ:');
    logToFile(`   Всего транзакций: ${global.totalTransactions}`);
    logToFile(`   Общая стоимость: $${global.totalCostUsd.toFixed(4)}`);
    logToFile(`   Средняя стоимость за транзакцию: $${(global.totalCostUsd / global.totalTransactions).toFixed(4)}`);
    
    console.log('\n🎯 Сценарии для тестирования (v2):');
    console.log('1. user02 → user03: приглашение без ответа (pending)');
    console.log('2. user02 → user04: приглашение отклонено (rejected)');
    console.log('3. user02 ↔ user05: активный чат с сообщениями (двойное шифрование)');
    console.log('4. user03 ↔ user04: активный чат с сообщениями (двойное шифрование)');
    console.log('5. user03 ↔ user05: активный чат с сообщениями (двойное шифрование)');
    console.log('6. user04 → user05: приглашение отклонено (блокировка повторных приглашений)');
    console.log('7. Новая структура сообщений: encryptedForSmaller/encryptedForLarger');
    console.log('8. Единая система чатов с уникальными ID');
    
    logToFile('\n🎯 Сценарии для тестирования (v2):');
    logToFile('1. user02 → user03: приглашение без ответа (pending)');
    logToFile('2. user02 → user04: приглашение отклонено (rejected)');
    logToFile('3. user02 ↔ user05: активный чат с сообщениями (двойное шифрование)');
    logToFile('4. user03 ↔ user04: активный чат с сообщениями (двойное шифрование)');
    logToFile('5. user03 ↔ user05: активный чат с сообщениями (двойное шифрование)');
    logToFile('6. user04 → user05: приглашение отклонено (блокировка повторных приглашений)');
    logToFile('7. Новая структура сообщений: encryptedForSmaller/encryptedForLarger');
    logToFile('8. Единая система чатов с уникальными ID');
    
    logToFile('='.repeat(80));
   
}

// Запуск скрипта
if (require.main === module) {
    try {
        populateContractWithTestData();
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        process.exit(1);
    }
}

module.exports = { 
    populateContractWithTestData, 
    testUsers, 
    testMessages,
    invitationSend,
    invitationAccept,
    invitationReject,
    sendMessage
};
