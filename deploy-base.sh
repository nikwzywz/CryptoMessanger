#!/bin/bash

# Deploy CryptoMessenger to Base Mainnet
echo "🚀 Deploying CryptoMessenger to Base Mainnet..."

# Load environment variables
source .env

# Deploy contract
echo "📦 Deploying contract..."
DEPLOY_OUTPUT=$(forge script contracts/script/Deploy.s.sol --rpc-url base --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY --chain 8453)

echo "✅ Deployment completed!"
echo ""

# Извлекаем адрес контракта из JSON файла, созданного Foundry
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BROADCAST_FILE="$SCRIPT_DIR/contracts/broadcast/Deploy.s.sol/8453/run-latest.json"

if [ -f "$BROADCAST_FILE" ]; then
    # Извлекаем адрес контракта из JSON файла
    DEPLOYED_ADDRESS=$(grep -o '"contractAddress": "[^"]*"' "$BROADCAST_FILE" | head -1 | sed 's/"contractAddress": "//' | sed 's/"//')
    
    if [ -n "$DEPLOYED_ADDRESS" ]; then
        echo "📄 Обновляем адрес контракта в config.js: $DEPLOYED_ADDRESS"
        
        CONFIG_FILE="$SCRIPT_DIR/pwa/frontend/config.js"
        
        if [ -f "$CONFIG_FILE" ]; then
            # Используем sed для замены адреса контракта
            sed -i "s/contractAddress: '[^']*'/contractAddress: '$DEPLOYED_ADDRESS'/g" "$CONFIG_FILE"
            echo "✅ Адрес контракта обновлен в $CONFIG_FILE"
            echo "🔍 Проверяем обновление..."
            grep "contractAddress:" "$CONFIG_FILE" | head -1
        else
            echo "❌ Файл $CONFIG_FILE не найден"
        fi
    else
        echo "❌ Не удалось извлечь адрес контракта из $BROADCAST_FILE"
    fi
else
    echo "❌ Файл $BROADCAST_FILE не найден"
fi

echo ""
echo "📋 РУЧНОЕ ОБНОВЛЕНИЕ НЕОБХОДИМО:"
echo "1. Скопируйте ABI с https://basescan.org/address/$DEPLOYED_ADDRESS в abi-raw.json"
echo "2. Запустите: make update-abi-base"
echo ""
echo "🎉 Деплой завершен!"