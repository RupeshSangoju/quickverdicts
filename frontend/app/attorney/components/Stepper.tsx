"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FileText, Users, Scale, MessageSquare, CreditCard, ClipboardCheck, Calendar, Gavel } from "lucide-react";
import React from "react";

type StepperProps = {
  currentStep: number;
  onBack?: () => void;
};

const steps = [
  {
    label: "Case Type",
    path: "/attorney/state/case-type",
    icon: Gavel,
    description: "State or Federal"
  },
  {
    label: "Case Details",
    path: "/attorney/state/case-details",
    icon: FileText,
    description: "Basic information"
  },
  {
    label: "Plaintiff Details",
    path: "/attorney/state/plaintiff-details",
    icon: Users,
    description: "Plaintiff information"
  },
  {
    label: "Defendant Details",
    path: "/attorney/state/defendant-details",
    icon: Scale,
    description: "Defendant information"
  },
  {
    label: "Voir Dire",
    path: "/attorney/state/voir-dire-1",
    icon: MessageSquare,
    description: "Questions"
  },
  {
    label: "Payment",
    path: "/attorney/state/payment-details",
    icon: CreditCard,
    description: "Payment details"
  },
  {
    label: "Review",
    path: "/attorney/state/review-details",
    icon: ClipboardCheck,
    description: "Verify information"
  },
  {
    label: "Schedule",
    path: "/attorney/state/schedule-trail",
    icon: Calendar,
    description: "Set trial date"
  },
];

export default function Stepper({ currentStep, onBack }: StepperProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (currentStep > 0) {
      router.push(steps[currentStep - 1].path);
    } else {
      router.push("/attorney/state/case-type");
    }
  };

  const handleStepClick = (idx: number) => {
    // Only allow clicking on completed steps or current step
    if (idx <= currentStep) {
      router.push(steps[idx].path);
    }
  };

  return (
    <div className="w-full bg-white border-b border-gray-200">
      <div className="w-full px-8 py-6">

        {/* Back Button */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-[#16305B] hover:text-[#1e417a] transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold">Back</span>
          </button>
        </div>

        {/* Progress Bar Background */}
        <div className="mb-2">
          <div className="flex items-center justify-between relative">
            {/* Progress Line - Starts from first step center to last step center */}
            <div
              className="absolute top-[22px] h-1 bg-gray-200 -z-0"
              style={{
                left: `${(100 / (steps.length * 2))}%`,
                right: `${(100 / (steps.length * 2))}%`
              }}
            />
            <div
              className="absolute top-[22px] h-1 bg-[#16305B] -z-0 transition-all duration-500"
              style={{
                left: `${(100 / (steps.length * 2))}%`,
                width: currentStep === 0
                  ? '0%'
                  : `${(currentStep / (steps.length - 1)) * (100 - 2 * (100 / (steps.length * 2)))}%`
              }}
            />
            
            {/* Steps */}
            {steps.map((step, idx) => {
              const isCompleted = idx < currentStep;
              const isActive = idx === currentStep;
              const isFuture = idx > currentStep;
              const Icon = step.icon;

              return (
                <div 
                  key={step.label} 
                  className="flex flex-col items-center flex-1 relative z-10"
                >
                  <button
                    onClick={() => handleStepClick(idx)}
                    disabled={isFuture}
                    className={`flex flex-col items-center gap-2 transition-all duration-300 group ${
                      isFuture ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {/* Circle with Icon */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-4 ${
                        isCompleted
                          ? "bg-[#16305B] border-[#16305B] shadow-lg"
                          : isActive
                          ? "bg-white border-[#16305B] shadow-lg scale-110"
                          : "bg-white border-gray-300"
                      } ${!isFuture ? 'group-hover:scale-110 group-hover:shadow-xl' : ''}`}
                    >
                      {isCompleted ? (
                        <Check className="text-white" size={24} strokeWidth={3} />
                      ) : (
                        <Icon 
                          className={`${
                            isActive 
                              ? "text-[#16305B]" 
                              : isFuture 
                              ? "text-gray-300" 
                              : "text-gray-400"
                          }`} 
                          size={20} 
                        />
                      )}
                    </div>

                    {/* Label */}
                    <div className="flex flex-col items-center gap-1 min-w-[100px] max-w-[120px]">
                      <span
                        className={`text-sm font-semibold leading-tight text-center transition-colors ${
                          isActive
                            ? "text-[#16305B]"
                            : isCompleted
                            ? "text-gray-700"
                            : "text-gray-400"
                        }`}
                      >
                        {step.label}
                      </span>
                      <span
                        className={`text-xs leading-tight text-center transition-colors ${
                          isActive
                            ? "text-[#16305B] opacity-70"
                            : isCompleted
                            ? "text-gray-500"
                            : "text-gray-400"
                        }`}
                      >
                        {step.description}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Step Indicator */}
        <div className="mt-8 px-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {React.createElement(steps[currentStep].icon, {
                  className: "text-[#16305B]",
                  size: 24
                })}
                <div>
                  <p className="text-sm text-gray-600">Current Step</p>
                  <p className="font-bold text-[#16305B] text-lg">
                    {steps[currentStep].label}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Progress</p>
                <p className="font-bold text-[#16305B] text-lg">
                  {currentStep + 1} of {steps.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}