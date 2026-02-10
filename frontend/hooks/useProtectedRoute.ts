// =============================================
// useProtectedRoute.ts - Protected Route Hook
// =============================================

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  isAuthenticated, 
  getUserType, 
  getUser, 
  clearAuth 
} from "@/lib/apiClient";

/* ===========================================================
   TYPES
   =========================================================== */

type UserType = "attorney" | "juror" | "admin";

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
          
          const loginPath = redirectTo || `/login/${requiredUserType}`;
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
          
          const loginPath = redirectTo || `/login/${requiredUserType}`;
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
        
        const loginPath = redirectTo || `/login/${requiredUserType}`;
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
