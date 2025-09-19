#!/bin/bash

# Deploy CryptoMessenger to Polygon Mainnet
echo "🚀 Deploying CryptoMessenger to Polygon Mainnet..."

# Load environment variables
source .env

# Check wallet balance first
echo "💰 Проверяем баланс кошелька..."
WALLET_ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY_01)
BALANCE_WEI=$(cast balance $WALLET_ADDRESS --rpc-url polygon)
BALANCE_MATIC=$(cast from-wei $BALANCE_WEI)

echo "📍 Кошелек: $WALLET_ADDRESS"
echo "💎 Баланс: $BALANCE_MATIC POL"

# Check if balance is sufficient (need ~0.11 POL for deployment)
# Use awk for floating point comparison, ensuring proper number format
REQUIRED_MATIC="0.1"
BALANCE_CHECK=$(awk -v bal="$BALANCE_MATIC" -v req="$REQUIRED_MATIC" 'BEGIN {print (bal < req)}')
if [ "$BALANCE_CHECK" -eq 1 ]; then
    echo "❌ Недостаточно средств для развертывания!"
    echo "💡 Необходимо: ~0.11 POL"
    echo "📝 Пополните кошелек $WALLET_ADDRESS в сети Polygon"
    echo "🔗 Можно получить POL на https://wallet.polygon.technology/faucet"
    echo ""
    echo "⚠️  Развертывание будет продолжено, но может завершиться ошибкой..."
    echo ""
fi

# Deploy contract
echo "📦 Deploying contract..."
DEPLOY_OUTPUT=$(forge script contracts/script/Deploy.s.sol --rpc-url polygon --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY --chain 137)

echo "✅ Deployment completed!"
echo ""

# Извлекаем адрес контракта из JSON файла, созданного Foundry
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BROADCAST_FILE="$SCRIPT_DIR/contracts/broadcast/Deploy.s.sol/137/run-latest.json"

if [ -f "$BROADCAST_FILE" ]; then
    # Извлекаем адрес контракта из JSON файла
    DEPLOYED_ADDRESS=$(grep -o '"contractAddress": "[^"]*"' "$BROADCAST_FILE" | head -1 | sed 's/"contractAddress": "//' | sed 's/"//')
    
    if [ -n "$DEPLOYED_ADDRESS" ]; then
        echo "📄 Обновляем адрес контракта в config.js: $DEPLOYED_ADDRESS"
        
        CONFIG_FILE="$SCRIPT_DIR/pwa/frontend/config.js"
        
        if [ -f "$CONFIG_FILE" ]; then
            echo "⚠️  ВНИМАНИЕ: config.js настроен для Base network"
            echo "📄 Deployed contract address: $DEPLOYED_ADDRESS"
            echo "🔍 View on PolygonScan: https://polygonscan.com/address/$DEPLOYED_ADDRESS"
            echo ""
            echo "📋 Для использования в Polygon нужно:"
            echo "   1. Изменить network.chainId на '0x89' (137 в hex)"
            echo "   2. Изменить network.chainName на 'Polygon'"
            echo "   3. Изменить rpcUrls на ['https://polygon-rpc.com']"
            echo "   4. Изменить blockExplorerUrls на ['https://polygonscan.com']"
            echo "   5. Обновить contractAddress на '$DEPLOYED_ADDRESS'"
        else
            echo "❌ Файл $CONFIG_FILE не найден"
            echo "📄 Deployed contract address: $DEPLOYED_ADDRESS"
            echo "🔍 View on PolygonScan: https://polygonscan.com/address/$DEPLOYED_ADDRESS"
        fi
    else
        echo "❌ Не удалось извлечь адрес контракта из $BROADCAST_FILE"
    fi
else
    echo "❌ Файл $BROADCAST_FILE не найден"
fi

echo ""
echo "📋 РУЧНОЕ ОБНОВЛЕНИЕ НЕОБХОДИМО:"
echo "1. Скопируйте ABI с https://polygonscan.com/address/$DEPLOYED_ADDRESS в abi-raw.json"
echo "2. Запустите: make update-abi-polygon"
echo ""
echo "🎉 Деплой завершен!"
