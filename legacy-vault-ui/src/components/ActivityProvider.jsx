import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { ActivityContext } from "./ActivityContext";
import { ORACLE_BASE_URL } from "../config/contract";

const STORAGE_KEY = "legacyVault:activity";
const MAX_ITEMS = 30;

function readStoredActivity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function ActivityProvider({ children }) {
  const [activities, setActivities] = useState(readStoredActivity);
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    if (!address) return;

    const controller = new AbortController();
    fetch(`${ORACLE_BASE_URL}/activity/${address}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Activity timeline unavailable");
        return response.json();
      })
      .then((data) => {
        setActivities(Array.isArray(data.activities) ? data.activities : []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("Activity sync failed; using local fallback.", err);
        }
      });

    return () => controller.abort();
  }, [address]);

  const addActivity = useCallback((title, detail, type = "info") => {
    const item = {
      id: crypto.randomUUID(),
      title,
      detail,
      type,
      createdAt: Date.now(),
    };

    setActivities((items) => [item, ...items].slice(0, MAX_ITEMS));
    if (address) {
      fetch(`${ORACLE_BASE_URL}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, activity: item }),
      }).catch((err) => console.warn("Activity persistence failed.", err));
    }
  }, [address]);

  const clearActivity = useCallback(async () => {
    if (!address) {
      setActivities([]);
      return;
    }

    try {
      const signature = await signMessageAsync({
        message: [
          "LegacyVault Activity Timeline",
          `Wallet: ${address.toLowerCase()}`,
          "Action: Clear activity history",
        ].join("\n"),
      });
      const response = await fetch(`${ORACLE_BASE_URL}/activity/${address}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      if (!response.ok) throw new Error("Activity clear authorization failed");
      setActivities([]);
    } catch (err) {
      console.warn("Activity clear failed.", err);
    }
  }, [address, signMessageAsync]);

  const value = useMemo(
    () => ({ activities, addActivity, clearActivity }),
    [activities, addActivity, clearActivity]
  );

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}
