# Деплой на Base Network

## 🌐 Сеть Base

Base - это L2 решение от Coinbase, построенное на OP Stack. Предоставляет дешевые и быстрые транзакции для Ethereum-совместимых приложений.

## 🔗 Контракт

**Адрес**: `0x541a49c4f9A97a274ADf0623beDCF6A8F9F17bF8`  
**Сеть**: Base Mainnet  
**Блокчейн-эксплорер**: [BaseScan](https://basescan.org/address/0x541a49c4f9A97a274ADf0623beDCF6A8F9F17bF8)

## ⚙️ Конфигурация

### RPC Endpoints
```javascript
const RPC_ENDPOINTS = [
    'https://base-rpc.publicnode.com',
    'https://base.llamarpc.com', 
    'https://base-mainnet.g.alchemy.com/v2/demo'
];
```

### Gas настройки
- **Gas Price**: Динамический (через `getOptimalGasPrice`)
- **Gas Limit**: Ограничен стоимостью $0.01-0.025
- **Максимальная стоимость**: $0.025 за транзакцию

## 🚀 Процесс деплоя

### 1. Компиляция
```bash
forge build
```

### 2. Тестирование
```bash
forge test
```

### 3. Деплой
```bash
forge script script/Deploy.s.sol --rpc-url $BASE_RPC_URL --broadcast --verify
```

## 📊 Статистика деплоя

- **Время деплоя**: ~2 минуты
- **Стоимость деплоя**: ~$0.50
- **Размер контракта**: ~15KB
- **Gas used**: ~500,000

## 🔍 Верификация

Контракт верифицирован на BaseScan:
- Исходный код доступен
- ABI экспортирован
- Функции документированы

## 🧪 Тестирование в продакшене

### Тестовые данные
- 5 тестовых пользователей зарегистрированы
- 18 сообщений отправлено
- Контакты добавлены

### Мониторинг
- События отслеживаются через BaseScan
- RPC endpoints мониторятся
- Gas costs отслеживаются
