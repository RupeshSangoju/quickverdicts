"use client";

import React, { useCallback, useMemo } from "react";
import { FormField } from "@/components/forms/FormField";
import type { JurorFormData, ValidationErrors } from "@/types/signup.types";
import { CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

/* ===========================================================
   TYPES
   =========================================================== */

interface Step1CriteriaVerificationProps {
  formData: JurorFormData;
  onUpdate: (data: Partial<JurorFormData>) => void;
  validationErrors: ValidationErrors;
  onClearError: (field: keyof JurorFormData | string) => void;
  onNext: () => void;
}

interface QuestionProps {
  label: string;
  name: keyof JurorFormData["criteriaAnswers"];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  questionNumber: number;
  totalQuestions: number;
}

/* ===========================================================
   QUESTION COMPONENT
   =========================================================== */

function Question({
  label,
  name,
  value,
  onChange,
  error,
  questionNumber,
  totalQuestions,
}: QuestionProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, selectedValue: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onChange(selectedValue);
      }
    },
    [onChange]
  );

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-[#0A2342] transition-all shadow-sm hover:shadow-md">
      <div className="flex items-start gap-3 mb-3">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0A2342] text-white flex items-center justify-center text-sm font-bold"
          aria-hidden="true"
        >
          {questionNumber}
        </div>
        <div className="flex-1">
          <FormField
            label={label}
            required
            validationErrors={error ? { [name]: error } : {}}
            fieldName={name}
          >
            <fieldset className="mt-3" aria-labelledby={`${name}-legend`}>
              <legend id={`${name}-legend`} className="sr-only">
                {label}
              </legend>
              <div
                className="flex gap-6"
                role="radiogroup"
                aria-label={label}
                aria-required="true"
                aria-invalid={!!error}
              >
                {/* Yes Option */}
                <label
                  className="flex items-center gap-3 cursor-pointer group"
                  htmlFor={`${name}-yes`}
                >
                  <div className="relative">
                    <input
                      id={`${name}-yes`}
                      type="radio"
                      name={name}
                      value="yes"
                      checked={value === "yes"}
                      onChange={(e) => onChange(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "yes")}
                      className="sr-only"
                      aria-label={`${label} - Yes`}
                    />
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        value === "yes"
                          ? "border-[#0A2342] bg-[#0A2342]"
                          : "border-gray-300 group-hover:border-[#0A2342]"
                      }`}
                      aria-hidden="true"
                    >
                      {value === "yes" && (
                        <CheckCircle2 size={16} className="text-white" />
                      )}
                    </div>
                  </div>
                  <span
                    className={`font-medium transition-colors ${
                      value === "yes"
                        ? "text-[#0A2342]"
                        : "text-gray-600 group-hover:text-[#0A2342]"
                    }`}
                  >
                    Yes
                  </span>
                </label>

                {/* No Option */}
                <label
                  className="flex items-center gap-3 cursor-pointer group"
                  htmlFor={`${name}-no`}
                >
                  <div className="relative">
                    <input
                      id={`${name}-no`}
                      type="radio"
                      name={name}
                      value="no"
                      checked={value === "no"}
                      onChange={(e) => onChange(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "no")}
                      className="sr-only"
                      aria-label={`${label} - No`}
                    />
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        value === "no"
                          ? "border-[#0A2342] bg-[#0A2342]"
                          : "border-gray-300 group-hover:border-[#0A2342]"
                      }`}
                      aria-hidden="true"
                    >
                      {value === "no" && (
                        <CheckCircle2 size={16} className="text-white" />
                      )}
                    </div>
                  </div>
                  <span
                    className={`font-medium transition-colors ${
                      value === "no"
                        ? "text-[#0A2342]"
                        : "text-gray-600 group-hover:text-[#0A2342]"
                    }`}
                  >
                    No
                  </span>
                </label>
              </div>
            </fieldset>
          </FormField>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   QUESTIONS DATA
   =========================================================== */

const QUESTIONS = [
  {
    name: "felony" as const,
    label:
      "Have you been convicted of a felony within the past ten (10) years for which your rights have not been restored?",
  },
  {
    name: "indictment" as const,
    label: "Are you currently under indictment for or charged with a felony?",
  },
  {
    name: "age" as const,
    label: "Are you at least 18 years old?",
  },
  {
    name: "citizen" as const,
    label: "Are you a citizen of the United States?",
  },
  {
    name: "work1" as const,
    label:
      "Do you or your spouse, parents, or children work for a law firm, an insurance company or a claims adjusting company?",
  },
  {
    name: "work2" as const,
    label:
      "Have you, your spouse, parents or children worked for a law firm, an insurance company or a claims adjusting company within the past year?",
  },
] as const;

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

export function Step1CriteriaVerification({
  formData,
  onUpdate,
  validationErrors,
  onClearError,
  onNext,
}: Step1CriteriaVerificationProps) {
  /* ===========================================================
     HANDLERS
     =========================================================== */

  const handleCriteriaChange = useCallback(
    (field: keyof JurorFormData["criteriaAnswers"], value: string) => {
      onUpdate({
        criteriaAnswers: {
          ...formData.criteriaAnswers,
          [field]: value,
        },
      });
      onClearError(`criteriaAnswers.${field}`);
      onClearError("criteriaAnswers.eligibility");

      // Track answer
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "criteria_answered", {
          form_type: "juror_signup",
          step: 1,
          question: field,
          answer: value,
        });
      }
    },
    [formData.criteriaAnswers, onUpdate, onClearError]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Track form submission
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "step1_submit", {
          form_type: "juror_signup",
        });
      }

      onNext();
    },
    [onNext]
  );

  /* ===========================================================
     PROGRESS CALCULATION
     =========================================================== */

  const progress = useMemo(() => {
    const answers = formData.criteriaAnswers;
    const totalQuestions = QUESTIONS.length;
    const answeredQuestions = Object.values(answers).filter(
      (v) => v !== ""
    ).length;
    const percentage = Math.round(
      (answeredQuestions / totalQuestions) * 100
    );

    return {
      answered: answeredQuestions,
      total: totalQuestions,
      percentage,
      isComplete: answeredQuestions === totalQuestions,
    };
  }, [formData.criteriaAnswers]);

  /* ===========================================================
     ELIGIBILITY CHECK
     =========================================================== */

  const eligibilityStatus = useMemo(() => {
    const { felony, indictment, age, citizen } = formData.criteriaAnswers;

    // Need at least the first 4 questions answered
    if (!felony || !indictment || !age || !citizen) {
      return null;
    }

    const isEligible =
      felony === "no" &&
      indictment === "no" &&
      age === "yes" &&
      citizen === "yes";

    return {
      isEligible,
      message: isEligible
        ? "Based on your answers to the first 4 questions, you appear to meet the basic eligibility requirements."
        : "Based on your answers, you may not meet the basic eligibility requirements for jury service.",
    };
  }, [formData.criteriaAnswers]);

  /* ===========================================================
     RENDER
     =========================================================== */

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-[#0A2342] mb-2">
              Eligibility Verification
            </h1>
            <p className="text-gray-600">
              Please answer the following questions honestly to determine your
              eligibility for jury service.
            </p>
          </div>
          <div
            className="flex-shrink-0 ml-4"
            role="img"
            aria-label="Eligibility verification shield"
          >
            <ShieldCheck
              className="w-12 h-12 text-[#0A2342]"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-500 ease-out"
            style={{ width: `${progress.percentage}%` }}
            role="progressbar"
            aria-valuenow={progress.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress: ${progress.answered} of ${progress.total} questions answered`}
          />
        </div>
        <p className="text-sm text-gray-600 mt-2 text-right">
          {progress.answered} of {progress.total} questions answered
        </p>
      </header>

      {/* Form */}
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {QUESTIONS.map((question, index) => (
          <Question
            key={question.name}
            label={question.label}
            name={question.name}
            value={formData.criteriaAnswers[question.name]}
            onChange={(value) => handleCriteriaChange(question.name, value)}
            error={
              validationErrors?.[
                `criteriaAnswers.${question.name}`
              ] as string
            }
            questionNumber={index + 1}
            totalQuestions={QUESTIONS.length}
          />
        ))}

        {/* Eligibility Status */}
        {eligibilityStatus && (
          <div
            className={`rounded-xl p-6 border-2 transition-all ${
              eligibilityStatus.isEligible
                ? "bg-green-50 border-green-200"
                : "bg-yellow-50 border-yellow-200"
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {eligibilityStatus.isEligible ? (
                <CheckCircle2
                  className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              )}
              <div>
                <h2
                  className={`font-semibold mb-1 ${
                    eligibilityStatus.isEligible
                      ? "text-green-900"
                      : "text-yellow-900"
                  }`}
                >
                  {eligibilityStatus.isEligible
                    ? "Preliminary Eligibility Met"
                    : "Eligibility Notice"}
                </h2>
                <p
                  className={`text-sm ${
                    eligibilityStatus.isEligible
                      ? "text-green-800"
                      : "text-yellow-800"
                  }`}
                >
                  {eligibilityStatus.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* General Eligibility Error */}
        {validationErrors["criteriaAnswers.eligibility"] && (
          <div
            className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3"
            role="alert"
          >
            <div className="bg-red-100 rounded-full p-2 flex-shrink-0">
              <AlertCircle
                className="w-5 h-5 text-red-600"
                aria-hidden="true"
              />
            </div>
            <p className="text-red-700 text-sm font-medium flex-1">
              {validationErrors["criteriaAnswers.eligibility"]}
            </p>
          </div>
        )}

        {/* Important Notice */}
        <div
          className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6"
          role="note"
        >
          <h3 className="font-semibold text-blue-900 mb-2 text-sm">
            📋 Important Information
          </h3>
          <ul className="text-xs text-blue-800 space-y-1" role="list">
            <li>• All answers are subject to verification</li>
            <li>
              • Providing false information may result in legal consequences
            </li>
            <li>
              • Additional eligibility criteria may apply based on your
              jurisdiction
            </li>
          </ul>
        </div>

        {/* Submit Button */}
        <div className="pt-6">
          <button
            type="submit"
            disabled={!progress.isComplete}
            className={`w-full font-semibold px-8 py-4 rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
              progress.isComplete
                ? "bg-[#0A2342] text-white hover:bg-[#132c54] hover:shadow-lg transform hover:scale-[1.02]"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
            aria-label="Continue to personal details"
          >
            {progress.isComplete
              ? "Continue to Personal Details"
              : `Answer all questions to continue (${progress.answered}/${progress.total})`}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Step1CriteriaVerification;
