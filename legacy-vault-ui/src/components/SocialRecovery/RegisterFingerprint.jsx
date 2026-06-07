import React, { useState } from "react";
import { ORACLE_BASE_URL } from "../../config/contract";
import { useToast } from "../ToastContext";

export default function RegisterFingerprint({ userAddress }) {
  const [status, setStatus] = useState("");
  const { notify } = useToast();

  const handleRegister = async () => {
    if (!userAddress) {
      notify({
        title: "Wallet address required",
        message: "Connect or enter your wallet address first.",
      });
      return;
    }

    try {
      setStatus("Initializing fingerprint registration...");

      const challengeRes = await fetch(`${ORACLE_BASE_URL}/register/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress }),
      });

      const challenge = await challengeRes.json();

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: Uint8Array.from(atob(challenge.challenge), (c) =>
            c.charCodeAt(0)
          ),
          rp: { name: "Legacy Vault Recovery" },
          user: {
            id: Uint8Array.from(userAddress, (c) => c.charCodeAt(0)),
            name: userAddress,
            displayName: userAddress,
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: { userVerification: "required" },
          timeout: 60000,
          attestation: "direct",
        },
      });

      setStatus("Sending registration data to oracle...");

      const verifyRes = await fetch(`${ORACLE_BASE_URL}/register/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress,
          credential: {
            id: credential.id,
            type: credential.type,
            rawId: btoa(
              String.fromCharCode(...new Uint8Array(credential.rawId))
            ),
            response: {
              attestationObject: btoa(
                String.fromCharCode(
                  ...new Uint8Array(credential.response.attestationObject)
                )
              ),
              clientDataJSON: btoa(
                String.fromCharCode(
                  ...new Uint8Array(credential.response.clientDataJSON)
                )
              ),
            },
          },
        }),
      });

      const verifyData = await verifyRes.json();
      if (verifyData.success) {
        setStatus("Fingerprint successfully registered.");
        notify({
          title: "Fingerprint registered",
          message: "Biometric recovery is ready.",
          type: "success",
        });
      } else {
        throw new Error("Registration failed on server.");
      }
    } catch (err) {
      console.error(err);
      setStatus(`Registration failed: ${err.message}`);
      notify({
        title: "Registration failed",
        message: err.message,
        type: "error",
      });
    }
  };

  return (
    <div className="lv-card mt-6">
      <h3 className="text-lg font-semibold text-white">Register Fingerprint</h3>
      <p className="lv-muted mt-2">
        Register your biometric for secure recovery in the future.
      </p>

      <button onClick={handleRegister} className="lv-btn-primary mt-4 w-full">
        Save Fingerprint / FaceID
      </button>

      {status && <p className="lv-status-warning mt-4">{status}</p>}
    </div>
  );
}
