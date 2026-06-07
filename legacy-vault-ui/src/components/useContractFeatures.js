import { useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import { VAULT_ABI, VAULT_ADDRESS } from "../config/contract";

const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000";

function detectVersion(version) {
  if (!version) return "Unknown";
  if (version.includes("V3")) return "V3";
  if (version.includes("V2")) return "V2";
  if (version.includes("V1")) return "V1";
  return version;
}

export default function useContractFeatures() {
  const { address } = useAccount();
  const probeAddress = address || EMPTY_ADDRESS;

  const versionRead = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "version",
    query: { retry: false },
  });

  const nonceRead = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "usedNonces",
    args: [probeAddress],
    query: { retry: false },
  });

  const dailyLimitRead = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "dailyLimit",
    args: [probeAddress],
    query: { retry: false },
  });

  const spentTodayRead = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "spentToday",
    args: [probeAddress],
    query: { retry: false },
  });

  return useMemo(() => {
    const supportsNonceRecovery = nonceRead.isSuccess && nonceRead.error == null;
    const supportsV3Wallet =
      dailyLimitRead.isSuccess &&
      spentTodayRead.isSuccess &&
      dailyLimitRead.error == null &&
      spentTodayRead.error == null;
    const isLoading =
      versionRead.isLoading ||
      nonceRead.isLoading ||
      dailyLimitRead.isLoading ||
      spentTodayRead.isLoading;
    const hasReadError = Boolean(
      versionRead.error ||
        nonceRead.error ||
        dailyLimitRead.error ||
        spentTodayRead.error
    );

    return {
      detectedVersion: detectVersion(versionRead.data),
      versionLabel: versionRead.data || "Unknown contract version",
      isCompatible: supportsNonceRecovery && supportsV3Wallet,
      supportsNonceRecovery,
      supportsV3Wallet,
      isLoading,
      hasReadError,
    };
  }, [
    dailyLimitRead.error,
    dailyLimitRead.isSuccess,
    nonceRead.error,
    nonceRead.isSuccess,
    spentTodayRead.error,
    spentTodayRead.isSuccess,
    versionRead.data,
    versionRead.error,
    versionRead.isLoading,
    nonceRead.isLoading,
    dailyLimitRead.isLoading,
    spentTodayRead.isLoading,
  ]);
}
