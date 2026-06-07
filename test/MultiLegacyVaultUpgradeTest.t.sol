// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../src/MultiLegacyVaultUpgradeable.sol";
import "../src/MultiLegacyVaultUpgradeableV2.sol";
import {ERC1967Proxy} from "../lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract MultiLegacyVaultUpgradeTest is Test {
    MultiLegacyVaultUpgradeable public v1Impl;
    MultiLegacyVaultUpgradeableV2 public v2Impl;
    MultiLegacyVaultUpgradeable public vaultProxy; // interact via V1 ABI
    address public oracleSigner = address(0x123);
    address public owner = address(this);
    address public user1 = address(0xBEEF);
    address public heir = address(0xDEAD);

    function setUp() public {
        // Deploy V1 implementation
        v1Impl = new MultiLegacyVaultUpgradeable();

        // Deploy proxy without initData
        ERC1967Proxy proxy = new ERC1967Proxy(address(v1Impl), "");

        // Initialize via proxy (msg.sender = test contract)
        vaultProxy = MultiLegacyVaultUpgradeable(payable(address(proxy)));
        vaultProxy.initialize(oracleSigner);

        assertEq(vaultProxy.owner(), owner, "Owner should be test contract");
        assertEq(vaultProxy.version(), "V1 - Core Vault");
    }

    function testDepositAndUpgrade() public {
        // 1️⃣ User deposits
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vaultProxy.deposit{value: 1 ether}();

        MultiLegacyVaultUpgradeable.Vault memory v = vaultProxy.getVault(user1);
        assertEq(v.balance, 1 ether, "Vault balance mismatch before upgrade");
        console.log("Owner is:", vaultProxy.owner());
        console.log("This contract is:", address(this));

        // 2️⃣ Deploy new implementation (V2)
        v2Impl = new MultiLegacyVaultUpgradeableV2();

        // 3️⃣ Perform upgrade via low-level call (since upgradeTo isn't public in ABI)
        (bool success,) =
            address(vaultProxy).call(abi.encodeWithSignature("upgradeToAndCall(address,bytes)", address(v2Impl), ""));
        require(success, "Upgrade failed");

        // 4️⃣ Reconnect using V2 ABI
        MultiLegacyVaultUpgradeableV2 upgraded = MultiLegacyVaultUpgradeableV2(payable(address(vaultProxy)));

        // 5️⃣ Assert upgrade success + data persistence
        assertEq(upgraded.version(), "V2 - Biometric + Nonce Upgrade");
        assertEq(upgraded.owner(), owner, "Owner persisted");
        assertEq(upgraded.oracleSigner(), oracleSigner, "Oracle persisted");
        assertEq(upgraded.getVault(user1).balance, 1 ether, "Balance persisted");
        assertEq(upgraded.usedNonces(user1), 0, "Nonce should be 0");
    }
}
