import React from "react";

export default function SignatureInput({ value, onChange }) {
  return (
    <input
      type="text"
      placeholder="Signature from Oracle"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="lv-input"
    />
  );
}
