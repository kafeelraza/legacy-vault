import { getVaultContract } from "../utils/contract";
import { ethers } from "ethers";
import { useState } from "react";

export default function DepositForm() {
  const [amount, setAmount] = useState("");

  async function deposit() {
    if (!amount || isNaN(amount)) {
      alert("Please enter a valid amount");
      return;
    }

    const contract = getVaultContract();
    const tx = await contract.deposit({
      value: ethers.parseEther(amount), // user input amount
    });
    await tx.wait();
    alert(`Deposited ${amount} ETH!`);
    setAmount(""); // reset input
  }

  return (
    <div>
      <h3>Deposit ETH</h3>
      <input
        type="text"
        placeholder="Enter amount in ETH"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button onClick={deposit}>Deposit</button>
    </div>
  );
}
