"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import { api, request } from "@/lib/apiClient";

const BLUE = "#0A2342";
const BG = "#FAF9F6";

type Step = "email" | "otp" | "password" | "success";

interface ApiResponse {
  success: boolean;
  message: string;
}

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"attorney" | "juror">("attorney");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // OTP countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Step 1: Request OTP
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const data = await request<ApiResponse>(
        api.post("/auth/request-password-reset", {
          email: email.trim().toLowerCase(),
          userType,
        })
      );

      if (data.success) {
        setSuccess("Verification code sent to your email");
        setStep("otp");
        setCountdown(600); // 10 minutes
      } else {
        setError(data.message || "Failed to send verification code");
      }
    } catch (err: any) {
      if (err.message.includes("Too many")) {
        setError("Too many reset attempts. Please try again later.");
      } else {
        setError(err.message || "Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const data = await request<ApiResponse>(
        api.post("/auth/verify-password-reset-otp", {
          email: email.trim().toLowerCase(),
          otp,
          userType,
        })
      );

      if (data.success) {
        setSuccess("Code verified successfully");
        setStep("password");
      } else {
        setError(data.message || "Invalid verification code");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);

    if (!hasUppercase || !hasLowercase || !hasNumber) {
      setError(
        "Password must contain uppercase, lowercase, and number"
      );
      return;
    }

    setLoading(true);
    try {
      const data = await request<ApiResponse>(
        api.post("/auth/reset-password", {
          email: email.trim().toLowerCase(),
          otp,
          newPassword,
          userType,
        })
      );

      if (data.success) {
        setSuccess("Password reset successfully! Redirecting to login...");
        setStep("success");

        // Redirect to login after 3 seconds
        setTimeout(() => {
          window.location.href = `/login/${userType}`;
        }, 3000);
      } else {
        setError(data.message || "Failed to reset password");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (countdown > 540 || loading) return; // Allow resend after 1 minute

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const data = await request<ApiResponse>(
        api.post("/auth/request-password-reset", {
          email: email.trim().toLowerCase(),
          userType,
        })
      );

      if (data.success) {
        setSuccess("New verification code sent to your email");
        setCountdown(600); // Reset countdown
      } else {
        setError(data.message || "Failed to resend code");
      }
    } catch (err: any) {
      setError(err.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

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

          {step === "email" && (
            <>
              <p className="text-sm text-blue-100 leading-relaxed">
                Enter your email to receive a verification code for password reset.
              </p>
              <p className="text-sm text-blue-100 mt-4">
                The code will be valid for 10 minutes.
              </p>
            </>
          )}

          {step === "otp" && (
            <>
              <p className="text-sm text-blue-100 leading-relaxed">
                We've sent a 6-digit verification code to <strong>{email}</strong>.
              </p>
              <p className="text-sm text-blue-100 mt-4">
                Enter the code to continue with password reset.
              </p>
            </>
          )}

          {step === "password" && (
            <>
              <p className="text-sm text-blue-100 leading-relaxed">
                Create a strong new password for your account.
              </p>
              <p className="text-sm text-blue-100 mt-4">
                Make sure it meets all security requirements.
              </p>
            </>
          )}

          {step === "success" && (
            <>
              <p className="text-sm text-blue-100 leading-relaxed">
                Your password has been reset successfully!
              </p>
              <p className="text-sm text-blue-100 mt-4">
                You can now login with your new password.
              </p>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <section className="flex-1 flex flex-col relative px-6 sm:px-12 py-10">
        {/* Top navigation */}
        <div className="absolute top-6 left-6 sm:left-10">
          <Link
            href={`/login/${userType}`}
            className="text-sm text-gray-600 hover:underline flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded px-2 py-1"
          >
            <ArrowLeft size={16} /> Back to Login
          </Link>
        </div>

        <div className="absolute top-6 right-6 sm:right-10 flex items-center space-x-3 text-sm">
          <span className="text-gray-600 hidden sm:inline">Don't have an account?</span>
          <Link
            href={`/signup/${userType}`}
            className="border text-gray-600 border-gray-300 rounded px-3 py-1 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2"
          >
            Sign Up
          </Link>
        </div>

        {/* Content */}
        <div className="flex flex-1 items-center justify-center lg:justify-start">
          <div className="max-w-md w-full lg:ml-16">
            <h1 className="text-2xl font-bold mb-8" style={{ color: BLUE }}>
              {step === "email" && "Password Recovery"}
              {step === "otp" && "Enter Verification Code"}
              {step === "password" && "Create New Password"}
              {step === "success" && "Password Reset Complete"}
            </h1>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex items-start gap-2">
                <AlertCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4 flex items-start gap-2">
                <CheckCircle size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-green-700">{success}</span>
              </div>
            )}

            {/* Step 1: Email */}
            {step === "email" && (
              <form className="space-y-6" onSubmit={handleRequestOTP} noValidate>
                <p className="text-sm text-gray-600 mb-6">
                  Enter your account email to receive a verification code.
                </p>

                {/* Account Type */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Account Type
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer text-gray-800">
                      <input
                        type="radio"
                        name="userType"
                        value="attorney"
                        checked={userType === "attorney"}
                        onChange={(e) => setUserType(e.target.value as "attorney" | "juror")}
                        className="mr-2 accent-[#0A2342]"
                      />
                      <span className="text-gray-800">Attorney</span>
                    </label>
                    <label className="flex items-center cursor-pointer text-gray-800">
                      <input
                        type="radio"
                        name="userType"
                        value="juror"
                        checked={userType === "juror"}
                        onChange={(e) => setUserType(e.target.value as "attorney" | "juror")}
                        className="mr-2 accent-[#0A2342]"
                      />
                      <span className="text-gray-800">Juror</span>
                    </label>
                  </div>
                </div>

                {/* Email */}
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
                    autoComplete="email"
                    className="w-full border border-gray-300 rounded px-3 py-2.5 focus:ring-2 focus:ring-[#0A2342] outline-none text-gray-800"
                    disabled={loading}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full rounded px-4 py-3 font-semibold transition-colors text-white focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#0A2342] hover:bg-[#132c54]"
                  }`}
                >
                  {loading ? "Sending..." : "Send Verification Code"}
                </button>
              </form>
            )}

            {/* Step 2: OTP Verification */}
            {step === "otp" && (
              <form className="space-y-6" onSubmit={handleVerifyOTP} noValidate>
                <p className="text-sm text-gray-600 mb-6">
                  Enter the 6-digit code sent to {email}
                </p>

                {/* Countdown Timer */}
                {countdown > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-center">
                    <span className="text-sm text-blue-800">
                      Code expires in: <strong>{formatTime(countdown)}</strong>
                    </span>
                  </div>
                )}

                {/* OTP Input */}
                <div>
                  <label
                    htmlFor="otp"
                    className="block mb-2 text-sm font-medium text-gray-700"
                  >
                    Verification Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, ""));
                      setError(null);
                    }}
                    maxLength={6}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-3 text-center text-2xl tracking-widest focus:ring-2 focus:ring-[#0A2342] outline-none text-gray-800"
                    disabled={loading}
                  />
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className={`w-full rounded px-4 py-3 font-semibold transition-colors text-white focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
                    loading || otp.length !== 6
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#0A2342] hover:bg-[#132c54]"
                  }`}
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </button>

                {/* Resend Button */}
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={loading || countdown > 540}
                  className={`w-full rounded px-4 py-3 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
                    loading || countdown > 540
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "border border-[#0A2342] text-[#0A2342] hover:bg-[#0A2342] hover:text-white"
                  }`}
                >
                  {loading
                    ? "Sending..."
                    : countdown > 540
                    ? `Resend in ${Math.ceil((countdown - 540))}s`
                    : "Resend Code"}
                </button>
              </form>
            )}

            {/* Step 3: New Password */}
            {step === "password" && (
              <form className="space-y-6" onSubmit={handleResetPassword} noValidate>
                <p className="text-sm text-gray-600 mb-6">
                  Enter and confirm your new password below.
                </p>

                {/* New Password */}
                <div>
                  <label
                    htmlFor="newPassword"
                    className="block mb-2 text-sm font-medium text-gray-700"
                  >
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError(null);
                    }}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2.5 focus:ring-2 focus:ring-[#0A2342] outline-none text-gray-800"
                    disabled={loading}
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block mb-2 text-sm font-medium text-gray-700"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError(null);
                    }}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2.5 focus:ring-2 focus:ring-[#0A2342] outline-none text-gray-800"
                    disabled={loading}
                  />
                </div>

                {/* Password Requirements */}
                <div className="bg-gray-50 rounded-md p-3 text-xs text-gray-600">
                  <p className="font-medium mb-2">Password requirements:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>At least 8 characters long</li>
                    <li>One uppercase letter</li>
                    <li>One lowercase letter</li>
                    <li>One number</li>
                  </ul>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full rounded px-4 py-3 font-semibold transition-colors text-white focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#0A2342] hover:bg-[#132c54]"
                  }`}
                >
                  {loading ? "Resetting Password..." : "Reset Password"}
                </button>
              </form>
            )}

            {/* Step 4: Success */}
            {step === "success" && (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-md p-6 text-center">
                  <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-green-800 mb-2">
                    Password Reset Successful!
                  </p>
                  <p className="text-sm text-green-700">
                    You can now login with your new password.
                  </p>
                  <p className="text-sm text-gray-600 mt-4">
                    Redirecting to login page...
                  </p>
                </div>

                <Link
                  href={`/login/${userType}`}
                  className="block w-full text-center rounded px-4 py-3 font-semibold bg-[#0A2342] text-white hover:bg-[#132c54] transition-colors"
                >
                  Go to Login Now
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
