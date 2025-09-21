// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MultiLegacyVaultUpgradeable} from "../src/MultiLegacyVaultUpgradeable.sol";

contract DeployVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY"); // wallet key
        address oracleSigner = vm.envAddress("ORACLE_SIGNER");  // oracle signer

        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        MultiLegacyVaultUpgradeable impl = new MultiLegacyVaultUpgradeable();

        // Prepare initializer calldata
        bytes memory initData = abi.encodeWithSelector(
            MultiLegacyVaultUpgradeable.initialize.selector,
            oracleSigner
        );

        // Deploy Proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        vm.stopBroadcast();

        console2.log("Implementation deployed at:", address(impl));
        console2.log("Proxy deployed at:", address(proxy));
        console2.log("OracleSigner set as:", oracleSigner);
    }
}
