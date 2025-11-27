"use client";

import React, { useCallback } from "react";
import { Check } from "lucide-react";

/* ===========================================================
   TYPES
   =========================================================== */

interface Step {
  label: string;
  completed: boolean;
  active: boolean;
  clickable: boolean;
}

interface StepperNavProps {
  steps: string[];
  currentStep: number;
  className?: string;
  userType?: "attorney" | "juror";
  onStepClick?: (step: number) => void;
  allowBackNavigation?: boolean;
}

/* ===========================================================
   CONSTANTS
   =========================================================== */

const COLORS = {
  attorney: "#16305B",
  juror: "#0A2342",
} as const;

const INACTIVE_COLOR = "#bfc6d1";

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

export function StepperNav({
  steps,
  currentStep,
  className = "",
  userType = "attorney",
  onStepClick,
  allowBackNavigation = false,
}: StepperNavProps) {
  const primaryColor = COLORS[userType];

  /* ===========================================================
     PROCESS STEPS
     =========================================================== */

  const processedSteps: Step[] = steps.map((label, index) => {
    const stepNumber = index + 1;
    const completed = currentStep > stepNumber;
    const active = currentStep === stepNumber;
    const clickable = allowBackNavigation && completed && !!onStepClick;

    return { label, completed, active, clickable };
  });

  const progressPercentage =
    steps.length > 1 ? ((currentStep - 1) / (steps.length - 1)) * 100 : 100;

  /* ===========================================================
     EVENT HANDLERS
     =========================================================== */

  const handleStepClick = useCallback(
    (index: number) => {
      const stepNumber = index + 1;

      // Only allow clicking on completed steps when back navigation is enabled
      if (allowBackNavigation && stepNumber < currentStep && onStepClick) {
        onStepClick(stepNumber);

        // Track step navigation
        if (typeof window !== "undefined" && (window as any).gtag) {
          (window as any).gtag("event", "stepper_navigation", {
            from_step: currentStep,
            to_step: stepNumber,
            user_type: userType,
          });
        }
      }
    },
    [allowBackNavigation, currentStep, onStepClick, userType]
  );

  /* ===========================================================
     RENDER
     =========================================================== */

  return (
    <div
      className={`w-full ${className}`}
      style={
        {
          "--color-primary": primaryColor,
          "--color-inactive": INACTIVE_COLOR,
        } as React.CSSProperties
      }
    >
      {/* Mobile Progress Bar */}
      <div className="lg:hidden px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-sm font-semibold"
            style={{ color: primaryColor }}
          >
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-xs text-gray-500">
            {steps[currentStep - 1]}
          </span>
        </div>

        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full transition-all duration-500 ease-out rounded-full"
            style={{
              width: `${progressPercentage}%`,
              backgroundColor: primaryColor,
            }}
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuetext={`Step ${currentStep} of ${steps.length}: ${
              steps[currentStep - 1]
            }`}
          />
        </div>

        <div className="text-right mt-1">
          <span className="text-xs text-gray-500">
            {Math.round(progressPercentage)}% complete
          </span>
        </div>
      </div>

      {/* Desktop Stepper */}
      <nav
        className="hidden lg:block w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
        aria-label="Registration progress steps"
      >
        <ol className="flex items-center justify-between py-6" role="list">
          {processedSteps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const stepNumber = idx + 1;

            return (
              <li
                key={`${step.label}-${idx}`}
                className="flex items-center flex-1 group"
                role="listitem"
              >
                {/* Step Circle and Label */}
                <button
                  type="button"
                  onClick={() => handleStepClick(idx)}
                  disabled={!step.clickable}
                  className={`flex items-center gap-3 focus:outline-none focus:ring-2 rounded-lg px-2 py-1 transition-all ${
                    step.clickable
                      ? "cursor-pointer hover:bg-gray-50"
                      : "cursor-default"
                  }`}
                  style={
                    {
                      "--tw-ring-color": "var(--color-primary)",
                    } as React.CSSProperties
                  }
                  aria-current={step.active ? "step" : undefined}
                  aria-label={`${
                    step.completed
                      ? "Completed: "
                      : step.active
                      ? "Current: "
                      : ""
                  }Step ${stepNumber}: ${step.label}`}
                  tabIndex={step.clickable ? 0 : -1}
                >
                  {/* Step Circle */}
                  <div
                    className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                      step.active
                        ? "scale-110 shadow-md"
                        : step.clickable
                        ? "group-hover:scale-105"
                        : ""
                    }`}
                    style={{
                      borderColor:
                        step.active || step.completed
                          ? "var(--color-primary)"
                          : "var(--color-inactive)",
                      backgroundColor: step.completed
                        ? "var(--color-primary)"
                        : "transparent",
                    }}
                  >
                    {step.completed ? (
                      <Check
                        size={20}
                        className="text-white animate-scaleIn"
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className={`font-semibold transition-all duration-300 ${
                          step.active ? "text-base" : "text-sm"
                        }`}
                        style={{
                          color: step.active
                            ? "var(--color-primary)"
                            : "var(--color-inactive)",
                        }}
                      >
                        {stepNumber}
                      </span>
                    )}

                    {/* Active Step Pulse Animation */}
                    {step.active && (
                      <div
                        className="absolute inset-0 rounded-full animate-pulse"
                        style={{
                          border: "2px solid var(--color-primary)",
                          opacity: 0.3,
                          transform: "scale(1.3)",
                        }}
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-sm leading-tight max-w-[100px] transition-colors duration-300 ${
                      step.active
                        ? "font-bold"
                        : step.completed
                        ? "font-medium"
                        : "font-normal"
                    }`}
                    style={{
                      color:
                        step.active || step.completed
                          ? "var(--color-primary)"
                          : "var(--color-inactive)",
                    }}
                  >
                    {step.label}
                  </span>
                </button>

                {/* Connector Line */}
                {!isLast && (
                  <div className="flex-1 px-4 relative" aria-hidden="true">
                    {/* Background Line */}
                    <div
                      className="h-0.5 w-full rounded-full"
                      style={{ backgroundColor: "var(--color-inactive)" }}
                    />
                    {/* Progress Line */}
                    <div
                      className="absolute top-0 left-4 h-0.5 rounded-full transition-all duration-500 ease-out"
                      style={{
                        backgroundColor: "var(--color-primary)",
                        width: step.completed
                          ? "calc(100% - 2rem)"
                          : step.active
                          ? "50%"
                          : "0%",
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {/* Hint Text */}
        {allowBackNavigation && processedSteps.some((s) => s.clickable) && (
          <div
            className="text-center text-xs text-gray-500 mt-2"
            role="status"
            aria-live="polite"
          >
            💡 Click on completed steps to go back
          </div>
        )}
      </nav>

      {/* Add animation keyframes */}
      <style jsx>{`
        @keyframes scaleIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default StepperNav;
