import React from "react";

export default function StatusMessage({ isSuccess, error }) {
  if (isSuccess) {
    return (
      <p className="lv-status-success mt-4">
        Recovery successful. Funds released to your address.
      </p>
    );
  }

  if (error) {
    return (
      <p className="lv-status-error mt-4">
        Error: {error.message || "Transaction failed"}
      </p>
    );
  }

  return null;
}
