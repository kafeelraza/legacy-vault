import React, { useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { VAULT_ABI, VAULT_ADDRESS } from "../config/contract";
import { useToast } from "./ToastContext";
import { useActivity } from "./ActivityContext";

export default function HeartbeatButton() {
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  const { isConnected } = useAccount();
  const { notify } = useToast();
  const { addActivity } = useActivity();

  useEffect(() => {
    if (!isSuccess) return;
    notify({
      title: "Heartbeat confirmed",
      message: "Your vault activity timestamp was refreshed.",
      type: "success",
    });
    addActivity("Heartbeat sent", "Vault heartbeat confirmed on-chain.", "success");
  }, [addActivity, isSuccess, notify]);

  const handleHeartbeat = () => {
    if (!isConnected) {
      notify({
        title: "Wallet required",
        message: "Connect your wallet before sending a heartbeat.",
      });
      return;
    }

    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "heartbeat",
    });
  };

  return (
    <div className="lv-card">
      <p className="lv-eyebrow">Heartbeat</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Confirm activity</h2>
      <p className="lv-muted mt-1">
        Refresh your last heartbeat timestamp with an on-chain transaction.
      </p>

      <button
        onClick={handleHeartbeat}
        disabled={isPending || !isConnected}
        className="lv-btn-primary mt-5 w-full"
      >
        {isPending ? "Sending heartbeat..." : "Send Heartbeat"}
      </button>

      {isSuccess && <p className="lv-status-success mt-4">Heartbeat sent.</p>}
      {!isConnected && (
        <p className="lv-status-warning mt-4">
          Connect your wallet to send a heartbeat.
        </p>
      )}
    </div>
  );
}
