import React, { useState, useEffect } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { VAULT_ABI, VAULT_ADDRESS } from "../config/contract";
import { useToast } from "./ToastContext";
import { useActivity } from "./ActivityContext";

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function TriggerInheritance() {
  const { address: caller } = useAccount();
  const [owner, setOwner] = useState("");
  const [canClaim, setCanClaim] = useState(false);

  const { data: vault, refetch, isLoading } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getVault",
    args: [owner || EMPTY_ADDRESS],
    query: { enabled: Boolean(owner) },
  });

  const { data: txHash, writeContract, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { notify } = useToast();
  const { addActivity } = useActivity();

  useEffect(() => {
    if (!isSuccess) return;
    notify({
      title: "Inheritance confirmed",
      message: "The inheritance transaction completed on-chain.",
      type: "success",
    });
    addActivity(
      "Recovery successful",
      "Inheritance transaction confirmed on-chain.",
      "success"
    );
  }, [addActivity, isSuccess, notify]);

  useEffect(() => {
    if (!vault) {
      setCanClaim(false);
      return;
    }

    const balance = vault.balance ?? 0n;
    const inactivity = Number(vault.inactivityPeriod ?? 0n);
    const lastHeartbeat = Number(vault.lastHeartbeat ?? 0n);
    const heir = vault.heir ?? EMPTY_ADDRESS;
    const now = Math.floor(Date.now() / 1000);

    setCanClaim(
      now > lastHeartbeat + inactivity && balance > 0n && heir !== EMPTY_ADDRESS
    );
  }, [vault]);

  const handleTrigger = () => {
    if (!owner) {
      notify({
        title: "Owner address required",
        message: "Enter the vault owner address before checking inheritance.",
      });
      return;
    }
    try {
      writeContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "triggerInheritance",
        args: [owner],
      });
    } catch (err) {
      console.error(err);
      notify({
        title: "Transaction failed",
        message: "Inheritance transaction failed to start.",
        type: "error",
      });
    }
  };

  return (
    <div className="lv-card">
      <p className="lv-eyebrow">Inheritance</p>
      <h2 className="mt-2 text-xl font-semibold text-white">
        Trigger inheritance
      </h2>
      <p className="lv-muted mt-1">
        Check whether an inactive vault can be claimed by its heir.
      </p>

      <input
        type="text"
        placeholder="Enter vault owner address"
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        className="lv-input mt-5"
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => refetch()}
          className="lv-btn-secondary"
          disabled={!owner}
        >
          Load Vault
        </button>
        <button
          onClick={() => setOwner(caller || "")}
          className="lv-btn-secondary"
        >
          Use My Address
        </button>
      </div>

      {isLoading ? (
        <p className="lv-muted mt-4">Checking eligibility...</p>
      ) : (
        <p className={canClaim ? "lv-status-success mt-4" : "lv-status-warning mt-4"}>
          Can claim: {canClaim ? "Yes" : "No"}
        </p>
      )}

      <button
        onClick={handleTrigger}
        disabled={!canClaim || isPending}
        className="lv-btn-danger mt-4 w-full"
      >
        {isPending ? "Processing..." : "Trigger Inheritance"}
      </button>

      {isSuccess && (
        <p className="lv-status-success mt-4">
          Inheritance transaction confirmed.
        </p>
      )}
    </div>
  );
}
