// // SPDX-License-Identifier: UNLICENSED
// pragma solidity ^0.8.20;

// import "forge-std/Test.sol";
// import "../src/LegacyVault.sol";

// contract LegacyVaultTest is Test {
//     LegacyVault vault;
//     address owner = address(0x123);
//     address heir1 = address(0x456);

//     function setUp() public {
//         vm.deal(owner, 10 ether);
//         vm.prank(owner);
//         vault = new LegacyVault(owner, 60); // 60 sec inactivity
//     }

//     function testDepositAndHeartbeat() public {
//         vm.prank(owner);
//         vault.deposit{value: 1 ether}();
//         assertEq(address(vault).balance, 1 ether);

//         vm.prank(owner);
//         vault.heartbeat();
//         assertEq(vault.lastHeartbeat(), block.timestamp);
//     }

//     function testInheritanceTrigger() public {
//         vm.startPrank(owner);
//         vault.setHeir(heir1, 0.5 ether);
//         vault.deposit{value: 1 ether}();
//         vm.stopPrank();

//         // move time forward
//         vm.warp(block.timestamp + 120);
//         vm.prank(address(0x999)); // outsider triggers
//         vault.triggerInheritance();
//         assertEq(heir1.balance, 0.5 ether);
//     }
// }
