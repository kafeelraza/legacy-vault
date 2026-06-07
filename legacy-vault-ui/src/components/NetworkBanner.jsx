import React from "react";
import { useAccount, useChainId } from "wagmi";
import { CHAIN_ID } from "../config/contract";

export default function NetworkBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  if (!isConnected || chainId === CHAIN_ID) return null;

  return (
    <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-5 py-4 text-amber-100 shadow-lg shadow-amber-950/20 backdrop-blur-xl">
      <p className="text-sm font-semibold">Wrong network</p>
      <p className="mt-1 text-sm text-amber-100/80">
        LegacyVault is configured for Sepolia. Switch your wallet to Sepolia to
        read vault data and submit transactions reliably.
      </p>
    </div>
  );
}
