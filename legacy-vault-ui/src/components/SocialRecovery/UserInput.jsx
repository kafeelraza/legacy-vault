import React from "react";

export default function UserInput({ value, onChange }) {
  return (
    <input
      type="text"
      placeholder="User address to recover"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="lv-input"
    />
  );
}
