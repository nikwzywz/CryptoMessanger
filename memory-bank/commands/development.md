# Команды разработки CryptoMessenger

## 🔨 Разработка и тестирование
```bash
make build                  # Компиляция контрактов
make test                   # Тестирование (18/18 тестов проходят)
make clean                  # Очистка артефактов
```

## 🚀 Развертывание контрактов
```bash
make deploy-base            # Развертывание в Base Mainnet
make deploy-sepolia         # Развертывание в Base Sepolia  
make deploy-local           # Локальное развертывание
```

## 🌐 Frontend разработка
```bash
cd pwa/frontend && python3 -m http.server 8081  # Запуск локального сервера
open http://localhost:8081/auth-v2.html     # Новая авторизация (с подписанием)
open http://localhost:8081/main.html        # Главная страница мессенджера
open http://localhost:8081/test-encryption.html  # Тест ECIES шифрования
```

## 📋 ABI Management
```bash
make update-abi          # Обновить ABI из Basescan
node pwa/scripts/update-abi.js  # Прямой вызов скрипта обновления ABI
```

## 🧪 Тестовые данные
```bash
make populate-contract  # Заполнить контракт тестовыми данными
node pwa/scripts/populate-contract-test-data.js  # Прямой вызов скрипта
```

## 📊 Проверка данных
```bash
node pwa/scripts/check-balances.js      # Проверить балансы пользователей
node pwa/scripts/check-messages.js      # Проверить сообщения в контракте
node pwa/scripts/check-user-status.js   # Проверить статус пользователей
```

## 🔐 Контракт (текущий)
- **Адрес**: `0x82274F4ec7f23440531Db1C6B90C18519710c056`
- **Сеть**: Base Mainnet
- **Верификация**: https://basescan.org/address/0x82274f4ec7f23440531db1c6b90c18519710c056
- **Особенности**: Передеплоен с поддержкой реального ECIES шифрования

## 🔑 Шифрование
- **Подписываемая фраза**: "By signing this message, I authorize CryptoMessenger to decrypt and read my messages."
- **Алгоритм**: ECIES с secp256k1 + AES-256-GCM
- **Библиотеки**: @noble/secp256k1, CryptoJS

## 📝 Полезные команды
```bash
# Проверка статуса контракта
cast call 0x82274F4ec7f23440531Db1C6B90C18519710c056 "helloWorld()" --rpc-url https://mainnet.base.org

# Проверка баланса пользователя
cast balance 0x016b67764012166A8d9Ed3502eA542A061B771f8 --rpc-url https://mainnet.base.org

# Получение ABI контракта
cast interface 0x82274F4ec7f23440531Db1C6B90C18519710c056 --rpc-url https://mainnet.base.org
```