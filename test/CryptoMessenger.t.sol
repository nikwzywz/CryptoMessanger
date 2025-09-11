// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/CryptoMessenger.sol";

/**
 * @title CryptoMessengerTest
 * @dev Тесты для контракта CryptoMessenger
 */
contract CryptoMessengerTest is Test {
    
    CryptoMessenger public cryptoMessenger;
    
    // Тестовые пользователи
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    
    // Тестовые данные
    bytes public alicePublicKey = "alice_public_key_12345";
    bytes public bobPublicKey = "bob_public_key_67890";
    bytes public charliePublicKey = "charlie_public_key_abcde";
    
    // Тестовые сообщения
    bytes public testMessage = "Hello, this is a test message!";
    bytes public encryptedTestMessage = "encrypted_test_message_data";
    
    function setUp() public {
        cryptoMessenger = new CryptoMessenger();
        
        // Настройка тестовых пользователей
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);
    }
    
    function testRegisterPublicKey() public {
        vm.prank(alice);
        cryptoMessenger.registerPublicKey(alicePublicKey);
        
        assertTrue(cryptoMessenger.isUserRegistered(alice));
        assertEq(cryptoMessenger.getPublicKey(alice), alicePublicKey);
    }
    
    function testCannotRegisterTwice() public {
        vm.prank(alice);
        cryptoMessenger.registerPublicKey(alicePublicKey);
        
        vm.prank(alice);
        vm.expectRevert("User already registered");
        cryptoMessenger.registerPublicKey(alicePublicKey);
    }
    
    function testUpdatePublicKey() public {
        vm.prank(alice);
        cryptoMessenger.registerPublicKey(alicePublicKey);
        
        bytes memory newPublicKey = "new_alice_public_key";
        vm.prank(alice);
        cryptoMessenger.updatePublicKey(newPublicKey);
        
        assertEq(cryptoMessenger.getPublicKey(alice), newPublicKey);
    }
    
    function testContactRequest() public {
        // Регистрируем пользователей
        vm.prank(alice);
        cryptoMessenger.registerPublicKey(alicePublicKey);
        
        vm.prank(bob);
        cryptoMessenger.registerPublicKey(bobPublicKey);
        
        // Alice запрашивает добавление в контакты Bob
        uint256 requestFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        
        vm.prank(alice);
        cryptoMessenger.requestContact{value: requestFee}(
            bob,
            testMessage,
            encryptedTestMessage
        );
        
        // Проверяем, что запрос создан
        CryptoMessenger.ContactRequest memory request = cryptoMessenger.getContactRequest(bob, alice);
        assertTrue(request.isActive);
        assertEq(request.from, alice);
        assertEq(request.payment, requestFee);
    }
    
    function testAcceptContactRequest() public {
        // Регистрируем пользователей
        vm.prank(alice);
        cryptoMessenger.registerPublicKey(alicePublicKey);
        
        vm.prank(bob);
        cryptoMessenger.registerPublicKey(bobPublicKey);
        
        // Alice запрашивает добавление в контакты Bob
        uint256 requestFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        uint256 aliceBalanceBefore = alice.balance;
        
        vm.prank(alice);
        cryptoMessenger.requestContact{value: requestFee}(
            bob,
            testMessage,
            encryptedTestMessage
        );
        
        // Bob принимает запрос
        vm.prank(bob);
        cryptoMessenger.acceptContactRequest(alice);
        
        // Проверяем, что контакт добавлен
        assertTrue(cryptoMessenger.isContact(bob, alice));
        
        // Проверяем, что средства возвращены Alice
        assertEq(alice.balance, aliceBalanceBefore);
    }
    
    function testRejectContactRequest() public {
        // Регистрируем пользователей
        vm.prank(alice);
        cryptoMessenger.registerPublicKey(alicePublicKey);
        
        vm.prank(bob);
        cryptoMessenger.registerPublicKey(bobPublicKey);
        
        // Alice запрашивает добавление в контакты Bob
        uint256 requestFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        uint256 aliceBalanceBefore = alice.balance;
        
        vm.prank(alice);
        cryptoMessenger.requestContact{value: requestFee}(
            bob,
            testMessage,
            encryptedTestMessage
        );
        
        // Bob отклоняет запрос
        vm.prank(bob);
        cryptoMessenger.rejectContactRequest(alice);
        
        // Проверяем, что контакт НЕ добавлен
        assertFalse(cryptoMessenger.isContact(bob, alice));
        
        // Проверяем, что средства НЕ возвращены Alice
        assertEq(alice.balance, aliceBalanceBefore - requestFee);
    }
    
    function testSendMessage() public {
        // Регистрируем пользователей
        vm.prank(alice);
        cryptoMessenger.registerPublicKey(alicePublicKey);
        
        vm.prank(bob);
        cryptoMessenger.registerPublicKey(bobPublicKey);
        
        // Alice запрашивает добавление в контакты Bob
        uint256 requestFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        
        vm.prank(alice);
        cryptoMessenger.requestContact{value: requestFee}(
            bob,
            testMessage,
            encryptedTestMessage
        );
        
        // Bob принимает запрос
        vm.prank(bob);
        cryptoMessenger.acceptContactRequest(alice);
        
        // Alice отправляет сообщение Bob
        vm.prank(alice);
        cryptoMessenger.sendMessage(bob, encryptedTestMessage);
        
        // Проверяем, что сообщение отправлено (через событие)
        // В реальном тесте можно проверить событие MessageSent
    }
    
    function testCannotSendMessageWithoutContact() public {
        // Регистрируем пользователей
        vm.prank(alice);
        cryptoMessenger.registerPublicKey(alicePublicKey);
        
        vm.prank(bob);
        cryptoMessenger.registerPublicKey(bobPublicKey);
        
        // Alice пытается отправить сообщение без добавления в контакты
        vm.prank(alice);
        vm.expectRevert("Not in recipient's contacts");
        cryptoMessenger.sendMessage(bob, encryptedTestMessage);
    }
    
    function testSetContactRequestFee() public {
        vm.prank(alice);
        cryptoMessenger.registerPublicKey(alicePublicKey);
        
        uint256 newFee = 0.01 ether;
        vm.prank(alice);
        cryptoMessenger.setContactRequestFee(newFee);
        
        assertEq(cryptoMessenger.getUserSettings(alice).contactRequestFee, newFee);
    }
    
    function testRemoveContact() public {
        // Регистрируем пользователей
        vm.prank(alice);
        cryptoMessenger.registerPublicKey(alicePublicKey);
        
        vm.prank(bob);
        cryptoMessenger.registerPublicKey(bobPublicKey);
        
        // Alice запрашивает добавление в контакты Bob
        uint256 requestFee = cryptoMessenger.getUserSettings(bob).contactRequestFee;
        
        vm.prank(alice);
        cryptoMessenger.requestContact{value: requestFee}(
            bob,
            testMessage,
            encryptedTestMessage
        );
        
        // Bob принимает запрос
        vm.prank(bob);
        cryptoMessenger.acceptContactRequest(alice);
        
        // Bob удаляет Alice из контактов
        vm.prank(bob);
        cryptoMessenger.removeContact(alice);
        
        // Проверяем, что контакт удален
        assertFalse(cryptoMessenger.isContact(bob, alice));
    }
}
