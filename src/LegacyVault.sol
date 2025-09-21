// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.20;

// import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";


// /**
//  * MVP LegacyVault
//  * Features (Phase-1):
//  * - Deposit ETH into the vault
//  * - Heartbeat to mark activity
//  * - Inactivity-based inheritance trigger
//  * - Heirs management with fixed amounts
//  * - Owner-only withdrawal (while active)
//  *
//  * NOTE: This is a minimal starting point. Phase-2 will add:
//  * - Social recovery (guardians + ECDSA)
//  * - Subscription payouts
//  * - Oracle recovery (biometric/KYC attestations)
//  */
// contract LegacyVault is Ownable, ReentrancyGuard {
//     /// @dev seconds of inactivity after which inheritance can be triggered
//     uint256 public inactivityPeriod; 
//     uint256 public lastHeartbeat; 

//     /// @dev simple heirs mapping and list for iteration
//     mapping(address => uint256) public heirAmount;
//     address[] public heirs;

//     event Deposited(address indexed from, uint256 amount);
//     event Withdrawn(address indexed to, uint256 amount);
//     event Heartbeat(address indexed owner, uint256 timestamp);
//     event InheritanceTriggered(address indexed by);
//     event HeirSet(address indexed heir, uint256 amount);
//     event HeirRemoved(address indexed heir);
//     event InactivityPeriodUpdated(uint256 secondsAmount);

//     constructor(address initialOwner, uint256 _inactivityPeriodSeconds) {
//     require(_inactivityPeriodSeconds > 0, "inactivity must be > 0");
//     inactivityPeriod = _inactivityPeriodSeconds;
//     lastHeartbeat = block.timestamp;

//     // set initial owner
//     _transferOwnership(initialOwner);
// }


//     // ----------- Owner Actions -----------

//     function deposit() external payable nonReentrant {
//         require(msg.value > 0, "no value");
//         emit Deposited(msg.sender, msg.value);
//     }

//     function heartbeat() external onlyOwner {
//         lastHeartbeat = block.timestamp;
//         emit Heartbeat(msg.sender, block.timestamp);
//     }

//     function setInactivityPeriod(uint256 secondsAmount) external onlyOwner {
//         require(secondsAmount > 0, "invalid");
//         inactivityPeriod = secondsAmount;
//         emit InactivityPeriodUpdated(secondsAmount);
//     }

//     function setHeir(address heir, uint256 amountWei) external onlyOwner {
//         require(heir != address(0), "zero heir");
//         if (heirAmount[heir] == 0) {
//             heirs.push(heir);
//         }
//         heirAmount[heir] = amountWei;
//         emit HeirSet(heir, amountWei);
//     }

//     function removeHeir(address heir) external onlyOwner {
//         require(heirAmount[heir] > 0, "not set");
//         // remove from array
//         for (uint256 i = 0; i < heirs.length; i++) {
//             if (heirs[i] == heir) {
//                 heirs[i] = heirs[heirs.length - 1];
//                 heirs.pop();
//                 break;
//             }
//         }
//         delete heirAmount[heir];
//         emit HeirRemoved(heir);
//     }

//     /// @notice Owner can withdraw while active (safety during MVP/testing)
//     function ownerWithdraw(uint256 amount) external onlyOwner nonReentrant {
//         require(block.timestamp <= lastHeartbeat + inactivityPeriod, "inactive - locked");
//         require(address(this).balance >= amount, "insufficient");
//         (bool ok, ) = owner().call{value: amount}("");
//         require(ok, "transfer failed");
//         emit Withdrawn(owner(), amount);
//     }

//     // ----------- Inheritance Trigger -----------

//     function triggerInheritance() external nonReentrant {
//         require(block.timestamp > lastHeartbeat + inactivityPeriod, "still active");
//         // distribute as configured fixed amounts
//         for (uint256 i = 0; i < heirs.length; i++) {
//             address h = heirs[i];
//             uint256 amt = heirAmount[h];
//             if (amt == 0) continue;
//             if (address(this).balance < amt) break; // stop if insufficient
//             heirAmount[h] = 0; // prevent double send
//             (bool ok, ) = h.call{value: amt}("");
//             require(ok, "heir transfer failed");
//         }
//         emit InheritanceTriggered(msg.sender);
//     }

//     // ----------- Views -----------

//     function getHeirs() external view returns (address[] memory) {
//         return heirs;
//     }

//     receive() external payable {
//         emit Deposited(msg.sender, msg.value);
//     }
// }
