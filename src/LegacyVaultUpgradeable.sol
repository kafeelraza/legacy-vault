// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.22;

// // import { Initializable } from "../lib/@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
// // import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// // import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
// import { Initializable } from "../lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
// import { OwnableUpgradeable } from "../lib/openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
// import { UUPSUpgradeable } from "../lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";

// contract LegacyVaultUpgradeable is Initializable, OwnableUpgradeable, UUPSUpgradeable {
//     struct Heir {
//         uint256 amount;     // fixed allocation in wei
//         bool withdrawn;     // whether heir already claimed
//     }

//     mapping(address => Heir) public heirs;
//     address[] public heirList;

//     uint256 public lastHeartbeat;
//     uint256 public heartbeatInterval;

//     event Deposited(address indexed from, uint256 amount);
//     event HeirSet(address indexed heir, uint256 amount);
//     event Heartbeat(address indexed owner, uint256 time);
//     event InheritanceTriggered();
//     event Withdrawn(address indexed heir, uint256 amount);
//     event OwnerWithdrawn(address indexed owner, uint256 amount);

//     /// @custom:oz-upgrades-unsafe-allow constructor
//     constructor() {
//         _disableInitializers(); // required for upgradeable
//     }

//     function initialize(uint256 _heartbeatInterval, address _owner) public initializer {
//         __Ownable_init(_owner);
//         __UUPSUpgradeable_init();

//         heartbeatInterval = _heartbeatInterval;
//         lastHeartbeat = block.timestamp;
//     }

//     function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

//     // deposit ETH
//     receive() external payable {
//         emit Deposited(msg.sender, msg.value);
//     }

//     function deposit() external payable onlyOwner {
//         emit Deposited(msg.sender, msg.value);
//     }

//     // prove liveness
//     function heartbeat() external onlyOwner {
//         lastHeartbeat = block.timestamp;
//         emit Heartbeat(msg.sender, lastHeartbeat);
//     }

//     // set heir
//     function setHeir(address heir, uint256 amountWei) external onlyOwner {
//         require(heir != address(0), "Invalid heir");
//         require(amountWei > 0, "Amount must be > 0");

//         if (heirs[heir].amount == 0) {
//             heirList.push(heir);
//         }

//         heirs[heir].amount = amountWei;
//         heirs[heir].withdrawn = false;

//         emit HeirSet(heir, amountWei);
//     }

//     function getHeirs() external view returns (address[] memory) {
//         return heirList;
//     }

//     // mark inheritance triggered
//     function triggerInheritance() external {
//         require(block.timestamp > lastHeartbeat + heartbeatInterval, "Owner still active");
//         emit InheritanceTriggered();
//     }

//     // heir withdraw
//     function heirWithdraw() external {
//         Heir storage h = heirs[msg.sender];
//         require(h.amount > 0, "Not a heir");
//         require(!h.withdrawn, "Already withdrawn");
//         require(block.timestamp > lastHeartbeat + heartbeatInterval, "Not triggered yet");

//         h.withdrawn = true;
//         payable(msg.sender).transfer(h.amount);

//         emit Withdrawn(msg.sender, h.amount);
//     }

//     // owner withdraw
//     function ownerWithdraw(uint256 amountWei) external onlyOwner {
//         require(address(this).balance >= amountWei, "Insufficient balance");
//         payable(owner()).transfer(amountWei);
//         emit OwnerWithdrawn(msg.sender, amountWei);
//     }

//     function contractBalance() external view returns (uint256) {
//         return address(this).balance;
//     }
// }
