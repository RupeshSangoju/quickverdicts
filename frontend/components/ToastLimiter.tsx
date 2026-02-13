"use client";

import { useEffect } from "react";
import { useToasterStore, toast } from "react-hot-toast";

export function ToastLimiter({ max = 1 }: { max?: number }) {
  const { toasts } = useToasterStore();

  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= max)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts, max]);

  return null;
}
