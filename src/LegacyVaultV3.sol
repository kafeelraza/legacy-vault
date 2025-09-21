// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.22;

// import { Initializable } from "../lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
// import { OwnableUpgradeable } from "../lib/openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
// import { UUPSUpgradeable } from "../lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
// import { ReentrancyGuardUpgradeable } from "../lib/openzeppelin-contracts-upgradeable/contracts/utils/ReentrancyGuardUpgradeable.sol";
// import { IERC20 } from "../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

// contract LegacyVaultV3 is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
//     uint256 public constant MAX_BPS = 10000; // 100%

//     uint256 public lastHeartbeat;
//     uint256 public heartbeatInterval;

//     mapping(address => uint256) public heirShares;
//     address[] private heirList;
//     uint256 public totalShares;

//     event Deposited(address indexed from, uint256 amount);
//     event Heartbeat(uint256 time);
//     event HeirShareSet(address heir, uint256 bps);
//     event HeirRemoved(address heir);
//     event InheritanceTriggered();
//     event Withdraw(address owner, uint256 amount);
//     event EmergencyWithdraw(address owner, uint256 amount);
//     event ERC20Inheritance(address token, address heir, uint256 amount);

//     /// @custom:oz-upgrades-unsafe-allow constructor
//     constructor() {
//         _disableInitializers();
//     }

//     function initialize(uint256 _heartbeatInterval, address _owner) public reinitializer(3) {
//         __Ownable_init(_owner);
//         __UUPSUpgradeable_init();
//         __ReentrancyGuard_init();

//         heartbeatInterval = _heartbeatInterval;
//         lastHeartbeat = block.timestamp;
//     }

//     function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

//     receive() external payable {
//         emit Deposited(msg.sender, msg.value);
//     }

//     function deposit() external payable {
//         require(msg.value > 0, "No value");
//         emit Deposited(msg.sender, msg.value);
//     }

//     function heartbeat() external onlyOwner {
//         lastHeartbeat = block.timestamp;
//         emit Heartbeat(block.timestamp);
//     }

//     function setHeirShare(address heir, uint256 bps) external onlyOwner {
//         require(heir != address(0), "Zero heir");
//         require(bps <= MAX_BPS, "bps > 100%");

//         uint256 prev = heirShares[heir];

//         if (prev == 0 && bps > 0) {
//             heirList.push(heir);
//             totalShares += bps;
//             heirShares[heir] = bps;
//         } else if (prev > 0 && bps == 0) {
//             totalShares -= prev;
//             heirShares[heir] = 0;
//             emit HeirRemoved(heir);
//         } else {
//             if (bps >= prev) {
//                 totalShares += (bps - prev);
//             } else {
//                 totalShares -= (prev - bps);
//             }
//             heirShares[heir] = bps;
//         }

//         require(totalShares <= MAX_BPS, "Total shares > 100%");
//         emit HeirShareSet(heir, bps);
//     }

//     function getHeirs() external view returns (address[] memory) {
//         return heirList;
//     }

//     function withdraw(uint256 amount) external onlyOwner nonReentrant {
//         require(block.timestamp <= lastHeartbeat + heartbeatInterval, "Inactive - locked");
//         require(address(this).balance >= amount, "Insufficient");
//         (bool ok, ) = owner().call{value: amount}("");
//         require(ok, "Transfer failed");
//         emit Withdraw(owner(), amount);
//     }

//     function emergencyWithdrawAll() external onlyOwner nonReentrant {
//         uint256 bal = address(this).balance;
//         require(bal > 0, "Zero balance");
//         (bool ok, ) = payable(owner()).call{value: bal}("");
//         require(ok, "Transfer failed");
//         emit EmergencyWithdraw(owner(), bal);
//     }

//     function triggerInheritance() external nonReentrant {
//         require(block.timestamp > lastHeartbeat + heartbeatInterval, "Still active");
//         require(totalShares > 0, "No heirs");

//         uint256 bal = address(this).balance;
//         require(bal > 0, "No balance");

//         for (uint256 i = 0; i < heirList.length; i++) {
//             address h = heirList[i];
//             uint256 bps = heirShares[h];
//             if (bps == 0) continue;

//             uint256 amt = (bal * bps) / MAX_BPS;
//             heirShares[h] = 0;

//             (bool ok, ) = payable(h).call{value: amt}("");
//             require(ok, "ETH transfer failed");
//         }

//         totalShares = 0;
//         emit InheritanceTriggered();
//     }

//     function triggerInheritanceERC20(address token) external nonReentrant {
//         require(block.timestamp > lastHeartbeat + heartbeatInterval, "Still active");
//         require(totalShares > 0, "No heirs");

//         uint256 bal = IERC20(token).balanceOf(address(this));
//         require(bal > 0, "No token balance");

//         for (uint256 i = 0; i < heirList.length; i++) {
//             address h = heirList[i];
//             uint256 bps = heirShares[h];
//             if (bps == 0) continue;

//             uint256 amt = (bal * bps) / MAX_BPS;
//             heirShares[h] = 0;

//             bool sent = IERC20(token).transfer(h, amt);
//             require(sent, "Token transfer failed");
//             emit ERC20Inheritance(token, h, amt);
//         }

//         totalShares = 0;
//         emit InheritanceTriggered();
//     }

//     function getVaultBalance() external view returns (uint256) {
//         return address(this).balance;
//     }

//     function timeUntilInactive() external view returns (int256) {
//         return int256(lastHeartbeat + heartbeatInterval) - int256(block.timestamp);
//     }
// }
