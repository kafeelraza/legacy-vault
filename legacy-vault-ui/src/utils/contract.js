import { ethers } from "ethers";
import { LEGACY_VAULT_ABI, LEGACY_VAULT_ADDRESS } from "../abi/abi";

export function getVaultContract() {
  if (!window.ethereum) throw new Error("MetaMask not found");

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = provider.getSigner();
  return new ethers.Contract(LEGACY_VAULT_ADDRESS, LEGACY_VAULT_ABI, signer);
}
