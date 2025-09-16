// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../CryptoMessenger.sol";

/**
 * @title CryptoMessengerTest
 * @dev Тесты для контракта CryptoMessenger (новая версия с чатами)
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
        assertEq(cryptoMessenger.getContactName(alice), aliceName);
        assertEq(cryptoMessenger.getPublicKey(alice), alicePublicKey);
        
        CryptoMessenger.UserSettings memory settings = cryptoMessenger.getUserSettings(alice);
        assertEq(settings.contactName, aliceName);
        assertEq(settings.publicKeyForEncode, alicePublicKey);
        assertTrue(settings.isRegistered);
    }
    
    function testCannotRegisterTwice() public {
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(alice);
        vm.expectRevert("User already registered");
        cryptoMessenger.registerUser("Alice2", alicePublicKey);
        vm.stopPrank();
    }
    
    function testRegisterUserValidation() public {
        vm.startPrank(alice);
        
        // Пустое имя
        vm.expectRevert("Contact name cannot be empty");
        cryptoMessenger.registerUser("", alicePublicKey);
        
        // Слишком длинное имя
        string memory longName = "This is a very long contact name that exceeds the maximum allowed length of 50 characters";
        vm.expectRevert("Contact name too long");
        cryptoMessenger.registerUser(longName, alicePublicKey);
        
        // Пустой публичный ключ
        vm.expectRevert("Public key cannot be empty");
        cryptoMessenger.registerUser(aliceName, "");
        
        vm.stopPrank();
    }
    
    function testSetContactName() public {
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        
        string memory newName = "AliceUpdated";
        cryptoMessenger.setContactName(newName);
        vm.stopPrank();
        
        assertEq(cryptoMessenger.getContactName(alice), newName);
    }
    
    function testSetContactNameValidation() public {
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        
        // Пустое имя
        vm.expectRevert("Contact name cannot be empty");
        cryptoMessenger.setContactName("");
        
        // Слишком длинное имя
        string memory longName = "This is a very long contact name that exceeds the maximum allowed length of 50 characters";
        vm.expectRevert("Contact name too long");
        cryptoMessenger.setContactName(longName);
        
        vm.stopPrank();
    }
    
    // ========================================
    // ТЕСТЫ СИСТЕМЫ ПРИГЛАШЕНИЙ В ЧАТЫ
    // ========================================
    
    function testSendChatInvitation() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Alice отправляет приглашение Bob
        uint256 invitationFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        uint256 aliceBalanceBefore = alice.balance;
        
        vm.startPrank(alice);
        cryptoMessenger.invitationSend{value: invitationFee}(
            bob,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
        
        // Проверяем, что чат создан
        bytes32 chatId = cryptoMessenger.getChatId(alice, bob);
        assertTrue(chatId != bytes32(0));
        
        CryptoMessenger.Chat memory chat = cryptoMessenger.getChat(chatId);
        assertTrue(chat.isNeedAcceptance);
        assertFalse(chat.isActive);
        assertEq(chat.inviter, alice);
        assertEq(chat.invitationFee, invitationFee);
        assertEq(chat.messageCount, 1); // Первое сообщение добавлено
        
        // Проверяем, что средства списаны
        assertEq(alice.balance, aliceBalanceBefore - invitationFee);
    }
    
    function testAcceptChatInvitation() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Alice отправляет приглашение Bob
        uint256 invitationFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        uint256 aliceBalanceBefore = alice.balance;
        
        vm.startPrank(alice);
        cryptoMessenger.invitationSend{value: invitationFee}(
            bob,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
        
        // Bob принимает приглашение
        vm.startPrank(bob);
        cryptoMessenger.invitationAccept(alice);
        vm.stopPrank();
        
        // Проверяем, что чат активен
        bytes32 chatId = cryptoMessenger.getChatId(alice, bob);
        assertTrue(cryptoMessenger.getChat(chatId).isActive);
        
        // Проверяем, что чат активирован
        CryptoMessenger.Chat memory chat = cryptoMessenger.getChat(chatId);
        assertTrue(chat.isActive);
        assertFalse(chat.isNeedAcceptance);
        
        // Проверяем, что средства возвращены Alice
        assertEq(alice.balance, aliceBalanceBefore);
    }
    
    function testRejectChatInvitation() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Alice отправляет приглашение Bob
        uint256 invitationFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        uint256 bobBalanceBefore = bob.balance;
        
        vm.startPrank(alice);
        cryptoMessenger.invitationSend{value: invitationFee}(
            bob,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
        
        // Bob отклоняет приглашение
        vm.startPrank(bob);
        cryptoMessenger.invitationReject(alice);
        vm.stopPrank();
        
        // Проверяем, что контакт остается (контакт не исчезает)
        assertTrue(cryptoMessenger.checkContact(alice, bob));
        
        // Проверяем, что средства получены Bob
        assertEq(bob.balance, bobBalanceBefore + invitationFee);
        
        // Проверяем, что чат деактивирован
        bytes32 chatId = cryptoMessenger.getChatId(alice, bob);
        CryptoMessenger.Chat memory chat = cryptoMessenger.getChat(chatId);
        assertFalse(chat.isActive);
        assertFalse(chat.isNeedAcceptance);
    }
    
    function testCancelChatInvitation() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Alice отправляет приглашение Bob
        uint256 invitationFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        uint256 aliceBalanceBefore = alice.balance;
        
        vm.startPrank(alice);
        cryptoMessenger.invitationSend{value: invitationFee}(
            bob,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
        
        // Перематываем время на 3 дня + 1 секунда
        vm.warp(block.timestamp + 3 days + 1);
        
        // Alice отзывает приглашение
        vm.startPrank(alice);
        cryptoMessenger.invitationCancel(bob);
        vm.stopPrank();
        
        // Проверяем, что контакт остается (контакт не исчезает)
        assertTrue(cryptoMessenger.checkContact(alice, bob));
        
        // Проверяем, что средства возвращены Alice
        assertEq(alice.balance, aliceBalanceBefore);
    }
    
    function testCannotCancelInvitationBeforeTimeout() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Alice отправляет приглашение Bob
        uint256 invitationFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        
        vm.startPrank(alice);
        cryptoMessenger.invitationSend{value: invitationFee}(
            bob,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
        
        // Alice пытается отозвать приглашение раньше времени
        vm.startPrank(alice);
        vm.expectRevert("Invitation timeout not reached");
        cryptoMessenger.invitationCancel(bob);
        vm.stopPrank();
    }
    
    // ========================================
    // ТЕСТЫ ОТПРАВКИ СООБЩЕНИЙ
    // ========================================
    
    function testSendMessage() public {
        // Регистрируем пользователей и создаем чат
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Создаем активный чат
        _createActiveChat(alice, bob);
        
        // Alice отправляет сообщение Bob
        vm.startPrank(alice);
        cryptoMessenger.sendMessage(bob, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // Проверяем, что сообщение добавлено
        bytes32 chatId = cryptoMessenger.getChatId(alice, bob);
        (uint256 messageCount, CryptoMessenger.ChatMessage[] memory messages) = cryptoMessenger.getChatMessages(chatId);
        assertEq(messageCount, 2); // Первое сообщение + новое
        assertEq(messages[1].messageTimestamp, block.timestamp);
    }
    
    function testCannotSendMessageWithoutContact() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Alice пытается отправить сообщение без контакта
        vm.startPrank(alice);
        vm.expectRevert("Chat not found");
        cryptoMessenger.sendMessage(bob, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
    }
    
    function testCannotSendMessageToInactiveChat() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Alice отправляет приглашение, но Bob отклоняет
        uint256 invitationFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        
        vm.startPrank(alice);
        cryptoMessenger.invitationSend{value: invitationFee}(
            bob,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.invitationReject(alice);
        vm.stopPrank();
        
        // Alice пытается отправить сообщение в неактивный чат
        vm.startPrank(alice);
        vm.expectRevert("Chat is not active");
        cryptoMessenger.sendMessage(bob, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
    }
    
    // ========================================
    // ТЕСТЫ ПАГИНАЦИИ
    // ========================================
    
    function testGetUserContactsPaginated() public {
        // Регистрируем пользователей
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
        
        // Создаем контакты
        _createActiveChat(alice, bob);
        _createActiveChat(alice, charlie);
        _createActiveChat(alice, dave);
        
        // Тестируем получение всех контактов
        address[] memory allContacts = cryptoMessenger.getContacts(alice);
        assertEq(allContacts.length, 3);
        
        // Тестируем пагинацию с деталями
        (address[] memory firstTwo, , ) = cryptoMessenger.getContactsWithDetailsPaginated(alice, 0, 2);
        assertEq(firstTwo.length, 2);
        
        (address[] memory lastOne, , ) = cryptoMessenger.getContactsWithDetailsPaginated(alice, 2, 0);
        assertEq(lastOne.length, 1);
    }
    
    function testGetUserContactsWithDetailsPaginated() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Создаем контакт
        _createActiveChat(alice, bob);
        
        // Тестируем получение деталей
        (
            address[] memory contacts,
            string[] memory names,
            bytes[] memory publicKeys
        ) = cryptoMessenger.getContactsWithDetailsPaginated(alice, 0, 0);
        
        assertEq(contacts.length, 1);
        assertEq(contacts[0], bob);
        assertEq(names[0], bobName);
        assertEq(publicKeys[0], bobPublicKey);
    }
    
    function testGetChatMessagesPaginated() public {
        // Регистрируем пользователей и создаем чат
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        _createActiveChat(alice, bob);
        
        // Отправляем несколько сообщений
        for (uint256 i = 0; i < 5; i++) {
            vm.startPrank(alice);
            cryptoMessenger.sendMessage(bob, encryptedForRecipient, encryptedForSender);
            vm.stopPrank();
        }
        
        bytes32 chatId = cryptoMessenger.getChatId(alice, bob);
        
        // Тестируем пагинацию сообщений
        CryptoMessenger.ChatMessage[] memory allMessages = cryptoMessenger.getChatMessagesPaginated(chatId, 0, 0);
        assertEq(allMessages.length, 6); // Первое + 5 новых
        
        CryptoMessenger.ChatMessage[] memory firstThree = cryptoMessenger.getChatMessagesPaginated(chatId, 0, 3);
        assertEq(firstThree.length, 3);
        
        CryptoMessenger.ChatMessage[] memory lastTwo = cryptoMessenger.getChatMessagesPaginated(chatId, 4, 0);
        assertEq(lastTwo.length, 2);
    }
    
    // ========================================
    // ТЕСТЫ УДАЛЕНИЯ КОНТАКТОВ
    // ========================================
    
    function testDeactivateContact() public {
        // Регистрируем пользователей и создаем чат
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        _createActiveChat(alice, bob);
        
        // Bob деактивирует чат с Alice
        vm.startPrank(bob);
        cryptoMessenger.deactivateContact(alice);
        vm.stopPrank();
        
        // Проверяем, что чат деактивирован
        bytes32 chatId = cryptoMessenger.getChatId(alice, bob);
        CryptoMessenger.Chat memory chat = cryptoMessenger.getChat(chatId);
        assertFalse(chat.isActive);
    }
    
    // ========================================
    // ТЕСТЫ ГРАНИЧНЫХ СЛУЧАЕВ
    // ========================================
    
    function testPaginationEdgeCases() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        _createActiveChat(alice, bob);
        
        // Тестируем некорректные индексы
        vm.expectRevert("Start index out of bounds");
        cryptoMessenger.getContactsWithDetailsPaginated(alice, 2, 0);
        
        vm.expectRevert("End index out of bounds");
        cryptoMessenger.getContactsWithDetailsPaginated(alice, 0, 2);
        
        // startIndex = 1, endIndex = 1 - валидный диапазон (пустой результат)
        (address[] memory emptyResult, , ) = cryptoMessenger.getContactsWithDetailsPaginated(alice, 1, 1);
        assertEq(emptyResult.length, 0);
    }
    
    function testCannotInteractWithSelf() public {
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        
        // Нельзя отправить приглашение самому себе
        vm.expectRevert("Cannot interact with self");
        cryptoMessenger.invitationSend{value: 0.001 ether}(
            alice,
            encryptedForRecipient,
            encryptedForSender
        );
        
        // Нельзя отправить сообщение самому себе
        vm.expectRevert("Cannot interact with self");
        cryptoMessenger.sendMessage(alice, encryptedForRecipient, encryptedForSender);
        
        vm.stopPrank();
    }
    
    // ========================================
    // ТЕСТЫ ПОЛНОГО ЖИЗНЕННОГО ЦИКЛА ЧАТА
    // ========================================
    
    function testFullChatLifecycle() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // ЭТАП 1: Alice создает приглашение Bob
        uint256 invitationFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        
        vm.startPrank(alice);
        cryptoMessenger.invitationSend{value: invitationFee}(
            bob,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
        
        // Проверяем, что приглашение создано
        bytes32 chatId = cryptoMessenger.getChatId(alice, bob);
        assertTrue(chatId != bytes32(0));
        assertTrue(cryptoMessenger.getChat(chatId).isNeedAcceptance);
        
        // ЭТАП 2: Bob принимает приглашение
        vm.startPrank(bob);
        cryptoMessenger.invitationAccept(alice);
        vm.stopPrank();
        
        // Проверяем, что чат активен
        assertTrue(cryptoMessenger.getChat(chatId).isActive);
        
        // ЭТАП 3: Они общаются
        vm.startPrank(alice);
        cryptoMessenger.sendMessage(bob, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.sendMessage(alice, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // Проверяем, что сообщения добавлены
        (uint256 messageCount, ) = cryptoMessenger.getChatMessages(chatId);
        assertEq(messageCount, 3); // Первое сообщение + 2 новых
        
        // ЭТАП 4: Alice разрывает контакт
        vm.startPrank(alice);
        cryptoMessenger.deactivateContact(bob);
        vm.stopPrank();
        
        // Проверяем, что чат неактивен (контакты остаются в списке)
        assertFalse(cryptoMessenger.getChat(chatId).isActive);
        
        // ЭТАП 5: Bob пытается написать - не получается
        vm.startPrank(bob);
        vm.expectRevert("Chat is not active");
        cryptoMessenger.sendMessage(alice, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // ЭТАП 6: Alice тоже не может написать
        vm.startPrank(alice);
        vm.expectRevert("Chat is not active");
        cryptoMessenger.sendMessage(bob, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // ЭТАП 7: Bob увеличивает свою комиссию и создает новое приглашение Alice
        vm.startPrank(bob);
        uint256 newInvitationFee = 0.002 ether; // Увеличиваем комиссию Боба
        cryptoMessenger.setContactRequestFee(newInvitationFee);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.invitationSend{value: newInvitationFee}(
            alice,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
        
        // Проверяем, что новое приглашение создано (используется тот же chatId)
        bytes32 newChatId = cryptoMessenger.getChatId(bob, alice);
        assertTrue(newChatId != bytes32(0));
        assertEq(newChatId, chatId); // Тот же ID, так как адреса те же
        assertTrue(cryptoMessenger.getChat(newChatId).isNeedAcceptance);
        
        // Проверяем, что invitationFee обновился на новую сумму (комиссия Боба)
        assertEq(cryptoMessenger.getChat(newChatId).invitationFee, newInvitationFee);
        
        // Проверяем, что комиссия Боба действительно изменилась
        assertEq(cryptoMessenger.getUserSettings(bob).contactRequestFee, newInvitationFee);
        
        // ЭТАП 8: Alice принимает новое приглашение
        vm.startPrank(alice);
        cryptoMessenger.invitationAccept(bob);
        vm.stopPrank();
        
        // Проверяем, что чат снова активен
        assertTrue(cryptoMessenger.getChat(newChatId).isActive);
        
        // ЭТАП 9: Они снова могут общаться
        vm.startPrank(alice);
        cryptoMessenger.sendMessage(bob, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.sendMessage(alice, encryptedForRecipient, encryptedForSender);
        vm.stopPrank();
        
        // Проверяем, что новые сообщения добавлены (всего 3: 1 новое + 2 новых)
        (uint256 newMessageCount, ) = cryptoMessenger.getChatMessages(newChatId);
        assertEq(newMessageCount, 6); // 1 приглашение + 2 сообщения + 1 приглашение + 2 сообщения
        
        // Проверяем, что чат теперь активен (переиспользуется тот же чат)
        assertTrue(cryptoMessenger.getChat(chatId).isActive);
        
        // Проверяем, что в списке контактов есть контакт (контакты остаются в массивах после разрыва)
        address[] memory aliceContacts = cryptoMessenger.getContacts(alice);
        assertEq(aliceContacts.length, 1);
        assertEq(aliceContacts[0], bob);
        
        address[] memory bobContacts = cryptoMessenger.getContacts(bob);
        assertEq(bobContacts.length, 1);
        assertEq(bobContacts[0], alice);
    }
    
    // ========================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ========================================
    // ТЕСТЫ ПРОВЕРКИ СИСТЕМЫ КОНТАКТОВ
    // ========================================
    
    function testCheckContactAfterInvitationAccept() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Проверяем, что изначально контакта нет
        assertFalse(cryptoMessenger.checkContact(alice, bob));
        
        // Alice отправляет приглашение Bob
        uint256 invitationFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        
        vm.startPrank(alice);
        cryptoMessenger.invitationSend{value: invitationFee}(
            bob,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
        
        // Проверяем, что после отправки приглашения контакт уже есть
        assertTrue(cryptoMessenger.checkContact(alice, bob));
        
        // Bob принимает приглашение
        vm.startPrank(bob);
        cryptoMessenger.invitationAccept(alice);
        vm.stopPrank();
        
        // Проверяем, что после принятия приглашения контакт установлен
        assertTrue(cryptoMessenger.checkContact(alice, bob));
        assertTrue(cryptoMessenger.checkContact(bob, alice)); // Должно работать в обе стороны
        
        // Проверяем, что чат активен
        bytes32 chatId = cryptoMessenger.getChatId(alice, bob);
        assertTrue(cryptoMessenger.getChat(chatId).isActive);
    }
    
    function testCheckContactAfterDeactivation() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Создаем активный чат
        _createActiveChat(alice, bob);
        
        // Проверяем, что контакт установлен
        assertTrue(cryptoMessenger.checkContact(alice, bob));
        
        // Alice деактивирует чат
        vm.startPrank(alice);
        cryptoMessenger.deactivateContact(bob);
        vm.stopPrank();
        
        // Проверяем, что контакт ОСТАЕТСЯ (контакт не исчезает)
        assertTrue(cryptoMessenger.checkContact(alice, bob));
        assertTrue(cryptoMessenger.checkContact(bob, alice));
        
        // Проверяем, что чат стал неактивным (нельзя писать сообщения)
        bytes32 chatId = cryptoMessenger.getChatId(alice, bob);
        assertFalse(cryptoMessenger.getChat(chatId).isActive);
    }
    
    // ========================================
    
    function _createActiveChat(address user1, address user2) internal {
        uint256 invitationFee = cryptoMessenger.getUserSettings(user2).contactRequestFee;
        
        vm.startPrank(user1);
        cryptoMessenger.invitationSend{value: invitationFee}(
            user2,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
        
        vm.startPrank(user2);
        cryptoMessenger.invitationAccept(user1);
        vm.stopPrank();
    }
    
    /**
     * @dev Тест: нельзя отправить второе приглашение, если первое еще ожидает принятия
     */
    function testCannotSendDuplicateInvitationWhilePending() public {
        // Регистрируем пользователей
        vm.startPrank(alice);
        cryptoMessenger.registerUser(aliceName, alicePublicKey);
        vm.stopPrank();
        
        vm.startPrank(bob);
        cryptoMessenger.registerUser(bobName, bobPublicKey);
        vm.stopPrank();
        
        // Alice отправляет первое приглашение Bob
        uint256 invitationFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        
        vm.startPrank(alice);
        cryptoMessenger.invitationSend{value: invitationFee}(
            bob,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
        
        // Проверяем, что чат создан и ожидает принятия
        bytes32 chatId = cryptoMessenger.getChatId(alice, bob);
        CryptoMessenger.Chat memory chat = cryptoMessenger.getChat(chatId);
        assertTrue(chat.isNeedAcceptance);
        assertFalse(chat.isActive);
        
        // Alice пытается отправить второе приглашение Bob (должно провалиться)
        vm.startPrank(alice);
        vm.expectRevert("Invitation already pending");
        cryptoMessenger.invitationSend{value: invitationFee}(
            bob,
            encryptedForRecipient,
            encryptedForSender
        );
        vm.stopPrank();
    }
}