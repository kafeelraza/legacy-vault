// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console2} from "forge-std/Script.sol";
import {LegacyVaultV3} from "../src/LegacyVaultV3.sol";

contract DeployAndUpgradeV3 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // Step 1: Deploy V3 implementation
        LegacyVaultV3 v3Impl = new LegacyVaultV3();
        console2.log("V3 Implementation deployed at:", address(v3Impl));

        // Step 2: Existing proxy address (V1)
        address payable proxyAddress = payable(0x39B25f9d490C745507d7E21F781D1fF20932ED10);

        // Step 3: Upgrade proxy to V3 + call initializer
        LegacyVaultV3(proxyAddress).upgradeToAndCall(
            address(v3Impl),
            abi.encodeWithSelector(
                LegacyVaultV3.initialize.selector,
                3600,                     // heartbeatInterval = 1 hour
                vm.addr(deployerKey)      // owner = deployer
            )
        );

        console2.log("Proxy upgraded to V3 at:", proxyAddress);

        vm.stopBroadcast();
    }
}
