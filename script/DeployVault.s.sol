// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../lib/forge-std/src/Script.sol";
import {ERC1967Proxy} from "../lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MultiLegacyVaultUpgradeable} from "../src/MultiLegacyVaultUpgradeable.sol";

contract DeployVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address oracleSigner = vm.envAddress("ORACLE_SIGNER");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        MultiLegacyVaultUpgradeable impl = new MultiLegacyVaultUpgradeable();

        // Prepare initializer calldata: initialize(address)
        bytes memory initData = abi.encodeWithSelector(
            MultiLegacyVaultUpgradeable.initialize.selector,
            oracleSigner
        );

        // Deploy proxy pointing to implementation and run initializer via proxy constructor delegatecall
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        console.log(" Implementation deployed at:", address(impl));
        console.log(" Proxy deployed at:", address(proxy));
        console.log(" Oracle signer:", oracleSigner);

        vm.stopBroadcast();
    }
}