// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.22;

// import "./LegacyVaultUpgradeable.sol";

// contract LegacyVaultV2 is LegacyVaultUpgradeable {
//     event EmergencyWithdraw(address indexed owner, uint256 amount);

//     function emergencyWithdrawAll() external onlyOwner {
//         uint256 bal = address(this).balance;
//         require(bal > 0, "Zero balance");

//         payable(owner()).transfer(bal);
//         emit EmergencyWithdraw(owner(), bal);
//     }
// }
