# Команды разработки CryptoMessenger

## 🔨 Разработка и тестирование
```bash
make build                  # Компиляция контрактов
make test                   # Тестирование (18/18 тестов проходят)
make clean                  # Очистка артефактов
```

## 🚀 Развертывание контрактов
```bash
make deploy-base            # Развертывание в Base Mainnet (автообновление config.js)
make deploy-sepolia         # Развертывание в Base Sepolia  
make deploy-polygon         # Развертывание в Polygon Mainnet (требует ~0.11 POL для газа)
make deploy-local           # Локальное развертывание
```

### 💰 Требования к балансу кошелька
- **Base:** ~0.012 ETH для развертывания
- **Polygon:** ~0.11 POL для развертывания (ранее MATIC)
- **Sepolia:** Тестовые ETH с фaucet

Скрипты автоматически проверяют баланс перед развертыванием.

## 🌐 Frontend разработка
```bash
cd pwa/frontend && python3 -m http.server 8080   # Запуск локального сервера
open http://localhost:8080/auth.html             # Авторизация (адаптивна к текущей сети)
open http://localhost:8080/main.html             # Главная страница мессенджера
open http://localhost:8080/test-encryption.html  # Тест ECIES шифрования
```

### 🔄 Переключение между сетями
Frontend автоматически адаптируется к сети из `config.js`. Для переключения:
```bash
make update-abi-base     # Переключение на Base + обновление ABI
make update-abi-polygon  # Переключение на Polygon + обновление ABI
```

## 🔄 Полный цикл развертывания

### Base Mainnet:
```bash
make deploy-base            # Развертывание контракта
make update-abi-base        # Обновление config.js для Base
# Готово! Frontend настроен на Base
```

### Polygon Mainnet:
```bash
make deploy-polygon         # Развертывание контракта (требует POL)
make update-abi-polygon     # Обновление config.js для Polygon  
# Готово! Frontend настроен на Polygon
```

## 📋 ABI Management
```bash
make update-abi          # Обновить ABI для Base network (по умолчанию)
make update-abi-base     # Обновить ABI и config для Base network
make update-abi-polygon  # Обновить ABI и config для Polygon network

# Прямые вызовы скрипта:
node pwa/scripts/update-abi.js base     # Base network
node pwa/scripts/update-abi.js polygon  # Polygon network
```
