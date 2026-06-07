import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAccount, useSignMessage } from "wagmi";
import { isAddress } from "viem";
import { ORACLE_BASE_URL } from "../config/contract";
import { useToast } from "./ToastContext";

async function readOracleJson(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const data = await response.json();
      throw new Error(data.error || fallbackMessage);
    }

    throw new Error(
      response.status === 404
        ? `${fallbackMessage}. Oracle endpoint not found. Restart npm run oracle.`
        : fallbackMessage
    );
  }

  if (!contentType.includes("application/json")) {
    throw new Error(`${fallbackMessage}. Oracle returned a non-JSON response.`);
  }

  return response.json();
}

function shortAddress(value) {
  if (!value) return "Not provided";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function GuardianSignPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const lostWallet = params.get("user") || "";
  const replacementWallet = params.get("caller") || "";

  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { notify } = useToast();

  const [status, setStatus] = useState("");
  const [approvalState, setApprovalState] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const isValidRequest = isAddress(lostWallet) && isAddress(replacementWallet);

  const handleGuardianSign = async () => {
    try {
      if (!isValidRequest) {
        throw new Error("This guardian request link is invalid or incomplete.");
      }
      if (!isConnected || !address) {
        throw new Error("Connect the guardian wallet first.");
      }
      if (lostWallet.toLowerCase() === replacementWallet.toLowerCase()) {
        throw new Error("Lost wallet and replacement wallet must be different.");
      }

      setIsBusy(true);
      setStatus("Loading guardian request...");

      const startResult = await fetch(`${ORACLE_BASE_URL}/guardian-recovery/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: lostWallet, caller: replacementWallet }),
      }).then((r) => readOracleJson(r, "Guardian request failed to load"));

      if (!startResult.success) {
        throw new Error(startResult.error || "Guardian request failed to load");
      }

      const allowedGuardians = startResult.guardians || [];
      const isGuardian = allowedGuardians.some(
        (guardian) => guardian.toLowerCase() === address.toLowerCase()
      );

      if (!isGuardian) {
        throw new Error(
          `Connected wallet ${shortAddress(address)} is not one of the configured guardians.`
        );
      }

      setStatus("Please sign the guardian approval message in your wallet.");
      const signature = await signMessageAsync({ message: startResult.message });

      const approveResult = await fetch(`${ORACLE_BASE_URL}/guardian-recovery/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: lostWallet,
          caller: replacementWallet,
          guardian: address,
          signature,
          requestId: startResult.requestId,
        }),
      }).then((r) => readOracleJson(r, "Guardian approval failed"));

      if (!approveResult.success) {
        throw new Error(approveResult.error || "Guardian approval failed");
      }

      setApprovalState(approveResult);
      setStatus(
        approveResult.ready
          ? "Approval recorded. Recovery threshold is complete."
          : `Approval recorded. ${approveResult.approvals}/${approveResult.threshold} approvals collected.`
      );
      notify({
        title: "Guardian approval signed",
        message: `${approveResult.approvals}/${approveResult.threshold} approvals collected.`,
        type: approveResult.ready ? "success" : "info",
      });
    } catch (err) {
      setStatus(`Guardian signing failed: ${err.message}`);
      notify({
        title: "Guardian signing failed",
        message: err.message,
        type: "error",
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <section className="lv-glass p-6">
        <p className="lv-eyebrow">Guardian approval</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Sign Recovery Request
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Open this page as a configured guardian, connect your guardian wallet,
          and sign the approval message. This does not transfer funds by itself.
        </p>
      </section>

      <section className="lv-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="guardian-request-box">
            <span>Lost wallet</span>
            <strong>{shortAddress(lostWallet)}</strong>
          </div>
          <div className="guardian-request-box">
            <span>Replacement wallet</span>
            <strong>{shortAddress(replacementWallet)}</strong>
          </div>
          <div className="guardian-request-box">
            <span>Connected guardian</span>
            <strong>{shortAddress(address)}</strong>
          </div>
          <div className="guardian-request-box">
            <span>Status</span>
            <strong>
              {approvalState
                ? `${approvalState.approvals}/${approvalState.threshold} approvals`
                : "Waiting for signature"}
            </strong>
          </div>
        </div>

        {!isValidRequest && (
          <div className="lv-status-error mt-5">
            This request link is missing a valid lost wallet or replacement wallet.
          </div>
        )}

        {!isConnected && (
          <div className="lv-status-warning mt-5">
            Use the wallet button in the header to connect your guardian wallet.
          </div>
        )}

        {status && (
          <div
            className={`mt-5 ${
              status.toLowerCase().includes("failed")
                ? "lv-status-error"
                : approvalState
                  ? "lv-status-success"
                  : "lv-status-warning"
            }`}
          >
            {status}
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleGuardianSign}
            disabled={isBusy || !isValidRequest || !isConnected}
            className="lv-btn-primary"
          >
            {isBusy ? "Signing..." : "Sign As Guardian"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/app/recovery")}
            className="lv-btn-secondary"
          >
            Back to Recovery
          </button>
        </div>
      </section>
    </div>
  );
}
