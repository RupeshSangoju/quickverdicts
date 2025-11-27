// =============================================
// apiClient.ts - API Communication Layer
// =============================================

import axios, { 
  AxiosError, 
  AxiosResponse, 
  InternalAxiosRequestConfig 
} from "axios";

/* ===========================================================
   TYPES & INTERFACES
   =========================================================== */

/**
 * Standard API Response Format (matches backend)
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  data?: T;
  token?: string;
  user?: any;
  // Legacy fields for backward compatibility
  attorneyId?: number;
  jurorId?: number;
}

/**
 * Error Response from API
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  code?: string;
}

/**
 * Authentication User Data
 * Includes all possible fields from Attorney, Juror, and Admin
 */
export interface AuthUser {
  // ===== COMMON FIELDS (all user types) =====
  id: number;
  email: string;
  type: "attorney" | "juror" | "admin";
  verified?: boolean;
  verificationStatus?: string;
  isActive?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  
  // ===== ATTORNEY FIELDS =====
  firstName?: string;
  middleName?: string;
  lastName?: string;
  lawFirmName?: string;
  phoneNumber?: string;
  state?: string;
  stateBarNumber?: string;
  officeAddress1?: string;
  officeAddress2?: string;
  city?: string;
  county?: string;
  zipCode?: string;
  tierLevel?: string;
  verifiedAt?: string;
  
  // ===== JUROR FIELDS =====
  name?: string;
  address1?: string;
  address2?: string;
  maritalStatus?: string;
  spouseEmployer?: string;
  employerName?: string;
  employerAddress?: string;
  yearsInCounty?: number;
  ageRange?: string;
  gender?: string;
  education?: string;
  paymentMethod?: string;
  onboardingCompleted?: boolean;
  introVideoCompleted?: boolean;
  jurorQuizCompleted?: boolean;
  profileComplete?: boolean;
  
  // ===== ADMIN FIELDS =====
  username?: string;
  role?: string;
}

/* ===========================================================
   CONFIGURATION
   =========================================================== */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  // Auth routes
  "/auth/attorney/signup",
  "/auth/attorney/login",
  "/auth/attorney/send-otp",
  "/auth/attorney/verify-otp",
  "/auth/attorney/send-email-verification",
  "/auth/juror/signup",
  "/auth/juror/login",
  "/auth/juror/send-otp",
  "/auth/juror/verify-otp",
  "/auth/juror/send-email-verification",
  "/auth/admin/login",
  "/auth/login", // Unified login
  "/auth/verify-email",
  "/auth/request-password-reset",
  "/auth/reset-password",
  "/auth/health",
  // Public attorney/juror routes
  "/attorney/public-check",
  "/juror/public-check",
] as const;

/* ===========================================================
   AXIOS INSTANCE
   =========================================================== */

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

/* ===========================================================
   HELPER FUNCTIONS
   =========================================================== */

/**
 * Check if route is public (doesn't require auth)
 */
function isPublicRoute(url?: string): boolean {
  if (!url) return false;
  return PUBLIC_ROUTES.some((route) => url.includes(route));
}

/**
 * Get stored auth token
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("token");
  } catch (error) {
    console.error("Error reading token from localStorage:", error);
    return null;
  }
}

/**
 * Store auth token
 */
export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("token", token);
  } catch (error) {
    console.error("Error storing token in localStorage:", error);
  }
}

/**
 * Remove auth token
 */
export function removeToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("token");
  } catch (error) {
    console.error("Error removing token from localStorage:", error);
  }
}

/**
 * Store user data
 */
export function setUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("user", JSON.stringify(user));
  } catch (error) {
    console.error("Error storing user in localStorage:", error);
  }
}

/**
 * Get stored user data
 */
export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error("Error reading user from localStorage:", error);
    return null;
  }
}

/**
 * Remove user data
 */
export function removeUser(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("user");
  } catch (error) {
    console.error("Error removing user from localStorage:", error);
  }
}

/**
 * Clear all auth data
 */
export function clearAuth(): void {
  removeToken();
  removeUser();
}

/* ===========================================================
   TYPE GUARDS
   =========================================================== */

/**
 * Type guard to check if user is attorney
 */
export function isAttorney(user: AuthUser | null): user is AuthUser & { firstName: string; lastName: string } {
  return user?.type === "attorney";
}

/**
 * Type guard to check if user is juror
 */
export function isJuror(user: AuthUser | null): user is AuthUser & { name: string } {
  return user?.type === "juror";
}

/**
 * Type guard to check if user is admin
 */
export function isAdmin(user: AuthUser | null): user is AuthUser & { username: string; role: string } {
  return user?.type === "admin";
}

/* ===========================================================
   REQUEST INTERCEPTOR
   =========================================================== */

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    const isPublic = isPublicRoute(config.url);

    // Attach Authorization header for protected routes
    if (token && !isPublic) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request in development
    if (process.env.NODE_ENV === "development") {
      console.log(`🔵 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    console.error("❌ Request Interceptor Error:", error);
    return Promise.reject(error);
  }
);

/* ===========================================================
   RESPONSE INTERCEPTOR
   =========================================================== */

api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log response in development
    if (process.env.NODE_ENV === "development") {
      console.log(`🟢 API Response: ${response.config.url}`, response.data);
    }

    return response;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      console.warn("⚠️ Unauthorized (401) - Clearing auth data");
      clearAuth();

      // Redirect to login if not already there
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.warn("⚠️ Forbidden (403) - Access denied");
    }

    // Handle 500 Internal Server Error
    if (error.response?.status === 500) {
      console.error("❌ Internal Server Error (500)");
    }

    // Log error in development
    if (process.env.NODE_ENV === "development") {
      console.error("❌ API Error:", {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    return Promise.reject(error);
  }
);

/* ===========================================================
   GENERIC REQUEST WRAPPER
   =========================================================== */

/**
 * Generic typed request wrapper with proper error handling
 * @param promise Axios promise to execute
 * @returns Typed response data
 */
export async function request<T = any>(
  promise: Promise<AxiosResponse<ApiResponse<T>>>
): Promise<ApiResponse<T>> {
  try {
    const response = await promise;
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiErrorResponse>;

      // Server responded with error
      if (axiosError.response) {
        const errorData = axiosError.response.data;

        // Extract error message
        const errorMessage =
          errorData?.error ||
          errorData?.message ||
          `Request failed with status ${axiosError.response.status}`;

        throw new Error(errorMessage);
      }

      // Request made but no response
      if (axiosError.request) {
        throw new Error(
          "No response from server. Please check your internet connection."
        );
      }

      // Request setup error
      throw new Error(axiosError.message || "Request configuration error");
    }

    // Unknown error
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("An unexpected error occurred");
  }
}

/* ===========================================================
   CONVENIENCE METHODS
   =========================================================== */

/**
 * GET request
 */
export async function get<T = any>(
  url: string,
  config?: any
): Promise<ApiResponse<T>> {
  return request<T>(api.get(url, config));
}

/**
 * POST request
 */
export async function post<T = any>(
  url: string,
  data?: any,
  config?: any
): Promise<ApiResponse<T>> {
  return request<T>(api.post(url, data, config));
}

/**
 * PUT request
 */
export async function put<T = any>(
  url: string,
  data?: any,
  config?: any
): Promise<ApiResponse<T>> {
  return request<T>(api.put(url, data, config));
}

/**
 * DELETE request
 */
export async function del<T = any>(
  url: string,
  config?: any
): Promise<ApiResponse<T>> {
  return request<T>(api.delete(url, config));
}

/**
 * PATCH request
 */
export async function patch<T = any>(
  url: string,
  data?: any,
  config?: any
): Promise<ApiResponse<T>> {
  return request<T>(api.patch(url, data, config));
}

/* ===========================================================
   AUTHENTICATION HELPERS
   =========================================================== */

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Get current user type
 */
export function getUserType(): "attorney" | "juror" | "admin" | null {
  const user = getUser();
  return user?.type || null;
}

/**
 * Login user (store token and user data)
 */
export function login(token: string, user: AuthUser): void {
  setToken(token);
  setUser(user);
}

/**
 * Logout user (clear all auth data)
 * @param redirectPath - Optional path to redirect to (default: "/login")
 */
export function logout(redirectPath: string = "/login"): void {
  clearAuth();
  if (typeof window !== "undefined") {
    window.location.href = redirectPath;
  }
}

/* ===========================================================
   EXPORTS
   =========================================================== */

export default api;
