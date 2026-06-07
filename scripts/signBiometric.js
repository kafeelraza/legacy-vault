import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  // Oracle private key (⚠️ only for local testing, don’t push to GitHub)
  const oracleKey = process.env.ORACLE_PRIVATE_KEY;
  if (!oracleKey) throw new Error("Set ORACLE_PRIVATE_KEY in .env");

  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(oracleKey, provider);

  const user = "0xUSER_ADDRESS"; // replace with real user address
  const contract = "0xVAULT_CONTRACT"; // proxy address of deployed vault
  const caller = "0xCALLER_ADDRESS"; // who triggers recovery

  // keccak256(user, caller, chainId, contract)
  const chainId = (await provider.getNetwork()).chainId;
  const hash = ethers.solidityPackedKeccak256(
    ["address", "address", "uint256", "address"],
    [user, caller, chainId, contract]
  );

  // Sign with oracle
  const signature = await wallet.signMessage(ethers.getBytes(hash));

  console.log("User:", user);
  console.log("Contract:", contract);
  console.log("ChainId:", chainId);
  console.log("Signature:", signature);
}

main().catch(console.error);
