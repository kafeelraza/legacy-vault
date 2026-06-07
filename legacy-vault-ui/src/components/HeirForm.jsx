import React, { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { VAULT_ABI, VAULT_ADDRESS } from "../config/contract";
import { useToast } from "./ToastContext";
import { useActivity } from "./ActivityContext";

export default function HeirForm() {
  const [heir, setHeir] = useState("");
  const { isConnected } = useAccount();
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });
  const { notify } = useToast();
  const { addActivity } = useActivity();

  useEffect(() => {
    if (!isSuccess) return;
    notify({
      title: "Heir updated",
      message: "The heir address was confirmed on-chain.",
      type: "success",
    });
    addActivity("Heir updated", "Heir update confirmed on-chain.", "success");
  }, [addActivity, isSuccess, notify]);

  const handleAddHeir = () => {
    if (!isConnected) {
      notify({
        title: "Wallet required",
        message: "Connect your wallet before setting an heir.",
      });
      return;
    }

    if (!heir) {
      notify({
        title: "Heir address required",
        message: "Enter an heir wallet address before submitting.",
      });
      return;
    }
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "setHeir",
      args: [heir],
    });
    setHeir("");
  };

  return (
    <div className="lv-card">
      <p className="lv-eyebrow">Heir</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Assign heir</h2>
      <p className="lv-muted mt-1">
        Set the address allowed to receive funds after inactivity.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Enter heir address"
          value={heir}
          onChange={(e) => setHeir(e.target.value)}
          className="lv-input"
        />
        <button
          onClick={handleAddHeir}
          disabled={isPending || !isConnected}
          className="lv-btn-primary sm:min-w-36"
        >
          {isPending ? "Setting..." : "Set Heir"}
        </button>
      </div>

      {isSuccess && <p className="lv-status-success mt-4">Heir set successfully.</p>}
      {!isConnected && (
        <p className="lv-status-warning mt-4">
          Connect your wallet to set an heir.
        </p>
      )}
    </div>
  );
}
