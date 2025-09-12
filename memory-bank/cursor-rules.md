# Постоянные правила Cursor для CryptoMessenger

## 🚫 НЕ ДУБЛИРОВАТЬ ABI
- **ВСЕГДА** используй `frontend/config.js` для импорта ABI контракта
- **НИКОГДА** не дублируй ABI в каждом файле
- Все скрипты должны импортировать ABI из `window.CryptoMessengerConfig.contractABI`

## 📁 Структура проекта
- `frontend/config.js` - единственный источник конфигурации (адрес контракта, ABI, сеть)
- `scripts/` - скрипты для автоматизации (деплой, обновление ABI, тестовые данные)
- `contracts/` - смарт-контракты Solidity
- `memory-bank/` - документация и планы проекта

## 🔧 Принципы разработки
1. **DRY (Don't Repeat Yourself)** - не дублируй код
2. **Single Source of Truth** - один источник правды для конфигурации
3. **Централизованная конфигурация** - все настройки в `config.js`
4. **Автоматизация** - используй Makefile для повторяющихся задач

## 📝 Импорт конфигурации в скриптах
```javascript
// Правильно - импорт из config.js
const configPath = path.join(__dirname, '..', 'frontend', 'config.js');
const configContent = fs.readFileSync(configPath, 'utf8');
const configMatch = configContent.match(/window\.CryptoMessengerConfig\s*=\s*({[\s\S]*?});/);
const config = eval('(' + configMatch[1] + ')');
const CONTRACT_ADDRESS = config.contractAddress;
const CONTRACT_ABI = config.contractABI;
```

## ❌ НЕ ДЕЛАЙ ТАК
```javascript
// Неправильно - дублирование ABI
const CONTRACT_ABI = [
    {"inputs": [...], "name": "registerPublicKey", ...},
    // ... много строк ABI
];
```

## ✅ ДЕЛАЙ ТАК
```javascript
// Правильно - импорт из config.js
const CONTRACT_ABI = config.contractABI;
```

## 🎯 Цель
Поддерживать проект в чистом состоянии, избегать дублирования кода и упростить обновления конфигурации.
