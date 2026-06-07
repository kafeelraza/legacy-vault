import React from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatEther } from "viem";
import { VAULT_ABI, VAULT_ADDRESS } from "../config/contract";

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000";

function formatTimestamp(value) {
  const timestamp = Number(value ?? 0n);
  if (!timestamp) return "No heartbeat yet";
  return new Date(timestamp * 1000).toLocaleString();
}

function formatDuration(secondsValue) {
  const seconds = Number(secondsValue ?? 0n);
  if (!seconds) return "Not set";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function isEmptyAddress(address) {
  return address?.toLowerCase() === EMPTY_ADDRESS;
}

export default function VaultInfo({ refreshKey, variant = "full" }) {
  const { address } = useAccount();
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const { data, refetch, isLoading } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getVault",
    args: [address || EMPTY_ADDRESS],
    query: { enabled: Boolean(address) },
  });

  React.useEffect(() => {
    if (refreshKey) refetch();
  }, [refreshKey, refetch]);

  React.useEffect(() => {
    if (!detailsOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setDetailsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [detailsOpen]);

  const hasDeposit = Boolean(data && data.balance > 0n);
  const hasHeir = Boolean(data && !isEmptyAddress(data.heir));
  const hasInactivity = Boolean(data && data.inactivityPeriod > 0n);
  const hasHeartbeat = Boolean(data && data.lastHeartbeat > 0n);
  const configuredCount = [hasDeposit, hasHeir, hasInactivity, hasHeartbeat].filter(
    Boolean
  ).length;

  return (
    <>
      <div className={`lv-card lv-vault-summary lv-vault-summary-${variant}`}>
        <div className="lv-vault-summary-header">
          <div>
            <p className="lv-eyebrow">Vault status</p>
            <h2>Protected balance</h2>
          </div>
          <span className="lv-vault-network-badge">Sepolia</span>
        </div>

        {isLoading ? (
          <div className="lv-vault-summary-loading">Loading vault data...</div>
        ) : data ? (
          <>
            <div className="lv-vault-overview">
              <div className="lv-vault-balance-block">
                <span>Vault balance</span>
                <strong>{formatEther(data.balance)} ETH</strong>
                <small>
                  {hasDeposit
                    ? "Funds protected by LegacyVault"
                    : "No vault deposit yet"}
                </small>
              </div>

              <div className="lv-vault-checks">
                <div className={hasHeir ? "is-ready" : ""}>
                  <span>{hasHeir ? "OK" : "--"}</span>
                  <p>
                    <strong>Heir</strong>
                    <small>{hasHeir ? "Configured" : "Not set"}</small>
                  </p>
                </div>
                <div className={hasInactivity ? "is-ready" : ""}>
                  <span>{hasInactivity ? "OK" : "--"}</span>
                  <p>
                    <strong>Inactivity</strong>
                    <small>{hasInactivity ? "Configured" : "Not set"}</small>
                  </p>
                </div>
                <div className={hasHeartbeat ? "is-ready" : ""}>
                  <span>{hasHeartbeat ? "OK" : "--"}</span>
                  <p>
                    <strong>Heartbeat</strong>
                    <small>{hasHeartbeat ? "Recorded" : "Not sent"}</small>
                  </p>
                </div>
              </div>

              <div className="lv-vault-readiness">
                <div className="lv-vault-setup-ring">
                  <strong>{configuredCount}/4</strong>
                  <span>ready</span>
                </div>
                <p>
                  <strong>
                    {configuredCount === 4
                      ? "Vault ready"
                      : `${4 - configuredCount} action${4 - configuredCount === 1 ? "" : "s"} left`}
                  </strong>
                  <small>Protection readiness</small>
                </p>
              </div>
            </div>

            <button
              type="button"
              className="lv-btn-secondary lv-vault-details-button"
              onClick={() => setDetailsOpen(true)}
            >
              View details
            </button>
          </>
        ) : (
          <div className="lv-vault-summary-empty">
            <p>Connect a wallet to load vault data.</p>
          </div>
        )}
      </div>

      {detailsOpen && data && (
        <div
          className="lv-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailsOpen(false);
          }}
        >
          <section
            className="lv-vault-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vault-details-title"
          >
            <header className="lv-passkey-modal-header">
              <div>
                <p className="lv-eyebrow">Vault overview</p>
                <h2 id="vault-details-title">Vault details</h2>
                <p>
                  Current on-chain protection settings for the connected owner.
                </p>
              </div>
              <button
                type="button"
                className="lv-modal-close"
                onClick={() => setDetailsOpen(false)}
                aria-label="Close vault details"
              >
                X
              </button>
            </header>

            <div className="lv-vault-modal-content">
              <div className="lv-vault-detail-balance">
                <span>Protected balance</span>
                <strong>{formatEther(data.balance)} ETH</strong>
                <small>Sepolia test network</small>
              </div>

              <div className="lv-vault-detail-grid">
                <article>
                  <span>Inactivity period</span>
                  <strong>{formatDuration(data.inactivityPeriod)}</strong>
                  <small>{Number(data.inactivityPeriod)} seconds</small>
                </article>
                <article>
                  <span>Last heartbeat</span>
                  <strong>{formatTimestamp(data.lastHeartbeat)}</strong>
                  <small>{hasHeartbeat ? "Activity recorded" : "Action recommended"}</small>
                </article>
                <article className="lv-vault-detail-wide">
                  <span>Designated heir</span>
                  {hasHeir ? (
                    <strong className="lv-vault-address">{data.heir}</strong>
                  ) : (
                    <strong>No heir configured</strong>
                  )}
                  <small>
                    {hasHeir
                      ? "Eligible after the inactivity period"
                      : "Add an heir to complete inheritance setup"}
                  </small>
                </article>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
