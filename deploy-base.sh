#!/bin/bash

# Deploy CryptoMessenger to Base Mainnet
echo "🚀 Deploying CryptoMessenger to Base Mainnet..."

# Load environment variables
source .env

# Deploy contract
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY --chain 8453

echo "✅ Deployment completed!"

# Update ABI in config.js
echo "🔄 Updating ABI in config.js..."
node scripts/update-abi.js

echo "🎉 Deployment and ABI update completed!"
