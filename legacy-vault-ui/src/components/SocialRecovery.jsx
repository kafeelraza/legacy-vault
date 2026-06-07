import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAccount,
  useSignMessage,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { isAddress } from "viem";
import { ORACLE_BASE_URL, VAULT_ABI, VAULT_ADDRESS } from "../config/contract";
import { useToast } from "./ToastContext";
import { useActivity } from "./ActivityContext";
import useContractFeatures from "./useContractFeatures";

function base64urlToUint8Array(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + (4 - (base64.length % 4)) % 4,
    "="
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function bufferToBase64url(buffer) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function buildGuardianSetupMessage(wallet, guardians, threshold) {
  return [
    "LegacyVault Guardian Setup",
    `Wallet: ${wallet.toLowerCase()}`,
    `Guardians: ${guardians.map((item) => item.toLowerCase()).sort().join(",")}`,
    `Threshold: ${threshold}`,
  ].join("\n");
}

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

export default function SocialRecovery() {
  const [userAddress, setUserAddress] = useState("");
  const [newWallet, setNewWallet] = useState("");
  const [recoveryMode, setRecoveryMode] = useState("passkey");
  const [step, setStep] = useState("idle");
  const [status, setStatus] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [guardianInputs, setGuardianInputs] = useState(["", "", ""]);
  const [guardianThreshold, setGuardianThreshold] = useState(2);
  const [guardianProfile, setGuardianProfile] = useState(null);
  const [guardianMessage, setGuardianMessage] = useState("");
  const [guardianStatus, setGuardianStatus] = useState(null);
  const [guardianDeliveryMode, setGuardianDeliveryMode] = useState("link");
  const [isGuardianBusy, setIsGuardianBusy] = useState(false);
  const [guardianManagerOpen, setGuardianManagerOpen] = useState(false);

  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const navigate = useNavigate();
  const { notify } = useToast();
  const { addActivity } = useActivity();
  const contractFeatures = useContractFeatures();

  useEffect(() => {
    if (!address) {
      setGuardianInputs(["", "", ""]);
      setGuardianThreshold(2);
      setGuardianProfile(null);
      return;
    }

    let cancelled = false;

    const loadGuardianProfile = async () => {
      try {
        const profile = await fetch(
          `${ORACLE_BASE_URL}/recovery/profile/${address}`
        ).then((response) =>
          readOracleJson(response, "Guardian profile could not be loaded")
        );

        if (cancelled) return;

        const savedGuardians = Array.isArray(profile.guardians)
          ? profile.guardians
          : [];
        setGuardianProfile(
          savedGuardians.length > 0
            ? {
                guardians: savedGuardians,
                guardianThreshold: profile.guardianThreshold,
              }
            : null
        );
        setGuardianInputs(
          savedGuardians.length > 0 ? savedGuardians : ["", "", ""]
        );
        setGuardianThreshold(
          savedGuardians.length > 0 ? profile.guardianThreshold : 2
        );
      } catch (err) {
        if (!cancelled) {
          setStatus(`Guardian profile warning: ${err.message}`);
        }
      }
    };

    loadGuardianProfile();

    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    if (!guardianManagerOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isGuardianBusy) {
        setGuardianManagerOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [guardianManagerOpen, isGuardianBusy]);

  const replacementWallet = newWallet || address || "";
  const guardianRequestLink =
    guardianStatus && isAddress(userAddress) && isAddress(replacementWallet)
      ? `${window.location.origin}/app/recovery/guardian-sign?user=${encodeURIComponent(
          userAddress
        )}&caller=${encodeURIComponent(replacementWallet)}`
      : "";

  const setErrorStatus = (title, err) => {
    setStatus(`${title}: ${err.message}`);
    notify({ title, message: err.message, type: "error" });
  };

  const handleSaveGuardians = async () => {
    try {
      if (!address) throw new Error("Connect the owner wallet first");

      const guardians = guardianInputs.map((item) => item.trim()).filter(Boolean);
      const uniqueGuardians = [...new Set(guardians.map((item) => item.toLowerCase()))];
      if (uniqueGuardians.length < 2) throw new Error("Add at least two guardians");
      if (uniqueGuardians.some((item) => !isAddress(item))) {
        throw new Error("Every guardian must be a valid wallet address");
      }
      if (uniqueGuardians.includes(address.toLowerCase())) {
        throw new Error("Owner wallet cannot also be a guardian");
      }
      if (uniqueGuardians.length > 10) {
        throw new Error("A maximum of 10 guardians can be configured");
      }
      if (
        !Number.isInteger(guardianThreshold) ||
        guardianThreshold < 2 ||
        guardianThreshold > uniqueGuardians.length
      ) {
        throw new Error("Threshold must be at least 2 and not exceed guardian count");
      }

      setIsGuardianBusy(true);
      setStatus("Sign guardian setup with the owner wallet...");
      const message = buildGuardianSetupMessage(address, uniqueGuardians, guardianThreshold);
      const signature = await signMessageAsync({ message });

      const result = await fetch(`${ORACLE_BASE_URL}/guardians/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: address,
          guardians: uniqueGuardians,
          threshold: guardianThreshold,
          signature,
        }),
      }).then((r) => readOracleJson(r, "Guardian setup failed"));

      if (!result.success) throw new Error(result.error || "Guardian setup failed");

      setGuardianProfile({
        guardians: result.guardians,
        guardianThreshold: result.guardianThreshold,
      });
      setStatus("Guardian recovery setup saved.");
      notify({
        title: "Guardians saved",
        message: `${result.guardianThreshold} of ${result.guardians.length} approvals required.`,
        type: "success",
      });
      addActivity("Guardians updated", "Guardian recovery threshold was configured.", "success");
    } catch (err) {
      setErrorStatus("Guardian setup failed", err);
    } finally {
      setIsGuardianBusy(false);
    }
  };

  const handleAddGuardian = () => {
    setGuardianInputs((current) =>
      current.length >= 10 ? current : [...current, ""]
    );
  };

  const handleRemoveGuardian = (index) => {
    setGuardianInputs((current) => {
      if (current.length <= 2) return current;

      const next = current.filter((_, itemIndex) => itemIndex !== index);
      const configuredCount = next.filter((item) => item.trim()).length;
      setGuardianThreshold((currentThreshold) =>
        Math.max(2, Math.min(currentThreshold, configuredCount || 2))
      );
      return next;
    });
  };

  const handleVerifyPasskey = async () => {
    if (!isAddress(userAddress)) {
      notify({
        title: "Lost wallet required",
        message: "Enter a valid wallet address you want to recover.",
      });
      return;
    }

    if (!contractFeatures.supportsNonceRecovery) {
      notify({
        title: "Recovery unavailable",
        message: "The deployed contract does not support nonce-based recovery.",
        type: "error",
      });
      return;
    }

    try {
      setStatus("Requesting authentication challenge...");
      addActivity("Recovery attempted", "Passkey recovery verification started.", "info");

      const options = await fetch(`${ORACLE_BASE_URL}/verify/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: userAddress }),
      }).then((r) => readOracleJson(r, "Passkey challenge failed"));

      if (options.error) throw new Error(options.error);

      options.challenge = base64urlToUint8Array(options.challenge);
      if (options.allowCredentials) {
        options.allowCredentials = options.allowCredentials.map((cred) => ({
          ...cred,
          id: base64urlToUint8Array(cred.id),
        }));
      }

      const assertion = await navigator.credentials.get({ publicKey: options });
      const authResponse = {
        id: assertion.id,
        rawId: bufferToBase64url(assertion.rawId),
        type: assertion.type,
        response: {
          authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
          clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
          signature: bufferToBase64url(assertion.response.signature),
          userHandle: assertion.response.userHandle
            ? bufferToBase64url(assertion.response.userHandle)
            : null,
        },
      };

      setStatus("Verifying passkey...");
      const verifyRes = await fetch(`${ORACLE_BASE_URL}/verify/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: userAddress, response: authResponse }),
      }).then((r) => readOracleJson(r, "Passkey verification failed"));

      if (!verifyRes.verified) {
        throw new Error(verifyRes.error || "Passkey verification failed");
      }

      localStorage.setItem("token", verifyRes.token);
      setStep("verified");
      setStatus("Passkey verified. You can now recover funds.");
      notify({
        title: "Passkey verified",
        message: "Oracle signing is now available for this recovery session.",
        type: "success",
      });
      addActivity("Recovery verified", "Passkey verification completed.", "success");
    } catch (err) {
      console.error("Verify error:", err);
      setErrorStatus("Verification failed", err);
    }
  };

  const handleStartGuardianRecovery = async () => {
    try {
      if (!isAddress(userAddress)) throw new Error("Enter a valid lost wallet address");
      if (!isAddress(replacementWallet)) {
        throw new Error("Connect or enter a valid replacement wallet address");
      }
      if (userAddress.toLowerCase() === replacementWallet.toLowerCase()) {
        throw new Error("Lost wallet and replacement wallet must be different");
      }

      setIsGuardianBusy(true);
      const result = await fetch(`${ORACLE_BASE_URL}/guardian-recovery/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: userAddress, caller: replacementWallet }),
      }).then((r) => readOracleJson(r, "Guardian recovery failed to start"));

      if (!result.success) throw new Error(result.error || "Guardian recovery failed to start");

      setGuardianMessage(result.message);
      setGuardianStatus((current) => ({
        ...current,
        ...result,
        guardians: result.guardians || current?.guardians || [],
      }));
      setNewWallet(replacementWallet);
      setStatus("Guardian request created. Ask configured guardians to sign approval.");
      notify({
        title: "Guardian request ready",
        message: `${result.approvals}/${result.threshold} approvals collected.`,
        type: "success",
      });
    } catch (err) {
      setErrorStatus("Guardian recovery failed", err);
    } finally {
      setIsGuardianBusy(false);
    }
  };

  const handleCopyGuardianLink = async () => {
    try {
      if (!guardianRequestLink) throw new Error("Start a guardian request first");
      await navigator.clipboard.writeText(guardianRequestLink);
      notify({
        title: "Request link copied",
        message: "Send this link to the selected guardian.",
        type: "success",
      });
    } catch (err) {
      setErrorStatus("Copy failed", err);
    }
  };

  const handleGuardianApprove = async () => {
    try {
      if (!guardianMessage) throw new Error("Start guardian recovery first");
      if (!address) throw new Error("Connect a configured guardian wallet");

      setIsGuardianBusy(true);
      setStatus("Guardian is signing recovery approval...");
      const signature = await signMessageAsync({ message: guardianMessage });

      const result = await fetch(`${ORACLE_BASE_URL}/guardian-recovery/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: userAddress,
          caller: replacementWallet,
          guardian: address,
          signature,
          requestId: guardianStatus?.requestId,
        }),
      }).then((r) => readOracleJson(r, "Guardian approval failed"));

      if (!result.success) throw new Error(result.error || "Guardian approval failed");

      setGuardianStatus((current) => ({
        ...current,
        ...result,
        guardians: current?.guardians || [],
      }));
      setStatus(
        result.ready
          ? "Guardian threshold reached. Recovery can now continue."
          : `Guardian approval collected (${result.approvals}/${result.threshold}).`
      );
      notify({
        title: "Guardian approval recorded",
        message: `${result.approvals}/${result.threshold} approvals collected.`,
        type: result.ready ? "success" : "info",
      });
      addActivity("Guardian approved recovery", "A guardian signed the recovery request.", "success");
    } catch (err) {
      setErrorStatus("Guardian approval failed", err);
    } finally {
      setIsGuardianBusy(false);
    }
  };

  const handleGuardianToken = async () => {
    try {
      if (!isAddress(userAddress) || !isAddress(replacementWallet)) {
        throw new Error("Lost wallet and replacement wallet are required");
      }
      if (userAddress.toLowerCase() === replacementWallet.toLowerCase()) {
        throw new Error("Lost wallet and replacement wallet must be different");
      }

      setIsGuardianBusy(true);
      const result = await fetch(`${ORACLE_BASE_URL}/guardian-recovery/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: userAddress,
          caller: replacementWallet,
          requestId: guardianStatus?.requestId,
        }),
      }).then((r) => readOracleJson(r, "Guardian threshold verification failed"));

      if (!result.success) throw new Error(result.error || "Guardian threshold not met");

      localStorage.setItem("token", result.token);
      setStep("verified");
      setStatus("Guardian threshold verified. You can now recover funds.");
      notify({
        title: "Guardian recovery verified",
        message: "Oracle signing is now available for this recovery session.",
        type: "success",
      });
      addActivity("Guardian recovery verified", "Guardian threshold was completed.", "success");
    } catch (err) {
      setErrorStatus("Guardian verification failed", err);
    } finally {
      setIsGuardianBusy(false);
    }
  };

  const handleRecover = async () => {
    if (step !== "verified") {
      notify({
        title: "Verification required",
        message: "Complete passkey or guardian verification first.",
      });
      return;
    }
    if (!isAddress(newWallet)) {
      notify({
        title: "New wallet required",
        message: "Enter a valid replacement wallet address.",
      });
      return;
    }
    if (userAddress.toLowerCase() === newWallet.toLowerCase()) {
      notify({
        title: "Wallet mismatch",
        message: "Lost wallet and replacement wallet must be different.",
        type: "error",
      });
      return;
    }
    if (!contractFeatures.supportsNonceRecovery) {
      notify({
        title: "Recovery unavailable",
        message: "The deployed contract does not support nonce-based recovery.",
        type: "error",
      });
      return;
    }
    if (address?.toLowerCase() !== newWallet.toLowerCase()) {
      notify({
        title: "Wallet mismatch",
        message: "Connect the replacement wallet first.",
        type: "error",
      });
      return;
    }

    try {
      setIsRecovering(true);
      setStatus("Requesting oracle signature...");

      const token = localStorage.getItem("token");
      if (!token) throw new Error("Complete recovery verification first");

      const signRes = await fetch(`${ORACLE_BASE_URL}/sign-recovery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user: userAddress, caller: newWallet }),
      }).then((r) => readOracleJson(r, "Oracle signing failed"));

      if (!signRes.signature) throw new Error(signRes.error || "Oracle error");

      setStatus("Sending recovery transaction...");
      const hash = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "recoverWithBiometric",
        args: [
          userAddress,
          signRes.signature,
          Number(signRes.nonce),
          Number(signRes.expiry),
        ],
      });

      setTxHash(hash);
      setStatus(`Transaction sent: ${hash}`);
      notify({
        title: "Recovery transaction sent",
        message: `${hash.slice(0, 10)}...`,
        type: "success",
      });
      addActivity(
        "Recovery successful",
        `Recovery transaction submitted: ${hash.slice(0, 10)}...`,
        "success"
      );
    } catch (err) {
      console.error("Recovery error:", err);
      setErrorStatus("Recovery failed", err);
    } finally {
      setIsRecovering(false);
    }
  };

  const statusClass =
    status.toLowerCase().includes("failed") ||
    status.toLowerCase().includes("error") ||
    status.toLowerCase().includes("rejected")
    ? "lv-status-error"
    : step === "verified"
      ? "lv-status-success"
      : "lv-status-warning";

  return (
    <div className="max-w-5xl space-y-6">
      <section className="lv-glass p-6">
        <p className="lv-eyebrow">Social recovery</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Recovery Center
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Recover vault access through a registered passkey or a guardian
          threshold. LegacyVault does not recover private keys.
        </p>
      </section>

      <section className="lv-glass p-6">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="lv-eyebrow">Recovery setup</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              Configure guardians
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Save trusted guardian wallets for demo social recovery. The owner
              wallet signs this setup so the backend can verify intent.
            </p>
          </div>

          <div className="lv-guardian-summary">
            <div className="lv-guardian-summary-top">
              <div>
                <p className="lv-guardian-summary-label">Guardian protection</p>
                <h3>
                  {guardianProfile
                    ? `${guardianProfile.guardians.length} trusted guardians`
                    : "Not configured"}
                </h3>
                <p>
                  {guardianProfile
                    ? `${guardianProfile.guardianThreshold} approvals required to recover.`
                    : "Add trusted wallets to enable threshold recovery."}
                </p>
              </div>
              <span className={guardianProfile ? "is-active" : ""}>
                {guardianProfile ? "Active" : "Setup needed"}
              </span>
            </div>

            {guardianProfile && (
              <div className="lv-guardian-avatar-row" aria-label="Configured guardians">
                {guardianProfile.guardians.slice(0, 5).map((guardian, index) => (
                  <span key={guardian} title={guardian}>
                    G{index + 1}
                  </span>
                ))}
                {guardianProfile.guardians.length > 5 && (
                  <span>+{guardianProfile.guardians.length - 5}</span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setGuardianManagerOpen(true)}
              disabled={!address}
              className="lv-btn-primary mt-4 w-full"
            >
              {guardianProfile ? "Manage Guardians" : "Set Up Guardians"}
            </button>
            {!address && (
              <p className="lv-guardian-summary-help">
                Connect the owner wallet to configure recovery guardians.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="lv-glass p-6 sm:p-8">
        {!address && (
          <div className="lv-status-warning mb-6">
            Connect the replacement wallet before submitting a recovery
            transaction.
          </div>
        )}

        {!contractFeatures.supportsNonceRecovery && !contractFeatures.isLoading && (
          <div className="lv-status-warning mb-6">
            Social Recovery is disabled because the deployed contract did not
            expose nonce-based recovery through usedNonces(address) and
            recoverWithBiometric(address,bytes,uint256,uint256).
          </div>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setRecoveryMode("passkey")}
            className={recoveryMode === "passkey" ? "lv-btn-primary" : "lv-btn-secondary"}
          >
            Passkey Recovery
          </button>
          <button
            type="button"
            onClick={() => setRecoveryMode("guardian")}
            className={recoveryMode === "guardian" ? "lv-btn-primary" : "lv-btn-secondary"}
          >
            Guardian Recovery
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="lv-eyebrow">JWT oracle flow</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {recoveryMode === "passkey"
                ? "Verify, sign, recover"
                : "Approve, threshold, recover"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {recoveryMode === "passkey"
                ? "Start with the lost wallet address, complete passkey verification, then connect the replacement wallet to submit recovery."
                : "Start a guardian request, collect enough signed approvals, then request an oracle recovery token."}
            </p>
            <div className="mt-6 grid gap-3">
              {(recoveryMode === "passkey"
                ? ["Challenge", "Passkey verify", "Oracle signature"]
                : ["Guardian request", "Signed approvals", "Oracle signature"]
              ).map((item, index) => (
                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-200">
                    {index + 1}. {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lv-card">
            <label className="mb-2 block text-sm text-slate-400">
              Lost wallet address
            </label>
            <input
              value={userAddress}
              onChange={(e) => setUserAddress(e.target.value)}
              placeholder="0x..."
              className="lv-input font-mono"
            />

            {recoveryMode === "passkey" ? (
              <button
                onClick={handleVerifyPasskey}
                disabled={!contractFeatures.supportsNonceRecovery}
                className="lv-btn-primary mt-4 w-full"
              >
                Verify Passkey
              </button>
            ) : (
              <div className="mt-4 grid gap-3">
                <label className="block text-sm text-slate-400">
                  Replacement wallet address
                </label>
                <input
                  value={newWallet || address || ""}
                  onChange={(e) => setNewWallet(e.target.value)}
                  placeholder="0x..."
                  className="lv-input font-mono"
                />
                <div className="lv-status-warning">
                  Replacement wallet should be the new wallet you control. It
                  must be different from the lost wallet and connected before
                  the final recovery transaction.
                </div>
                <button
                  type="button"
                  onClick={handleStartGuardianRecovery}
                  disabled={isGuardianBusy || !contractFeatures.supportsNonceRecovery}
                  className="lv-btn-secondary w-full"
                >
                  {guardianStatus ? "Refresh Guardian Approvals" : "Start Guardian Request"}
                </button>
                {guardianStatus && (
                  <div className="guardian-approval-panel">
                    <div className="guardian-mode-toggle">
                      <button
                        type="button"
                        onClick={() => setGuardianDeliveryMode("link")}
                        className={
                          guardianDeliveryMode === "link"
                            ? "lv-btn-primary"
                            : "lv-btn-secondary"
                        }
                      >
                        Other Device / Share Link
                      </button>
                      <button
                        type="button"
                        onClick={() => setGuardianDeliveryMode("same-device")}
                        className={
                          guardianDeliveryMode === "same-device"
                            ? "lv-btn-primary"
                            : "lv-btn-secondary"
                        }
                      >
                        Same Device Demo
                      </button>
                    </div>

                    {guardianDeliveryMode === "link" ? (
                      <div className="grid gap-3">
                        <p className="text-sm leading-6 text-slate-400">
                          Send this request link to a configured guardian. They
                          open it on their own device, connect their guardian
                          wallet, and sign the approval message.
                        </p>
                        <input
                          value={guardianRequestLink}
                          readOnly
                          className="lv-input font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleCopyGuardianLink}
                          className="lv-btn-secondary w-full"
                        >
                          Copy Guardian Request Link
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        <p className="text-sm leading-6 text-slate-400">
                          Use this only for local testing. Switch the connected
                          wallet to a configured guardian, then sign.
                        </p>
                        <button
                          type="button"
                          onClick={handleGuardianApprove}
                          disabled={isGuardianBusy || !guardianMessage}
                          className="lv-btn-secondary w-full"
                        >
                          Sign With Connected Guardian Wallet
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleGuardianToken}
                  disabled={isGuardianBusy || !guardianStatus?.ready}
                  className="lv-btn-primary w-full"
                >
                  Verify Guardian Threshold
                </button>
                {guardianStatus && (
                  <div className="grid gap-3">
                    <div
                      className={
                        guardianStatus.ready ? "lv-status-success" : "lv-status-warning"
                      }
                    >
                      Approvals: {guardianStatus.approvals}/{guardianStatus.threshold}
                    </div>
                    {guardianStatus.guardians?.length > 0 && (
                      <div className="guardian-list">
                        {guardianStatus.guardians.map((guardian) => {
                          const signed = guardianStatus.approvedGuardians?.some(
                            (item) => item.toLowerCase() === guardian.toLowerCase()
                          );
                          return (
                            <div key={guardian} className="guardian-list-item">
                              <span>{guardian}</span>
                              <strong>{signed ? "Signed" : "Pending"}</strong>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === "verified" && (
              <div className="mt-5">
                <label className="mb-2 block text-sm text-slate-400">
                  New wallet address
                </label>
                <input
                  value={newWallet}
                  onChange={(e) => setNewWallet(e.target.value)}
                  placeholder="0x..."
                  className="lv-input font-mono"
                />

                <button
                  disabled={
                    isRecovering ||
                    isConfirming ||
                    !contractFeatures.supportsNonceRecovery
                  }
                  onClick={handleRecover}
                  className="lv-btn-primary mt-4 w-full"
                >
                  {isRecovering || isConfirming ? "Recovering..." : "Recover Funds"}
                </button>
              </div>
            )}

            {isSuccess && txHash && (
              <div className="lv-status-success mt-5">
                Recovery transaction confirmed. Hash: {txHash.slice(0, 10)}...
              </div>
            )}

            {status && <div className={`${statusClass} mt-5`}>{status}</div>}

            <button
              onClick={() => navigate("/app")}
              className="lv-btn-secondary mt-5 w-full"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </section>

      {guardianManagerOpen && (
        <div
          className="lv-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isGuardianBusy) {
              setGuardianManagerOpen(false);
            }
          }}
        >
          <section
            className="lv-guardian-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guardian-manager-title"
          >
            <header className="lv-passkey-modal-header">
              <div>
                <p className="lv-eyebrow">Recovery security</p>
                <h2 id="guardian-manager-title">Manage guardians</h2>
                <p>
                  Choose trusted wallets and the number of approvals required
                  before recovery can continue.
                </p>
              </div>
              <button
                type="button"
                className="lv-modal-close"
                onClick={() => setGuardianManagerOpen(false)}
                disabled={isGuardianBusy}
                aria-label="Close guardian manager"
              >
                ×
              </button>
            </header>

            <div className="lv-guardian-modal-content">
              {guardianProfile && (
                <div className="lv-guardian-update-warning">
                  Updating this list replaces the existing guardians and
                  invalidates pending guardian recovery requests.
                </div>
              )}

              <div className="lv-guardian-input-list">
                {guardianInputs.map((guardian, index) => (
                  <div key={index} className="lv-guardian-input-row">
                    <span>G{index + 1}</span>
                    <input
                      value={guardian}
                      onChange={(event) =>
                        setGuardianInputs((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item
                          )
                        )
                      }
                      placeholder={`Guardian ${index + 1} wallet address`}
                      className="lv-input font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveGuardian(index)}
                      disabled={guardianInputs.length <= 2 || isGuardianBusy}
                      className="lv-guardian-remove"
                      aria-label={`Remove guardian ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddGuardian}
                disabled={guardianInputs.length >= 10 || isGuardianBusy}
                className="lv-btn-secondary w-full"
              >
                Add Another Guardian
              </button>

              <div className="lv-guardian-threshold">
                <div>
                  <strong>Approval threshold</strong>
                  <span>
                    Minimum approvals needed before recovery is authorized.
                  </span>
                </div>
                <input
                  type="number"
                  min="2"
                  max={guardianInputs.filter(Boolean).length || 3}
                  value={guardianThreshold}
                  onChange={(event) =>
                    setGuardianThreshold(Number(event.target.value))
                  }
                  className="lv-input"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveGuardians}
                disabled={isGuardianBusy || !address}
                className="lv-btn-primary w-full"
              >
                {isGuardianBusy
                  ? "Waiting for owner signature..."
                  : guardianProfile
                    ? "Save Guardian Changes"
                    : "Enable Guardian Recovery"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
