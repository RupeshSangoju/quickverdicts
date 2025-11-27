"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Shield, Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { post, login as loginUser } from "@/lib/apiClient";

const BLUE = "#0A2342";
const BG = "#FAF9F6";
const LIGHT_BLUE = "#e6ecf5";

interface AdminLoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: {
    id: number;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    type: "admin";
    role: string;
  };
}

export default function AdminLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      img.onerror = onImageLoad; // Still count as loaded
    });

    // Fallback timeout
    const fallbackTimeout = setTimeout(() => {
      setIsPageLoading(false);
    }, 2500);

    return () => clearTimeout(fallbackTimeout);
  }, []);

  /* ===========================================================
     FORM SUBMISSION
     =========================================================== */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await post<AdminLoginResponse>("/auth/admin/login", {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      if (!response.success || !response.token || !response.user) {
        throw new Error(response.message || "Login failed");
      }

      // Store auth data using apiClient helper (localStorage only)
      loginUser(response.token, {
        id: response.user.id,
        email: response.user.email,
        type: "admin",
        username: response.user.username,
        firstName: response.user.firstName,
        lastName: response.user.lastName,
        role: response.user.role,
      });

      console.log("✅ Admin login successful - redirecting to dashboard");

      // Redirect to admin dashboard
      router.push("/admin/dashboard");
    } catch (err: any) {
      console.error("❌ Admin login error:", err);
      setError(err.message || "Invalid credentials. Please try again.");
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
        <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0A2342] transition-all duration-300 ease-out"
            style={{ width: `${(loadedImages / 1) * 100}%` }}
          />
        </div>
        <p className="text-[#0A2342] text-sm mt-4 animate-pulse">Loading...</p>
      </div>
    );
  }

  /* ===========================================================
     MAIN UI
     =========================================================== */

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG }}>
      <div className="flex min-h-screen">
        {/* Left Sidebar - Same as Attorney/Juror Login */}
        <div
          className="hidden md:flex md:w-80 flex-col justify-between p-8"
          style={{ backgroundColor: BLUE }}
        >
          <div className="flex flex-col items-center justify-center flex-1">
            <Image
              src="/logo_sidebar_signup.png"
              alt="QuickVerdicts Admin"
              width={200}
              height={200}
              priority
              className="mb-6"
            />
            <h2 className="text-white text-2xl font-bold text-center mb-2">
              Admin Portal
            </h2>
            <p className="text-white/80 text-sm text-center">
              Secure access to system controls
            </p>
          </div>
          <div className="text-white/60 text-xs text-center">
            <p>© 2024 QuickVerdicts</p>
            <p className="mt-1">Secure Admin Authentication</p>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="md:hidden flex flex-col items-center mb-8">
              <Image
                src="/logo_sidebar_signup.png"
                alt="QuickVerdicts Admin"
                width={150}
                height={150}
                priority
              />
              <h1 className="text-2xl font-bold mt-4" style={{ color: BLUE }}>
                Admin Portal
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Secure access to system controls
              </p>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:block mb-8">
              <h1 className="text-3xl font-bold" style={{ color: BLUE }}>
                Sign In to Admin Portal
              </h1>
              <p className="text-gray-600 mt-2">
                Access your administrative dashboard
              </p>
            </div>

            {/* Login Form */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Error Message */}
                {error && (
                  <div
                    className="border-2 rounded-lg p-4 flex items-start gap-3"
                    style={{
                      backgroundColor: "#FEE2E2",
                      borderColor: "#DC2626",
                    }}
                  >
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-800 text-sm font-medium">{error}</p>
                  </div>
                )}

                {/* Email Field */}
                <div>
                  <label
                    className="block font-semibold mb-2"
                    style={{ color: BLUE }}
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5"
                      style={{ color: BLUE, opacity: 0.5 }}
                    />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full pl-12 pr-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all"
                      style={{
                        borderColor: "#D1D5DB",
                        backgroundColor: BG,
                        color: BLUE,
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = BLUE;
                        e.target.style.boxShadow = `0 0 0 3px ${LIGHT_BLUE}`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#D1D5DB";
                        e.target.style.boxShadow = "none";
                      }}
                      placeholder="admin@virtualjury.com"
                      suppressHydrationWarning
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label
                    className="block font-semibold mb-2"
                    style={{ color: BLUE }}
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5"
                      style={{ color: BLUE, opacity: 0.5 }}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full pl-12 pr-12 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all"
                      style={{
                        borderColor: "#D1D5DB",
                        backgroundColor: BG,
                        color: BLUE,
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = BLUE;
                        e.target.style.boxShadow = `0 0 0 3px ${LIGHT_BLUE}`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#D1D5DB";
                        e.target.style.boxShadow = "none";
                      }}
                      placeholder="Enter your password"
                      suppressHydrationWarning
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 transition-colors"
                      style={{ color: BLUE, opacity: 0.6 }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = "1";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "0.6";
                      }}
                      suppressHydrationWarning
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-bold py-4 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                  style={{ backgroundColor: BLUE }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = "#0D2D52";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = BLUE;
                  }}
                  suppressHydrationWarning
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5" />
                      Sign In to Admin Portal
                    </>
                  )}
                </button>
              </form>

              {/* Footer Links */}
              <div className="mt-6 text-center">
                <a
                  href="/login"
                  className="text-sm font-medium transition-colors hover:underline"
                  style={{ color: BLUE }}
                >
                  ← Back to User Login
                </a>
              </div>
            </div>

            {/* Security Notice */}
            <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm flex items-center justify-center gap-2">
                <Shield className="h-4 w-4" style={{ color: BLUE }} />
                Secure admin authentication • All actions are logged
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
