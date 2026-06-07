import React, { useMemo } from "react";

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000";

function isHeirSet(vault) {
  return vault?.heir && vault.heir.toLowerCase() !== EMPTY_ADDRESS;
}

function isHeartbeatRecent(vault) {
  const lastHeartbeat = Number(vault?.lastHeartbeat ?? 0n);
  if (!lastHeartbeat) return false;

  const now = Math.floor(Date.now() / 1000);
  const inactivity = Number(vault?.inactivityPeriod ?? 0n);
  if (inactivity > 0) return now <= lastHeartbeat + inactivity;

  return now - lastHeartbeat <= 30 * 24 * 60 * 60;
}

function getStatus(score) {
  if (score >= 80) return "Strong";
  if (score >= 50) return "Good";
  return "Weak";
}

export default function VaultHealthCard({
  isConnected,
  isCorrectNetwork,
  vault,
  biometricAvailable,
}) {
  const health = useMemo(() => {
    const checks = [
      {
        label: "Connect wallet",
        passed: isConnected,
        recommendation: "Connect your wallet.",
        weight: 15,
      },
      {
        label: "Use Sepolia",
        passed: isCorrectNetwork,
        recommendation: "Switch to Sepolia.",
        weight: 15,
      },
      {
        label: "Deposit funds",
        passed: (vault?.balance ?? 0n) > 0n,
        recommendation: "Deposit ETH into the vault.",
        weight: 20,
      },
      {
        label: "Set heir",
        passed: isHeirSet(vault),
        recommendation: "Assign a trusted heir address.",
        weight: 15,
      },
      {
        label: "Set inactivity",
        passed: (vault?.inactivityPeriod ?? 0n) > 0n,
        recommendation: "Set an inactivity period.",
        weight: 10,
      },
      {
        label: "Recent heartbeat",
        passed: isHeartbeatRecent(vault),
        recommendation: "Send a heartbeat.",
        weight: 15,
      },
      {
        label: "Biometric recovery",
        passed: biometricAvailable,
        recommendation: "Register biometric recovery.",
        weight: 10,
      },
    ];

    const score = checks.reduce(
      (total, check) => total + (check.passed ? check.weight : 0),
      0
    );

    return {
      score,
      status: getStatus(score),
      recommendations: checks
        .filter((check) => !check.passed)
        .map((check) => check.recommendation)
        .slice(0, 3),
    };
  }, [biometricAvailable, isConnected, isCorrectNetwork, vault]);

  return (
    <div id="vault-health" className="lv-card">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="lv-eyebrow">Vault Health</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Security posture
          </h2>
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-5 py-4 text-center">
          <p className="text-4xl font-bold text-cyan-100">{health.score}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
            {health.status}
          </p>
        </div>
      </div>

      {health.recommendations.length === 0 ? (
        <p className="lv-status-success mt-5">
          Strong setup. Keep sending heartbeats and monitoring your recovery
          settings.
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {health.recommendations.map((item) => (
            <p key={item} className="lv-status-warning">
              {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
