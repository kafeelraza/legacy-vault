import { useEffect, useState } from "react";
import { getVaultContract } from "../utils/contract";
import { ethers } from "ethers";

export default function VaultInfo() {
  const [balance, setBalance] = useState("0");
  const [heirs, setHeirs] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const contract = getVaultContract();
      const bal = await contract.getVaultBalance();
      setBalance(ethers.formatEther(bal));

      const heirList = await contract.getHeirs();
      setHeirs(heirList);
    }
    fetchData();
  }, []);

  return (
    <div>
      <h2>Vault Balance: {balance} ETH</h2>
      <h3>Heirs</h3>
      <ul>
        {heirs.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
    </div>
  );
}

