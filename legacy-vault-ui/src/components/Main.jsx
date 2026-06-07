import React, { useEffect, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useDisconnect,
  useReadContract,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link } from "react-router-dom";
import {
  CHAIN_ID,
  ORACLE_BASE_URL,
  VAULT_ABI,
  VAULT_ADDRESS,
} from "../config/contract";
import VaultHealthCard from "./VaultHealthCard";
import ActivityTimeline from "./ActivityTimeline";
import { useActivity } from "./ActivityContext";
import useContractFeatures from "./useContractFeatures";

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000";

const actionCards = [
  {
    title: "Vault",
    label: "Deposit and heartbeat",
    description: "Fund your vault and keep the activity timestamp current.",
    to: "/app/vault",
  },
  {
    title: "Heir",
    label: "Manage succession",
    description: "Set the heir and check inheritance eligibility.",
    to: "/app/heir",
  },
  {
    title: "Payments",
    label: "Spend from vault",
    description: "Transfer ETH through V3 daily-limit controls.",
    to: "/app/pay",
  },
  {
    title: "Recovery Center",
    label: "Recover access",
    description: "Use biometric recovery and oracle authorization.",
    to: "/app/recovery",
  },
];

function shortAddress(address) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Main() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance, isLoading } = useBalance({ address });
  const { disconnect } = useDisconnect();
  const { addActivity } = useActivity();
  const contractFeatures = useContractFeatures();
  const [recoveryProfile, setRecoveryProfile] = useState(null);
  const userAddress = address || EMPTY_ADDRESS;
  const isCorrectNetwork = chainId === CHAIN_ID;
  const biometricAvailable = (recoveryProfile?.passkeys || 0) > 0;

  const { data: vault } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getVault",
    args: [userAddress],
    query: { enabled: Boolean(address) },
  });

  useEffect(() => {
    if (!address) return;
    addActivity(
      "Wallet connected",
      `${shortAddress(address)} connected to LegacyVault.`,
      "success"
    );
  }, [addActivity, address]);

  useEffect(() => {
    if (!address) {
      setRecoveryProfile(null);
      return;
    }

    const controller = new AbortController();
    fetch(`${ORACLE_BASE_URL}/recovery/profile/${address}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Recovery profile unavailable");
        return response.json();
      })
      .then(setRecoveryProfile)
      .catch((err) => {
        if (err.name !== "AbortError") setRecoveryProfile(null);
      });

    return () => controller.abort();
  }, [address]);

  return (
    <div className="space-y-6">
        {!isConnected ? (
          <section className="lv-glass overflow-hidden p-8 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="lv-eyebrow">Secure self-custody</p>
                <h2 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
                  Protect ETH today. Make inheritance possible tomorrow.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                  Connect your wallet to manage vault deposits, heir settings,
                  heartbeats, controlled spending, and biometric recovery from a
                  single dashboard.
                </p>
              </div>
              <div className="lv-card">
                <p className="text-sm font-semibold text-slate-200">
                  Wallet status
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  No wallet connected. Connect to activate vault controls.
                </p>
                <div className="lv-status-warning mt-5">
                  Dashboard data, vault actions, and recovery transactions stay
                  locked until a wallet is connected.
                </div>
                <div className="mt-6 flex justify-center">
                  <ConnectButton />
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="lv-glass p-6">
              <p className="lv-eyebrow">Dashboard</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
                Vault Overview
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                A summary of wallet state, contract compatibility, vault
                health, and the next workflows that need attention.
              </p>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="lv-glass p-6">
                <p className="lv-eyebrow">Wallet online</p>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white">
                      {shortAddress(address)}
                    </h2>
                    <p className="mt-2 break-all text-sm text-slate-400">
                      {address}
                    </p>
                  </div>
                  <button
                    onClick={() => disconnect()}
                    className="lv-btn-danger sm:min-w-44"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              </div>

              <div className="lv-glass p-6">
                <p className="lv-eyebrow">Wallet balance</p>
                <p className="mt-4 text-4xl font-bold text-cyan-200">
                  {isLoading
                    ? "Loading"
                    : balance
                      ? Number(balance.formatted).toFixed(4)
                      : "0.0000"}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {balance?.symbol || "ETH"} available in connected wallet
                </p>
              </div>
            </section>

            <section className="lv-glass p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="lv-eyebrow">Contract compatibility</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {contractFeatures.detectedVersion} detected
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {contractFeatures.versionLabel}
                  </p>
                </div>
                <div
                  className={
                    contractFeatures.isCompatible
                      ? "lv-status-success"
                      : "lv-status-warning"
                  }
                >
                  {contractFeatures.isLoading
                    ? "Checking contract features..."
                    : contractFeatures.isCompatible
                      ? "Compatible"
                      : "Compatibility warning"}
                </div>
              </div>
              {!contractFeatures.isCompatible && !contractFeatures.isLoading && (
                <p className="mt-4 text-sm leading-6 text-amber-100">
                  Some advanced modules are guarded because the deployed
                  contract did not confirm nonce recovery and V3 wallet reads.
                </p>
              )}
            </section>

            <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <VaultHealthCard
                isConnected={isConnected}
                isCorrectNetwork={isCorrectNetwork}
                vault={vault}
                biometricAvailable={biometricAvailable}
              />
              <ActivityTimeline limit={4} />
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {actionCards.map((card) => {
                const blocked =
                  !contractFeatures.isLoading &&
                  ((card.title === "Payments" &&
                    !contractFeatures.supportsV3Wallet) ||
                    (card.title === "Recovery Center" &&
                      !contractFeatures.supportsNonceRecovery));

                if (blocked) {
                  return (
                    <div
                      key={card.title}
                      className="lv-card block min-h-44 opacity-70"
                    >
                      <div className="flex h-full flex-col justify-between gap-6">
                        <div>
                          <p className="lv-eyebrow">{card.title}</p>
                          <h3 className="mt-3 text-xl font-semibold text-white">
                            {card.label}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            This module needs a newer deployed contract
                            feature.
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-amber-100">
                          Disabled by compatibility check
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                <Link
                  key={card.title}
                  to={card.to}
                  className="lv-card lv-card-hover group block min-h-44"
                >
                  <div className="flex h-full flex-col justify-between gap-6">
                    <div>
                      <p className="lv-eyebrow">{card.title}</p>
                      <h3 className="mt-3 text-xl font-semibold text-white">
                        {card.label}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {card.description}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-cyan-200 group-hover:text-cyan-100">
                      Open module
                    </span>
                  </div>
                </Link>
                );
              })}
            </section>
          </>
        )}
    </div>
  );
}
