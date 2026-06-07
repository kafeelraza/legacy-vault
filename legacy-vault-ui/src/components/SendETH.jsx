import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther, isAddress, parseEther } from "viem";
import QRCode from "qrcode";
import { VAULT_ABI, VAULT_ADDRESS } from "../config/contract";
import { useToast } from "./ToastContext";
import { useActivity } from "./ActivityContext";
import useContractFeatures from "./useContractFeatures";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RECENTS_KEY = "legacyvault_recent_payments";

function shortAddress(value) {
  if (!value) return "Not set";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function parsePaymentPayload(payload) {
  const text = payload.trim();
  if (!text) return null;

  try {
    const url = new URL(text);
    const to = url.searchParams.get("to") || url.searchParams.get("address");
    const amount = url.searchParams.get("amount") || "";
    if (to && isAddress(to)) return { to, amount };
  } catch {
    // Not a URL. Continue with address or URI parsing below.
  }

  if (text.startsWith("ethereum:")) {
    const withoutScheme = text.replace("ethereum:", "");
    const [rawAddress, rawQuery = ""] = withoutScheme.split("?");
    const params = new URLSearchParams(rawQuery);
    const to = rawAddress.split("@")[0];
    const amount = params.get("amount") || "";
    if (isAddress(to)) return { to, amount };
  }

  if (isAddress(text)) return { to: text, amount: "" };
  return null;
}

function loadRecents() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentPayment(payment) {
  const current = loadRecents();
  const next = [
    payment,
    ...current.filter((item) => item.to.toLowerCase() !== payment.to.toLowerCase()),
  ].slice(0, 6);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

export default function SendETH() {
  const { address } = useAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pay");
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [dailyLimitInput, setDailyLimitInput] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestQr, setRequestQr] = useState("");
  const [scannerText, setScannerText] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [recentPayments, setRecentPayments] = useState(() => loadRecents());
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanLoopRef = useRef(null);
  const { notify } = useToast();
  const { addActivity } = useActivity();
  const contractFeatures = useContractFeatures();

  const userAddress = address || ZERO_ADDRESS;

  const { data: vaultData, refetch: refetchVault } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getVault",
    args: [userAddress],
    query: { enabled: Boolean(address) },
  });

  const { data: dailyLimit = 0n, refetch: refetchDailyLimit } =
    useReadContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "dailyLimit",
      args: [userAddress],
      query: { enabled: Boolean(address) },
    });

  const { data: spentToday = 0n, refetch: refetchSpentToday } =
    useReadContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "spentToday",
      args: [userAddress],
      query: { enabled: Boolean(address) },
    });

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const balance = vaultData?.balance ?? 0n;
  const isLoading = isPending || isConfirming;

  const remainingLimit = useMemo(() => {
    return dailyLimit > spentToday ? dailyLimit - spentToday : 0n;
  }, [dailyLimit, spentToday]);

  const progressWidth = useMemo(() => {
    if (dailyLimit === 0n) return "0%";
    const percent = (Number(spentToday) / Number(dailyLimit)) * 100;
    return `${Math.min(percent, 100)}%`;
  }, [dailyLimit, spentToday]);

  const paymentLink = useMemo(() => {
    if (!address) return "";
    const params = new URLSearchParams({ to: address });
    if (requestAmount) params.set("amount", requestAmount);
    if (requestNote) params.set("note", requestNote);
    return `${window.location.origin}/app/pay?${params.toString()}`;
  }, [address, requestAmount, requestNote]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const to = params.get("to") || "";
    const requestedAmount = params.get("amount") || "";
    if (to && isAddress(to)) {
      setReceiver(to);
      setAmount(requestedAmount);
      setActiveTab("pay");
      navigate("/app/pay", { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    let cancelled = false;
    if (!paymentLink) {
      setRequestQr("");
      return;
    }

    QRCode.toDataURL(paymentLink, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    }).then((dataUrl) => {
      if (!cancelled) setRequestQr(dataUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [paymentLink]);

  useEffect(() => {
    if (!isSuccess) return;
    refetchVault();
    refetchDailyLimit();
    refetchSpentToday();
    notify({
      title: "Payment confirmed",
      message: txHash ? `${txHash.slice(0, 10)}...` : "Vault state refreshed.",
      type: "success",
    });
    addActivity(
      "ETH sent",
      txHash ? `Payment confirmed: ${txHash.slice(0, 10)}...` : "Payment confirmed.",
      "success"
    );
  }, [addActivity, isSuccess, notify, refetchDailyLimit, refetchSpentToday, refetchVault, txHash]);

  useEffect(() => {
    return () => stopScanner();
  }, []);

  const parsePositiveEth = (value, fieldName) => {
    try {
      const parsed = parseEther(value);
      if (parsed <= 0n) throw new Error();
      return parsed;
    } catch {
      throw new Error(`Enter a valid ${fieldName.toLowerCase()} in ETH`);
    }
  };

  const applyPaymentPayload = (payload) => {
    const parsed = parsePaymentPayload(payload);
    if (!parsed) {
      throw new Error("QR or payment text does not contain a valid wallet address");
    }
    setReceiver(parsed.to);
    if (parsed.amount) setAmount(parsed.amount);
    setActiveTab("pay");
    notify({
      title: "Payment details loaded",
      message: `${shortAddress(parsed.to)}${parsed.amount ? ` for ${parsed.amount} ETH` : ""}`,
      type: "success",
    });
  };

  const handleManualQrParse = () => {
    try {
      setScanError("");
      applyPaymentPayload(scannerText);
    } catch (err) {
      setScanError(err.message);
    }
  };

  const stopScanner = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  const startScanner = async () => {
    try {
      setScanError("");
      if (!("BarcodeDetector" in window)) {
        throw new Error("This browser does not support native QR scanning. Paste the QR text or payment link instead.");
      }

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setIsScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const scanFrame = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const rawValue = codes[0].rawValue;
            stopScanner();
            setScannerText(rawValue);
            applyPaymentPayload(rawValue);
            return;
          }
        } catch {
          // Keep scanning; camera frames can fail while autofocus settles.
        }
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      };

      scanLoopRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      stopScanner();
      setScanError(err.message);
    }
  };

  const handleSend = async () => {
    try {
      setError(null);

      if (!address) throw new Error("Connect your wallet first");
      if (!contractFeatures.supportsV3Wallet) {
        throw new Error("The deployed contract does not support V3 wallet functions");
      }
      if (!isAddress(receiver)) throw new Error("Enter a valid receiver address");
      if (receiver.toLowerCase() === address.toLowerCase()) {
        throw new Error("Receiver cannot be your own wallet for a payment");
      }

      const amountInWei = parsePositiveEth(amount, "Amount");
      if (dailyLimit > 0n && amountInWei > remainingLimit) {
        throw new Error("Amount is higher than your remaining daily limit");
      }
      if (amountInWei > balance) {
        throw new Error("Amount is higher than your vault balance");
      }

      const hash = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "spend",
        args: [receiver, amountInWei],
      });

      setTxHash(hash);
      const nextRecents = saveRecentPayment({
        to: receiver,
        amount,
        time: new Date().toLocaleString(),
      });
      setRecentPayments(nextRecents);
      setReceiver("");
      setAmount("");
      notify({
        title: "Payment transaction sent",
        message: `${hash.slice(0, 10)}...`,
        type: "success",
      });
      addActivity(
        "ETH sent",
        `Payment submitted to ${shortAddress(receiver)}: ${hash.slice(0, 10)}...`,
        "success"
      );
    } catch (err) {
      console.error("Transaction error:", err);
      setError(err.shortMessage || err.message || "Transaction failed");
      notify({
        title: "Payment failed",
        message: err.shortMessage || err.message || "Transaction failed",
        type: "error",
      });
    }
  };

  const handleSetLimit = async () => {
    try {
      setError(null);

      if (!address) throw new Error("Connect your wallet first");
      if (!contractFeatures.supportsV3Wallet) {
        throw new Error("The deployed contract does not support V3 wallet functions");
      }

      const limitInWei = parsePositiveEth(dailyLimitInput, "Daily limit");

      const hash = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "setDailyLimit",
        args: [limitInWei],
      });

      setTxHash(hash);
      setDailyLimitInput("");
      notify({
        title: "Limit transaction sent",
        message: `${hash.slice(0, 10)}...`,
        type: "success",
      });
      addActivity(
        "Daily limit updated",
        `Daily spending limit transaction submitted: ${hash.slice(0, 10)}...`,
        "success"
      );
    } catch (err) {
      console.error("Set limit error:", err);
      setError(err.shortMessage || err.message || "Failed to set limit");
      notify({
        title: "Limit update failed",
        message: err.shortMessage || err.message || "Failed to set limit",
        type: "error",
      });
    }
  };

  const handleCopyPaymentLink = async () => {
    try {
      if (!paymentLink) throw new Error("Connect your wallet first");
      await navigator.clipboard.writeText(paymentLink);
      notify({
        title: "Payment link copied",
        message: "Share it to receive ETH into your connected wallet.",
        type: "success",
      });
    } catch (err) {
      notify({
        title: "Copy failed",
        message: err.message,
        type: "error",
      });
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <section className="lv-glass p-6">
        <p className="lv-eyebrow">Daily smart wallet</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Payments
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Pay by wallet address, scan a payment QR, or create your own QR to
          receive ETH. Spending uses the V3 vault daily-limit controls.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        {!address && (
          <div className="lv-status-warning xl:col-span-2">
            Connect your wallet to load vault balance, set a daily limit, and
            use payments.
          </div>
        )}

        {!contractFeatures.supportsV3Wallet && !contractFeatures.isLoading && (
          <div className="lv-status-warning xl:col-span-2">
            Payments are disabled because the deployed contract did not expose
            V3 wallet functions: dailyLimit(address), spentToday(address),
            setDailyLimit(uint256), and spend(address,uint256).
          </div>
        )}

        <div className="space-y-5">
          <div className="lv-glass p-6">
            <p className="lv-eyebrow">Vault Balance</p>
            <p className="mt-4 text-5xl font-bold text-cyan-200">
              {formatEther(balance)}
            </p>
            <p className="mt-2 text-sm text-slate-400">ETH available in vault</p>

            <div className="mt-6 grid gap-3">
              <div className="flex justify-between rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm">
                <span className="text-slate-400">Daily Limit</span>
                <span className="font-semibold text-white">
                  {formatEther(dailyLimit)} ETH
                </span>
              </div>
              <div className="flex justify-between rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm">
                <span className="text-slate-400">Spent Today</span>
                <span className="font-semibold text-white">
                  {formatEther(spentToday)} ETH
                </span>
              </div>
            </div>

            <div className="mt-5 h-2 w-full rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-cyan-300"
                style={{ width: progressWidth }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Remaining: {Number(formatEther(remainingLimit)).toFixed(4)} ETH
            </p>
          </div>

          <div className="lv-card">
            <p className="lv-eyebrow">Limit</p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Daily spending limit
            </h2>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                type="number"
                value={dailyLimitInput}
                onChange={(e) => setDailyLimitInput(e.target.value)}
                placeholder="e.g. 0.5"
                disabled={!contractFeatures.supportsV3Wallet}
                className="lv-input"
              />
              <button
                onClick={handleSetLimit}
                disabled={isLoading || !contractFeatures.supportsV3Wallet}
                className="lv-btn-secondary sm:min-w-32"
              >
                {isLoading ? "Processing..." : "Set Limit"}
              </button>
            </div>
          </div>
        </div>

        <div className="lv-card">
          <div className="payment-tabs">
            {[
              ["pay", "Pay by Address"],
              ["scan", "Scan QR"],
              ["receive", "Receive QR"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={activeTab === value ? "lv-btn-primary" : "lv-btn-secondary"}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "pay" && (
            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Receiver wallet / public key
                </label>
                <input
                  type="text"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="0x..."
                  disabled={!contractFeatures.supportsV3Wallet}
                  className="lv-input font-mono"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Amount (ETH)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  max={remainingLimit > 0n ? formatEther(remainingLimit) : undefined}
                  disabled={!contractFeatures.supportsV3Wallet}
                  className="lv-input"
                />
              </div>

              {recentPayments.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-semibold text-slate-400">
                    Recent payments
                  </p>
                  <div className="recent-payments-grid">
                    {recentPayments.map((item) => (
                      <button
                        type="button"
                        key={`${item.to}-${item.time}`}
                        onClick={() => {
                          setReceiver(item.to);
                          setAmount(item.amount || "");
                        }}
                        className="recent-payment-card"
                      >
                        <strong>{shortAddress(item.to)}</strong>
                        <span>{item.amount || "Custom"} ETH</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && <div className="lv-status-error">{error}</div>}

              {isSuccess && txHash && (
                <div className="lv-status-success">
                  Payment confirmed. Hash: {txHash.slice(0, 10)}...
                </div>
              )}

              <button
                onClick={handleSend}
                disabled={
                  isLoading ||
                  !receiver ||
                  !amount ||
                  !contractFeatures.supportsV3Wallet
                }
                className="lv-btn-primary w-full"
              >
                {isLoading ? "Processing..." : "Pay From Vault"}
              </button>
            </div>
          )}

          {activeTab === "scan" && (
            <div className="mt-6 space-y-5">
              <div className="lv-status-warning">
                Camera QR scan uses your browser's native scanner when
                available. If your browser does not support it, paste a payment
                link or wallet address below.
              </div>

              <div className="qr-scanner-frame">
                <video ref={videoRef} muted playsInline />
                {!isScanning && <span>Camera scanner idle</span>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={startScanner}
                  disabled={isScanning}
                  className="lv-btn-primary"
                >
                  {isScanning ? "Scanning..." : "Start QR Scanner"}
                </button>
                <button
                  type="button"
                  onClick={stopScanner}
                  disabled={!isScanning}
                  className="lv-btn-secondary"
                >
                  Stop Scanner
                </button>
              </div>

              <textarea
                value={scannerText}
                onChange={(e) => setScannerText(e.target.value)}
                placeholder="Paste payment link, ethereum: URI, or wallet address"
                className="lv-input min-h-28"
              />
              <button
                type="button"
                onClick={handleManualQrParse}
                className="lv-btn-secondary w-full"
              >
                Load Payment Details
              </button>

              {scanError && <div className="lv-status-error">{scanError}</div>}
            </div>
          )}

          {activeTab === "receive" && (
            <div className="mt-6 space-y-5">
              {!address && (
                <div className="lv-status-warning">
                  Connect your wallet to generate your receive QR.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-400">
                    Request amount (optional)
                  </label>
                  <input
                    type="number"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    placeholder="0.01"
                    className="lv-input"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-400">
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    placeholder="Payment request"
                    className="lv-input"
                  />
                </div>
              </div>

              <div className="receive-qr-card">
                {requestQr ? (
                  <img src={requestQr} alt="LegacyVault receive QR" />
                ) : (
                  <div className="lv-status-warning">QR not ready</div>
                )}
                <div>
                  <p className="lv-eyebrow">Receive into connected wallet</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    {shortAddress(address)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Share this QR or payment link. The payer can scan it and
                    send ETH to your connected wallet address. Deposit the
                    received ETH into LegacyVault afterward.
                  </p>
                </div>
              </div>

              <input value={paymentLink} readOnly className="lv-input font-mono" />
              <button
                type="button"
                onClick={handleCopyPaymentLink}
                disabled={!paymentLink}
                className="lv-btn-secondary w-full"
              >
                Copy Payment Link
              </button>
              <button
                type="button"
                onClick={() => navigate("/app/vault")}
                className="lv-btn-primary w-full"
              >
                Open Vault Deposit
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
