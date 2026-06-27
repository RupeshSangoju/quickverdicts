"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
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

// Routes where inactivity timeout should NOT apply (active trials/calls)
const EXEMPTED_ROUTES = [
  /\/juror\/trial\/.*\/conference/,           // Juror trial conference
  /\/attorney\/trial\/.*\/conference/,        // Attorney trial conference (old structure)
  /\/attorney\/cases\/.*\/trial\/conference/, // Attorney trial conference (new structure)
  /\/admin\/trial\/.*\/conference/,           // Admin trial conference
  /\/juror\/war-room/,                        // Juror war room
  /\/attorney\/war-room/,                     // Attorney war room
] as const;

/**
 * Automatically logs out the user after 20 minutes of inactivity.
 * Resets the timer on any mouse, keyboard, scroll, or touch event.
 * DISABLED during active trials/calls and war room sessions.
 *
 * @param redirectPath - Where to redirect after logout (e.g. "/login/attorney")
 * @param enabled      - Set to false to disable the hook (e.g. before auth check completes)
 */
export function useInactivityLogout(
  redirectPath: string,
  enabled: boolean = true
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  // Check if current route is exempted from inactivity logout
  const isExemptedRoute = EXEMPTED_ROUTES.some((route) => route.test(pathname));

  if (process.env.NODE_ENV === "development") {
    console.log("🔍 useInactivityLogout - pathname:", pathname, "isExempted:", isExemptedRoute, "enabled:", enabled);
  }

  useEffect(() => {
    // Disable timeout if hook is disabled, we're in an exempted route, or not in browser
    if (!enabled || isExemptedRoute || typeof window === "undefined") {
      if (process.env.NODE_ENV === "development" && isExemptedRoute) {
        console.log("✅ useInactivityLogout - Skipping timeout for exempted route:", pathname);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

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
  }, [enabled, redirectPath, isExemptedRoute]);
}
