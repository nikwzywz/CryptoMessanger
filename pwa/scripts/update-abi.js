#!/usr/bin/env node

/**
 * Скрипт для автоматического обновления ABI в config.js
 * 
 * Приоритет источников ABI:
 * 1. abi-raw.json - основной источник (скопируйте сюда ABI с Basescan)
 * 2. Basescan API - резервный источник (требует API ключ)
 * 3. Локальный контракт - fallback (contracts/out/CryptoMessenger.sol/CryptoMessenger.json)
 * 
 * Использование:
 * 1. Скопируйте ABI с https://basescan.org/address/0x... в abi-raw.json
 * 2. Запустите: make update-abi
 */

const fs = require('fs');
const path = require('path');

// Конфигурации сетей
const NETWORKS = {
    base: {
        name: 'Base',
        chainId: '0x2105', // 8453 в hex
        rpcUrls: ['https://mainnet.base.org'],
        blockExplorerUrls: ['https://basescan.org'],
        apiUrl: 'https://api.basescan.org/api',
        nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
        },
        gasSettings: {
            gasLimit: {
                registerUser: 200000,      // Регистрация пользователя
                sendMessage: 150000,       // Отправка сообщения
                invitationSend: 180000,    // Отправка приглашения
                invitationAccept: 120000,  // Принятие приглашения
                invitationReject: 100000,  // Отклонение приглашения
                invitationCancel: 100000,  // Отмена приглашения
                setContactName: 80000      // Изменение имени
            },
            gasPrice: '1000000000', // 1 gwei для Base (дешевые транзакции)
            maxFeePerGas: '2000000000', // 2 gwei максимум для EIP-1559
            maxPriorityFeePerGas: '100000000' // 0.1 gwei приоритетная комиссия
        }
    },
    polygon: {
        name: 'Polygon',
        chainId: '0x89', // 137 в hex
        rpcUrls: ['https://polygon.rpc.subquery.network/public'],
        blockExplorerUrls: ['https://polygonscan.com'],
        apiUrl: 'https://api.polygonscan.com/api',
        nativeCurrency: {
            name: 'POL',
            symbol: 'POL',
            decimals: 18
        },
        gasSettings: {
            gasLimit: {
                registerUser: 200000,      // Регистрация пользователя
                sendMessage: 150000,       // Отправка сообщения
                invitationSend: 180000,    // Отправка приглашения
                invitationAccept: 120000,  // Принятие приглашения
                invitationReject: 100000,  // Отклонение приглашения
                invitationCancel: 100000,  // Отмена приглашения
                setContactName: 80000      // Изменение имени
            },
            gasPrice: '30000000000', // 30 gwei для Polygon (быстрые транзакции)
            maxFeePerGas: '50000000000', // 50 gwei максимум для EIP-1559
            maxPriorityFeePerGas: '2000000000' // 2 gwei приоритетная комиссия
        }
    }
};

const CONFIG_FILE = path.join(__dirname, '../frontend/config.js');
const ABI_RAW_FILE = path.join(__dirname, '../../abi-raw.json');

// Получаем параметры из аргументов командной строки
const NETWORK_NAME = process.argv[2] || 'base'; // Название сети (base, polygon)
let CONTRACT_ADDRESS = process.argv[3]; // Адрес контракта (опционально)

// Проверяем поддерживаемую сеть
if (!NETWORKS[NETWORK_NAME]) {
    console.error(`❌ Неподдерживаемая сеть: ${NETWORK_NAME}`);
    console.error(`✅ Поддерживаемые сети: ${Object.keys(NETWORKS).join(', ')}`);
    process.exit(1);
}

const NETWORK_CONFIG = NETWORKS[NETWORK_NAME];
console.log(`🌐 Обновляем конфигурацию для сети: ${NETWORK_CONFIG.name}`);

// Если адрес не передан, читаем из config.js
if (!CONTRACT_ADDRESS) {
    try {
        const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
        const match = configContent.match(/contractAddress:\s*'([^']+)'/);
        if (match) {
            CONTRACT_ADDRESS = match[1];
            console.log(`📄 Используем адрес из config.js: ${CONTRACT_ADDRESS}`);
        } else {
            throw new Error('Не удалось найти contractAddress в config.js');
        }
    } catch (error) {
        console.error('❌ Ошибка чтения адреса контракта:', error.message);
        process.exit(1);
    }
} else {
    console.log(`📄 Используем адрес из аргументов: ${CONTRACT_ADDRESS}`);
}

// Загружаем API ключ из .env файла
let ETHERSCAN_API_KEY = '';
try {
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/ETHERSCAN_API_KEY=([^\s\n\r]+)/);
        if (match) {
            ETHERSCAN_API_KEY = match[1];
            console.log('✅ API ключ загружен из .env файла');
        }
    }
} catch (error) {
    console.warn('⚠️ Не удалось загрузить API ключ из .env:', error.message);
}

/**
 * Получает ABI контракта из API блокчейн-эксплорера
 */
async function fetchABI(contractAddress) {
    try {
        console.log(`🔍 Получение ABI для контракта ${contractAddress} из ${NETWORK_CONFIG.name}...`);
        
        // Формируем URL с API ключом
        const apiUrl = `${NETWORK_CONFIG.apiUrl}?module=contract&action=getabi&address=${contractAddress}`;
        const urlWithKey = apiUrl; // Пока используем без ключа
        
        console.log(`🌐 Запрос к ${NETWORK_CONFIG.name} API: ${urlWithKey}`);
        
        const response = await fetch(urlWithKey);
        const data = await response.json();
        
        console.log(`📊 Ответ от ${NETWORK_CONFIG.name} API:`, data);
        
        if (data.status === '1' && data.result) {
            const abi = JSON.parse(data.result);
            console.log(`✅ ABI успешно получен из ${NETWORK_CONFIG.name}`);
            return abi;
        } else {
            throw new Error(`${NETWORK_CONFIG.name} API error: ${data.message || data.result || 'Неизвестная ошибка'}`);
        }
    } catch (error) {
        console.error(`❌ Ошибка получения ABI из ${NETWORK_CONFIG.name}:`, error);
        throw error;
    }
}

/**
 * Получает ABI из файла abi-raw.json (основной источник)
 */
function getABIFromRawFile() {
    try {
        console.log('📁 Получение ABI из abi-raw.json...');
        
        if (!fs.existsSync(ABI_RAW_FILE)) {
            throw new Error('Файл abi-raw.json не найден');
        }
        
        const rawContent = fs.readFileSync(ABI_RAW_FILE, 'utf8').trim();
        
        if (!rawContent || rawContent === '[]') {
            throw new Error('Файл abi-raw.json пуст или содержит только пустой массив');
        }
        
        // Парсим ABI
        let abi;
        try {
            abi = JSON.parse(rawContent);
        } catch (parseError) {
            throw new Error(`Ошибка парсинга JSON в abi-raw.json: ${parseError.message}`);
        }
        
        if (!Array.isArray(abi) || abi.length === 0) {
            throw new Error('ABI должен быть непустым массивом');
        }
        
        console.log('✅ ABI успешно получен из abi-raw.json');
        console.log(`📊 Функций: ${abi.filter(item => item.type === 'function').length}`);
        console.log(`📢 Событий: ${abi.filter(item => item.type === 'event').length}`);
        
        return abi;
    } catch (error) {
        console.error('❌ Ошибка получения ABI из abi-raw.json:', error);
        throw error;
    }
}

/**
 * Получает ABI из локального файла контракта (fallback)
 */
function getABIFromLocalContract() {
    try {
        console.log('📁 Попытка получить ABI из локального контракта...');
        
        const contractPath = path.join(__dirname, '../../contracts/out/CryptoMessenger.sol/CryptoMessenger.json');
        if (fs.existsSync(contractPath)) {
            const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
            if (contractData.abi) {
                console.log('✅ ABI получен из локального контракта');
                return contractData.abi;
            }
        }
        
        throw new Error('Локальный ABI не найден');
    } catch (error) {
        console.error('❌ Ошибка получения локального ABI:', error);
        throw error;
    }
}

/**
 * Обновляет ABI в config.js
 */
function updateConfigFile(abi, contractAddress) {
    try {
        console.log('📝 Чтение config.js...');
        let configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
        
        // Обновляем сетевую конфигурацию (ищем от network: { до закрывающей скобки)
        const networkStartIndex = configContent.indexOf('network: {');
        let networkEndIndex = -1;
        
        if (networkStartIndex !== -1) {
            // Ищем закрывающую скобку для network объекта
            let braceCount = 0;
            let currentIndex = networkStartIndex + 'network: '.length;
            
            for (let i = currentIndex; i < configContent.length; i++) {
                if (configContent[i] === '{') {
                    braceCount++;
                } else if (configContent[i] === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        networkEndIndex = i;
                        break;
                    }
                }
            }
        }
        
        if (networkStartIndex !== -1 && networkEndIndex !== -1) {
            const beforeNetwork = configContent.substring(0, networkStartIndex);
            const afterNetwork = configContent.substring(networkEndIndex + 1);
            
            const newNetworkConfig = `network: {
        chainId: '${NETWORK_CONFIG.chainId}', // ${parseInt(NETWORK_CONFIG.chainId, 16)} в hex
        chainName: '${NETWORK_CONFIG.name}',
        rpcUrls: [
            '${NETWORK_CONFIG.rpcUrls[0]}'
        ],
        blockExplorerUrls: ['${NETWORK_CONFIG.blockExplorerUrls[0]}'],
        nativeCurrency: {
            name: '${NETWORK_CONFIG.nativeCurrency.name}',
            symbol: '${NETWORK_CONFIG.nativeCurrency.symbol}',
            decimals: ${NETWORK_CONFIG.nativeCurrency.decimals}
        },
        // Настройки газа для текущей сети
        gasSettings: {
            gasLimit: {
                registerUser: ${NETWORK_CONFIG.gasSettings.gasLimit.registerUser},      // Регистрация пользователя
                sendMessage: ${NETWORK_CONFIG.gasSettings.gasLimit.sendMessage},       // Отправка сообщения
                invitationSend: ${NETWORK_CONFIG.gasSettings.gasLimit.invitationSend},    // Отправка приглашения
                invitationAccept: ${NETWORK_CONFIG.gasSettings.gasLimit.invitationAccept},  // Принятие приглашения
                invitationReject: ${NETWORK_CONFIG.gasSettings.gasLimit.invitationReject},  // Отклонение приглашения
                invitationCancel: ${NETWORK_CONFIG.gasSettings.gasLimit.invitationCancel},  // Отмена приглашения
                setContactName: ${NETWORK_CONFIG.gasSettings.gasLimit.setContactName}      // Изменение имени
            },
            gasPrice: '${NETWORK_CONFIG.gasSettings.gasPrice}', // ${parseInt(NETWORK_CONFIG.gasSettings.gasPrice) / 1000000000} gwei для ${NETWORK_CONFIG.name}
            maxFeePerGas: '${NETWORK_CONFIG.gasSettings.maxFeePerGas}', // ${parseInt(NETWORK_CONFIG.gasSettings.maxFeePerGas) / 1000000000} gwei максимум для EIP-1559
            maxPriorityFeePerGas: '${NETWORK_CONFIG.gasSettings.maxPriorityFeePerGas}' // ${parseInt(NETWORK_CONFIG.gasSettings.maxPriorityFeePerGas) / 1000000000} gwei приоритетная комиссия
        }
    }`;
            
            configContent = beforeNetwork + newNetworkConfig + afterNetwork;
            console.log(`🌐 Обновлена конфигурация сети: ${NETWORK_CONFIG.name} (включая настройки газа)`);
        }
        
        // Обновляем адрес контракта
        const addressRegex = /contractAddress:\s*'[^']*'/;
        configContent = configContent.replace(addressRegex, `contractAddress: '${contractAddress}'`);
        
        // Обновляем ABI - ищем от contractABI: до закрывающей скобки массива
        const abiStartIndex = configContent.indexOf('contractABI: [');
        const abiEndIndex = configContent.lastIndexOf(']');
        
        if (abiStartIndex !== -1 && abiEndIndex !== -1) {
            const beforeABI = configContent.substring(0, abiStartIndex);
            const afterABI = configContent.substring(abiEndIndex + 1);
            const newABI = `contractABI: ${JSON.stringify(abi, null, 4)}`;
            configContent = beforeABI + newABI + afterABI;
        } else {
            throw new Error('Не удалось найти ABI в config.js');
        }
        
        // Обновляем версию и дату
        const versionRegex = /v\d+\.\d+\.\d+ - \d{4}-\d{2}-\d{2} \d{2}:\d{2}/;
        const now = new Date();
        const version = `v1.0.0 - ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        // Ищем и заменяем версию в console.log
        const consoleLogRegex = /console\.log\('📦 Конфигурация (CryptoMessenger|Web3shold) загружена v[\d\.]+ - \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(полный ABI[^']*\)'\);/;
        const newConsoleLog = `console.log('📦 Конфигурация Web3shold загружена ${version} (полный ABI, ${NETWORK_CONFIG.name})');`;
        configContent = configContent.replace(consoleLogRegex, newConsoleLog);
        
        // Записываем обновленный файл
        fs.writeFileSync(CONFIG_FILE, configContent, 'utf8');
        console.log('✅ config.js успешно обновлен');
        
    } catch (error) {
        console.error('❌ Ошибка обновления config.js:', error);
        throw error;
    }
}

/**
 * Основная функция
 */
async function main() {
    try {
        console.log('🚀 Начинаем обновление ABI...');
        
        let abi;
        
        try {
            // Сначала пытаемся получить ABI из abi-raw.json
            abi = getABIFromRawFile();
        } catch (error) {
            console.log('⚠️ Не удалось получить ABI из abi-raw.json, пытаемся Basescan...');
            try {
                abi = await fetchABI(CONTRACT_ADDRESS);
            } catch (basescanError) {
                console.log('⚠️ Не удалось получить ABI из Basescan, используем локальный...');
                try {
                    abi = getABIFromLocalContract();
                } catch (localError) {
                    console.error('❌ Не удалось получить ABI ни из одного источника');
                    throw new Error(`Не удалось получить ABI: abi-raw.json: ${error.message}, Basescan: ${basescanError.message}, Локальный: ${localError.message}`);
                }
            }
        }
        
        // Обновляем config.js
        updateConfigFile(abi, CONTRACT_ADDRESS);
        
        console.log('🎉 ABI успешно обновлен!');
        console.log(`📄 Контракт: ${CONTRACT_ADDRESS}`);
        console.log(`📊 Функций в ABI: ${abi.filter(item => item.type === 'function').length}`);
        console.log(`📢 Событий в ABI: ${abi.filter(item => item.type === 'event').length}`);
        
    } catch (error) {
        console.error('💥 Ошибка обновления ABI:', error);
        process.exit(1);
    }
}

// Запускаем скрипт
if (require.main === module) {
    main();
}

module.exports = { fetchABI, updateConfigFile };
