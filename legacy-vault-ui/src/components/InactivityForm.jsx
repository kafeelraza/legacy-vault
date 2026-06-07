import React, { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { VAULT_ABI, VAULT_ADDRESS } from "../config/contract";
import { useToast } from "./ToastContext";
import { useActivity } from "./ActivityContext";

export default function InactivityForm() {
  const [period, setPeriod] = useState("");
  const { isConnected } = useAccount();
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  const { notify } = useToast();
  const { addActivity } = useActivity();

  useEffect(() => {
    if (!isSuccess) return;
    notify({
      title: "Inactivity period updated",
      message: "The heartbeat window was confirmed on-chain.",
      type: "success",
    });
    addActivity(
      "Inactivity updated",
      "Heartbeat window confirmed on-chain.",
      "success"
    );
  }, [addActivity, isSuccess, notify]);

  const handleSetPeriod = () => {
    if (!isConnected) {
      notify({
        title: "Wallet required",
        message: "Connect your wallet before setting inactivity.",
      });
      return;
    }

    if (!period) {
      notify({
        title: "Period required",
        message: "Enter an inactivity period in seconds.",
      });
      return;
    }
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "setInactivityPeriod",
      args: [BigInt(period)],
    });
    setPeriod("");
  };

  return (
    <div className="lv-card">
      <p className="lv-eyebrow">Inactivity</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Set heartbeat window</h2>
      <p className="lv-muted mt-1">
        Choose how long the vault waits before inheritance can be triggered.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="number"
          placeholder="Seconds, e.g. 2592000"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="lv-input"
        />
        <button
          onClick={handleSetPeriod}
          disabled={isPending || !isConnected}
          className="lv-btn-primary sm:min-w-36"
        >
          {isPending ? "Setting..." : "Set Period"}
        </button>
      </div>

      {isSuccess && <p className="lv-status-success mt-4">Period set successfully.</p>}
      {!isConnected && (
        <p className="lv-status-warning mt-4">
          Connect your wallet to set the inactivity period.
        </p>
      )}
    </div>
  );
}
