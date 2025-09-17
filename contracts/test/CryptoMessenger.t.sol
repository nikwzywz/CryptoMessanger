// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../CryptoMessenger.sol";

/**
 * @title CryptoMessengerTest V3
 * @dev Тесты для контракта CryptoMessenger архитектуры V3 с polling
 */
contract CryptoMessengerTest is Test {
    
    CryptoMessenger public cryptoMessenger;
    
    // Тестовые пользователи
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public dave = makeAddr("dave");
    
    // Тестовые данные
    string public aliceName = "Alice";
    string public bobName = "Bob";
    string public charlieName = "Charlie";
    string public daveName = "Dave";
    
    bytes public alicePublicKey = "alice_public_key_12345";
    bytes public bobPublicKey = "bob_public_key_67890";
    bytes public charliePublicKey = "charlie_public_key_abcde";
    bytes public davePublicKey = "dave_public_key_fghij";
    
    // Тестовые зашифрованные сообщения
    bytes public encryptedForRecipient = "encrypted_for_recipient_data";
    bytes public encryptedForSender = "encrypted_for_sender_data";
    
    function setUp() public {
        cryptoMessenger = new CryptoMessenger();
        
        // Настройка тестовых пользователей
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
        vm.deal(dave, 10 ether);
    }
    
    // ========================================
    // ТЕСТЫ РЕГИСТРАЦИИ ПОЛЬЗОВАТЕЛЕЙ
    // ========================================
    
    function testRegisterUser() public {
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        assertTrue(cryptoMessenger.isUserRegistered(alice));
        
        (string memory name, bytes memory publicKey, , bool isRegistered) = 
            cryptoMessenger.userSettings(alice);
        
        assertEq(name, aliceName);
        assertEq(publicKey, alicePublicKey);
        assertTrue(isRegistered);
    }
    
    function testCannotRegisterTwice() public {
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        
        vm.expectRevert("User already registered");
        cryptoMessenger.registerUser("Alice2", "different_key");
        vm.stopPrank();
    }
    
    function testCannotRegisterWithEmptyName() public {
        vm.startPrank(alice);
        vm.expectRevert("Contact name cannot be empty");
        cryptoMessenger.registerUser("", alicePublicKey);
        vm.stopPrank();
    }
    
    // ========================================
    // ТЕСТЫ СИСТЕМЫ ПРИГЛАШЕНИЙ V3
    // ========================================
    
    function testInvitationSendV3() public {
        // Регистрируем пользователей
        _registerUsers();
        
        vm.startPrank(alice);
        uint256 fee = cryptoMessenger.defaultContactRequestFee();
        cryptoMessenger.invitationSend{value: fee}(bob, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // Проверяем состояние чата
        bytes32 chatId = _generateChatId(alice, bob);
        CryptoMessenger.ChatSettings memory chat = cryptoMessenger.getChat(chatId);
        
        assertEq(uint256(chat.state), uint256(CryptoMessenger.enumChatState.waitingAcceptance));
        assertEq(chat.inviter, alice);
        assertEq(chat.invitationFee, fee);
        
        // 🆕 ПРОВЕРЯЕМ ПЕРСОНАЛЬНЫЕ МАССИВЫ СООБЩЕНИЙ
        vm.startPrank(alice);
        uint256 aliceMessagesCount = cryptoMessenger.getMessagesCount();
        assertEq(aliceMessagesCount, 1);
        vm.stopPrank();
        
        vm.startPrank(bob);
        uint256 bobMessagesCount = cryptoMessenger.getMessagesCount();
        assertEq(bobMessagesCount, 1);
        vm.stopPrank();
    }
    
    function testInvitationAcceptV3() public {
        _registerUsers();
        _sendInvitation(alice, bob);
        
        vm.startPrank(bob);
        cryptoMessenger.invitationAccept(alice, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // Проверяем состояние чата
        bytes32 chatId = _generateChatId(alice, bob);
        CryptoMessenger.ChatSettings memory chat = cryptoMessenger.getChat(chatId);
        
        assertEq(uint256(chat.state), uint256(CryptoMessenger.enumChatState.allowedWrite));
        
        // 🆕 ПРОВЕРЯЕМ ЧТО ДОБАВИЛОСЬ ПО ОДНОМУ СООБЩЕНИЮ КАЖДОМУ
        vm.startPrank(alice);
        assertEq(cryptoMessenger.getMessagesCount(), 2); // Приглашение + принятие
        vm.stopPrank();
        
        vm.startPrank(bob);
        assertEq(cryptoMessenger.getMessagesCount(), 2); // Приглашение + принятие
        vm.stopPrank();
    }
    
    function testInvitationRejectV3() public {
        _registerUsers();
        _sendInvitation(alice, bob);
        
        vm.startPrank(bob);
        cryptoMessenger.invitationReject(alice, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // Проверяем состояние чата
        bytes32 chatId = _generateChatId(alice, bob);
        CryptoMessenger.ChatSettings memory chat = cryptoMessenger.getChat(chatId);
        
        assertEq(uint256(chat.state), uint256(CryptoMessenger.enumChatState.notAllowedWrite));
    }
    
    // ========================================
    // 🆕 ТЕСТЫ ПЕРСОНАЛЬНЫХ МАССИВОВ СООБЩЕНИЙ
    // ========================================
    
    function testPersonalMessageArraysV3() public {
        _registerUsers();
        _sendInvitation(alice, bob);
        _acceptInvitation(alice, bob);
        
        // Alice отправляет сообщение Bob'у
        vm.startPrank(alice);
        cryptoMessenger.sendMessage(bob, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // 🎯 КРИТИЧЕСКИЙ ТЕСТ: Проверяем что у каждого свой массив
        vm.startPrank(alice);
        CryptoMessenger.TypeMessage[] memory aliceMessages = 
            cryptoMessenger.getMessagesPaginated(0, 100);
        vm.stopPrank();
        
        vm.startPrank(bob);
        CryptoMessenger.TypeMessage[] memory bobMessages = 
            cryptoMessenger.getMessagesPaginated(0, 100);
        vm.stopPrank();
        
        // У каждого должно быть 3 сообщения: приглашение + принятие + обычное
        assertEq(aliceMessages.length, 3);
        assertEq(bobMessages.length, 3);
        
        // 🎯 ПРОВЕРЯЕМ НАПРАВЛЕНИЕ СООБЩЕНИЙ
        // Последнее сообщение Alice (отправленное ею)
        assertTrue(aliceMessages[2].isFromMe); // Для Alice это исходящее
        assertFalse(bobMessages[2].isFromMe);  // Для Bob это входящее
        
        // 🎯 ПРОВЕРЯЕМ messIndex
        assertEq(aliceMessages[0].messIndex, 0); // Первое сообщение Alice
        assertEq(aliceMessages[1].messIndex, 1); // Второе сообщение Alice
        assertEq(aliceMessages[2].messIndex, 2); // Третье сообщение Alice
        
        assertEq(bobMessages[0].messIndex, 0); // Первое сообщение Bob
        assertEq(bobMessages[1].messIndex, 1); // Второе сообщение Bob
        assertEq(bobMessages[2].messIndex, 2); // Третье сообщение Bob
    }
    
    // ========================================
    // 🆕 ТЕСТЫ СОСТОЯНИЙ ЧАТОВ В СООБЩЕНИЯХ
    // ========================================
    
    function testChatStatesInMessagesV3() public {
        _registerUsers();
        
        // 1. Отправляем приглашение
        vm.startPrank(alice);
        uint256 fee = cryptoMessenger.defaultContactRequestFee();
        cryptoMessenger.invitationSend{value: fee}(bob, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // Проверяем состояние в сообщении
        vm.startPrank(alice);
        CryptoMessenger.TypeMessage[] memory aliceMessages = 
            cryptoMessenger.getMessagesPaginated(0, 0);
        assertEq(uint256(aliceMessages[0].newChatState), uint256(CryptoMessenger.enumChatState.waitingAcceptance));
        vm.stopPrank();
        
        // 2. Принимаем приглашение
        vm.startPrank(bob);
        cryptoMessenger.invitationAccept(alice, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // Проверяем состояние в сообщении принятия
        vm.startPrank(bob);
        CryptoMessenger.TypeMessage[] memory bobMessages = 
            cryptoMessenger.getMessagesPaginated(0, 1);
        assertEq(uint256(bobMessages[1].newChatState), uint256(CryptoMessenger.enumChatState.allowedWrite));
        vm.stopPrank();
        
        // 3. Отправляем обычное сообщение
        vm.startPrank(alice);
        cryptoMessenger.sendMessage(bob, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // Проверяем состояние в обычном сообщении
        vm.startPrank(alice);
        aliceMessages = cryptoMessenger.getMessagesPaginated(0, 2);
        assertEq(uint256(aliceMessages[2].newChatState), uint256(CryptoMessenger.enumChatState.allowedWrite));
        vm.stopPrank();
    }
    
    // ========================================
    // 🆕 ТЕСТЫ ПАГИНАЦИИ V3
    // ========================================
    
    function testMessagesPaginationV3() public {
        _registerUsers();
        _sendInvitation(alice, bob);
        _acceptInvitation(alice, bob);
        
        // Отправляем несколько сообщений
        vm.startPrank(alice);
        for (uint i = 0; i < 5; i++) {
            cryptoMessenger.sendMessage(bob, encryptedForRecipient, encryptedForSender);
        }
        vm.stopPrank();
        
        // Всего должно быть 7 сообщений: приглашение + принятие + 5 обычных
        vm.startPrank(alice);
        assertEq(cryptoMessenger.getMessagesCount(), 7);
        
        // 🎯 ТЕСТ ПАГИНАЦИИ: Получаем первые 3 сообщения
        CryptoMessenger.TypeMessage[] memory firstThree = 
            cryptoMessenger.getMessagesPaginated(0, 2);
        assertEq(firstThree.length, 3);
        assertEq(firstThree[0].messIndex, 0);
        assertEq(firstThree[2].messIndex, 2);
        
        // 🎯 ТЕСТ ПАГИНАЦИИ: Получаем последние 2 сообщения
        CryptoMessenger.TypeMessage[] memory lastTwo = 
            cryptoMessenger.getMessagesPaginated(5, 6);
        assertEq(lastTwo.length, 2);
        assertEq(lastTwo[0].messIndex, 5);
        assertEq(lastTwo[1].messIndex, 6);
        
        // 🎯 ТЕСТ ПАГИНАЦИИ: Получаем все сообщения (большой endIndex)
        CryptoMessenger.TypeMessage[] memory allMessages = 
            cryptoMessenger.getMessagesPaginated(0, 1000); // Большое число
        assertEq(allMessages.length, 7); // Должно вернуть все 7
        vm.stopPrank();
    }
    
    function testContactsPaginationV3() public {
        _registerUsers();
        
        // Alice добавляет контакты
        vm.startPrank(alice);
        uint256 fee = cryptoMessenger.defaultContactRequestFee();
        cryptoMessenger.invitationSend{value: fee}(bob, encryptedForRecipient, encryptedForSender);
        cryptoMessenger.invitationSend{value: fee}(charlie, encryptedForRecipient, encryptedForSender);
        cryptoMessenger.invitationSend{value: fee}(dave, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // 🎯 ТЕСТ ПАГИНАЦИИ КОНТАКТОВ
        vm.startPrank(alice);
        assertEq(cryptoMessenger.getContactsCount(), 3);
        
        // Получаем первые 2 контакта (endIndex включительный)
        (address[] memory firstTwo, string[] memory names1, ) = 
            cryptoMessenger.getContactsPaginated(0, 1);
        assertEq(firstTwo.length, 2);
        assertEq(firstTwo[0], bob);
        assertEq(firstTwo[1], charlie);
        assertEq(names1[0], bobName);
        assertEq(names1[1], charlieName);
        
        // Получаем последний контакт
        (address[] memory lastOne, string[] memory names2, ) = 
            cryptoMessenger.getContactsPaginated(2, 2);
        assertEq(lastOne.length, 1);
        assertEq(lastOne[0], dave);
        assertEq(names2[0], daveName);
        vm.stopPrank();
    }
    
    // ========================================
    // 🆕 ТЕСТ POLLING ЭФФЕКТИВНОСТИ
    // ========================================
    
    function testPollingEfficiencyV3() public {
        _registerUsers();
        
        // Создаем сообщения от разных пользователей к Alice
        vm.startPrank(bob);
        uint256 fee = cryptoMessenger.defaultContactRequestFee();
        cryptoMessenger.invitationSend{value: fee}(alice, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        vm.startPrank(charlie);
        cryptoMessenger.invitationSend{value: fee}(alice, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // 🎯 КРИТИЧЕСКИЙ ТЕСТ: Alice получает ВСЕ сообщения одним запросом
        vm.startPrank(alice);
        CryptoMessenger.TypeMessage[] memory allAliceMessages = 
            cryptoMessenger.getMessagesPaginated(0, 100);
        
        // Alice должна получить 2 приглашения от разных пользователей
        assertEq(allAliceMessages.length, 2);
        
        // Проверяем что сообщения от разных чатов
        assertTrue(allAliceMessages[0].chatID != allAliceMessages[1].chatID);
        
        // Оба сообщения входящие для Alice
        assertFalse(allAliceMessages[0].isFromMe);
        assertFalse(allAliceMessages[1].isFromMe);
        vm.stopPrank();
        
        // 🎯 ЭМУЛЯЦИЯ POLLING: Получаем только новые сообщения
        vm.startPrank(dave);
        cryptoMessenger.invitationSend{value: fee}(alice, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // Alice получает только сообщения после индекса 1 (новые)
        vm.startPrank(alice);
        CryptoMessenger.TypeMessage[] memory newMessages = 
            cryptoMessenger.getMessagesPaginated(2, 100); // Начиная с индекса 2
        
        assertEq(newMessages.length, 1); // Только одно новое сообщение от Dave
        assertEq(newMessages[0].messIndex, 2);
        vm.stopPrank();
    }
    
    // ========================================
    // ТЕСТЫ ГРАНИЧНЫХ СЛУЧАЕВ
    // ========================================
    
    function testEmptyMessageArrays() public {
        _registerUsers();
        
        // Пользователь без сообщений
        vm.startPrank(alice);
        assertEq(cryptoMessenger.getMessagesCount(), 0);
        
        CryptoMessenger.TypeMessage[] memory emptyMessages = 
            cryptoMessenger.getMessagesPaginated(0, 100);
        assertEq(emptyMessages.length, 0);
        vm.stopPrank();
    }
    
    function testEmptyContactsArray() public {
        _registerUsers();
        
        // Пользователь без контактов
        vm.startPrank(alice);
        assertEq(cryptoMessenger.getContactsCount(), 0);
        
        (address[] memory emptyContacts, string[] memory emptyNames, ) = 
            cryptoMessenger.getContactsPaginated(0, 100);
        assertEq(emptyContacts.length, 0);
        assertEq(emptyNames.length, 0);
        vm.stopPrank();
    }
    
    function testPaginationBoundaries() public {
        _registerUsers();
        _sendInvitation(alice, bob);
        
        vm.startPrank(alice);
        // Тест на граничные значения пагинации
        vm.expectRevert("Start index out of bounds");
        cryptoMessenger.getMessagesPaginated(10, 15); // startIndex > length
        
        // Тест корректного поведения при endIndex > length
        CryptoMessenger.TypeMessage[] memory messages = 
            cryptoMessenger.getMessagesPaginated(0, 1000); // endIndex больше length
        assertEq(messages.length, 1); // Должно вернуть только существующие
        vm.stopPrank();
    }
    
    // ========================================
    // 🆕 ТЕСТЫ ENUM СОСТОЯНИЙ
    // ========================================
    
    function testEnumChatStatesV3() public {
        _registerUsers();
        bytes32 chatId = _generateChatId(alice, bob);
        
        // Изначально чат не существует (inviter = address(0))
        CryptoMessenger.ChatSettings memory initialChat = cryptoMessenger.getChat(chatId);
        assertEq(initialChat.inviter, address(0));
        
        // 1. Отправляем приглашение -> waitingAcceptance
        _sendInvitation(alice, bob);
        CryptoMessenger.ChatSettings memory waitingChat = cryptoMessenger.getChat(chatId);
        assertEq(uint256(waitingChat.state), uint256(CryptoMessenger.enumChatState.waitingAcceptance));
        
        // 2. Принимаем приглашение -> allowedWrite
        _acceptInvitation(alice, bob);
        CryptoMessenger.ChatSettings memory activeChat = cryptoMessenger.getChat(chatId);
        assertEq(uint256(activeChat.state), uint256(CryptoMessenger.enumChatState.allowedWrite));
        
        // 3. Деактивируем чат -> notAllowedWrite
        vm.startPrank(alice);
        cryptoMessenger.deactivateChat(bob, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        CryptoMessenger.ChatSettings memory deactivatedChat = cryptoMessenger.getChat(chatId);
        assertEq(uint256(deactivatedChat.state), uint256(CryptoMessenger.enumChatState.notAllowedWrite));
    }
    
    // ========================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ========================================
    
    function _registerUsers() internal {
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        vm.startPrank(charlie);
        cryptoMessenger.registerUser(charlieName, charliePublicKey);
        vm.stopPrank();
        
        vm.startPrank(dave);
        cryptoMessenger.registerUser(daveName, davePublicKey);
        vm.stopPrank();
    }
    
    function _sendInvitation(address from, address to) internal {
        vm.startPrank(from);
        uint256 fee = cryptoMessenger.defaultContactRequestFee();
        cryptoMessenger.invitationSend{value: fee}(to, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
    }
    
    function _acceptInvitation(address inviter, address accepter) internal {
        vm.startPrank(accepter);
        cryptoMessenger.invitationAccept(inviter, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
    }
    
    function _generateChatId(address addr1, address addr2) internal pure returns (bytes32) {
        (address smaller, address larger) = addr1 < addr2 ? (addr1, addr2) : (addr2, addr1);
        return keccak256(abi.encodePacked(smaller, larger));
    }
}