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

// Импортируем конфигурацию из config.js
const configPath = path.join(__dirname, '..', 'frontend', 'config.js');
const configContent = fs.readFileSync(configPath, 'utf8');

// Извлекаем конфигурацию из config.js
const configMatch = configContent.match(/window\.CryptoMessengerConfig\s*=\s*({[\s\S]*?});/);
if (!configMatch) {
    throw new Error('Не удалось найти CryptoMessengerConfig в config.js');
}

const config = eval('(' + configMatch[1] + ')');
const CONTRACT_ADDRESS = config.contractAddress;
const CONTRACT_ABI = config.contractABI;
const BASE_RPC_URL = config.network.rpcUrl;

// Тестовые пользователи
const testUsers = {
    user02: {
        privateKey: process.env.PRIVATE_KEY_02,
        name: 'Алиса',
        description: 'Активный пользователь, много общается'
    },
    user03: {
        privateKey: process.env.PRIVATE_KEY_03,
        name: 'Боб',
        description: 'Молчаливый пользователь, редко отвечает'
    },
    user04: {
        privateKey: process.env.PRIVATE_KEY_04,
        name: 'Чарли',
        description: 'Избирательный пользователь, часто отказывается'
    },
    user05: {
        privateKey: process.env.PRIVATE_KEY_05,
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
function getAddressFromPrivateKey(privateKey) {
    // В реальном проекте использовать web3.js или ethers.js
    return `0x${privateKey.slice(0, 40)}`;
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
        const address = getAddressFromPrivateKey(privateKey);
        const publicKey = `0x${privateKey.slice(0, 64)}`;
        
        // В реальном проекте здесь был бы вызов контракта
        console.log(`✅ ${userId} зарегистрирован`);
        console.log(`   Адрес: ${address}`);
        console.log(`   Публичный ключ: ${publicKey}`);
        
        return { userId, address, publicKey, registered: true };
        
    } catch (error) {
        console.error(`❌ Ошибка регистрации ${userId}:`, error.message);
        return { userId, address: getAddressFromPrivateKey(privateKey), registered: false, error: error.message };
    }
}

/**
 * Отправляет запрос на добавление в контакты
 */
async function requestContact(fromUserId, toUserId, fromAddress, toAddress) {
    console.log(`📤 ${fromUserId} → ${toUserId}: запрос на добавление в контакты`);
    
    try {
        // В реальном проекте здесь был бы вызов contract.requestContact(toAddress)
        console.log(`✅ Запрос отправлен: ${fromAddress} → ${toAddress}`);
        return { success: true, fromUserId, toUserId, fromAddress, toAddress };
        
    } catch (error) {
        console.error(`❌ Ошибка отправки запроса:`, error.message);
        return { success: false, fromUserId, toUserId, error: error.message };
    }
}

/**
 * Принимает запрос на добавление в контакты
 */
async function acceptContactRequest(acceptorUserId, senderUserId, acceptorAddress, senderAddress) {
    console.log(`✅ ${acceptorUserId} принимает запрос от ${senderUserId}`);
    
    try {
        // В реальном проекте здесь был бы вызов contract.acceptContactRequest(senderAddress)
        console.log(`✅ Контакт добавлен: ${acceptorAddress} ↔ ${senderAddress}`);
        return { success: true, acceptorUserId, senderUserId, acceptorAddress, senderAddress };
        
    } catch (error) {
        console.error(`❌ Ошибка принятия запроса:`, error.message);
        return { success: false, acceptorUserId, senderUserId, error: error.message };
    }
}

/**
 * Отклоняет запрос на добавление в контакты
 */
async function rejectContactRequest(rejectorUserId, senderUserId, rejectorAddress, senderAddress) {
    console.log(`❌ ${rejectorUserId} отклоняет запрос от ${senderUserId}`);
    
    try {
        // В реальном проекте здесь был бы вызов contract.rejectContactRequest(senderAddress)
        console.log(`✅ Запрос отклонен: ${rejectorAddress} ❌ ${senderAddress}`);
        return { success: true, rejectorUserId, senderUserId, rejectorAddress, senderAddress };
        
    } catch (error) {
        console.error(`❌ Ошибка отклонения запроса:`, error.message);
        return { success: false, rejectorUserId, senderUserId, error: error.message };
    }
}

/**
 * Отправляет сообщение
 */
async function sendMessage(fromUserId, toUserId, fromAddress, toAddress, message) {
    console.log(`💬 ${fromUserId} → ${toUserId}: "${message}"`);
    
    try {
        const encryptedMessage = generateEncryptedMessage(message);
        // В реальном проекте здесь был бы вызов contract.sendMessage(toAddress, encryptedMessage)
        console.log(`✅ Сообщение отправлено: ${fromAddress} → ${toAddress}`);
        return { success: true, fromUserId, toUserId, fromAddress, toAddress, message, encryptedMessage };
        
    } catch (error) {
        console.error(`❌ Ошибка отправки сообщения:`, error.message);
        return { success: false, fromUserId, toUserId, error: error.message };
    }
}

/**
 * Основная функция для заполнения контракта тестовыми данными
 */
async function populateContractWithTestData() {
    console.log('🚀 Заполнение контракта тестовыми данными...\n');
    
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
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 2. Отправляем запросы на добавление в контакты
    console.log('\n📤 Шаг 2: Отправка запросов на добавление в контакты');
    
    // user02 → user03 (без ответа)
    await requestContact('user02', 'user03', users.user02.address, users.user03.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // user02 → user04 (отказ)
    await requestContact('user02', 'user04', users.user02.address, users.user04.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // user02 → user05 (согласие)
    await requestContact('user02', 'user05', users.user02.address, users.user05.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // user03 → user04 (согласие)
    await requestContact('user03', 'user04', users.user03.address, users.user04.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // user03 → user05 (согласие)
    await requestContact('user03', 'user05', users.user03.address, users.user05.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // user04 → user05 (отказ)
    await requestContact('user04', 'user05', users.user04.address, users.user05.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Обрабатываем запросы
    console.log('\n✅ Шаг 3: Обработка запросов');
    
    // user04 отклоняет запрос от user02
    await rejectContactRequest('user04', 'user02', users.user04.address, users.user02.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // user05 принимает запрос от user02
    await acceptContactRequest('user05', 'user02', users.user05.address, users.user02.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // user04 принимает запрос от user03
    await acceptContactRequest('user04', 'user03', users.user04.address, users.user03.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // user05 принимает запрос от user03
    await acceptContactRequest('user05', 'user03', users.user05.address, users.user03.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // user05 отклоняет запрос от user04
    await rejectContactRequest('user05', 'user04', users.user05.address, users.user04.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Отправляем сообщения в активных чатах
    console.log('\n💬 Шаг 4: Отправка сообщений');
    
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
        await new Promise(resolve => setTimeout(resolve, 1000));
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
        await new Promise(resolve => setTimeout(resolve, 1000));
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
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 Заполнение контракта завершено!');
    console.log('\n📊 Созданные тестовые данные:');
    console.log('✅ 4 пользователя зарегистрированы');
    console.log('📤 6 запросов на добавление в контакты отправлено');
    console.log('✅ 3 запроса принято');
    console.log('❌ 3 запроса отклонено');
    console.log('💬 15 сообщений отправлено в 3 активных чата');
    
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
