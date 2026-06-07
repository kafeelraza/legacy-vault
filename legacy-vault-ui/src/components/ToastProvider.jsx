import React, { useCallback, useMemo, useRef, useState } from "react";
import { ToastContext } from "./ToastContext";

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const recentToastRef = useRef({ key: "", time: 0 });

  const removeToast = useCallback((id) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({ title, message, type = "info" }) => {
      const key = `${type}:${title}:${message || ""}`;
      const now = Date.now();
      if (
        recentToastRef.current.key === key &&
        now - recentToastRef.current.time < 1500
      ) {
        return;
      }
      recentToastRef.current = { key, time: now };

      const id = crypto.randomUUID();
      setToasts((items) => [...items, { id, title, message, type }]);
      window.setTimeout(() => removeToast(id), 4500);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={`lv-toast ${
              toast.type === "success"
                ? "lv-toast-success"
                : toast.type === "error"
                  ? "lv-toast-error"
                  : toast.type === "warning"
                    ? "lv-toast-warning"
                    : "lv-toast-info"
            }`}
          >
            <div className="lv-toast-icon" aria-hidden="true">
              {toast.type === "success"
                ? "✓"
                : toast.type === "error"
                  ? "!"
                  : toast.type === "warning"
                    ? "!"
                    : "i"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="lv-toast-title">{toast.title}</p>
              {toast.message && <p className="lv-toast-message">{toast.message}</p>}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="lv-toast-close"
              aria-label="Dismiss notification"
            >
              &times;
            </button>
            <span className="lv-toast-progress" aria-hidden="true" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
