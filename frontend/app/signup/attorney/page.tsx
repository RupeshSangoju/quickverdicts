"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSignupForm } from "@/hooks/useSignupForm";
import type {
  AttorneyFormData,
  LocationOption,
} from "@/types/signup.types";
import { validateWithSchema } from "@/lib/validation/validators";
import {
  attorneyStep1Schema,
  attorneyStep2Schema,
  attorneyStep3Schema,
  attorneyStep4Schema,
} from "@/lib/validation/schemas";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { post, login } from "@/lib/apiClient";

// ✅ FIXED: Named imports instead of default
import { AuthLayout } from "../components/shared/AuthLayout";
import { Step1PersonalDetails } from "../components/attorney/Step1PersonalDetails";
import { Step2AddressDetails } from "../components/attorney/Step2AddressDetails";
import { Step3EmailPassword } from "../components/attorney/Step3EmailPassword";
import { Step4Agreement } from "../components/attorney/Step4Agreement";
import { Step5Success } from "../components/attorney/Step5Success";

/* ===========================================================
   CONSTANTS
   =========================================================== */

const CENSUS_API_BASE = "https://api.census.gov/data/2020/dec/pl";

const US_STATES: LocationOption[] = [
  { label: "Alabama", value: "01" },
  { label: "Alaska", value: "02" },
  { label: "Arizona", value: "04" },
  { label: "Arkansas", value: "05" },
  { label: "California", value: "06" },
  { label: "Colorado", value: "08" },
  { label: "Connecticut", value: "09" },
  { label: "Delaware", value: "10" },
  { label: "Florida", value: "12" },
  { label: "Georgia", value: "13" },
  { label: "Hawaii", value: "15" },
  { label: "Idaho", value: "16" },
  { label: "Illinois", value: "17" },
  { label: "Indiana", value: "18" },
  { label: "Iowa", value: "19" },
  { label: "Kansas", value: "20" },
  { label: "Kentucky", value: "21" },
  { label: "Louisiana", value: "22" },
  { label: "Maine", value: "23" },
  { label: "Maryland", value: "24" },
  { label: "Massachusetts", value: "25" },
  { label: "Michigan", value: "26" },
  { label: "Minnesota", value: "27" },
  { label: "Mississippi", value: "28" },
  { label: "Missouri", value: "29" },
  { label: "Montana", value: "30" },
  { label: "Nebraska", value: "31" },
  { label: "Nevada", value: "32" },
  { label: "New Hampshire", value: "33" },
  { label: "New Jersey", value: "34" },
  { label: "New Mexico", value: "35" },
  { label: "New York", value: "36" },
  { label: "North Carolina", value: "37" },
  { label: "North Dakota", value: "38" },
  { label: "Ohio", value: "39" },
  { label: "Oklahoma", value: "40" },
  { label: "Oregon", value: "41" },
  { label: "Pennsylvania", value: "42" },
  { label: "Rhode Island", value: "44" },
  { label: "South Carolina", value: "45" },
  { label: "South Dakota", value: "46" },
  { label: "Tennessee", value: "47" },
  { label: "Texas", value: "48" },
  { label: "Utah", value: "49" },
  { label: "Vermont", value: "50" },
  { label: "Virginia", value: "51" },
  { label: "Washington", value: "53" },
  { label: "West Virginia", value: "54" },
  { label: "Wisconsin", value: "55" },
  { label: "Wyoming", value: "56" },
];

/* ===========================================================
   TOAST COMPONENT
   =========================================================== */

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  const bgColor =
    type === "error"
      ? "bg-red-500"
      : type === "success"
      ? "bg-green-500"
      : "bg-blue-500";

  const icon = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-slideIn">
      <div
        className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]`}
        role="alert"
      >
        <span className="text-xl" aria-hidden="true">
          {icon}
        </span>
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
          aria-label="Close notification"
        >
          ✖
        </button>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

function AttorneySignupInner() {
  const router = useRouter();
  const { state, actions } = useSignupForm("attorney");
  const formData = state.formData as AttorneyFormData;

  // UI State
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "info" as "success" | "error" | "info",
  });
  const [availableCounties, setAvailableCounties] = useState<LocationOption[]>(
    []
  );
  const [availableCities, setAvailableCities] = useState<LocationOption[]>([]);
  const [countiesLoading, setCountiesLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);

  /* ===========================================================
     TOAST HELPER
     =========================================================== */

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      setToast({ show: true, message, type });
      setTimeout(() => setToast((p) => ({ ...p, show: false })), 4000);
    },
    []
  );

  /* ===========================================================
     SAFE JSON PARSER
     =========================================================== */

  const safeJsonParse = async (res: Response) => {
    try {
      const text = await res.text();
      return JSON.parse(text);
    } catch (error) {
      console.error("Invalid JSON from Census API:", error);
      showToast("Invalid response from location service", "error");
      return null;
    }
  };

  /* ===========================================================
     FETCH COUNTIES
     =========================================================== */

  useEffect(() => {
    if (!formData.state) {
      setAvailableCounties([]);
      return;
    }

    const selectedState = US_STATES.find(
      (s) =>
        s.label.toLowerCase() === formData.state.toLowerCase() ||
        s.value === formData.state
    );

    if (!selectedState) {
      setAvailableCounties([]);
      return;
    }

    const fetchCounties = async () => {
      setCountiesLoading(true);
      try {
        const res = await fetch(
          `${CENSUS_API_BASE}?get=NAME&for=county:*&in=state:${selectedState.value}`
        );

        const data = await safeJsonParse(res);
        if (!Array.isArray(data) || data.length < 2) {
          throw new Error("Invalid county data");
        }

        const counties = data
          .slice(1)
          .map((r: [string, string, string], idx: number) => ({
            label: r[0].replace(` County, ${selectedState.label}`, "").trim(),
            value: `${selectedState.value}-${r[2] || idx}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));

        setAvailableCounties(counties);
      } catch (err) {
        console.error("County fetch failed:", err);
        setAvailableCounties([]);
        showToast("Failed to load counties", "error");
      } finally {
        setCountiesLoading(false);
      }
    };

    fetchCounties();
  }, [formData.state, showToast]);

  /* ===========================================================
     FETCH CITIES
     =========================================================== */

  useEffect(() => {
    if (!formData.state) {
      setAvailableCities([]);
      return;
    }

    const selectedState = US_STATES.find(
      (s) =>
        s.label.toLowerCase() === formData.state.toLowerCase() ||
        s.value === formData.state
    );

    if (!selectedState) {
      setAvailableCities([]);
      return;
    }

    const fetchCities = async () => {
      setCitiesLoading(true);
      try {
        const res = await fetch(
          `${CENSUS_API_BASE}?get=NAME&for=place:*&in=state:${selectedState.value}`
        );

        const data = await safeJsonParse(res);
        if (!Array.isArray(data) || data.length < 2) {
          throw new Error("Invalid city data");
        }

        const cities = data
          .slice(1)
          .map((r: [string, string, string], idx: number) => ({
            label: r[0].trim(),
            value: `${selectedState.value}-${r[2] || idx}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));

        setAvailableCities(cities);
      } catch (err) {
        console.error("City fetch failed:", err);
        setAvailableCities([]);
        showToast("Failed to load cities", "error");
      } finally {
        setCitiesLoading(false);
      }
    };

    fetchCities();
  }, [formData.state, showToast]);

  /* ===========================================================
     STEP NAVIGATION
     =========================================================== */

  const handleNext = async () => {
    actions.setError(null);
    actions.setValidationErrors({});
    let validation;

    switch (state.step) {
      /* ===== STEP 1: Personal Details ===== */
      case 1:
        validation = validateWithSchema(attorneyStep1Schema, formData);
        if (!validation.isValid) {
          actions.setValidationErrors(validation.errors);
          return;
        }
        actions.setStep(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;

      /* ===== STEP 2: Address Details ===== */
      case 2:
        validation = validateWithSchema(attorneyStep2Schema, formData);
        if (!validation.isValid) {
          actions.setValidationErrors(validation.errors);
          return;
        }
        actions.setStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;

      /* ===== STEP 3: Email & Password ===== */
      case 3:
        // Sub-step 1: Send OTP
        if (state.authSubStep === 1) {
          validation = validateWithSchema(attorneyStep3Schema, formData);
          if (!validation.isValid) {
            actions.setValidationErrors(validation.errors);
            return;
          }

          try {
            actions.setLoading(true);
            const response = await post("/api/auth/attorney/send-otp", {
              email: formData.email,
            });

            if (response.success) {
              showToast("Verification code sent to your email!", "success");
              actions.setAuthSubStep(2);
            } else {
              showToast(response.message || "Failed to send code", "error");
            }
          } catch (error: any) {
            showToast(error.message || "Failed to send OTP", "error");
          } finally {
            actions.setLoading(false);
          }
          return;
        }

        // Sub-step 2: Verify OTP
        if (state.authSubStep === 2) {
          if (!formData.otp || formData.otp.length !== 6) {
            actions.setValidationErrors({
              otp: "Please enter a valid 6-digit code",
            });
            return;
          }

          try {
            actions.setLoading(true);
            const response = await post("/api/auth/attorney/verify-otp", {
              email: formData.email,
              otp: formData.otp,
            });

            if (response.success) {
              actions.updateFormData({ emailVerified: true });
              showToast("Email verified successfully!", "success");
              actions.setStep(4);
              actions.setAuthSubStep(1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              showToast(
                response.message || "Invalid verification code",
                "error"
              );
            }
          } catch (error: any) {
            showToast(error.message || "Verification failed", "error");
          } finally {
            actions.setLoading(false);
          }
        }
        return;

      /* ===== STEP 4: Agreement & Final Submission ===== */
      case 4:
        console.log("🔥 Step 4 submission triggered");
        console.log("formData.agreedToTerms:", formData.agreedToTerms);

        // Simple check - Step4Agreement already handles UI validation
        if (!formData.agreedToTerms) {
          showToast("Please accept the terms to continue", "error");
          actions.setValidationErrors({
            agreedToTerms: "You must accept the terms to create an account",
          });
          return;
        }

        try {
          actions.setLoading(true);

          if (!formData.emailVerified) {
            showToast("Please verify your email first", "error");
            actions.setStep(3);
            return;
          }

          console.log("📤 Submitting attorney signup...");

          // Submit signup
          const response = await post("/api/auth/attorney/signup", {
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: formData.lastName,
            lawFirmName: formData.lawFirmName,
            stateBarNumber: formData.stateBarNumber,
            state: formData.state,
            county: formData.county,
            city: formData.city,
            officeAddress1: formData.officeAddress1,
            officeAddress2: formData.officeAddress2,
            zipCode: formData.zipCode,
            email: formData.email,
            password: formData.password,
            phoneNumber: formData.phoneNumber,
            agreedToTerms: formData.agreedToTerms,
          });

          console.log("📥 Signup response:", response);

          if (response.success && response.token && response.user) {
            // Store auth data
            login(response.token, response.user);

            // Update form data
            actions.updateFormData({
              attorneyId: response.user.id.toString(),
            });

            // Move to success step
            actions.setStep(5);
            showToast("Account created successfully!", "success");
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            console.error("❌ Signup failed:", response);
            showToast(response.message || "Signup failed", "error");
          }
        } catch (error: any) {
          console.error("❌ Signup error:", error);
          showToast(
            error.message || "Signup failed. Please try again.",
            "error"
          );
        } finally {
          actions.setLoading(false);
        }
        return;
    }
  };
  
  const handleBack = useCallback(() => {
    // If on OTP verification, go back to email/password entry
    if (state.step === 3 && state.authSubStep === 2) {
      actions.setAuthSubStep(1);
      actions.updateFormData({ otp: "" });
      return;
    }

    // If on first step, go back to signup selector
    if (state.step === 1) {
      router.push("/signup");
      return;
    }

    // Otherwise go to previous step
    actions.setStep(Math.max(1, state.step - 1) as any);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.step, state.authSubStep, router, actions]);

  /* ===========================================================
     RENDER
     =========================================================== */

  return (
    <AuthLayout
      userType="attorney"
      step={state.step}
      sidebarContent={{
        title: "Attorney Registration",
        description:
          "Join Quick Verdicts to resolve small claims cases faster with virtual trials and real jurors.",
      }}
      onBack={handleBack}
    >
      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}

      {/* Step 1: Personal Details */}
      {state.step === 1 && (
        <Step1PersonalDetails
          formData={formData}
          onNext={handleNext}
          validationErrors={state.validationErrors}
          onClearError={actions.clearFieldError}
          onUpdate={actions.updateFormData}
          availableStates={US_STATES}
        />
      )}

      {/* Step 2: Address Details */}
      {state.step === 2 && (
        <Step2AddressDetails
          formData={formData}
          onNext={handleNext}
          validationErrors={state.validationErrors}
          availableCities={availableCities}
          availableCounties={availableCounties}
          countiesLoading={countiesLoading}
          citiesLoading={citiesLoading}
          onUpdate={actions.updateFormData}
          onClearError={actions.clearFieldError}
        />
      )}

      {/* Step 3: Email & Password */}
      {state.step === 3 && (
        <Step3EmailPassword
          formData={formData}
          onNext={handleNext}
          onUpdate={actions.updateFormData}
          validationErrors={state.validationErrors}
          authSubStep={state.authSubStep}
          onClearError={actions.clearFieldError}
          loading={state.loading}
        />
      )}

      {/* Step 4: Agreement */}
      {state.step === 4 && (
        <Step4Agreement
          formData={formData}
          onSubmit={handleNext}
          onUpdate={actions.updateFormData}
          validationErrors={state.validationErrors}
          hasScrolledToBottom={state.hasScrolledToBottom}
          onScrolledToBottom={actions.setScrolledToBottom}
          loading={state.loading}
          onClearError={actions.clearFieldError}
        />
      )}

      {/* Step 5: Success */}
      {state.step === 5 && (
        <Step5Success
          email={formData.email}
          accountId={formData.attorneyId}
          firstName={formData.firstName}
        />
      )}
    </AuthLayout>
  );
}

/* ===========================================================
   LOADING FALLBACK
   =========================================================== */

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#f9f7f2] flex flex-col items-center justify-center">
      <Image
        src="/logo_sidebar_signup.png"
        alt="Quick Verdicts Logo"
        width={200}
        height={80}
        priority
      />
      <div className="mt-6 w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-[#0A2342] w-1/3 animate-pulse" />
      </div>
      <p className="text-[#455A7C] mt-4 animate-pulse">
        Loading signup form...
      </p>
    </div>
  );
}

/* ===========================================================
   EXPORT WRAPPER
   =========================================================== */

export default function AttorneySignup() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <AttorneySignupInner />
      </Suspense>
    </ErrorBoundary>
  );
}
