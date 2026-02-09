"use client";

import { useEffect } from "react";
import { Toaster, useToasterStore, toast } from "react-hot-toast";

const TOAST_LIMIT = 1;

export default function ToastProvider() {
  const { toasts } = useToasterStore();

  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= TOAST_LIMIT)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);

  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        duration: 4000,
        style: {
          background: "#fff",
          color: "#0A2342",
          padding: "16px",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          maxWidth: "500px",
        },
        success: {
          duration: 4000,
          iconTheme: {
            primary: "#10b981",
            secondary: "#fff",
          },
          style: {
            background: "#f0fdf4",
            border: "1px solid #86efac",
          },
        },
        error: {
          duration: 5000,
          iconTheme: {
            primary: "#ef4444",
            secondary: "#fff",
          },
          style: {
            background: "#fef2f2",
            border: "1px solid #fca5a5",
          },
        },
        loading: {
          iconTheme: {
            primary: "#0A2342",
            secondary: "#fff",
          },
        },
      }}
    />
  );
}
