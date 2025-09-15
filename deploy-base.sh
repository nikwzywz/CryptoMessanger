#!/bin/bash

# Deploy CryptoMessenger to Base Mainnet
echo "🚀 Deploying CryptoMessenger to Base Mainnet..."

# Load environment variables
source .env

# Deploy contract
echo "📦 Deploying contract..."
forge script contracts/script/Deploy.s.sol --rpc-url base --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY --chain 8453

echo "✅ Deployment completed!"
echo ""
echo "📋 РУЧНОЕ ОБНОВЛЕНИЕ НЕОБХОДИМО:"
echo "1. Скопируйте ABI с https://basescan.org/address/0хАдресКонтракта в abi-raw.json"
echo "2. Запустите: make update-abi"
echo "3. Проверьте, что адрес в config.js: 0хАдресКонтракта"
echo ""
echo "🎉 Деплой завершен!"