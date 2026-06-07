import React, { useState } from "react";
import { useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { VAULT_ABI, VAULT_ADDRESS } from "../config/contract";
import { useToast } from "./ToastContext";
import { useActivity } from "./ActivityContext";

export default function DepositETH({ onDepositSuccess, biometricRegistered }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const { writeContractAsync, isPending } = useWriteContract();
  const { notify } = useToast();
  const { addActivity } = useActivity();

  const handleDeposit = async () => {
    setError("");

    try {
      if (!amount) throw new Error("Enter an amount to deposit");

      const hash = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "deposit",
        value: parseEther(amount),
      });

      setAmount("");
      if (onDepositSuccess) onDepositSuccess();
      notify({
        title: "Deposit transaction sent",
        message: `${hash.slice(0, 10)}...`,
        type: "success",
      });
      addActivity(
        "Deposit submitted",
        `Deposit transaction sent: ${hash.slice(0, 10)}...`,
        "success"
      );
    } catch (depositError) {
      console.error("Deposit failed:", depositError);
      setError(depositError.shortMessage || depositError.message || "Deposit failed");
      notify({
        title: "Deposit failed",
        message: depositError.shortMessage || depositError.message || "Deposit failed",
        type: "error",
      });
    }
  };

  return (
    <div className="lv-card">
      <div className="flex flex-col gap-1">
        <p className="lv-eyebrow">Deposit</p>
        <h2 className="text-xl font-semibold text-white">Fund your vault</h2>
        <p className="lv-muted">
          Deposit ETH into your vault. Biometric recovery is recommended but not
          required by the contract.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="number"
          placeholder="Amount in ETH"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="lv-input"
        />
        <button
          onClick={handleDeposit}
          disabled={isPending}
          className="lv-btn-primary sm:min-w-32"
        >
          {isPending ? "Depositing..." : "Deposit"}
        </button>
      </div>

      {!biometricRegistered && (
        <p className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">
          Deposit does not require biometric registration. You can set up
          recovery later from the optional biometric section.
        </p>
      )}

      {error && <p className="lv-status-error mt-4">{error}</p>}
    </div>
  );
}
