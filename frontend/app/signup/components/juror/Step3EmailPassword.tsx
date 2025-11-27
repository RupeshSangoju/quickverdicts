"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { FormField, TextInput } from "@/components/forms/FormField";
import type { JurorFormData, ValidationErrors } from "@/types/signup.types";
import { validatePasswordRequirements } from "@/lib/validation/validators";
import { Eye, EyeOff, Check, Mail, Shield, AlertCircle, Lock, KeyRound } from "lucide-react";

/* ===========================================================
   TYPES
   =========================================================== */

interface Step3EmailPasswordProps {
  formData: JurorFormData;
  onUpdate: (data: Partial<JurorFormData>) => void;
  validationErrors: ValidationErrors;
  onClearError: (field: keyof JurorFormData | string) => void;
  authSubStep: 1 | 2;
  onNext: () => void;
  loading?: boolean;
  onResendOTP?: () => void;
}

interface ChecklistItem {
  ok: boolean;
  text: string;
}

/* ===========================================================
   UTILITY FUNCTIONS
   =========================================================== */

/**
 * Mask email for display
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;

  if (local.length <= 2) return email;

  const masked =
    local[0] + "*".repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

/* ===========================================================
   CHECKLIST COMPONENT
   =========================================================== */

function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="text-sm space-y-2.5" role="list">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <div
            className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all ${
              item.ok
                ? "bg-green-500 border-green-500"
                : "bg-white border-gray-300"
            }`}
            aria-hidden="true"
          >
            {item.ok && <Check size={12} className="text-white font-bold" />}
          </div>
          <div
            className={`flex-1 ${
              item.ok ? "text-green-700 font-medium" : "text-gray-600"
            }`}
          >
            {item.text}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

export function Step3EmailPassword({
  formData,
  onUpdate,
  validationErrors,
  onClearError,
  authSubStep,
  onNext,
  loading = false,
  onResendOTP,
}: Step3EmailPasswordProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  /* ===========================================================
     PASSWORD VALIDATION
     =========================================================== */

  const passwordValidation = validatePasswordRequirements(
    formData.password || "",
    formData.personalDetails2?.name || ""
  );

  /* ===========================================================
     RESEND COOLDOWN TIMER
     =========================================================== */

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

  /* ===========================================================
     OTP HANDLERS
     =========================================================== */

  const handleOTPChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;

      onClearError("otp");

      const otpArray = (formData.otp ?? "").padEnd(6, " ").split("");
      otpArray[index] = value || " ";
      const newOTP = otpArray.join("").trimEnd();

      onUpdate({ otp: newOTP });

      // Track input
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "otp_digit_entered", {
          form_type: "juror_signup",
          step: "3.2",
          digits_filled: newOTP.replace(/ /g, "").length,
        });
      }

      // Move to next input
      if (value && index < 5) {
        otpInputsRef.current[index + 1]?.focus();
      }
    },
    [formData.otp, onUpdate, onClearError]
  );

  const handleOTPPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pastedData = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);

      onClearError("otp");
      onUpdate({ otp: pastedData });

      // Track paste
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "otp_pasted", {
          form_type: "juror_signup",
          step: "3.2",
        });
      }

      const nextEmptyIndex = pastedData.length < 6 ? pastedData.length : 5;
      setTimeout(() => otpInputsRef.current[nextEmptyIndex]?.focus(), 0);
    },
    [onUpdate, onClearError]
  );

  const handleOTPKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      const otpVal = formData.otp ?? "";

      if (e.key === "Backspace") {
        const otpArray = otpVal.padEnd(6, " ").split("");

        if (!otpArray[index] || otpArray[index] === " ") {
          if (index > 0) {
            otpInputsRef.current[index - 1]?.focus();
          }
        } else {
          otpArray[index] = " ";
          onUpdate({ otp: otpArray.join("").trimEnd() });
          onClearError("otp");
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      } else if (e.key === "ArrowRight" && index < 5) {
        otpInputsRef.current[index + 1]?.focus();
      }
    },
    [formData.otp, onUpdate, onClearError]
  );

  /* ===========================================================
     AUTO-FOCUS FIRST INPUT
     =========================================================== */

  useEffect(() => {
    if (authSubStep === 2) {
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    }
  }, [authSubStep]);

  /* ===========================================================
     RESEND OTP HANDLER
     =========================================================== */

  const handleResendCode = useCallback(() => {
    if (resendCooldown > 0 || !onResendOTP) return;

    onUpdate({ otp: "" });
    onClearError("otp");
    onResendOTP();
    setResendCooldown(60);

    // Track resend
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "otp_resend_attempt", {
        form_type: "juror_signup",
        step: "3.2",
      });
    }
  }, [resendCooldown, onResendOTP, onUpdate, onClearError]);

  /* ===========================================================
     FORM SUBMIT HANDLER
     =========================================================== */

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Track form submission
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "step3_submit", {
          form_type: "juror_signup",
          substep: authSubStep === 1 ? "3.1" : "3.2",
        });
      }

      onNext();
    },
    [authSubStep, onNext]
  );

  /* ===========================================================
     RENDER OTP VERIFICATION SCREEN (Sub-step 2)
     =========================================================== */

  if (authSubStep === 2) {
    const otpDigits = (formData.otp ?? "").padEnd(6, " ").split("");
    const isComplete = otpDigits.every((d) => d !== " ");
    const hasError = !!validationErrors.otp;

    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Main Card */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-[#0A2342] to-[#132c54] px-8 py-6 text-center">
            <div className="inline-flex w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl items-center justify-center mb-4">
              <KeyRound className="w-8 h-8 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Email Verification
            </h1>
            <p className="text-blue-100">
              Enter the 6-digit code sent to
            </p>
            <p className="font-semibold text-white mt-1">
              {maskEmail(formData.email)}
            </p>
          </div>

          {/* Content Section */}
          <div className="p-8">
            {/* OTP Input */}
            <div className="mb-6">
              <label
                className="block text-sm font-semibold text-gray-700 mb-4 text-center"
                id="otp-label"
              >
                Verification Code
              </label>
              <div
                className="flex gap-3 justify-center mb-3"
                role="group"
                aria-labelledby="otp-label"
              >
                {otpDigits.map((digit, index) => {
                  const hasValue = digit !== " ";

                  return (
                    <div key={index} className="relative">
                      <input
                        ref={(el) => {
                          otpInputsRef.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit === " " ? "" : digit}
                        onChange={(e) => handleOTPChange(index, e.target.value)}
                        onKeyDown={(e) => handleOTPKeyDown(index, e)}
                        onPaste={handleOTPPaste}
                        className={`
                          w-14 h-16 text-center text-2xl font-bold rounded-xl
                          border-2 transition-all duration-200
                          focus:outline-none focus:ring-4
                          ${
                            hasError
                              ? "border-red-400 bg-red-50 text-red-600 focus:ring-red-100 focus:border-red-500"
                              : hasValue
                              ? "border-[#0A2342] bg-blue-50 text-[#0A2342] focus:ring-blue-100 focus:border-[#0A2342] shadow-sm"
                              : "border-gray-300 bg-white text-gray-900 focus:ring-blue-50 focus:border-[#0A2342] hover:border-gray-400"
                          }
                        `}
                        aria-label={`Digit ${index + 1} of 6`}
                        aria-invalid={hasError}
                      />
                      {hasValue && !hasError && (
                        <div
                          className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-sm"
                          aria-hidden="true"
                        >
                          <Check size={12} className="text-white font-bold" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Status Messages */}
              {hasError && (
                <div
                  className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 mt-4"
                  role="alert"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                    <p className="text-red-700 text-sm font-medium">
                      {validationErrors.otp}
                    </p>
                  </div>
                </div>
              )}
              {isComplete && !hasError && !loading && (
                <div
                  className="bg-green-50 border-l-4 border-green-500 rounded-r-lg p-4 mt-4"
                  role="status"
                >
                  <div className="flex items-center gap-2">
                    <Check className="text-green-600 flex-shrink-0" size={20} />
                    <p className="text-green-700 text-sm font-medium">
                      Code entered successfully!
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !isComplete}
                className={`w-full font-semibold px-8 py-4 rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
                  loading || !isComplete
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[#0A2342] text-white hover:bg-[#132c54] hover:shadow-lg transform hover:scale-[1.02]"
                }`}
                aria-label="Verify email with entered code"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Verifying Code...
                  </span>
                ) : (
                  "Verify & Continue"
                )}
              </button>

              {/* Resend Section */}
              <div className="text-center pt-2">
                <p className="text-sm text-gray-600 mb-2">
                  Didn't receive the code?
                </p>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || !onResendOTP}
                  className="text-[#0A2342] text-sm font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded px-3 py-1.5 transition-all"
                  aria-label="Resend verification code"
                >
                  <Mail size={16} aria-hidden="true" />
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend Code"}
                </button>
              </div>
            </div>

            {/* Helpful Tips */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mt-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-white" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-2 text-gray-800">
                    💡 Helpful Tips
                  </p>
                  <ul className="space-y-1.5 text-xs text-gray-600" role="list">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">•</span>
                      <span>Check your spam/junk folder if you don't see the email</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">•</span>
                      <span>Code expires in 10 minutes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">•</span>
                      <span>You can paste the code directly from your email</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ===========================================================
     RENDER EMAIL & PASSWORD FORM (Sub-step 1)
     =========================================================== */

  const canSubmit =
    passwordValidation.all &&
    formData.password === formData.confirmPassword &&
    !loading;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#0A2342] mb-2">
          Create Your Account
        </h1>
        <p className="text-gray-600">
          Set up your secure login credentials. All fields marked with{" "}
          <span className="text-red-500">*</span> are required.
        </p>
      </header>

      {/* Form */}
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {/* Email Field */}
        <section className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2">
            <Mail className="text-blue-600" size={20} aria-hidden="true" />
            Email Address
          </h2>
          <FormField
            label="Your Email"
            required
            validationErrors={validationErrors}
            fieldName="email"
          >
            <TextInput
              type="email"
              placeholder="johndoe@gmail.com"
              value={formData.email}
              onChange={(val) => {
                onUpdate({ email: val.toLowerCase().trim() });
                onClearError("email");
              }}
              hasError={!!validationErrors.email}
              autoComplete="email"
            />
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <Shield size={12} aria-hidden="true" />
              We'll send a verification code to this email
            </p>
          </FormField>
        </section>

        {/* Password Section */}
        <section className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2">
            <Lock className="text-blue-600" size={20} aria-hidden="true" />
            Password Security
          </h2>

          {/* Password */}
          <FormField
            label="Password"
            required
            validationErrors={validationErrors}
            fieldName="password"
          >
            <div className="relative">
              <TextInput
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                value={formData.password || ""}
                onChange={(val) => {
                  onUpdate({ password: val });
                  onClearError("password");
                }}
                hasError={!!validationErrors.password}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Password Requirements */}
            <div className="mt-4 p-4 bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Password Requirements:
              </p>
              <Checklist
                items={[
                  {
                    ok: passwordValidation.hasLen,
                    text: "At least 8 characters long",
                  },
                  {
                    ok: passwordValidation.hasNum,
                    text: "Contains at least 1 number",
                  },
                  {
                    ok: passwordValidation.hasUpper,
                    text: "Contains at least 1 uppercase letter",
                  },
                  {
                    ok: passwordValidation.hasSpecial,
                    text: "Contains at least 1 special character (!@#$%^&*)",
                  },
                  {
                    ok: passwordValidation.notSameAsName,
                    text: "Not the same as your name",
                  },
                  {
                    ok: passwordValidation.noTriple,
                    text: "No more than 2 consecutive identical characters",
                  },
                ]}
              />
            </div>
          </FormField>

          {/* Confirm Password */}
          <FormField
            label="Confirm Password"
            required
            validationErrors={validationErrors}
            fieldName="confirmPassword"
          >
            <div className="relative">
              <TextInput
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={formData.confirmPassword || ""}
                onChange={(val) => {
                  onUpdate({ confirmPassword: val });
                  onClearError("confirmPassword");
                }}
                hasError={!!validationErrors.confirmPassword}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded transition-colors"
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Password Match Check */}
            <div className="mt-3 p-3 bg-gradient-to-br from-gray-50 to-green-50 rounded-lg border border-gray-200">
              <Checklist
                items={[
                  {
                    ok:
                      formData.confirmPassword === formData.password &&
                      (formData.password?.length ?? 0) > 0,
                    text: "Passwords match",
                  },
                ]}
              />
            </div>
          </FormField>
        </section>

        {/* Submit Button */}
        <div className="pt-6">
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full font-semibold px-8 py-4 rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
              canSubmit
                ? "bg-[#0A2342] text-white hover:bg-[#132c54] hover:shadow-lg transform hover:scale-[1.02]"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
            aria-label="Continue to email verification"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
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
                Sending Verification Code...
              </span>
            ) : (
              "Send Verification Code"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Step3EmailPassword;
