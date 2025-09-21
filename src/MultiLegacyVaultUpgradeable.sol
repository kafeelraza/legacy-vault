// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

// -----------------------------
// OpenZeppelin Upgradeable base
// -----------------------------
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

// -----------------------------
// Libraries (non-upgradeable but safe)
// -----------------------------
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract MultiLegacyVaultUpgradeable is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;

    // -----------------------------
    // Storage
    // -----------------------------
    struct Vault {
        uint256 balance;
        uint256 inactivityPeriod;
        uint256 lastHeartbeat;
        address heir;
    }

    mapping(address => Vault) private vaults;
    EnumerableSet.AddressSet private users;

    address public oracleSigner; // biometric oracle signer

    // -----------------------------
    // Events
    // -----------------------------
    event Deposited(address indexed user, uint256 amount);
    event HeirSet(address indexed user, address indexed heir);
    event Heartbeat(address indexed user, uint256 timestamp);
    event InheritanceTriggered(address indexed user, address indexed heir, uint256 amount);
    event OracleSignerChanged(address indexed oldSigner, address indexed newSigner);

    // -----------------------------
    // Initializer
    // -----------------------------
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _oracleSigner) public initializer {
        __Ownable_init(msg.sender); // ✅ OZ v5 requires owner parameter
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        oracleSigner = _oracleSigner;
    }

    // -----------------------------
    // Core Vault Functions
    // -----------------------------
    function deposit() external payable nonReentrant {
        require(msg.value > 0, "Must deposit > 0");
        Vault storage v = vaults[msg.sender];
        v.balance += msg.value;

        if (!users.contains(msg.sender)) {
            users.add(msg.sender);
            v.lastHeartbeat = block.timestamp;
        }

        emit Deposited(msg.sender, msg.value);
    }

    function setInactivityPeriod(uint256 period) external {
        require(period > 0, "Invalid period");
        vaults[msg.sender].inactivityPeriod = period;
    }

    function setHeir(address heir) external {
        require(heir != address(0), "Invalid heir");
        vaults[msg.sender].heir = heir;
        emit HeirSet(msg.sender, heir);
    }

    function heartbeat() external {
        vaults[msg.sender].lastHeartbeat = block.timestamp;
        emit Heartbeat(msg.sender, block.timestamp);
    }

    function triggerInheritance(address user) external nonReentrant {
        Vault storage v = vaults[user];
        require(v.heir != address(0), "No heir set");
        require(v.balance > 0, "No funds");
        require(block.timestamp > v.lastHeartbeat + v.inactivityPeriod, "Still active");

        uint256 amount = v.balance;
        v.balance = 0;

        (bool success, ) = payable(v.heir).call{value: amount}("");
        require(success, "Transfer failed");

        emit InheritanceTriggered(user, v.heir, amount);
    }

    // -----------------------------
    // Biometric Recovery (via Oracle)
    // -----------------------------
    function recoverWithBiometric(address user, bytes calldata signature) external nonReentrant {
        Vault storage v = vaults[user];
        require(v.balance > 0, "No funds");
        require(oracleSigner != address(0), "Oracle not set");

        bytes32 hash = keccak256(
            abi.encodePacked(user, msg.sender, block.chainid, address(this))
        );

        // ✅ OZ v5 ke static methods
        bytes32 ethSignedHash = ECDSA.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(ethSignedHash, signature);

        require(signer == oracleSigner, "Invalid biometric proof");

        uint256 amount = v.balance;
        v.balance = 0;

        (bool success, ) = payable(user).call{value: amount}("");
        require(success, "Transfer failed");
    }

    // -----------------------------
    // Admin
    // -----------------------------
    function setOracleSigner(address newSigner) external onlyOwner {
        emit OracleSignerChanged(oracleSigner, newSigner);
        oracleSigner = newSigner;
    }

    // -----------------------------
    // View Helpers
    // -----------------------------
    function getVault(address user) external view returns (Vault memory) {
        return vaults[user];
    }

    function getAllUsers() external view returns (address[] memory) {
        return users.values();
    }

    // -----------------------------
    // UUPS Authorization
    // -----------------------------
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
