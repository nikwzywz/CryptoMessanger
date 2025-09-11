#!/bin/bash
source .env
forge script script/Deploy.s.sol --rpc-url base --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY --chain 8453
