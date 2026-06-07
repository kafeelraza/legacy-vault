import React from "react";

export default function RecoveryButton({ isPending, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className="lv-btn-primary w-full"
    >
      {isPending ? "Recovering..." : "Start Recovery"}
    </button>
  );
}
