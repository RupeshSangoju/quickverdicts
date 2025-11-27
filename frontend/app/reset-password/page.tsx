"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Eye, EyeOff, AlertCircle } from "lucide-react";
import { api, request } from "@/lib/apiClient";

const BLUE = "#0A2342";
const BG = "#FAF9F6";

interface VerifyTokenResponse {
  success: boolean;
  email?: string;
  message?: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState("");
  const [userType, setUserType] = useState<"attorney" | "juror">("attorney");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasNumber: false,
    hasCapital: false,
    hasSpecial: false,
    noConsecutive: false,
    notAccountName: true,
    passwordsMatch: false,
  });

  // ✅ Extract and verify token
  useEffect(() => {
    const verifyToken = async () => {
      const urlToken = searchParams.get("token");
      const urlType = searchParams.get("type");

      if (!urlToken || !urlType || !["attorney", "juror"].includes(urlType)) {
        setError("Invalid or missing reset link parameters.");
        setVerifyingToken(false);
        return;
      }

      setToken(urlToken);
      setUserType(urlType as "attorney" | "juror");

      try {
        const data = await request<VerifyTokenResponse>(
          api.post("/auth/verify-reset-token", {
            token: urlToken,
            userType: urlType,
          })
        );

        if (data.success && data.data?.email) {
          setEmail(data.data.email);
        } else if (data.message) {
          setError(data.message);
        }
      } catch (err: any) {
        setError(err.message || "Failed to verify reset token.");
      } finally {
        setVerifyingToken(false);
      }
    };

    verifyToken();
  }, [searchParams]);

  // ✅ Password validation
  useEffect(() => {
    const accountName = email.split("@")[0]?.toLowerCase() || "";
    setPasswordValidation({
      minLength: newPassword.length >= 8,
      hasNumber: /\d/.test(newPassword),
      hasCapital: /[A-Z]/.test(newPassword),
      hasSpecial: /[!@#$%^&*()[\]{};:'",.<>/?\\|`~_\-+=]/.test(newPassword),
      noConsecutive: !/(.)\1\1/.test(newPassword),
      notAccountName: newPassword.toLowerCase() !== accountName,
      passwordsMatch: newPassword === confirmPassword && newPassword.length > 0,
    });
  }, [newPassword, confirmPassword, email]);

  const isPasswordValid = () =>
    Object.values(passwordValidation).every(Boolean) && confirmPassword !== "";

  // ✅ Handle reset password
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid()) {
      setError("Please ensure your password meets all requirements and matches.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const data = await request<ResetPasswordResponse>(
        api.post("/auth/reset-password", {
          token,
          userType,
          newPassword,
        })
      );

      if (data.success) {
        setSuccess(true);
        setTimeout(() => router.push(`/login/${userType}`), 3000);
      } else {
        setError(data.message || "Failed to reset password.");
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Verifying Token UI
  if (verifyingToken) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: BG }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0A2342] mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying reset link...</p>
        </div>
      </main>
    );
  }

  // ❌ Invalid Token UI
  if (error && !token) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: BG }}
      >
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold mb-4" style={{ color: BLUE }}>
            Invalid Reset Link
          </h1>
          <p className="text-gray-600 mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block bg-[#0A2342] text-white px-6 py-3 rounded hover:bg-[#132c54] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A2342]"
          >
            Request New Reset Link
          </Link>
        </div>
      </main>
    );
  }

  // ✅ Success UI
  if (success) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: BG }}
      >
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4" style={{ color: BLUE }}>
            Password Reset Successful!
          </h1>
          <p className="text-gray-600 mb-6">
            Your password has been updated successfully.
          </p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </main>
    );
  }

  // ✅ Reset Password Form UI
  return (
    <main className="min-h-screen flex font-sans" style={{ backgroundColor: BG }}>
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-[#0A2342] text-white relative">
        <div className="absolute top-10 left-0 w-full">
          <Image
            src="/logo_sidebar_signup.png"
            alt="Quick Verdicts Logo"
            width={280}
            height={120}
            className="w-full object-cover"
            priority
          />
        </div>

        <div className="px-6 py-8 mt-48">
          <h2 className="text-lg font-semibold mb-3">Password Recovery</h2>
          <p className="text-sm text-blue-100 leading-relaxed">
            Choose a new secure password that meets all criteria.
          </p>
        </div>
      </aside>

      {/* Main Section */}
      <section className="flex-1 flex flex-col relative px-6 sm:px-12 py-10">
        <div className="absolute top-6 left-6">
          <Link
            href="/forgot-password"
            className="text-sm text-gray-600 hover:underline flex items-center gap-1"
          >
            <ArrowLeft size={16} /> Back
          </Link>
        </div>

        <div className="absolute top-6 right-6 flex items-center gap-2 text-sm">
          <span className="text-gray-600 hidden sm:inline">Don’t have an account?</span>
          <Link
            href="/signup"
            className="border text-gray-600 border-gray-300 rounded px-3 py-1 hover:bg-gray-100"
          >
            Sign Up
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-md w-full lg:ml-16">
            <h1 className="text-2xl font-bold mb-8" style={{ color: BLUE }}>
              Reset Your Password
            </h1>

            {email && (
              <p className="text-sm text-gray-600 mb-6">
                Resetting password for: <strong>{email}</strong>
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
                  <AlertCircle className="text-red-500" size={18} />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Password Field */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2.5 pr-10 focus:ring-2 focus:ring-[#0A2342] outline-none text-gray-800"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 text-gray-500"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Password Criteria */}
                <div className="mt-3 space-y-1 text-sm">
                  {Object.entries({
                    "Be at least 8 characters": passwordValidation.minLength,
                    "Contain at least one number": passwordValidation.hasNumber,
                    "Contain one uppercase letter": passwordValidation.hasCapital,
                    "Include one special character": passwordValidation.hasSpecial,
                    "No 3 consecutive identical characters": passwordValidation.noConsecutive,
                    "Not same as email name": passwordValidation.notAccountName,
                  }).map(([text, valid]) => (
                    <div key={text} className="flex items-center gap-2">
                      <input type="checkbox" checked={valid} readOnly className="w-4 h-4 accent-[#0A2342]" />
                      <span className={valid ? "text-green-600" : "text-gray-600"}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2.5 pr-10 focus:ring-2 focus:ring-[#0A2342] outline-none text-gray-800"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-3 text-gray-500"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!isPasswordValid() || loading}
                className={`w-full rounded px-4 py-3 font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
                  !isPasswordValid() || loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#0A2342] hover:bg-[#132c54]"
                }`}
              >
                {loading ? "Resetting Password..." : "Reset Password"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ResetPassword() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: BG }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0A2342] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
