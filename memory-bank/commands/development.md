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
cd pwa/frontend && python3 -m http.server 8080   # Запуск локального сервера
open http://localhost:8081/auth.html             # Авторизация (с подписанием)
open http://localhost:8081/main.html             # Главная страница мессенджера
open http://localhost:8081/test-encryption.html  # Тест ECIES шифрования
```

## 📋 ABI Management
```bash
make update-abi          # Обновить ABI из Basescan
node pwa/scripts/update-abi.js  # Прямой вызов скрипта обновления ABI
```
