import React, { useState, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { startRegistration } from "@simplewebauthn/browser";
import DepositETH from "./DepositETH";
import VaultInfo from "./VaultInfo";
import InactivityForm from "./InactivityForm";
import HeartbeatButton from "./HeartbeatButton";
import { ORACLE_BASE_URL } from "../config/contract";
import { useToast } from "./ToastContext";
import { useActivity } from "./ActivityContext";

const vaultActions = [
  { label: "Deposit", target: "vault-deposit" },
  { label: "Vault Status", target: "vault-status" },
  { label: "Inactivity", target: "vault-inactivity" },
  { label: "Heartbeat", target: "vault-heartbeat" },
  { label: "Recovery Setup", target: "vault-recovery" },
];

function formatPasskeyDate(value) {
  if (!value) return "Never used";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CreateVault() {
  const { address, isConnected } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [passkeyLabel, setPasskeyLabel] = useState("");
  const [passkeyDetails, setPasskeyDetails] = useState([]);
  const [profileState, setProfileState] = useState("idle");
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [editingPasskeyId, setEditingPasskeyId] = useState(null);
  const [editPasskeyLabel, setEditPasskeyLabel] = useState("");
  const [revokeConfirmId, setRevokeConfirmId] = useState(null);
  const [managementBusyId, setManagementBusyId] = useState(null);
  const [passkeyManagerOpen, setPasskeyManagerOpen] = useState(false);
  const { signMessageAsync } = useSignMessage();
  const { notify } = useToast();
  const { addActivity } = useActivity();

  const handleDepositSuccess = () => {
    setRefreshKey((prev) => prev + 1);
    setStatus("Deposit submitted. Refreshing vault data.");
    notify({
      title: "Deposit submitted",
      message: "Vault data will refresh after confirmation.",
      type: "success",
    });
    addActivity("Deposit submitted", "A vault deposit transaction was submitted.", "success");
  };

  useEffect(() => {
    const checkRegistration = async () => {
      if (!address) {
        setBiometricRegistered(false);
        setPasskeyDetails([]);
        setProfileState("idle");
        setStatus("");
        return;
      }

      try {
        setProfileState("loading");
        const res = await fetch(`${ORACLE_BASE_URL}/recovery/profile/${address}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Recovery profile unavailable");

        if ((data.passkeys || 0) > 0) {
          setBiometricRegistered(true);
          setPasskeyDetails(data.passkeyDetails || []);
          setProfileState("registered");
          setStatus("Biometric recovery is already registered.");
        } else {
          setBiometricRegistered(false);
          setPasskeyDetails([]);
          setProfileState("unregistered");
          setStatus("");
        }
      } catch (err) {
        console.error("Check registration error:", err);
        setBiometricRegistered(false);
        setPasskeyDetails([]);
        setProfileState("offline");
        setStatus(
          `Recovery service unavailable. Check that the oracle is running at ${ORACLE_BASE_URL}.`
        );
      }
    };

    checkRegistration();
  }, [address, profileRefreshKey]);

  useEffect(() => {
    if (!passkeyManagerOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading && !managementBusyId) {
        setPasskeyManagerOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [loading, managementBusyId, passkeyManagerOpen]);

  const handleActionNavigation = (target) => {
    document.getElementById(target)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const handleBiometricRegister = async () => {
    if (!isConnected) {
      setStatus("Connect your wallet first.");
      notify({
        title: "Wallet required",
        message: "Connect your wallet before registering biometric recovery.",
      });
      return;
    }

    try {
      if (profileState === "offline") {
        throw new Error(
          `Recovery service is offline. Start the oracle at ${ORACLE_BASE_URL} and retry.`
        );
      }
      setLoading(true);
      setStatus("Requesting biometric registration options...");

      const res = await fetch(`${ORACLE_BASE_URL}/register/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: address }),
      });

      const options = await res.json();
      if (!res.ok) throw new Error(options.error || "Registration start failed");
      const registrationChallenge = options.challenge;

      const attResp = await startRegistration(options);
      setStatus("Approve this passkey with the owner wallet...");
      const ownerSignature = await signMessageAsync({
        message: [
          "LegacyVault Passkey Registration",
          `Wallet: ${address.toLowerCase()}`,
          `Challenge: ${registrationChallenge}`,
        ].join("\n"),
      });

      const verifyRes = await fetch(`${ORACLE_BASE_URL}/register/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: address,
          response: attResp,
          ownerSignature,
          label: passkeyLabel,
        }),
      });

      const verification = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verification.error || "Registration failed");
      }

      if (verification.success) {
        setBiometricRegistered(true);
        setPasskeyLabel("");
        setPasskeyDetails((current) => [
          ...current,
          verification.passkey,
        ]);
        setProfileState("registered");
        setStatus("Fingerprint registered successfully.");
        addActivity(
          "Biometric recovery available",
          "Fingerprint recovery was registered for this wallet.",
          "success"
        );
        notify({
          title: "Fingerprint registered",
          message: "Biometric recovery is ready for this wallet.",
          type: "success",
        });
      } else {
        setStatus("Registration failed.");
        notify({
          title: "Registration failed",
          message: "The oracle server rejected the registration response.",
          type: "error",
        });
      }
    } catch (err) {
      console.error(err);
      const message =
        err instanceof TypeError && err.message === "Failed to fetch"
          ? `Recovery service is offline. Start the oracle at ${ORACLE_BASE_URL} and retry.`
          : err.message || "Error during registration.";
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setProfileState("offline");
      }
      setStatus(message);
      notify({
        title: "Registration error",
        message,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyManagement = async (action, passkey) => {
    try {
      if (!address) throw new Error("Connect the owner wallet first");
      const label = action === "rename" ? editPasskeyLabel.trim() : "";
      if (action === "rename" && !label) {
        throw new Error("Enter a name for this passkey");
      }

      setManagementBusyId(passkey.id);
      setStatus(`Preparing passkey ${action} authorization...`);
      const startResponse = await fetch(`${ORACLE_BASE_URL}/passkeys/manage/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: address,
          action,
          passkeyId: passkey.id,
          label,
        }),
      });
      const startResult = await startResponse.json();
      if (!startResponse.ok) {
        throw new Error(startResult.error || "Passkey management request failed");
      }

      const ownerSignature = await signMessageAsync({
        message: startResult.message,
      });
      const finishResponse = await fetch(`${ORACLE_BASE_URL}/passkeys/manage/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: address,
          action,
          passkeyId: passkey.id,
          label,
          ownerSignature,
        }),
      });
      const finishResult = await finishResponse.json();
      if (!finishResponse.ok || !finishResult.success) {
        throw new Error(finishResult.error || "Passkey management failed");
      }

      setPasskeyDetails(finishResult.passkeys);
      setBiometricRegistered(finishResult.passkeys.length > 0);
      setEditingPasskeyId(null);
      setEditPasskeyLabel("");
      setRevokeConfirmId(null);
      const completedAction = action === "rename" ? "renamed" : "revoked";
      setStatus(`Passkey ${completedAction} successfully.`);
      notify({
        title: `Passkey ${completedAction}`,
        message:
          action === "rename"
            ? "The passkey name was updated."
            : "The selected passkey can no longer authorize recovery.",
        type: "success",
      });
      addActivity(
        `Passkey ${completedAction}`,
        `${passkey.label || "Passkey"} was ${completedAction}.`,
        "success"
      );
    } catch (err) {
      setStatus(err.message || "Passkey management failed.");
      notify({
        title: "Passkey management failed",
        message: err.message || "The passkey could not be updated.",
        type: "error",
      });
    } finally {
      setManagementBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
        <section className="lv-glass p-6">
          <p className="lv-eyebrow">Vault command center</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Manage Vault
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Deposit funds, review vault status, update inactivity settings, and
            send heartbeat transactions from one focused page.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div id="vault-deposit" className="scroll-mt-28">
            <DepositETH
              onDepositSuccess={handleDepositSuccess}
              biometricRegistered={biometricRegistered}
            />
          </div>
          <div id="vault-status" className="scroll-mt-28">
            <VaultInfo refreshKey={refreshKey} variant="compact" />
          </div>
        </section>

        <section id="vault-recovery" className="lv-glass scroll-mt-28 p-6">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="lv-eyebrow">Recovery readiness</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Optional biometric registration
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Register a synced passkey or add a second passkey from a backup
                device while the owner wallet is available. Deposits remain
                independent from recovery setup.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              {!isConnected && (
                <p className="lv-status-warning mb-4">
                  Please connect your wallet first.
                </p>
              )}

              {isConnected && profileState === "loading" && (
                <p className="lv-status-warning mb-4">
                  Checking biometric recovery status...
                </p>
              )}

              {isConnected && profileState === "offline" && (
                <div className="lv-status-error mb-4">
                  <p className="font-semibold">Recovery service offline</p>
                  <p className="mt-1">
                    Start the oracle backend at {ORACLE_BASE_URL}, then check
                    the status again.
                  </p>
                  <button
                    type="button"
                    onClick={() => setProfileRefreshKey((current) => current + 1)}
                    className="lv-btn-secondary mt-3 w-full"
                  >
                    Retry Status Check
                  </button>
                </div>
              )}

              {isConnected && profileState === "registered" && (
                <div className="lv-passkey-summary">
                  <div>
                    <p className="lv-passkey-summary-label">Recovery protected</p>
                    <p className="lv-passkey-summary-title">
                      {passkeyDetails.length} registered passkey
                      {passkeyDetails.length === 1 ? "" : "s"}
                    </p>
                    <p className="lv-passkey-summary-copy">
                      Manage trusted devices, labels, and recovery access.
                    </p>
                  </div>
                  <span className="lv-passkey-summary-badge">Active</span>
                </div>
              )}

              {isConnected && profileState === "unregistered" && (
                <p className="lv-status-warning mb-4">
                  Biometric recovery is not registered for this wallet.
                </p>
              )}

              <button
                onClick={() => setPasskeyManagerOpen(true)}
                disabled={
                  !isConnected ||
                  profileState === "loading" ||
                  profileState === "offline"
                }
                className="lv-btn-primary mt-4 w-full"
              >
                {profileState === "registered"
                  ? "Manage Passkeys"
                  : "Set Up Biometric Recovery"}
              </button>

              {status && profileState !== "offline" && (
                <p
                  className={
                    status.toLowerCase().includes("failed") ||
                    status.toLowerCase().includes("error") ||
                    status.toLowerCase().includes("rejected")
                      ? "lv-status-error mt-4"
                      : biometricRegistered
                      ? "lv-status-success mt-4"
                      : "lv-status-warning mt-4"
                  }
                >
                  {status}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {vaultActions.map((action) => (
            <button
              key={action.target}
              type="button"
              onClick={() => handleActionNavigation(action.target)}
              className="lv-card lv-card-hover cursor-pointer py-4 text-center"
            >
              <span className="text-sm font-semibold text-slate-200">
                {action.label}
              </span>
            </button>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div id="vault-inactivity" className="scroll-mt-28">
            <InactivityForm />
          </div>
          <div id="vault-heartbeat" className="scroll-mt-28">
            <HeartbeatButton />
          </div>
        </section>

        {passkeyManagerOpen && (
          <div
            className="lv-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                !loading &&
                !managementBusyId
              ) {
                setPasskeyManagerOpen(false);
              }
            }}
          >
            <section
              className="lv-passkey-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="passkey-manager-title"
            >
              <header className="lv-passkey-modal-header">
                <div>
                  <p className="lv-eyebrow">Recovery security</p>
                  <h2 id="passkey-manager-title">Manage passkeys</h2>
                  <p>
                    Add a backup device or review the passkeys allowed to
                    authorize wallet recovery.
                  </p>
                </div>
                <button
                  type="button"
                  className="lv-modal-close"
                  onClick={() => setPasskeyManagerOpen(false)}
                  disabled={loading || Boolean(managementBusyId)}
                  aria-label="Close passkey manager"
                >
                  ×
                </button>
              </header>

              <div className="lv-passkey-modal-content">
                <div className="lv-passkey-add">
                  <input
                    value={passkeyLabel}
                    onChange={(event) => setPasskeyLabel(event.target.value)}
                    placeholder="Device label, e.g. Backup phone"
                    maxLength={60}
                    disabled={loading}
                    className="lv-input"
                  />
                  <button
                    type="button"
                    onClick={handleBiometricRegister}
                    disabled={loading}
                    className="lv-btn-primary"
                  >
                    {loading
                      ? "Registering..."
                      : biometricRegistered
                        ? "Add Passkey"
                        : "Register First Passkey"}
                  </button>
                </div>

                <div className="lv-passkey-modal-note">
                  Keep at least two passkeys on separate devices. Rename and
                  revoke actions require an owner-wallet signature.
                </div>

                <div className="lv-passkey-list">
                  {passkeyDetails.length === 0 ? (
                    <div className="lv-passkey-empty">
                      <strong>No passkeys registered</strong>
                      <span>Add your first passkey to enable biometric recovery.</span>
                    </div>
                  ) : (
                    passkeyDetails.map((passkey) => (
                      <article key={passkey.id} className="lv-passkey-row">
                        {editingPasskeyId === passkey.id ? (
                          <div className="lv-passkey-edit">
                            <input
                              value={editPasskeyLabel}
                              onChange={(event) =>
                                setEditPasskeyLabel(event.target.value)
                              }
                              maxLength={60}
                              className="lv-input"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handlePasskeyManagement("rename", passkey)
                              }
                              disabled={managementBusyId === passkey.id}
                              className="lv-btn-primary"
                            >
                              {managementBusyId === passkey.id ? "Signing..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPasskeyId(null);
                                setEditPasskeyLabel("");
                              }}
                              disabled={managementBusyId === passkey.id}
                              className="lv-btn-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="lv-passkey-row-main">
                              <span className="lv-passkey-device-icon">P</span>
                              <div>
                                <strong>{passkey.label || "Passkey"}</strong>
                                <span>
                                  {passkey.backedUp
                                    ? "Synced backup passkey"
                                    : "Device-bound passkey"}{" "}
                                  · Last used {formatPasskeyDate(passkey.lastUsedAt)}
                                </span>
                              </div>
                              <span className="lv-passkey-type">
                                {passkey.deviceType === "multiDevice"
                                  ? "Multi-device"
                                  : "Single-device"}
                              </span>
                            </div>
                            <div className="lv-passkey-row-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPasskeyId(passkey.id);
                                  setEditPasskeyLabel(passkey.label || "Passkey");
                                  setRevokeConfirmId(null);
                                }}
                                disabled={Boolean(managementBusyId)}
                                className="lv-btn-secondary"
                              >
                                Rename
                              </button>
                              {revokeConfirmId === passkey.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handlePasskeyManagement("revoke", passkey)
                                    }
                                    disabled={managementBusyId === passkey.id}
                                    className="lv-btn-danger"
                                  >
                                    {managementBusyId === passkey.id
                                      ? "Signing..."
                                      : "Confirm revoke"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRevokeConfirmId(null)}
                                    disabled={managementBusyId === passkey.id}
                                    className="lv-btn-secondary"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRevokeConfirmId(passkey.id);
                                    setEditingPasskeyId(null);
                                  }}
                                  disabled={
                                    Boolean(managementBusyId) ||
                                    passkeyDetails.length <= 1
                                  }
                                  className="lv-passkey-revoke-link"
                                >
                                  Revoke
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </article>
                    ))
                  )}
                </div>

                {status && (
                  <p
                    className={
                      status.toLowerCase().includes("failed") ||
                      status.toLowerCase().includes("error") ||
                      status.toLowerCase().includes("rejected")
                        ? "lv-status-error"
                        : biometricRegistered
                          ? "lv-status-success"
                          : "lv-status-warning"
                    }
                  >
                    {status}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
    </div>
  );
}
