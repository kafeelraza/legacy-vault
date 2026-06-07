// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {MultiLegacyVaultUpgradeable} from "./MultiLegacyVaultUpgradeable.sol";
import {MessageHashUtils} from "../lib/openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import {ECDSA} from "../lib/openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

contract MultiLegacyVaultUpgradeableV2 is MultiLegacyVaultUpgradeable {
    // New storage — appended (safe)
    mapping(address => uint256) public usedNonces;

    function recoverWithBiometric(
        address user,
        bytes calldata signature,
        uint256 nonce,
        uint256 expiry
    ) external nonReentrant {
        require(block.timestamp <= expiry, "Signature expired");
        require(nonce == usedNonces[user] + 1, "Invalid nonce");

        Vault storage v = vaults[user];
        require(v.balance > 0, "No funds");
        require(oracleSigner != address(0), "Oracle not set");

        bytes32 hash = keccak256(
            abi.encodePacked(
                user,
                msg.sender,
                block.chainid,
                address(this),
                nonce,
                expiry
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(ethSignedHash, signature);
        require(signer == oracleSigner, "Invalid biometric proof");

        usedNonces[user] = nonce;

        uint256 amount = v.balance;
        v.balance = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit InheritanceTriggered(user, msg.sender, amount);
    }

    function version() external pure virtual override returns (string memory) {
        return "V2 - Biometric + Nonce Upgrade";
    }
}