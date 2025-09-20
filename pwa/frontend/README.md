# Web3shold - Децентрализованный мессенджер

## 🚀 Быстрый деплой

### 1. Vercel (рекомендуется)
```bash
cd pwa/frontend
npx vercel
```

### 2. Netlify
Перетащите папку `pwa/frontend` на https://netlify.com

### 3. GitHub Pages
```bash
git subtree push --prefix=pwa/frontend origin gh-pages
```

## ⚙️ Настройка сети

Перед деплоем выберите сеть:

```bash
# Base Mainnet
make update-abi-base

# Polygon Mainnet  
make update-abi-polygon
```

## 🔧 Файлы конфигурации

- `config.js` - основная конфигурация (сеть, контракт, ABI)
- `vercel.json` - настройки для Vercel
- Все зависимости включены в `lib/` (без CDN)

## 📱 Особенности

- ✅ PWA готово к установке
- ✅ Работает оффлайн (кроме блокчейн операций)
- ✅ Адаптивный дизайн для мобильных
- ✅ Локальное шифрование ECIES

## 🌐 Поддерживаемые сети

- Base Mainnet (8453)
- Polygon Mainnet (137)
- Легко расширяется на другие EVM сети
