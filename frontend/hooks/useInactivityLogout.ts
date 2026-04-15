"use client";

import { useEffect, useRef } from "react";
import { clearAuth } from "@/lib/apiClient";

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

/**
 * Automatically logs out the user after 20 minutes of inactivity.
 * Resets the timer on any mouse, keyboard, scroll, or touch event.
 *
 * @param redirectPath - Where to redirect after logout (e.g. "/login/attorney")
 * @param enabled      - Set to false to disable the hook (e.g. before auth check completes)
 */
export function useInactivityLogout(
  redirectPath: string,
  enabled: boolean = true
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        console.log("⏱️ Inactivity timeout — logging out");
        clearAuth();
        window.location.href = redirectPath;
      }, INACTIVITY_TIMEOUT_MS);
    };

    // Start the timer immediately
    reset();

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, reset)
      );
    };
  }, [enabled, redirectPath]);
}
