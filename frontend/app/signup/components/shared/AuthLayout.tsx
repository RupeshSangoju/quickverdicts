"use client";

import React, { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

/* ===========================================================
   TYPES
   =========================================================== */

interface AuthLayoutProps {
  children: React.ReactNode;
  userType: "attorney" | "juror";
  step: number;
  totalSteps?: number;
  sidebarContent: {
    title: string;
    description: string;
  };
  onBack: () => void;
  showSignup?: boolean;
  canGoBack?: boolean;
}

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: readonly string[];  // ✅ FIXED: Changed to readonly
  userType: "attorney" | "juror";
}

/* ===========================================================
   CONSTANTS
   =========================================================== */

const ATTORNEY_STEPS = [
  "Personal Info",
  "Address",
  "Email & Password",
  "Agreement",
  "Success",
] as const;

const JUROR_STEPS = [
  "Eligibility",
  "Personal Info",
  "Email & Password",
  "Agreement",
  "Success",
] as const;

const COLORS = {
  attorney: "#16305B",
  juror: "#0A2342",
} as const;

/* ===========================================================
   PROGRESS INDICATOR COMPONENT
   =========================================================== */

function ProgressIndicator({
  currentStep,
  totalSteps,
  stepLabels,
  userType,
}: ProgressIndicatorProps) {
  const accentColor = COLORS[userType];

  return (
    <div
      className="w-full mb-8"
      role="navigation"
      aria-label="Registration progress"
    >
      {/* Mobile Progress Bar */}
      <div className="lg:hidden mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-xs text-gray-500">
            {stepLabels[currentStep - 1]}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${(currentStep / totalSteps) * 100}%`,
              backgroundColor: accentColor,
            }}
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Step ${currentStep} of ${totalSteps}: ${
              stepLabels[currentStep - 1]
            }`}
          />
        </div>
      </div>

      {/* Desktop Step Indicators */}
      <div className="hidden lg:flex items-center justify-between">
        {stepLabels.map((label, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <React.Fragment key={stepNumber}>
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "text-white ring-4 ring-opacity-20"
                      : "bg-gray-200 text-gray-500"
                  }`}
                  style={
                    isCurrent ? { backgroundColor: accentColor } : undefined
                  }
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${
                    isCompleted ? "Completed: " : isCurrent ? "Current: " : ""
                  }${label}`}
                >
                  {isCompleted ? (
                    <Check size={20} aria-hidden="true" />
                  ) : (
                    <span>{stepNumber}</span>
                  )}
                </div>
                <span
                  className={`text-xs mt-2 text-center max-w-[80px] ${
                    isCurrent
                      ? "font-semibold text-gray-900"
                      : "text-gray-600"
                  }`}
                >
                  {label}
                </span>
              </div>

              {/* Connector Line */}
              {index < stepLabels.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 transition-all duration-300 ${
                    stepNumber < currentStep ? "bg-green-500" : "bg-gray-200"
                  }`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

export function AuthLayout({
  children,
  userType,
  step,
  totalSteps = 5,
  sidebarContent,
  onBack,
  showSignup = true,
  canGoBack = true,
}: AuthLayoutProps) {
  const bgColor = COLORS[userType];
  const stepLabels = userType === "attorney" ? ATTORNEY_STEPS : JUROR_STEPS;
  const [logoError, setLogoError] = useState(false);

  /* ===========================================================
     EVENT HANDLERS
     =========================================================== */

  const handleBack = useCallback(() => {
    // Always allow back navigation, let parent decide what to do
    if (!canGoBack) {
      return;
    }

    // Track back navigation
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "back_clicked", {
        form_type: `${userType}_signup`,
        from_step: step,
      });
    }

    onBack();
  }, [onBack, userType, step, canGoBack]);

  const handleLoginClick = useCallback(() => {
    // Track login link click
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "login_link_clicked", {
        form_type: `${userType}_signup`,
        from_step: step,
      });
    }
  }, [userType, step]);

  /* ===========================================================
     RENDER
     =========================================================== */

  return (
    <div className="min-h-screen flex bg-[#faf8f3] font-sans">
      {/* Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-[280px]"
        role="complementary"
        aria-label="Registration information"
      >
        <div
          className="flex-1 text-white relative overflow-hidden"
          style={{ backgroundColor: bgColor }}
        >
          {/* Decorative Pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage:
                "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
            aria-hidden="true"
          />

          {/* Logo */}
          <div className="relative pt-8 px-6">
            <Link
              href="/"
              className="block focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 rounded"
              style={{ "--tw-ring-offset-color": bgColor } as React.CSSProperties}
            >
              <div className="relative w-full h-20">
                {!logoError ? (
                  <Image
                    src="/logo_sidebar_signup.png"
                    alt="Quick Verdicts - Virtual Courtroom Platform"
                    width={280}
                    height={80}
                    className="object-contain"
                    priority
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="w-full h-20 flex items-center justify-center text-white text-lg font-semibold">
                    QuickVerdicts
                  </div>
                )}
              </div>
            </Link>
          </div>

          {/* Content */}
          <div className="px-6 py-8 mt-12 relative z-10">
            <h2 className="text-2xl font-bold mb-4">
              {sidebarContent.title}
            </h2>
            <div className="text-sm leading-relaxed text-blue-100 space-y-3">
              <p>{sidebarContent.description}</p>
            </div>

            {/* User Type Badge */}
            <div className="mt-8 inline-block">
              <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wide">
                {userType === "attorney" ? "⚖️ Attorney" : "👥 Juror"}{" "}
                Registration
              </div>
            </div>
          </div>

          {/* Decorative Bottom Wave */}
          <div
            className="absolute bottom-0 left-0 right-0 h-32 opacity-10"
            style={{
              background:
                "linear-gradient(to top, rgba(255,255,255,0.2) 0%, transparent 100%)",
            }}
            aria-hidden="true"
          />
        </div>
      </aside>

      {/* Main Content */}
      <main
        className="flex-1 flex flex-col min-h-screen bg-[#faf8f3]"
        role="main"
      >
        {/* Top Navigation Bar */}
        <nav
          className="w-full bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40"
          aria-label="Registration navigation"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              {/* Back Button */}
              <button
                onClick={handleBack}
                disabled={!canGoBack}
                className={`flex items-center gap-2 text-sm font-medium transition-colors rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
                  !canGoBack
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-[#16305B] hover:bg-gray-100"
                }`}
                type="button"
                aria-label="Go back to previous step"
                aria-disabled={!canGoBack}
              >
                <ArrowLeft size={18} aria-hidden="true" />
                <span className="hidden sm:inline">Back</span>
              </button>

              {/* Mobile Logo */}
              <div className="lg:hidden">
                <Link
                  href="/"
                  className="text-xl font-bold"
                  style={{ color: bgColor }}
                >
                  QuickVerdicts
                </Link>
              </div>

              {/* Login Link */}
              {showSignup && (
                <div className="flex items-center gap-3">
                  <span className="text-gray-600 text-sm hidden sm:inline">
                    Already have an account?
                  </span>
                  <Link
                    href={`/login/${userType}`}
                    onClick={handleLoginClick}
                    className="border-2 text-sm font-medium rounded-lg px-4 py-2 transition-all hover:bg-opacity-10 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      borderColor: bgColor,
                      color: bgColor,
                    }}
                  >
                    Log In
                  </Link>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Progress Indicator */}
        <div className="w-full bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <ProgressIndicator
              currentStep={step}
              totalSteps={totalSteps}
              stepLabels={stepLabels}
              userType={userType}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 w-full overflow-y-auto">{children}</div>

        {/* Footer */}
        <footer
          className="w-full bg-white border-t border-gray-200 py-4 mt-auto"
          role="contentinfo"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
              <p>© 2025 QuickVerdicts. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <Link
                  href="/privacy"
                  className="hover:text-gray-700 hover:underline focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded transition-colors"
                >
                  Privacy Policy
                </Link>
                <span aria-hidden="true">•</span>
                <Link
                  href="/terms"
                  className="hover:text-gray-700 hover:underline focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded transition-colors"
                >
                  Terms of Service
                </Link>
                <span aria-hidden="true">•</span>
                <Link
                  href="/contact"
                  className="hover:text-gray-700 hover:underline focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded transition-colors"
                >
                  Contact
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default AuthLayout;
