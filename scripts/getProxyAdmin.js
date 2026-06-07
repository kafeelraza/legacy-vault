const { ethers } = require("hardhat");

async function main() {
  const proxy = "0xBd940B854C5f761b8c0844A3bF7B205564E5B798";

  // EIP-1967 admin slot
  const ADMIN_SLOT =
    "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

  const slot = await ethers.provider.getStorage(proxy, ADMIN_SLOT);

  console.log("Raw slot:", slot);

  const admin = "0x" + slot.slice(26);
  console.log("✅ ProxyAdmin address:", admin);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
