// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./MultiLegacyVaultUpgradeableV2.sol";
import {MultiLegacyVaultUpgradeable} from "./MultiLegacyVaultUpgradeable.sol";
import {ECDSA} from "../lib/openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "../lib/openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

contract MultiLegacyVaultUpgradeableV3 is MultiLegacyVaultUpgradeableV2 {

    /* =============================================================
                        NEW STORAGE (APPEND ONLY)
       ============================================================= */

    mapping(address => uint256) public dailyLimit;
    mapping(address => uint256) public spentToday;
    mapping(address => uint256) public lastSpendDay;
    mapping(address => uint256) public spendNonces;

    /* =============================================================
                        V3 INITIALIZER
       ============================================================= */

    function initializeV3() external reinitializer(3) {}

    /* =============================================================
                        DAILY LIMIT LOGIC
       ============================================================= */

    function setDailyLimit(uint256 limit) external {
        require(limit > 0, "Invalid limit");
        dailyLimit[msg.sender] = limit;
    }

    function _resetIfNewDay(address user) internal {
        uint256 today = block.timestamp / 1 days;
        if (lastSpendDay[user] < today) {
            spentToday[user] = 0;
            lastSpendDay[user] = today;
        }
    }

    /* =============================================================
                        NORMAL WALLET SPEND
       ============================================================= */

    function spend(address to, uint256 amount) external nonReentrant {
        require(to != address(0), "Invalid receiver");
        require(amount > 0, "Invalid amount");

        Vault storage v = vaults[msg.sender];
        require(msg.sender != v.heir, "Heir cannot spend");
        require(v.balance >= amount, "Insufficient balance");

        _resetIfNewDay(msg.sender);
        require(
            spentToday[msg.sender] + amount <= dailyLimit[msg.sender],
            "Daily limit exceeded"
        );

        spentToday[msg.sender] += amount;
        v.balance -= amount;
        v.lastHeartbeat = block.timestamp;

        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "ETH transfer failed");
    }

    /* =============================================================
                    ORACLE-APPROVED WALLET SPEND
       ============================================================= */

    function spendWithOracleApproval(
        address to,
        uint256 amount,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external nonReentrant {

        require(block.timestamp <= expiry, "Approval expired");
        require(to != address(0), "Invalid receiver");
        require(amount > 0, "Invalid amount");
        require(nonce == spendNonces[msg.sender] + 1, "Invalid nonce");
        require(oracleSigner != address(0), "Oracle not set");

        Vault storage v = vaults[msg.sender];
        require(v.balance >= amount, "Insufficient balance");

        _resetIfNewDay(msg.sender);
        require(
            spentToday[msg.sender] + amount <= dailyLimit[msg.sender],
            "Daily limit exceeded"
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                "ORACLE_WALLET_SPEND",
                msg.sender,
                to,
                amount,
                nonce,
                expiry,
                block.chainid,
                address(this)
            )
        );

        bytes32 ethSigned =
            MessageHashUtils.toEthSignedMessageHash(hash);

        require(
            ECDSA.recover(ethSigned, signature) == oracleSigner,
            "Invalid oracle signature"
        );

        spendNonces[msg.sender] = nonce;
        spentToday[msg.sender] += amount;
        v.balance -= amount;
        v.lastHeartbeat = block.timestamp;

        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "ETH transfer failed");
    }

    /* =============================================================
                            VERSION
       ============================================================= */

    function version() external pure override returns (string memory) {
        return "V3 - Wallet + Daily Limit + Oracle (Transparent Proxy)";
    }
}
