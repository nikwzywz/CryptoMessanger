# CryptoMessenger Smart Contracts

## Описание
Децентрализованный зашифрованный мессенджер на блокчейне Base.

## Структура проекта

```
contracts/
├── CryptoMessenger.sol          # Основной смарт-контракт
├── interfaces/
│   └── ICryptoMessenger.sol     # Интерфейс контракта
├── test/
│   └── CryptoMessengerTest.sol  # Тестовый контракт
└── README.md                    # Этот файл

script/
└── Deploy.s.sol                 # Скрипт развертывания

test/
└── CryptoMessenger.t.sol        # Тесты Foundry

foundry.toml                     # Конфигурация Foundry
Makefile                         # Команды для разработки
```

## Установка и настройка

### 1. Установка Foundry
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Установка зависимостей
```bash
make install
```

### 3. Компиляция
```bash
make build
```

### 4. Тестирование
```bash
make test
```

## Основной функционал

### 1. Регистрация пользователей
- `registerPublicKey(bytes _publicKey)` - регистрация публичного ключа
- `updatePublicKey(bytes _newPublicKey)` - обновление публичного ключа

### 2. Управление контактами
- `requestContact(address _to, bytes _firstMessage, bytes _encryptedData)` - запрос на добавление в контакты
- `acceptContactRequest(address _from)` - принятие запроса
- `rejectContactRequest(address _from)` - отклонение запроса
- `removeContact(address _contact)` - удаление контакта

### 3. Отправка сообщений
- `sendMessage(address _to, bytes _encryptedData)` - отправка зашифрованного сообщения

### 4. Настройки
- `setContactRequestFee(uint256 _fee)` - установка платы за запрос контакта

## События (Events)

- `PublicKeyRegistered` - регистрация публичного ключа
- `ContactRequested` - запрос на добавление в контакты
- `ContactAccepted` - принятие запроса
- `ContactRejected` - отклонение запроса
- `MessageSent` - отправка сообщения
- `ContactRequestFeeUpdated` - обновление платы

## Безопасность

### Модификаторы
- `onlyRegistered` - только зарегистрированные пользователи
- `validAddress` - проверка валидности адреса

### Защита от спама
- Плата за запрос на добавление в контакты (по умолчанию ~$10)
- Белый список контактов
- Возврат средств при принятии запроса

## Развертывание

### Настройка переменных окружения
```bash
export PRIVATE_KEY="your_private_key"
export BASE_ETHERSCAN_API_KEY="your_etherscan_api_key"
export BASE_SEPOLIA_ETHERSCAN_API_KEY="your_sepolia_etherscan_api_key"
```

### Команды развертывания
```bash
# Base Sepolia (тестовая сеть)
make deploy-sepolia

# Base Mainnet
make deploy-base

# Локальная сеть
make deploy-local
```

## Тестирование

### Запуск всех тестов
```bash
make test
```

### Подробный вывод
```bash
make test-verbose
```

### Отчет по газу
```bash
make test-gas
```

### Покрытие тестами
```bash
make coverage
```

## Газовые оптимизации

- Использование Events для хранения сообщений
- Минимальное использование Storage
- Эффективные структуры данных
- Оптимизация компилятора (200 runs)

## Полезные команды

```bash
# Форматирование кода
make fmt

# Проверка форматирования
make lint

# Создание документации
make doc

# Gas snapshot
make snapshot

# Очистка артефактов
make clean
```

## Лицензия
MIT