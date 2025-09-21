// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console2} from "forge-std/Script.sol";
import {LegacyVaultUpgradeable} from "../src/LegacyVaultUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployLegacyVault is Script {
    function run() external {
        // Read private key from environment
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        // Start broadcasting transactions
        vm.startBroadcast(deployerKey);

        // Step 1: Deploy the implementation contract (V1)
        LegacyVaultUpgradeable impl = new LegacyVaultUpgradeable();
        console2.log("Implementation V1 deployed at:", address(impl));

        // Step 2: Use the deployer's address as owner
        // msg.sender is not available in forge scripts, so use vm.addr(deployerKey)
        address deployer = vm.addr(deployerKey);

        // Encode the initializer call
        bytes memory data = abi.encodeWithSelector(
            LegacyVaultUpgradeable.initialize.selector,
            3600, // heartbeatInterval = 1 hour
            deployer
        );

        // Step 3: Deploy the proxy pointing to the implementation
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), data);
        console2.log("Proxy deployed at:", address(proxy));

        vm.stopBroadcast();
    }
}

