// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../lib/forge-std/src/Script.sol";
import { MultiLegacyVaultUpgradeableV2 } from "../src/MultiLegacyVaultUpgradeableV2.sol";

/// @notice Minimal interface of your proxy’s upgradeable functions
interface IMultiLegacyVaultUpgradeable {
    function upgradeTo(address newImplementation) external;
}

contract UpgradeToV2 is Script {
    function run() external {
        // 🔹 Load values from .env
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxy = vm.envAddress("PROXY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // 🔹 Deploy the new implementation contract
        MultiLegacyVaultUpgradeableV2 newImpl = new MultiLegacyVaultUpgradeableV2();
        console.log(" New implementation deployed at:", address(newImpl));

        // 🔹 Upgrade proxy to new implementation using the interface call (not low-level call)
        IMultiLegacyVaultUpgradeable(proxy).upgradeTo(address(newImpl));
        console.log(" Proxy successfully upgraded to V2!");

        vm.stopBroadcast();
    }
}