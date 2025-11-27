"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSignupForm } from "@/hooks/useSignupForm";
import type { JurorFormData, LocationOption } from "@/types/signup.types";
import { validateWithSchema } from "@/lib/validation/validators";
import {
  jurorStep1Schema,
  jurorStep2SubStep2Schema,
  jurorStep3Schema,
  jurorStep4Schema,
} from "@/lib/validation/schemas";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { post, login } from "@/lib/apiClient";

import { AuthLayout } from "../components/shared/AuthLayout";
import { Step1CriteriaVerification } from "../components/juror/Step1CriteriaVerification";
import { Step2PersonalDetails } from "../components/juror/Step2PersonalDetails";
import { Step3EmailPassword } from "../components/juror/Step3EmailPassword";
import { Step4Agreement } from "../components/juror/Step4Agreement";
import { Step5Success } from "../components/juror/Step5Success";

/* ===========================================================
   CONSTANTS
   =========================================================== */

const CENSUS_API_BASE = "https://api.census.gov/data/2020/dec/pl";
const IMAGES_TO_PRELOAD = ["/logo_sidebar_signup.png", "/Image1.png"];

/* ===========================================================
   TYPES
   =========================================================== */

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}

interface ToastState {
  show: boolean;
  message: string;
  type: "success" | "error" | "info";
}

interface LoadingState {
  isLoading: boolean;
  loadedCount: number;
  totalCount: number;
  hasError: boolean;
}

/* ===========================================================
   TOAST COMPONENT
   =========================================================== */

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

function JurorSignupInner() {
  const router = useRouter();
  const { state, actions } = useSignupForm("juror");
  const formData = state.formData as JurorFormData;

  // UI State
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "info",
  });
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    loadedCount: 0,
    totalCount: IMAGES_TO_PRELOAD.length,
    hasError: false,
  });

  // Location State
  const [availableStates, setAvailableStates] = useState<LocationOption[]>([]);
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
      setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 5000);
    },
    []
  );

  /* ===========================================================
     IMAGE PRELOADING
     =========================================================== */

  useEffect(() => {
    let mounted = true;
    let loaded = 0;

    const loadImage = (src: string): Promise<void> =>
      new Promise((resolve) => {
        const img = new window.Image();
        img.src = src;
        img.onload = img.onerror = () => {
          if (mounted) {
            loaded++;
            setLoadingState((prev) => ({ ...prev, loadedCount: loaded }));
          }
          resolve();
        };
      });

    Promise.all(IMAGES_TO_PRELOAD.map(loadImage)).then(() => {
      if (mounted) {
        setTimeout(
          () => setLoadingState((prev) => ({ ...prev, isLoading: false })),
          300
        );
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  /* ===========================================================
     FETCH STATES
     =========================================================== */

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const res = await fetch(`${CENSUS_API_BASE}?get=NAME&for=state:*`);
        const data = await res.json();

        const sorted = data
          .slice(1)
          .map((r: [string, string]) => ({ label: r[0], value: r[1] }))
          .sort((a: LocationOption, b: LocationOption) =>
            a.label.localeCompare(b.label)
          );

        setAvailableStates(sorted);
      } catch (err) {
        console.error("State fetch failed:", err);
        showToast("Failed to load states", "error");
      }
    };

    fetchStates();
  }, [showToast]);

  /* ===========================================================
     FETCH COUNTIES
     =========================================================== */

  useEffect(() => {
    if (!formData.personalDetails2?.state) {
      setAvailableCounties([]);
      return;
    }

    const selectedState = availableStates.find(
      (s) =>
        s.label.toLowerCase() ===
          formData.personalDetails2.state.toLowerCase() ||
        s.value === formData.personalDetails2.state
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
        const data = await res.json();

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
  }, [formData.personalDetails2?.state, availableStates, showToast]);

  /* ===========================================================
     FETCH CITIES
     =========================================================== */

  useEffect(() => {
    if (!formData.personalDetails2?.state) {
      setAvailableCities([]);
      return;
    }

    const selectedState = availableStates.find(
      (s) =>
        s.label.toLowerCase() ===
          formData.personalDetails2.state.toLowerCase() ||
        s.value === formData.personalDetails2.state
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
        const data = await res.json();

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
  }, [formData.personalDetails2?.state, availableStates, showToast]);

  /* ===========================================================
     STEP NAVIGATION
     =========================================================== */

  const handleNext = async () => {
    actions.setError(null);
    actions.setValidationErrors({});
    let validation;

    switch (state.step) {
      /* ===== STEP 1: Criteria Verification ===== */
      case 1:
        validation = validateWithSchema(jurorStep1Schema, {
          criteriaAnswers: formData.criteriaAnswers,
        });
        if (!validation.isValid) {
          actions.setValidationErrors(validation.errors);
          return;
        }
        actions.setStep(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;

      /* ===== STEP 2: Personal Details (Sub-steps) ===== */
      case 2:
        if (state.personalSubStep === 1) {
          // Move to sub-step 2
          actions.setPersonalSubStep(2);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        } else {
          // Validate sub-step 2 and move to step 3
          validation = validateWithSchema(
            jurorStep2SubStep2Schema,
            formData
          );
          if (!validation.isValid) {
            actions.setValidationErrors(validation.errors);
            return;
          }
          actions.setStep(3);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;

      /* ===== STEP 3: Email & Password ===== */
      case 3:
      // Sub-step 1: Send OTP
      if (state.authSubStep === 1) {
        validation = validateWithSchema(jurorStep3Schema, formData);
        if (!validation.isValid) {
          actions.setValidationErrors(validation.errors);
          return;
        }

        try {
          actions.setLoading(true);
          console.log("📤 Sending OTP to:", formData.email);

          const response = await post("/auth/juror/send-otp", {
            email: formData.email,
          });

          console.log("📥 OTP Send Response:", response);

          if (response.success) {
            showToast("Verification code sent to your email!", "success");
            actions.setAuthSubStep(2);
          } else {
            showToast(response.message || "Failed to send code", "error");
          }
        } catch (error: any) {
          console.error("❌ Send OTP Error:", error);
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
            otp: "Please enter the 6-digit code",
          });
          return;
        }

        try {
          actions.setLoading(true);
          console.log("🔐 Verifying OTP:", {
            email: formData.email,
            otp: formData.otp,
            otpLength: formData.otp.length,
          });

          const response = await post("/auth/juror/verify-otp", {
            email: formData.email,
            otp: formData.otp,
          });

          console.log("📥 OTP Verify Response:", response);

          if (response.success) {
            actions.updateFormData({ emailVerified: true });
            showToast("Email verified successfully!", "success");
            actions.setStep(4);
            actions.setAuthSubStep(1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            console.warn("⚠️ OTP Verification Failed:", response);
            showToast(
              response.message || "Invalid verification code",
              "error"
            );
            // Clear OTP on failure
            actions.updateFormData({ otp: "" });
          }
        } catch (error: any) {
          console.error("❌ Verify OTP Error:", error);
          showToast(
            error.message || "Verification failed. Please try again.",
            "error"
          );
          // Clear OTP on error
          actions.updateFormData({ otp: "" });
        } finally {
          actions.setLoading(false);
        }
      }
      return;

      /* ===== STEP 4: Agreement & Signup ===== */
      case 4:
        validation = validateWithSchema(jurorStep4Schema, formData);
        const errors = { ...validation.errors };

        if (!state.hasScrolledToBottom) {
          errors.scroll =
            "Please scroll to the bottom to read the full agreement";
        }

        if (!validation.isValid || !state.hasScrolledToBottom) {
          actions.setValidationErrors(errors);
          return;
        }

        if (!formData.emailVerified) {
          showToast("Email verification required before signup", "error");
          actions.setStep(3);
          return;
        }

        try {
          actions.setLoading(true);

          const payload = {
            criteriaResponses: JSON.stringify(formData.criteriaAnswers),
            name: formData.personalDetails2.name,
            email: formData.email,
            password: formData.password,
            phoneNumber: formData.personalDetails2.phone,
            address1: formData.personalDetails2.address1,
            address2: formData.personalDetails2.address2 || "",
            state: formData.personalDetails2.state,
            city: formData.personalDetails2.city,
            zipCode: formData.personalDetails2.zip,
            county: formData.personalDetails2.county,
            paymentMethod: formData.paymentMethod,
            agreedToTerms: formData.agreedToTerms,
          };

          const response = await post("/auth/juror/signup", payload);

          if (response.success && response.token && response.user) {
            // Store auth data
            login(response.token, response.user);

            // Clear sensitive data
            actions.clearSensitiveData();

            // Move to success step
            actions.setStep(5);
            showToast("Account created successfully!", "success");
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            showToast(response.message || "Signup failed", "error");
          }
        } catch (error: any) {
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

  /* ===========================================================
     BACK NAVIGATION
     =========================================================== */

  const handleBack = useCallback(() => {
    // Personal details sub-step 2 → sub-step 1
    if (state.step === 2 && state.personalSubStep === 2) {
      actions.setPersonalSubStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // OTP verification → Email/password entry
    if (state.step === 3 && state.authSubStep === 2) {
      actions.setAuthSubStep(1);
      actions.updateFormData({ otp: "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // First step → Signup selector
    if (state.step === 1) {
      router.push("/signup");
      return;
    }

    // Otherwise go to previous step
    actions.setStep(Math.max(1, state.step - 1) as any);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.step, state.authSubStep, state.personalSubStep, router, actions]);

  /* ===========================================================
     RESEND OTP
     =========================================================== */

  const handleResendOTP = async () => {
    try {
      actions.setLoading(true);
      const response = await post("/auth/juror/send-otp", {
        email: formData.email,
      });

      if (response.success) {
        showToast("Verification code resent!", "success");
      } else {
        showToast(response.message || "Failed to resend code", "error");
      }
    } catch (error: any) {
      showToast(error.message || "Failed to resend OTP", "error");
    } finally {
      actions.setLoading(false);
    }
  };

  /* ===========================================================
     SIDEBAR CONTENT
     =========================================================== */

  const getSidebarContent = useCallback(() => {
    const titles: Record<number, string> = {
      1: "Criteria Verification",
      2:
        state.personalSubStep === 1
          ? "Demographic Information"
          : "Contact Information",
      3:
        state.authSubStep === 1
          ? "Email & Password Setup"
          : "Email Verification",
      4: "User Agreement",
      5: "Sign Up Complete",
    };

    const descriptions: Record<number, string> = {
      1: "Please answer all questions honestly to determine jury eligibility.",
      2: "Provide accurate demographic and contact information.",
      3: "Create your credentials and verify your email to continue.",
      4: "Please read and agree to the user terms before completing signup.",
      5: "Welcome to QuickVerdicts! Your account has been created successfully.",
    };

    return {
      title: titles[state.step] || titles[1],
      description: descriptions[state.step] || descriptions[1],
    };
  }, [state.step, state.personalSubStep, state.authSubStep]);

  /* ===========================================================
     RENDER - LOADING STATE
     =========================================================== */

  if (loadingState.isLoading) {
    const progress = Math.round(
      (loadingState.loadedCount / loadingState.totalCount) * 100
    );

    return (
      <div className="fixed inset-0 bg-[#f9f7f2] flex flex-col items-center justify-center z-50">
        <Image
          src="/logo_sidebar_signup.png"
          alt="Quick Verdicts Logo"
          width={200}
          height={80}
          priority
        />
        <div className="w-48 h-2 bg-gray-200 rounded-full mt-4 overflow-hidden">
          <div
            className="h-full bg-[#0A2342] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-[#455A7C]">Loading... {progress}%</p>
      </div>
    );
  }

  /* ===========================================================
     RENDER - MAIN FORM
     =========================================================== */

  return (
    <AuthLayout
      userType="juror"
      step={state.step}
      sidebarContent={getSidebarContent()}
      onBack={handleBack}
    >
      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((prev) => ({ ...prev, show: false }))}
        />
      )}

      {/* Step 1: Criteria Verification */}
      {state.step === 1 && (
        <Step1CriteriaVerification
          formData={formData}
          onUpdate={actions.updateFormData}
          validationErrors={state.validationErrors}
          onClearError={actions.clearFieldError}
          onNext={handleNext}
        />
      )}

      {/* Step 2: Personal Details */}
      {state.step === 2 && (
        <Step2PersonalDetails
          formData={formData}
          onUpdate={actions.updateFormData}
          validationErrors={state.validationErrors}
          onClearError={actions.clearFieldError}
          personalSubStep={state.personalSubStep}
          availableStates={availableStates}
          availableCounties={availableCounties}
          availableCities={availableCities}
          countiesLoading={countiesLoading}
          citiesLoading={citiesLoading}
          onNext={handleNext}
        />
      )}

      {/* Step 3: Email & Password */}
      {state.step === 3 && (
        <Step3EmailPassword
          formData={formData}
          onUpdate={actions.updateFormData}
          validationErrors={state.validationErrors}
          onClearError={actions.clearFieldError}
          authSubStep={state.authSubStep}
          onNext={handleNext}
          loading={state.loading}
          onResendOTP={handleResendOTP}
        />
      )}

      {/* Step 4: Agreement */}
      {state.step === 4 && (
        <Step4Agreement
          formData={formData}
          onUpdate={actions.updateFormData}
          validationErrors={state.validationErrors}
          onClearError={actions.clearFieldError}
          hasScrolledToBottom={state.hasScrolledToBottom}
          onScrolledToBottom={actions.setScrolledToBottom}
          onSubmit={handleNext}
          loading={state.loading}
          error={state.error}
        />
      )}

      {/* Step 5: Success */}
      {state.step === 5 && <Step5Success />}
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

export default function JurorSignup() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <JurorSignupInner />
      </Suspense>
    </ErrorBoundary>
  );
}
