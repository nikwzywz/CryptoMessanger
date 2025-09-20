// Конфигурация CryptoMessenger
window.CryptoMessengerConfig = {
    
    // Режим отладки - показывает дополнительную информацию. Например, на карточках контактов.
    debugMode: false, // true - показывать отладочную информацию, false - обычный режим
    
    // Сеть 
    network: {
        chainId: '0x89', // 137 в hex
        chainName: 'Polygon',
        rpcUrls: [
            'https://polygon.rpc.subquery.network/public'
        ],
        blockExplorerUrls: ['https://polygonscan.com'],
        nativeCurrency: {
            name: 'POL',
            symbol: 'POL',
            decimals: 18
        },
        // Настройки газа для текущей сети
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
            gasPrice: '30000000000', // 30 gwei для Polygon
            maxFeePerGas: '50000000000', // 50 gwei максимум для EIP-1559
            maxPriorityFeePerGas: '2000000000' // 2 gwei приоритетная комиссия
        }
    },
    
    // Адрес развернутого контракта 
    contractAddress: '0xbc02826ba71d00604b91d2c883e0c27e9ecd30f7',
    
    // Подписываемая фраза для генерации ключей шифрования
    signaturePhrase: 'By signing this message, I authorize CryptoMessenger to decrypt and read my messages.',
    
    // Стандартные фразы для операций с приглашениями
    invitationMessages: {
        accept: 'I accept the invitation',
        reject: 'I reject the invitation', 
        cancel: 'I cancel the invitation',
        deactivate: 'I deactivate this chat'
    },
    
    // Константы для polling алгоритма V3
    pollingConfig: {
        MESSAGES_BATCH_SIZE: 100,    // Размер пачки сообщений (пункт 2.6 в алгоритме)
        CONTACTS_BATCH_SIZE: 100,    // Размер пачки контактов (пункт 6.4 в алгоритме)
        POLLING_INTERVAL: 15000      // 15 секунд между проверками
    },
    
    // Таймаут для отзыва приглашений (загружается из контракта)
    INVITATION_TIMEOUT: null, // Будет загружен из contract.INVITATION_TIMEOUT()
    
    // ABI контракта (полный)
    contractABI: [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "CannotInteractWithSelf",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "ChatAlreadyActive",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "ChatNotActive",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "ContactNameTooLong",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "FeeTooHigh",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "InsufficientPayment",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "InvalidAddress",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "InvalidInviter",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "InvitationAlreadyPending",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "InvitationFeeTooHigh",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NoInvitationFound",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "OnlyOwner",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "PublicKeyEmpty",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "RecipientNotRegistered",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "StartIndexOutOfBounds",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "UserAlreadyRegistered",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "UserNotRegistered",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "newDefaultFee",
                "type": "uint256"
            }
        ],
        "name": "DefaultContactRequestFeeUpdated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "FEE_UNIT",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "INVITATION_TIMEOUT",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "MAX_CONTACT_REQUEST_FEE",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "MAX_INVITATION_FEE",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "name": "chats",
        "outputs": [
            {
                "internalType": "address",
                "name": "inviter",
                "type": "address"
            },
            {
                "internalType": "uint56",
                "name": "invitationFee",
                "type": "uint56"
            },
            {
                "internalType": "uint32",
                "name": "createdAt",
                "type": "uint32"
            },
            {
                "internalType": "enum CryptoMessenger.enumChatState",
                "name": "state",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "contractOwner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "contactAddress",
                "type": "address"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForRecipient",
                "type": "bytes"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForSender",
                "type": "bytes"
            }
        ],
        "name": "deactivateChat",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "defaultContactRequestFee",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "chatId",
                "type": "bytes32"
            }
        ],
        "name": "getChat",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "inviter",
                        "type": "address"
                    },
                    {
                        "internalType": "uint56",
                        "name": "invitationFee",
                        "type": "uint56"
                    },
                    {
                        "internalType": "uint32",
                        "name": "createdAt",
                        "type": "uint32"
                    },
                    {
                        "internalType": "enum CryptoMessenger.enumChatState",
                        "name": "state",
                        "type": "uint8"
                    }
                ],
                "internalType": "struct CryptoMessenger.ChatSettings",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getContactsCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "startIndex",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "endIndex",
                "type": "uint256"
            }
        ],
        "name": "getContactsPaginated",
        "outputs": [
            {
                "internalType": "address[]",
                "name": "contacts",
                "type": "address[]"
            },
            {
                "internalType": "string[]",
                "name": "names",
                "type": "string[]"
            },
            {
                "internalType": "bytes[]",
                "name": "publicKeys",
                "type": "bytes[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getMessagesCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "startMessIndex",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "endMessIndex",
                "type": "uint256"
            }
        ],
        "name": "getMessagesPaginated",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "bytes32",
                        "name": "chatID",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "bytes",
                        "name": "encryptedMessage",
                        "type": "bytes"
                    },
                    {
                        "internalType": "uint248",
                        "name": "messIndex",
                        "type": "uint248"
                    },
                    {
                        "internalType": "bool",
                        "name": "isFromMe",
                        "type": "bool"
                    },
                    {
                        "internalType": "uint32",
                        "name": "messageTimestamp",
                        "type": "uint32"
                    },
                    {
                        "internalType": "enum CryptoMessenger.enumChatState",
                        "name": "newChatState",
                        "type": "uint8"
                    }
                ],
                "internalType": "struct CryptoMessenger.TypeMessage[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "inviterAddress",
                "type": "address"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForRecipient",
                "type": "bytes"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForSender",
                "type": "bytes"
            }
        ],
        "name": "invitationAccept",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "recipientAddress",
                "type": "address"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForRecipient",
                "type": "bytes"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForSender",
                "type": "bytes"
            }
        ],
        "name": "invitationCancel",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "inviterAddress",
                "type": "address"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForRecipient",
                "type": "bytes"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForSender",
                "type": "bytes"
            }
        ],
        "name": "invitationReject",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "recipientAddress",
                "type": "address"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForRecipient",
                "type": "bytes"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForSender",
                "type": "bytes"
            }
        ],
        "name": "invitationSend",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "userAddress",
                "type": "address"
            }
        ],
        "name": "isUserRegistered",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "messageCounters",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "messages",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "chatID",
                "type": "bytes32"
            },
            {
                "internalType": "bytes",
                "name": "encryptedMessage",
                "type": "bytes"
            },
            {
                "internalType": "uint248",
                "name": "messIndex",
                "type": "uint248"
            },
            {
                "internalType": "bool",
                "name": "isFromMe",
                "type": "bool"
            },
            {
                "internalType": "uint32",
                "name": "messageTimestamp",
                "type": "uint32"
            },
            {
                "internalType": "enum CryptoMessenger.enumChatState",
                "name": "newChatState",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "contactName",
                "type": "string"
            },
            {
                "internalType": "bytes",
                "name": "userPublicKey",
                "type": "bytes"
            }
        ],
        "name": "registerUser",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "recipientAddress",
                "type": "address"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForRecipient",
                "type": "bytes"
            },
            {
                "internalType": "bytes",
                "name": "encryptedForSender",
                "type": "bytes"
            }
        ],
        "name": "sendMessage",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "newContactName",
                "type": "string"
            }
        ],
        "name": "setContactName",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "contactRequestFee",
                "type": "uint256"
            }
        ],
        "name": "setContactRequestFee",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "newDefaultFee",
                "type": "uint256"
            }
        ],
        "name": "setDefaultContactRequestFee",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwnerAddress",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "userContacts",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "userSettings",
        "outputs": [
            {
                "internalType": "string",
                "name": "contactName",
                "type": "string"
            },
            {
                "internalType": "bytes",
                "name": "publicKeyForEncode",
                "type": "bytes"
            },
            {
                "internalType": "uint256",
                "name": "contactRequestFee",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "isRegistered",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "withdrawETH",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]
};

console.log('📦 Конфигурация Web3shold загружена v1.0.0 - 2025-09-20 16:03 (полный ABI, Polygon)');
console.log('🌐 Сеть:', window.CryptoMessengerConfig.network.chainName);
console.log('📄 Контракт:', window.CryptoMessengerConfig.contractAddress);
