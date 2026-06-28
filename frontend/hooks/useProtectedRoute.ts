// =============================================
// useProtectedRoute.ts - Protected Route Hook
// =============================================

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  isAuthenticated,
  getUserType,
  getUser,
  clearAuth
} from "@/lib/apiClient";

/* ===========================================================
   TYPES & CONSTANTS
   =========================================================== */

type UserType = "attorney" | "juror" | "admin";

// Routes where inactivity timeout should NOT apply (active trials/calls)
const EXEMPTED_ROUTES = [
  /\/juror\/trial\/.*\/conference/,           // Juror trial conference
  /\/attorney\/trial\/.*\/conference/,        // Attorney trial conference (old structure)
  /\/attorney\/cases\/.*\/trial\/conference/, // Attorney trial conference (new structure)
  /\/admin\/trial\/.*\/conference/,           // Admin trial conference
  /\/juror\/war-room/,                        // Juror war room
  /\/attorney\/war-room/,                     // Attorney war room
] as const;

interface UseProtectedRouteOptions {
  /**
   * Required user type for this route
   */
  requiredUserType: UserType;
  
  /**
   * Redirect path if not authenticated
   * Default: `/login/${userType}`
   */
  redirectTo?: string;
  
  /**
   * Whether to check email verification
   * Default: false
   */
  requireVerified?: boolean;
  
  /**
   * Whether to check onboarding completion (jurors only)
   * Default: false
   */
  requireOnboarding?: boolean;
  
  /**
   * Callback when authentication check completes
   */
  onAuthChecked?: (isAuthed: boolean) => void;
}

interface UseProtectedRouteReturn {
  /**
   * Whether auth check is in progress
   */
  isLoading: boolean;
  
  /**
   * Whether user is authenticated
   */
  isAuthenticated: boolean;
  
  /**
   * Current user data (if authenticated)
   */
  user: any | null;
  
  /**
   * Current user type
   */
  userType: UserType | null;
}

/* ===========================================================
   HOOK
   =========================================================== */

/**
 * Protected route hook - ensures user is authenticated with correct role
 * 
 * @example
 * ```
 * function AttorneyDashboard() {
 *   const { isLoading, user } = useProtectedRoute({ 
 *     requiredUserType: 'attorney' 
 *   });
 *   
 *   if (isLoading) return <Loading />;
 *   
 *   return <Dashboard user={user} />;
 * }
 * ```
 */
export function useProtectedRoute(
  options: UseProtectedRouteOptions
): UseProtectedRouteReturn {
  const router = useRouter();
  const pathname = usePathname();
  const hasChecked = useRef(false);
  const [state, setState] = useState<UseProtectedRouteReturn>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    userType: null,
  });

  const {
    requiredUserType,
    redirectTo,
    requireVerified = false,
    requireOnboarding = false,
    onAuthChecked,
  } = options;

  // Cross-tab logout: if another tab logs in as a different user type,
  // the storage event fires here and we immediately redirect to login.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== "token" && e.key !== "user") return;

      // 🛡️ NEVER tear down an active trial/call/war-room session because of a
      // cross-tab auth change. Another tab logging out (or its inactivity timer
      // firing) clears localStorage `token`/`user`, which fires this `storage`
      // event in the conference tab and would otherwise redirect to login —
      // unloading the page and ending the live call "by local participant".
      const onExemptedRoute = EXEMPTED_ROUTES.some((route) =>
        route.test(window.location.pathname)
      );
      if (onExemptedRoute) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            "🛡️ useProtectedRoute - Ignoring cross-tab auth change during active trial/war-room session:",
            window.location.pathname
          );
        }
        return;
      }

      const authed = isAuthenticated();
      const user = getUser();
      if (!authed || !user || user.type !== requiredUserType) {
        clearAuth();
        const loginPath =
          requiredUserType === "admin"
            ? "/admin/login"
            : `/login/${requiredUserType}`;
        window.location.href = loginPath;
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [requiredUserType]);

  // 20-minute inactivity timeout: reset on any user interaction;
  // check immediately on mount so an already-expired session is caught
  // before the page renders, then poll every 30 s while the tab is open.
  // DISABLED during active trials/calls and war room sessions.
  useEffect(() => {
    const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
    const POLL_MS = 30_000;            // check every 30 seconds

    const loginPath =
      requiredUserType === "admin"
        ? "/admin/login"
        : `/login/${requiredUserType}`;

    // Check if current route is exempted from inactivity logout
    const isExemptedRoute = EXEMPTED_ROUTES.some((route) => route.test(pathname));

    if (process.env.NODE_ENV === "development") {
      console.log("🔍 useProtectedRoute inactivity check - pathname:", pathname, "isExempted:", isExemptedRoute);
    }

    // Skip timeout setup if in exempted route
    if (isExemptedRoute) {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ useProtectedRoute - Skipping inactivity timeout for exempted route:", pathname);
      }
      return;
    }

    let activityCount = 0;
    const updateActivity = () => {
      activityCount++;
      localStorage.setItem("lastActivity", Date.now().toString());
      if (process.env.NODE_ENV === "development" && activityCount % 10 === 0) {
        console.log(`📊 useProtectedRoute activity detected (${activityCount}x) - updated lastActivity timestamp`);
      }
    };

    // --- Immediate check on mount ---
    const last = parseInt(localStorage.getItem("lastActivity") || "0", 10);
    const inactiveFor = Date.now() - last;
    if (last > 0 && inactiveFor > TIMEOUT_MS) {
      const mins = Math.floor(inactiveFor / 60000);
      console.log(`⏱️ ❌ IMMEDIATE CHECK - Session expired (inactive for ${mins}mins) - logging out`);
      clearAuth();
      localStorage.removeItem("lastActivity");
      window.location.href = loginPath;
      return; // skip setting up listeners — redirect is already in flight
    }

    // Seed timestamp if this is a fresh session with no recorded activity
    if (!last) {
      updateActivity();
      if (process.env.NODE_ENV === "development") {
        console.log("⏰ useProtectedRoute - Seeding lastActivity timestamp for new session");
      }
    }

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    activityEvents.forEach(ev => window.addEventListener(ev, updateActivity, { passive: true }));

    const interval = setInterval(() => {
      const latest = parseInt(localStorage.getItem("lastActivity") || "0", 10);
      const inactiveMs = Date.now() - latest;
      if (inactiveMs > TIMEOUT_MS) {
        const mins = Math.floor(inactiveMs / 60000);
        console.log(`⏱️ ❌ INTERVAL CHECK - Session expired (inactive for ${mins}mins) - logging out`);
        clearAuth();
        localStorage.removeItem("lastActivity");
        window.location.href = loginPath;
      }
    }, POLL_MS);

    return () => {
      activityEvents.forEach(ev => window.removeEventListener(ev, updateActivity));
      clearInterval(interval);
    };
  }, [requiredUserType, pathname]);

  useEffect(() => {
    // Only check once per mount
    if (hasChecked.current) return;
    hasChecked.current = true;

    // Skip on server-side
    if (typeof window === "undefined") return;

    const checkAuth = async () => {
      try {
        // Check if authenticated
        const authed = isAuthenticated();
        const currentUserType = getUserType();
        const user = getUser();

        if (process.env.NODE_ENV === "development") {
          console.log("🔐 Protected Route Check:", {
            isAuthenticated: authed,
            userType: currentUserType,
            required: requiredUserType,
            user: user ? `${user.email} (ID: ${user.id})` : "none",
          });
        }

        // Not authenticated - redirect to login
        if (!authed || !currentUserType || !user) {
          console.warn("❌ Not authenticated - redirecting to login");
          clearAuth();

          const loginPath = redirectTo || (requiredUserType === 'admin' ? '/admin/login' : `/login/${requiredUserType}`);
          router.replace(loginPath);
          
          setState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            userType: null,
          });
          
          onAuthChecked?.(false);
          return;
        }

        // Wrong user type - redirect to correct login
        if (currentUserType !== requiredUserType) {
          console.warn(
            `❌ Wrong user type: ${currentUserType} (required: ${requiredUserType})`
          );

          const loginPath = redirectTo || (requiredUserType === 'admin' ? '/admin/login' : `/login/${requiredUserType}`);
          router.replace(loginPath);
          
          setState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            userType: currentUserType,
          });
          
          onAuthChecked?.(false);
          return;
        }

        // Check email verification if required
        if (requireVerified && !user.verified) {
          console.warn("❌ Email not verified - redirecting");
          router.replace(`/${requiredUserType}/verify-email`);
          
          setState({
            isLoading: false,
            isAuthenticated: true,
            user,
            userType: currentUserType,
          });
          
          onAuthChecked?.(false);
          return;
        }

        // Check onboarding completion for jurors
        if (
          requireOnboarding &&
          requiredUserType === "juror" &&
          !user.onboardingCompleted
        ) {
          console.warn("❌ Onboarding not completed - redirecting");
          router.replace("/juror/onboarding");
          
          setState({
            isLoading: false,
            isAuthenticated: true,
            user,
            userType: currentUserType,
          });
          
          onAuthChecked?.(false);
          return;
        }

        // All checks passed
        if (process.env.NODE_ENV === "development") {
          console.log("✅ Auth check passed");
        }

        setState({
          isLoading: false,
          isAuthenticated: true,
          user,
          userType: currentUserType,
        });
        
        onAuthChecked?.(true);
      } catch (error) {
        console.error("❌ Auth check error:", error);
        clearAuth();

        const loginPath = redirectTo || (requiredUserType === 'admin' ? '/admin/login' : `/login/${requiredUserType}`);
        router.replace(loginPath);
        
        setState({
          isLoading: false,
          isAuthenticated: false,
          user: null,
          userType: null,
        });
        
        onAuthChecked?.(false);
      }
    };

    // Small delay to ensure everything is mounted
    const timeout = setTimeout(checkAuth, 100);

    return () => clearTimeout(timeout);
  }, [
    router,
    requiredUserType,
    redirectTo,
    requireVerified,
    requireOnboarding,
    onAuthChecked,
  ]);

  return state;
}

/* ===========================================================
   CONVENIENCE HOOKS
   =========================================================== */

/**
 * Hook for attorney-protected routes
 */
export function useAttorneyRoute(
  options?: Omit<UseProtectedRouteOptions, "requiredUserType">
): UseProtectedRouteReturn {
  return useProtectedRoute({
    ...options,
    requiredUserType: "attorney",
  });
}

/**
 * Hook for juror-protected routes
 */
export function useJurorRoute(
  options?: Omit<UseProtectedRouteOptions, "requiredUserType">
): UseProtectedRouteReturn {
  return useProtectedRoute({
    ...options,
    requiredUserType: "juror",
  });
}

/**
 * Hook for admin-protected routes
 */
export function useAdminRoute(
  options?: Omit<UseProtectedRouteOptions, "requiredUserType">
): UseProtectedRouteReturn {
  return useProtectedRoute({
    ...options,
    requiredUserType: "admin",
  });
}

/* ===========================================================
   EXPORTS
   =========================================================== */

export default useProtectedRoute;
