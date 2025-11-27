"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { FormField, TextInput } from "@/components/forms/FormField";
import type {
  AttorneyFormData,
  ValidationErrors,
} from "@/types/signup.types";
import { validatePasswordRequirements } from "@/lib/validation/validators";
import {
  Eye,
  EyeOff,
  Mail,
  Shield,
  Check,
  AlertCircle,
} from "lucide-react";

/* ===========================================================
   TYPES
   =========================================================== */

interface Step3EmailPasswordProps {
  formData: AttorneyFormData;
  onUpdate: (data: Partial<AttorneyFormData>) => void;
  validationErrors: ValidationErrors;
  onClearError: (field: keyof AttorneyFormData) => void;
  authSubStep: 1 | 2;
  onNext: () => void;
  loading?: boolean;
  onResendOTP?: () => void;
}

interface ChecklistItem {
  ok: boolean;
  text: string;
}

interface PasswordStrengthInfo {
  label: string;
  color: string;
  bgColor: string;
}

/* ===========================================================
   UTILITY FUNCTIONS
   =========================================================== */

/**
 * Sanitize email input
 */
function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Calculate password strength (0-100)
 */
function calculatePasswordStrength(password: string): number {
  let strength = 0;
  if (password.length >= 8) strength += 20;
  if (password.length >= 12) strength += 10;
  if (/[a-z]/.test(password)) strength += 15;
  if (/[A-Z]/.test(password)) strength += 15;
  if (/\d/.test(password)) strength += 15;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 15;
  if (password.length >= 16) strength += 10;
  return Math.min(strength, 100);
}

/**
 * Get password strength label and colors
 */
function getPasswordStrengthInfo(strength: number): PasswordStrengthInfo {
  if (strength === 0)
    return { label: "", color: "", bgColor: "" };
  if (strength < 40)
    return { label: "Weak", color: "text-red-600", bgColor: "bg-red-500" };
  if (strength < 70)
    return { label: "Fair", color: "text-yellow-600", bgColor: "bg-yellow-500" };
  if (strength < 90)
    return { label: "Good", color: "text-blue-600", bgColor: "bg-blue-500" };
  return { label: "Strong", color: "text-green-600", bgColor: "bg-green-500" };
}

/* ===========================================================
   CHECKLIST COMPONENT
   =========================================================== */

const Checklist = ({ items }: { items: ChecklistItem[] }) => (
  <ul className="text-sm space-y-2 mt-3" role="list">
    {items.map((item, idx) => (
      <li
        key={idx}
        className="flex items-start gap-3"
        role="listitem"
      >
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
        <span
          className={
            item.ok ? "text-green-700 font-medium" : "text-gray-600"
          }
        >
          {item.text}
        </span>
      </li>
    ))}
  </ul>
);

/* ===========================================================
   PASSWORD STRENGTH METER
   =========================================================== */

const PasswordStrengthMeter = ({ password }: { password: string }) => {
  const strength = calculatePasswordStrength(password);
  const info = getPasswordStrengthInfo(strength);

  if (strength === 0) return null;

  return (
    <div className="mt-3" role="status" aria-live="polite">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-gray-600">
          Password Strength:
        </span>
        <span className={`text-xs font-bold ${info.color}`}>
          {info.label}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${info.bgColor}`}
          style={{ width: `${strength}%` }}
          role="progressbar"
          aria-valuenow={strength}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Password strength: ${info.label}`}
        />
      </div>
    </div>
  );
};

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
  // State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Refs
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Validate password
  const passwordValidation = validatePasswordRequirements(
    formData.password || "",
    `${formData.firstName || ""} ${formData.lastName || ""}`.trim()
  );

  /* ===========================================================
     OTP HANDLERS
     =========================================================== */

  const handleOTPChange = useCallback(
    (index: number, value: string) => {
      // Only allow digits
      if (!/^\d*$/.test(value)) return;

      onClearError("otp");

      // Update OTP
      const otpArray = (formData.otp ?? "").padEnd(6, " ").split("");
      otpArray[index] = value;
      const newOTP = otpArray.join("").replace(/ /g, "");
      onUpdate({ otp: newOTP });

      // Auto-focus next input
      if (value && index < 5) {
        otpInputsRef.current[index + 1]?.focus();
      }
    },
    [formData.otp, onUpdate, onClearError]
  );

  const handleOTPPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();

      // Extract digits from pasted text
      const pasted = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);

      onClearError("otp");
      onUpdate({ otp: pasted });

      // Focus appropriate input
      const nextIndex = pasted.length < 6 ? pasted.length : 5;
      setTimeout(() => otpInputsRef.current[nextIndex]?.focus(), 0);
    },
    [onUpdate, onClearError]
  );

  const handleOTPKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      const otpVal = formData.otp ?? "";

      if (e.key === "Backspace") {
        if (!otpVal[index] && index > 0) {
          // Move to previous input if current is empty
          otpInputsRef.current[index - 1]?.focus();
        } else {
          // Clear current input
          const arr = otpVal.split("");
          arr[index] = "";
          onUpdate({ otp: arr.join("") });
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
     EMAIL HANDLER
     =========================================================== */

  const handleEmailChange = useCallback(
    (value: string) => {
      const sanitized = sanitizeEmail(value);
      onUpdate({ email: sanitized });
      onClearError("email");
    },
    [onUpdate, onClearError]
  );

  /* ===========================================================
     RESEND OTP
     =========================================================== */

  const handleResendOTP = useCallback(() => {
    if (onResendOTP && resendCooldown === 0) {
      onUpdate({ otp: "" });
      onClearError("otp");
      onResendOTP();
      setResendCooldown(60);

      // Track resend
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "otp_resend", {
          form_type: "attorney_signup",
        });
      }
    }
  }, [onResendOTP, resendCooldown, onUpdate, onClearError]);

  /* ===========================================================
     EFFECTS
     =========================================================== */

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown((t) => t - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-focus first OTP input
  useEffect(() => {
    if (authSubStep === 2) {
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    }
  }, [authSubStep]);

  /* ===========================================================
     OTP VERIFICATION SCREEN (Sub-step 2)
     =========================================================== */

  if (authSubStep === 2) {
    const otpDigits = (formData.otp ?? "").padEnd(6, " ").split("");
    const hasError = !!validationErrors.otp;
    const isComplete = otpDigits.every((d) => d !== " ");
    const canSubmit = isComplete && !hasError && !loading;

    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Mail className="w-10 h-10 text-white" aria-hidden="true" />
            </div>
          </div>

          {/* Header */}
          <h1 className="text-3xl font-bold text-[#0A2342] mb-3 text-center">
            Verify Your Email
          </h1>
          <p className="text-gray-600 text-center mb-8">
            We sent a 6-digit code to
            <br />
            <span className="font-bold text-[#0A2342] text-lg">
              {formData.email}
            </span>
          </p>

          {/* Form */}
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) onNext();
            }}
            noValidate
          >
            {/* OTP Input */}
            <div className="flex gap-3 justify-center mb-2">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpInputsRef.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit === " " ? "" : digit}
                  onChange={(e) => handleOTPChange(i, e.target.value)}
                  onKeyDown={(e) => handleOTPKeyDown(i, e)}
                  onPaste={handleOTPPaste}
                  className={`w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                    hasError
                      ? "border-red-400 bg-red-50 text-red-600"
                      : "border-gray-300 bg-white text-gray-900"
                  }`}
                  disabled={loading}
                  aria-label={`Digit ${i + 1} of 6`}
                  aria-invalid={hasError}
                />
              ))}
            </div>

            {/* Error Message */}
            {hasError && (
              <p
                className="text-red-500 text-sm text-center mt-3 flex items-center justify-center gap-1"
                role="alert"
              >
                <AlertCircle size={16} aria-hidden="true" />
                {validationErrors.otp}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full px-8 py-4 rounded-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
                !canSubmit
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-[#0A2342] text-white hover:bg-[#132c54] transform hover:scale-[1.02] shadow-md hover:shadow-lg"
              }`}
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>

            {/* Resend Link */}
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendCooldown > 0 || loading}
                className="text-[#0A2342] text-sm font-semibold hover:underline disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend verification code"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  /* ===========================================================
     EMAIL & PASSWORD FORM (Sub-step 1)
     =========================================================== */

  const passwordChecks: ChecklistItem[] = [
    { ok: passwordValidation.hasLen, text: "At least 8 characters long" },
    { ok: passwordValidation.hasNum, text: "Contains at least 1 number" },
    {
      ok: passwordValidation.hasUpper,
      text: "Contains at least 1 uppercase letter",
    },
    {
      ok: passwordValidation.hasSpecial,
      text: "Contains at least 1 special character",
    },
    { ok: passwordValidation.notSameAsName, text: "Not the same as your name" },
    {
      ok: passwordValidation.noTriple,
      text: "No more than 2 consecutive identical characters",
    },
  ];

  const passwordsMatch =
    formData.password === formData.confirmPassword &&
    !!formData.password?.length;

  const canSubmit = passwordValidation.all && passwordsMatch && !loading;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#0A2342] mb-2">
          Create Your Account
        </h1>
        <p className="text-gray-600">
          Set up your login credentials. Your password must meet all security
          requirements.
        </p>
      </header>

      {/* Form */}
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onNext();
        }}
        noValidate
      >
        {/* Email Section */}
        <section className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm">
          <FormField
            label="Email Address"
            required
            validationErrors={validationErrors}
            fieldName="email"
          >
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                size={20}
                aria-hidden="true"
              />
              <TextInput
                type="email"
                placeholder="attorney@lawfirm.com"
                value={formData.email || ""}
                onChange={handleEmailChange}
                hasError={!!validationErrors.email}
                className="pl-10"
                autoComplete="email"
              />
            </div>
          </FormField>
        </section>

        {/* Password Section */}
        <section className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm space-y-6">
          {/* Password */}
          <FormField
            label="Password"
            required
            validationErrors={validationErrors}
            fieldName="password"
          >
            <div className="relative">
              <Shield
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                size={20}
                aria-hidden="true"
              />
              <TextInput
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                value={formData.password || ""}
                onChange={(val) => {
                  onUpdate({ password: val });
                  onClearError("password");
                }}
                hasError={!!validationErrors.password}
                className="pl-10 pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
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
            <PasswordStrengthMeter password={formData.password || ""} />
            <Checklist items={passwordChecks} />
          </FormField>

          {/* Confirm Password */}
          <FormField
            label="Confirm Password"
            required
            validationErrors={validationErrors}
            fieldName="confirmPassword"
          >
            <div className="relative">
              <Shield
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                size={20}
                aria-hidden="true"
              />
              <TextInput
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={formData.confirmPassword || ""}
                onChange={(val) => {
                  onUpdate({ confirmPassword: val });
                  onClearError("confirmPassword");
                }}
                hasError={!!validationErrors.confirmPassword}
                className="pl-10 pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700 transition-colors"
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
            <Checklist
              items={[{ ok: passwordsMatch, text: "Passwords match" }]}
            />
          </FormField>
        </section>

        {/* Submit Button */}
        <div className="pt-6">
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full px-8 py-4 rounded-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
              !canSubmit
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-[#0A2342] text-white hover:bg-[#132c54] hover:shadow-lg transform hover:scale-[1.02] shadow-md"
            }`}
          >
            {loading ? "Sending Code..." : "Continue to Verification"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Step3EmailPassword;
