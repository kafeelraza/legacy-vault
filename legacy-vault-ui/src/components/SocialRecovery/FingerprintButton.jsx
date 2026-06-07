import React from "react";

export default function FingerprintButton({ isPending, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className="lv-btn-primary w-full"
    >
      {isPending ? "Verifying..." : "Use Fingerprint / FaceID"}
    </button>
  );
}
