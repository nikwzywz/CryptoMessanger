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

### 🔄 Переключение между сетями
###  + актуализация ABI в Config
Frontend автоматически адаптируется к сети из `config.js`. Для переключения:
```bash
make update-abi-base     # Переключение на Base + обновление ABI
make update-abi-polygon  # Переключение на Polygon + обновление ABI
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

# Прямые вызовы скрипта:
node pwa/scripts/update-abi.js base     # Base network
node pwa/scripts/update-abi.js polygon  # Polygon network
```

## 🌐 Frontend Deployment

### Самые простые способы:
```bash
make deploy-frontend-vercel    # Автоматический деплой на Vercel
make deploy-frontend-netlify   # Подготовка для Netlify (drag & drop)
```

### Альтернативные способы:
```bash
# GitHub Pages
git subtree push --prefix=pwa/frontend origin gh-pages

# IPFS (децентрализованно)
npx ipfs-deploy pwa/frontend

# Локальный сервер (для тестирования)
cd pwa/frontend && python3 -m http.server 8080
```
