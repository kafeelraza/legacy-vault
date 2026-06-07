// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.22;

// import "forge-std/Script.sol";
// import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
// import "../lib/openzeppelin-contracts/contracts/proxy/transparent/ITransparentUpgradeableProxy.sol";

// import "../src/MultiLegacyVaultUpgradeableV3.sol";

// contract UpgradeToV3 is Script {
//     function run() external {
//         address proxyAdmin = vm.envAddress("PROXY_ADMIN");
//         address proxy = vm.envAddress("PROXY_ADDRESS");

//         vm.startBroadcast();

//         // 1️⃣ deploy new V3 implementation
//         MultiLegacyVaultUpgradeableV3 impl =
//             new MultiLegacyVaultUpgradeableV3();

//         // 2️⃣ upgrade + optional initializer call
//         ProxyAdmin(proxyAdmin).upgradeAndCall(
//             ITransparentUpgradeableProxy(proxy),
//             address(impl),
//             abi.encodeCall(
//                 MultiLegacyVaultUpgradeableV3.initializeV3,
//                 ()
//             )
//         );

//         vm.stopBroadcast();
//     }
// }
