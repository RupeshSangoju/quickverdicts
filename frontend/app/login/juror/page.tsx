"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { post, login, isAuthenticated, getUserType } from "@/lib/apiClient";

/* ===========================================================
   CONSTANTS
   =========================================================== */

const BLUE = "#0A2342";
const BG = "#FAF9F6";

/* ===========================================================
   TYPES
   =========================================================== */

interface JurorLoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    county: string;
    state: string;
    type: "juror";
    verified: boolean;
    verificationStatus: string;
    onboardingCompleted: boolean;
  };
}

/* ===========================================================
   COMPONENT
   =========================================================== */

export default function JurorLogin() {
  const router = useRouter();
  
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // UI state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState(0);

  /* ===========================================================
     IMAGE PRELOADING
     =========================================================== */

  useEffect(() => {
    const imagesToLoad = ["/logo_sidebar_signup.png"];
    let loadedCount = 0;

    const onImageLoad = () => {
      loadedCount++;
      setLoadedImages(loadedCount);
      
      if (loadedCount === imagesToLoad.length) {
        setTimeout(() => setIsPageLoading(false), 300);
      }
    };

    imagesToLoad.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      img.onload = onImageLoad;
      img.onerror = onImageLoad;
    });

    // Fallback timeout
    const fallbackTimeout = setTimeout(() => {
      setIsPageLoading(false);
    }, 2500);

    return () => clearTimeout(fallbackTimeout);
  }, []);

  /* ===========================================================
     AUTO-LOGIN CHECK
     =========================================================== */

  useEffect(() => {
    // Skip if still loading page
    if (isPageLoading) return;

    // Check if user just logged out
    if (sessionStorage.getItem("justLoggedOut")) {
      sessionStorage.removeItem("justLoggedOut");
      return;
    }

    // Check if already authenticated
    const checkAuth = () => {
      const authed = isAuthenticated();
      const userType = getUserType();

      if (authed && userType === "juror") {
        console.log("✅ Already authenticated as juror - redirecting");
        router.replace("/juror");
      }
    };

    checkAuth();
  }, [router, isPageLoading]);

  /* ===========================================================
     FORM VALIDATION
     =========================================================== */

  const validateForm = (): boolean => {
    // Check if fields are empty
    if (!email.trim() || !password) {
      setError("Please enter both email and password");
      return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address");
      return false;
    }

    return true;
  };

  /* ===========================================================
     LOGIN HANDLER
     =========================================================== */

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Capture user's timezone offset
      const timezoneOffset = -new Date().getTimezoneOffset(); // Invert sign: positive = ahead of UTC

      console.log("🌍 Juror login - Timezone:", {
        timezoneOffset,
        timezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      // Call login API
      const response = await post<JurorLoginResponse>(
        "/auth/juror/login",
        {
          email: email.trim().toLowerCase(),
          password: password,
          timezoneOffset: timezoneOffset,
        }
      );

      // Check if login was successful
      if (!response.success || !response.token || !response.user) {
        throw new Error(response.message || "Login failed");
      }

      // Store auth data using apiClient helper
      login(response.token, {
        id: response.user.id,
        email: response.user.email,
        type: "juror",
        name: response.user.name,
        county: response.user.county,
        state: response.user.state,
        verified: response.user.verified,
        verificationStatus: response.user.verificationStatus,
        onboardingCompleted: response.user.onboardingCompleted,
      });

      // Clean up any signup drafts
      localStorage.removeItem("attorneySignupDraft");
      localStorage.removeItem("jurorSignupDraft");

      console.log("✅ Login successful - redirecting to dashboard");

      // Redirect to juror dashboard
      router.push("/juror");
    } catch (error: any) {
      console.error("❌ Login error:", error);
      
      // Display user-friendly error message
      setError(
        error.message ||
        "Login failed. Please check your credentials and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ===========================================================
     LOADING SCREEN
     =========================================================== */

  if (isPageLoading) {
    return (
      <div className="fixed inset-0 bg-[#f9f7f2] flex flex-col items-center justify-center z-50">
        <Image
          src="/logo_sidebar_signup.png"
          alt="Quick Verdicts Logo"
          width={200}
          height={80}
          className="mb-6"
          priority
        />
        <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0A2342] transition-all duration-300 ease-out"
            style={{ width: `${(loadedImages / 1) * 100}%` }}
          />
        </div>
        <p className="text-[#0A2342] text-sm mt-4 animate-pulse">
          Loading...
        </p>
      </div>
    );
  }

  /* ===========================================================
     LOGIN PAGE
     =========================================================== */

  return (
    <main
      className="min-h-screen flex font-sans"
      style={{ backgroundColor: BG }}
    >
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-[#0A2342] text-white relative">
        <div className="absolute top-10 w-full text-center">
          <Image
            src="/logo_sidebar_signup.png"
            alt="Quick Verdicts Logo"
            width={280}
            height={120}
            className="mx-auto"
            priority
          />
        </div>

        <div className="px-6 py-8 mt-48">
          <h2 className="text-lg font-semibold mb-3">Juror Login</h2>
          <p className="text-sm text-blue-100">
            Access your juror dashboard, browse cases, and get paid to serve.
          </p>
        </div>

        {/* Features List */}
        <div className="px-6 py-4 mt-auto space-y-3 text-sm text-blue-100">
          <div className="flex items-start gap-2">
            <span className="text-green-400">✓</span>
            <span>Browse available cases</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400">✓</span>
            <span>Apply to virtual trials</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400">✓</span>
            <span>Get paid for your service</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <section className="flex-1 flex flex-col relative px-6 sm:px-12 py-10">
        {/* Back Button */}
        <div className="absolute top-6 left-6">
          <Link
            href="/login"
            className="text-sm text-gray-600 hover:text-[#0A2342] hover:underline transition-colors"
          >
            ← Back to Login Options
          </Link>
        </div>

        {/* Sign Up Link */}
        <div className="absolute top-6 right-6 flex items-center gap-2 text-sm">
          <span className="text-gray-600 hidden sm:inline">
            Don't have an account?
          </span>
          <Link
            href="/signup/juror"
            className="border text-gray-700 border-gray-300 rounded px-3 py-1.5 hover:bg-gray-100 hover:border-gray-400 transition-all font-medium"
          >
            Sign Up
          </Link>
        </div>

        {/* Login Form - CHANGED: Removed justify-center, added ml-0 lg:ml-4 */}
        <div className="flex flex-1 items-center ml-0 lg:ml-4">
          <div className="max-w-md w-full">
            <h1
              className="text-2xl sm:text-3xl font-bold mb-2"
              style={{ color: BLUE }}
            >
              Juror Login
            </h1>
            <p className="text-gray-600 mb-8">
              Welcome back! Log in to access cases and get paid to serve.
            </p>

            {/* Rest of your form stays exactly the same */}
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Error Alert */}
              {error && (
                <div
                  className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2"
                  role="alert"
                >
                  <AlertCircle
                    className="text-red-500 flex-shrink-0 mt-0.5"
                    size={18}
                  />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Email Field */}
              <div>
                <label
                  htmlFor="email"
                  className="block mb-2 text-sm font-medium text-gray-700"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  required
                  disabled={loading}
                  autoComplete="email"
                  className="w-full border border-gray-300 rounded px-3 py-2.5 focus:ring-2 focus:ring-[#0A2342] focus:border-[#0A2342] outline-none text-gray-800 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
                />
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="password"
                  className="block mb-2 text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    className="w-full border border-gray-300 rounded px-3 py-2.5 pr-10 focus:ring-2 focus:ring-[#0A2342] focus:border-[#0A2342] outline-none text-gray-800 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute inset-y-0 right-3 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full rounded px-4 py-3 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 text-white ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#0A2342] hover:bg-[#132c54]"
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Logging in...
                  </span>
                ) : (
                  "Log In"
                )}
              </button>

              {/* Forgot Password */}
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-gray-600 hover:text-[#0A2342] hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Need help?{" "}
                <Link
                  href="/contact"
                  className="text-[#0A2342] hover:underline font-medium"
                >
                  Contact Support
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
