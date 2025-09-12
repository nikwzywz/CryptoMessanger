// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../CryptoMessenger.sol";

/**
 * @title Deploy
 * @dev Скрипт развертывания контракта CryptoMessenger
 */
contract Deploy is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_01");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with the account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Развертывание основного контракта
        CryptoMessenger cryptoMessenger = new CryptoMessenger();
        
        vm.stopBroadcast();
        
        console.log("CryptoMessenger deployed to:", address(cryptoMessenger));
        
        // Сохраняем адрес контракта в файл для использования в frontend
        string memory contractAddress = vm.toString(address(cryptoMessenger));
        
        console.log("Contract address:", contractAddress);
        console.log("Deployment completed successfully!");
    }
}
