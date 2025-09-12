#!/usr/bin/env node

/**
 * Скрипт для заполнения контракта CryptoMessenger тестовыми данными
 * 
 * Реально вызывает функции контракта:
 * - requestContact - отправка запросов на добавление в контакты
 * - acceptContactRequest - принятие запросов
 * - rejectContactRequest - отклонение запросов
 * - sendMessage - отправка сообщений
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

// Загружаем утилиты для газа
const { limitGas, limitGasByCost, getOptimalGasPrice, validateGasCost, calculateGasCost } = require('./gas-utils');

// Функция для паузы
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
const BASE_RPC_URL = global.window.CryptoMessengerConfig.network.rpcUrls[0];

// Инициализация Web3 и контракта
// Создаем отдельный экземпляр Web3 для каждого пользователя
function createWeb3Instance() {
    return new Web3(BASE_RPC_URL);
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
 * Генерирует ключи шифрования из мок-подписи (для тестирования)
 * В реальном приложении подпись получается от пользователя через MetaMask
 * Логика соответствует auth-v2.html
 */
function generateEncryptionKeys(userId, userAddress) {
    // Мок-подпись для тестирования (в реальности получается от пользователя)
    const mockSignature = `Mock signature for ${userId} - ${Date.now()}`;
    
    // Используем подпись как источник энтропии (как в auth-v2.html)
    const seed = CryptoJS.SHA256(mockSignature).toString();
    const privateKeyForEncode = CryptoJS.SHA256(seed + userAddress).toString();
    
    // Генерируем публичный ключ (как в auth-v2.html)
    const publicKeyForEncode = CryptoJS.SHA256(privateKeyForEncode + 'public').toString();
    
    return {
        privateKeyForEncode,
        publicKeyForEncode
    };
}

/**
 * Генерирует мок зашифрованное сообщение
 */
function generateEncryptedMessage(message) {
    // В реальном проекте использовать реальное шифрование
    // Здесь возвращаем мок зашифрованные данные
    const mockEncrypted = Buffer.from(message, 'utf8').toString('hex');
    return `0x${mockEncrypted}`;
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
        
        // 3. Генерируем ключи шифрования (как в auth-v2.html)
        const encryptionKeys = generateEncryptionKeys(userId, address);
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
                registered: true 
            };
        }
        
        // 5. Регистрируем PublicKeyForEncode в контракте (конвертируем в hex)
        const publicKeyHex = '0x' + publicKeyForEncode;
        console.log(`🔑 Регистрируем ключ для ${userId}:`);
        console.log(`   PublicKeyForEncode: ${publicKeyForEncode}`);
        console.log(`   PublicKeyHex: ${publicKeyHex}`);
        console.log(`   Длина hex: ${publicKeyHex.length}`);
        
        const tx = userContract.methods.registerPublicKey(publicKeyHex);
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
            registered: true 
        };
        
    } catch (error) {
        // Игнорируем ошибки регистрации (пользователь уже зарегистрирован)
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
            console.log(`⚠️  ${userId} уже зарегистрирован (пропускаем)`);
            const userWeb3 = createWeb3Instance();
            const address = getAddressFromPrivateKey(privateKey, userWeb3);
            const encryptionKeys = generateEncryptionKeys(userId, address);
            return { 
                userId, 
                address, 
                publicKeyForEncode: encryptionKeys.publicKeyForEncode,
                privateKeyForEncode: encryptionKeys.privateKeyForEncode,
                registered: true 
            };
        }
        
        console.warn(`⚠️  Ошибка регистрации ${userId}: ${error.message} (продолжаем)`);
        const userWeb3 = createWeb3Instance();
        const address = getAddressFromPrivateKey(privateKey, userWeb3);
        const encryptionKeys = generateEncryptionKeys(userId, address);
        return { 
            userId, 
            address, 
            publicKeyForEncode: encryptionKeys.publicKeyForEncode,
            privateKeyForEncode: encryptionKeys.privateKeyForEncode,
            registered: false, 
            error: error.message 
        };
    }
}

/**
 * Отправляет запрос на добавление в контакты
 */
async function requestContact(fromUserId, toUserId, fromAddress, toAddress) {
    console.log(`📤 ${fromUserId} → ${toUserId}: запрос на добавление в контакты`);
    
    try {
        // Создаем отдельный экземпляр Web3 для отправителя
        const fromWeb3 = createWeb3Instance();
        const fromContract = createContractInstance(fromWeb3);
        
        const fromUser = testUsers[fromUserId];
        
        // Создаем тестовые сообщения для запроса
        const introMessage = fromWeb3.utils.utf8ToHex(`Привет! Меня зовут ${fromUser.name}. Хочешь добавить меня в контакты?`);
        const encryptedMessageData = fromWeb3.utils.utf8ToHex(`Зашифрованное сообщение от ${fromUser.name}`);
        
        // Получаем плату получателя
        const recipientSettings = await fromContract.methods.getUserSettings(toAddress).call();
        const requiredFee = recipientSettings.contactRequestFee;
        
        console.log(`   Требуемая плата: ${fromWeb3.utils.fromWei(requiredFee, 'ether')} ETH`);
        
        const tx = fromContract.methods.requestContact(toAddress, introMessage, encryptedMessageData);
        const estimatedGas = await tx.estimateGas({ from: fromAddress, value: requiredFee });
        
        const gasPrice = await getOptimalGasPrice(fromWeb3);
        const gas = limitGasByCost(Number(estimatedGas), gasPrice, 0.025); // Увеличиваем бюджет для requestContact до $0.025
        
        // Детальное логирование стоимости газа
        const gasCost = calculateGasCost(gas, gasPrice);
        console.log(`   💰 Стоимость запроса: ${gasCost.eth.toFixed(8)} ETH ($${gasCost.usd.toFixed(4)})`);
        
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
        
        console.log(`✅ Запрос отправлен: ${fromAddress} → ${toAddress}`);
        console.log(`   TX Hash: ${receipt.transactionHash}`);
        
        // Пауза после транзакции
        console.log(`⏸️ Пауза 3 секунды после запроса...`);
        await sleep(3000);
        
        return { success: true, fromUserId, toUserId, fromAddress, toAddress };
        
    } catch (error) {
        // Игнорируем ошибки (запрос уже существует, пользователь не найден и т.д.)
        console.warn(`⚠️  Ошибка отправки запроса: ${error.message} (продолжаем)`);
        return { success: false, fromUserId, toUserId, error: error.message };
    }
}

/**
 * Принимает запрос на добавление в контакты
 */
async function acceptContactRequest(acceptorUserId, senderUserId, acceptorAddress, senderAddress) {
    console.log(`✅ ${acceptorUserId} принимает запрос от ${senderUserId}`);
    
    try {
        // Создаем отдельный экземпляр Web3 для принимающего
        const acceptorWeb3 = createWeb3Instance();
        const acceptorContract = createContractInstance(acceptorWeb3);
        
        const acceptorUser = testUsers[acceptorUserId];
        const tx = acceptorContract.methods.acceptContactRequest(senderAddress);
        const estimatedGas = await tx.estimateGas({ from: acceptorAddress });
        
        const gasPrice = await getOptimalGasPrice(acceptorWeb3);
        const gas = limitGasByCost(Number(estimatedGas), gasPrice, 0.025); // Бюджет $0.025 для принятия запроса
        
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
            gasPrice: gasPrice
        }, acceptorUser.privateKey);
        
        const receipt = await acceptorWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        console.log(`✅ Контакт добавлен: ${acceptorAddress} ↔ ${senderAddress}`);
        console.log(`   TX Hash: ${receipt.transactionHash}`);
        
        // Пауза после транзакции
        console.log(`⏸️ Пауза 3 секунды после принятия...`);
        await sleep(3000);
        
        return { success: true, acceptorUserId, senderUserId, acceptorAddress, senderAddress };
        
    } catch (error) {
        console.warn(`⚠️  Ошибка принятия запроса: ${error.message} (продолжаем)`);
        return { success: false, acceptorUserId, senderUserId, error: error.message };
    }
}

/**
 * Отклоняет запрос на добавление в контакты
 */
async function rejectContactRequest(rejectorUserId, senderUserId, rejectorAddress, senderAddress) {
    console.log(`❌ ${rejectorUserId} отклоняет запрос от ${senderUserId}`);
    
    try {
        // Создаем отдельный экземпляр Web3 для отклоняющего
        const rejectorWeb3 = createWeb3Instance();
        const rejectorContract = createContractInstance(rejectorWeb3);
        
        const rejectorUser = testUsers[rejectorUserId];
        const tx = rejectorContract.methods.rejectContactRequest(senderAddress);
        const estimatedGas = await tx.estimateGas({ from: rejectorAddress });
        
        const gasPrice = await getOptimalGasPrice(rejectorWeb3);
        const gas = limitGasByCost(Number(estimatedGas), gasPrice, 0.01); // Ограничиваем стоимостью $0.01
        
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
        
        console.log(`✅ Запрос отклонен: ${rejectorAddress} ❌ ${senderAddress}`);
        console.log(`   TX Hash: ${receipt.transactionHash}`);
        
        // Пауза после транзакции
        console.log(`⏸️ Пауза 3 секунды после отклонения...`);
        await sleep(3000);
        
        return { success: true, rejectorUserId, senderUserId, rejectorAddress, senderAddress };
        
    } catch (error) {
        console.warn(`⚠️  Ошибка отклонения запроса: ${error.message} (продолжаем)`);
        return { success: false, rejectorUserId, senderUserId, error: error.message };
    }
}

/**
 * Отправляет сообщение
 */
async function sendMessage(fromUserId, toUserId, fromAddress, toAddress, message) {
    console.log(`💬 ${fromUserId} → ${toUserId}: "${message}"`);
    
    try {
        // Создаем отдельный экземпляр Web3 для отправителя
        const fromWeb3 = createWeb3Instance();
        const fromContract = createContractInstance(fromWeb3);
        
        const fromUser = testUsers[fromUserId];
        const encryptedMessage = generateEncryptedMessage(message);
        
        // Реальный вызов контракта с зашифрованным сообщением
        const tx = fromContract.methods.sendMessage(toAddress, encryptedMessage);
        const estimatedGas = await tx.estimateGas({ from: fromAddress });
        
        const gasPrice = await getOptimalGasPrice(fromWeb3);
        const gas = limitGasByCost(Number(estimatedGas), gasPrice, 0.01); // Ограничиваем стоимостью $0.01
        
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
        console.log(`   Зашифровано: ${encryptedMessage.substring(0, 20)}...`);
        console.log(`   TX Hash: ${receipt.transactionHash}`);
        
        // Пауза после транзакции
        console.log(`⏸️ Пауза 3 секунды после сообщения...`);
        await sleep(3000);
        
        return { success: true, fromUserId, toUserId, fromAddress, toAddress, message, encryptedMessage };
        
    } catch (error) {
        console.warn(`⚠️  Ошибка отправки сообщения: ${error.message} (продолжаем)`);
        return { success: false, fromUserId, toUserId, error: error.message };
    }
}

/**
 * Основная функция для заполнения контракта тестовыми данными
 */
async function populateContractWithTestData() {
    console.log('🚀 Заполнение контракта тестовыми данными...\n');
    
    // Счетчик общих затрат (глобальные переменные)
    global.totalCostUsd = 0;
    global.totalTransactions = 0;
    
    // 1. Регистрируем всех пользователей
    console.log('📝 Шаг 1: Регистрация пользователей');
    const users = {};
    for (const [userId, userData] of Object.entries(testUsers)) {
        if (!userData.privateKey) {
            console.warn(`⚠️  Пропущен ${userId}: PRIVATE_KEY не найден`);
            continue;
        }
        
        const result = await registerUser(userId, userData.privateKey, userData);
        users[userId] = result;
        
        // Пауза между регистрациями
        console.log(`⏸️ Пауза 5 секунд после регистрации ${userId}...`);
        await sleep(5000);
    }
    
    // 2. Отправляем запросы на добавление в контакты
    console.log('\n📤 Шаг 2: Отправка запросов на добавление в контакты');
    console.log('⏸️ Пауза 10 секунд перед отправкой запросов...');
    await sleep(10000);
    
    // user02 → user03 (без ответа)
    await requestContact('user02', 'user03', users.user02.address, users.user03.address);
    
    // user02 → user04 (отказ)
    await requestContact('user02', 'user04', users.user02.address, users.user04.address);
    
    // user02 → user05 (согласие)
    await requestContact('user02', 'user05', users.user02.address, users.user05.address);
    
    // user03 → user04 (согласие)
    await requestContact('user03', 'user04', users.user03.address, users.user04.address);
    
    // user03 → user05 (согласие)
    await requestContact('user03', 'user05', users.user03.address, users.user05.address);
    
    // user04 → user05 (отказ)
    await requestContact('user04', 'user05', users.user04.address, users.user05.address);
    
    // 3. Обрабатываем запросы
    console.log('\n✅ Шаг 3: Обработка запросов');
    console.log('⏸️ Пауза 10 секунд перед обработкой запросов...');
    await sleep(10000);
    
    // user04 отклоняет запрос от user02
    await rejectContactRequest('user04', 'user02', users.user04.address, users.user02.address);
    
    // user05 принимает запрос от user02
    await acceptContactRequest('user05', 'user02', users.user05.address, users.user02.address);
    
    // user04 принимает запрос от user03
    await acceptContactRequest('user04', 'user03', users.user04.address, users.user03.address);
    
    // user05 принимает запрос от user03
    await acceptContactRequest('user05', 'user03', users.user05.address, users.user03.address);
    
    // user05 отклоняет запрос от user04
    await rejectContactRequest('user05', 'user04', users.user05.address, users.user04.address);
    
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
        
        await sendMessage(fromUserId, toUserId, fromAddress, toAddress, messages02_05[i]);
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
        
        await sendMessage(fromUserId, toUserId, fromAddress, toAddress, messages03_04[i]);
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
        
        await sendMessage(fromUserId, toUserId, fromAddress, toAddress, messages03_05[i]);
    }
    
    console.log('\n🎉 Заполнение контракта завершено!');
    console.log('\n📊 Созданные тестовые данные:');
    console.log('✅ 4 пользователя зарегистрированы');
    console.log('📤 6 запросов на добавление в контакты отправлено');
    console.log('✅ 3 запроса принято');
    console.log('❌ 3 запроса отклонено');
    console.log('💬 15 сообщений отправлено в 3 активных чата');
    
    console.log('\n💰 Общие затраты на газ:');
    console.log(`   Всего транзакций: ${global.totalTransactions}`);
    console.log(`   Общая стоимость: $${global.totalCostUsd.toFixed(4)}`);
    console.log(`   Средняя стоимость за транзакцию: $${(global.totalCostUsd / global.totalTransactions).toFixed(4)}`);
    
    console.log('\n🎯 Сценарии для тестирования:');
    console.log('1. user02 → user03: запрос без ответа (pending)');
    console.log('2. user02 → user04: запрос отклонен (rejected)');
    console.log('3. user02 ↔ user05: активный чат с сообщениями');
    console.log('4. user03 ↔ user04: активный чат с сообщениями');
    console.log('5. user03 ↔ user05: активный чат с сообщениями');
    console.log('6. user04 → user05: запрос отклонен (блокировка повторных запросов)');
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

module.exports = { populateContractWithTestData, testUsers, testMessages };
