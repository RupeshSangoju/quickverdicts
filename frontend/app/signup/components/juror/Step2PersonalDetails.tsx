"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  FormField,
  TextInput,
  Select,
} from "@/components/forms/FormField";
import { LocationDropdown } from "../shared/LocationDropdown";
import type {
  JurorFormData,
  LocationOption,
  ValidationErrors,
} from "@/types/signup.types";
import {
  Check,
  CreditCard,
  User,
  MapPin,
  Wallet,
  AlertCircle,
} from "lucide-react";

/* ===========================================================
   TYPES
   =========================================================== */

interface Step2PersonalDetailsProps {
  formData: JurorFormData;
  onUpdate: (data: Partial<JurorFormData>) => void;
  validationErrors: ValidationErrors;
  onClearError: (field: keyof JurorFormData | string) => void;
  personalSubStep: 1 | 2;
  availableStates: LocationOption[];
  availableCounties: LocationOption[];
  availableCities: LocationOption[];
  countiesLoading?: boolean;
  citiesLoading?: boolean;
  onNext: () => void;
}

interface PaymentMethodButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

/* ===========================================================
   UTILITY FUNCTIONS
   =========================================================== */

/**
 * Format phone number to (XXX) XXX-XXXX
 */
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6)
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Format ZIP code to 12345 or 12345-6789
 */
function formatZipCode(value: string): string {
  const cleaned = value.replace(/[^\d-]/g, "");
  const parts = cleaned.split("-");
  const main = parts[0].slice(0, 5);
  const ext = parts[1]?.slice(0, 4) || "";
  return ext ? `${main}-${ext}` : main;
}

/**
 * Sanitize text input while keeping spaces
 */
function sanitizeText(value: string): string {
  return value.replace(/\s{2,}/g, " ").trimStart();
}

/* ===========================================================
   PAYMENT METHOD BUTTON COMPONENT
   =========================================================== */

function PaymentMethodButton({
  label,
  selected,
  onClick,
  icon,
}: PaymentMethodButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border-2 rounded-xl px-4 py-4 text-left transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
        selected
          ? "border-[#0A2342] ring-2 ring-[#0A2342] ring-offset-2 bg-blue-50"
          : "border-gray-300 hover:border-[#0A2342] bg-white"
      }`}
      role="radio"
      aria-checked={selected}
      aria-label={`Select ${label} as payment method`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            selected
              ? "bg-[#0A2342] border-[#0A2342]"
              : "bg-white border-gray-300"
          }`}
          aria-hidden="true"
        >
          {selected && <Check size={14} className="text-white font-bold" />}
        </div>
        <div className="flex items-center gap-2 flex-1">
          {icon}
          <span className="text-[#0A2342] font-semibold">{label}</span>
        </div>
      </div>
    </button>
  );
}

/* ===========================================================
   ERROR ICON COMPONENT
   =========================================================== */

const ErrorIcon = () => (
  <svg
    className="w-4 h-4"
    fill="currentColor"
    viewBox="0 0 20 20"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

export function Step2PersonalDetails({
  formData,
  onUpdate,
  validationErrors,
  onClearError,
  personalSubStep,
  availableStates,
  availableCounties,
  availableCities,
  countiesLoading = false,
  citiesLoading = false,
  onNext,
}: Step2PersonalDetailsProps) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /* ===========================================================
     COMPUTED VALUES
     =========================================================== */

  const isMarried = useMemo(
    () => formData.personalDetails1.maritalStatus === "Married",
    [formData.personalDetails1.maritalStatus]
  );

  /* ===========================================================
     AUTO-FILL SPOUSE FIELDS
     =========================================================== */

  useEffect(() => {
    if (!isMarried) {
      const shouldUpdate =
        formData.personalDetails1.spouseEmployer !== "Not Applicable" ||
        formData.personalDetails1.employerAddress !== "Not Applicable";

      if (shouldUpdate) {
        onUpdate({
          personalDetails1: {
            ...formData.personalDetails1,
            spouseEmployer: "Not Applicable",
            employerAddress: "Not Applicable",
          },
        });
      }
    }
  }, [isMarried, formData.personalDetails1, onUpdate]);

  /* ===========================================================
     VALIDATION HELPERS
     =========================================================== */

  const clearFieldError = useCallback((fieldName: string) => {
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  const validateSubstep1 = useCallback(() => {
    const errors: Record<string, string> = {};

    const {
      maritalStatus,
      employerName,
      spouseEmployer,
      employerAddress,
      yearsInCounty,
      ageRange,
      gender,
      education,
    } = formData.personalDetails1;

    if (!maritalStatus)
      errors.maritalStatus = "Please select your marital status";
    if (!employerName?.trim())
      errors.employerName = "Please enter your employer name";

    if (isMarried) {
      if (!spouseEmployer?.trim())
        errors.spouseEmployer = "Please enter spouse employer name";
      if (!employerAddress?.trim())
        errors.employerAddress = "Please enter spouse employer address";
    }

    if (!yearsInCounty) errors.yearsInCounty = "Please select years in county";
    if (!ageRange) errors.ageRange = "Please select your age range";
    if (!gender) errors.gender = "Please select your gender";
    if (!education) errors.education = "Please select your education level";

    return errors;
  }, [formData.personalDetails1, isMarried]);

  /* ===========================================================
     HANDLERS - SUB-STEP 1
     =========================================================== */

  const handleSubstep1Next = useCallback(() => {
    const errors = validateSubstep1();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      window.scrollTo({ top: 0, behavior: "smooth" });

      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "validation_error", {
          form_type: "juror_signup",
          step: "2.1",
          error_count: Object.keys(errors).length,
        });
      }
      return;
    }

    setFieldErrors({});

    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "substep_complete", {
        form_type: "juror_signup",
        step: "2.1",
      });
    }

    onNext();
  }, [validateSubstep1, onNext]);

  /* ===========================================================
     HANDLERS - SUB-STEP 2
     =========================================================== */

  const handleStateChange = useCallback(
    (option: LocationOption) => {
      onUpdate({
        stateCode: option.value,        // ✅ Store state code
        countyCode: "",                  // Reset county code
        cityCode: "",                    // Reset city code
        personalDetails2: {
          ...formData.personalDetails2,
          state: option.label,
          county: "",                    // Reset county name
          city: "",                      // Reset city name
        },
      });
      onClearError("personalDetails2.state");
    },
    [formData.personalDetails2, onUpdate, onClearError]
  );

  const handleCountyChange = useCallback(
    (option: LocationOption) => {
      onUpdate({
        countyCode: option.value,        // ✅ Store county code
        personalDetails2: {
          ...formData.personalDetails2,
          county: option.label,          // ✅ Store county name
          city: "",                      // Reset city
        },
        cityCode: "",                    // Reset city code
      });
      onClearError("personalDetails2.county");
    },
    [formData.personalDetails2, onUpdate, onClearError]
  );

  const handleCityChange = useCallback(
    (option: LocationOption) => {
      onUpdate({
        cityCode: option.value,          // ✅ Store city code
        personalDetails2: {
          ...formData.personalDetails2,
          city: option.label,            // ✅ Store city name
        },
      });
      onClearError("personalDetails2.city");
    },
    [formData.personalDetails2, onUpdate, onClearError]
  );


  const handlePhoneChange = useCallback(
    (value: string) => {
      onUpdate({
        personalDetails2: {
          ...formData.personalDetails2,
          phone: formatPhoneNumber(value),
        },
      });
      onClearError("personalDetails2.phone");
    },
    [formData.personalDetails2, onUpdate, onClearError]
  );

  const handleZipChange = useCallback(
    (value: string) => {
      onUpdate({
        personalDetails2: {
          ...formData.personalDetails2,
          zip: formatZipCode(value),
        },
      });
      onClearError("personalDetails2.zip");
    },
    [formData.personalDetails2, onUpdate, onClearError]
  );

  const handleTextChange = useCallback(
    (field: string, value: string) => {
      onUpdate({
        personalDetails2: {
          ...formData.personalDetails2,
          [field]: sanitizeText(value),
        },
      });
      onClearError(`personalDetails2.${field}`);
    },
    [formData.personalDetails2, onUpdate, onClearError]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "step2_submit", {
          form_type: "juror_signup",
        });
      }

      onNext();
    },
    [onNext]
  );

  /* ===========================================================
     RENDER SUB-STEP 1
     =========================================================== */

  if (personalSubStep === 1) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-[#0A2342]">
              Demographic Information
            </h1>
            <div className="text-sm font-medium text-gray-500">
              Step 1 of 2
            </div>
          </div>
          <p className="text-gray-600">
            Help us understand your background better. All fields on this page
            are required.
          </p>
        </header>

        {/* Form */}
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubstep1Next();
          }}
          noValidate
        >
          {/* Marital Status */}
          <div
            className={`bg-white rounded-xl border-2 p-6 shadow-sm transition-colors ${
              fieldErrors.maritalStatus ? "border-red-300" : "border-gray-200"
            }`}
          >
            <FormField label="Marital Status" required>
              <Select
                value={formData.personalDetails1.maritalStatus}
                onChange={(val) => {
                  onUpdate({
                    personalDetails1: {
                      ...formData.personalDetails1,
                      maritalStatus: val,
                    },
                  });
                  clearFieldError("maritalStatus");
                }}
                options={[
                  "Single",
                  "Married",
                  "Divorced",
                  "Widowed",
                  "Prefer not to say",
                ]}
                placeholder="Select your marital status"
              />
            </FormField>
            {fieldErrors.maritalStatus && (
              <p
                className="text-red-500 text-sm mt-2 flex items-center gap-1"
                role="alert"
              >
                <ErrorIcon />
                {fieldErrors.maritalStatus}
              </p>
            )}
          </div>

          {/* Your Employment */}
          <div
            className={`bg-white rounded-xl border-2 p-6 shadow-sm transition-colors ${
              fieldErrors.employerName ? "border-red-300" : "border-gray-200"
            }`}
          >
            <h2 className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2">
              <User className="text-blue-600" size={20} aria-hidden="true" />
              Your Employment Information
            </h2>

            <FormField label="Your Current Employer Name" required>
              <TextInput
                placeholder="e.g., Lone Star Innovations LLC"
                value={formData.personalDetails1.employerName}
                onChange={(val) => {
                  onUpdate({
                    personalDetails1: {
                      ...formData.personalDetails1,
                      employerName: val,
                    },
                  });
                  clearFieldError("employerName");
                }}
                hasError={!!fieldErrors.employerName}
                autoComplete="organization"
              />
            </FormField>
            {fieldErrors.employerName && (
              <p
                className="text-red-500 text-sm mt-2 flex items-center gap-1"
                role="alert"
              >
                <ErrorIcon />
                {fieldErrors.employerName}
              </p>
            )}
          </div>

          {/* Spouse Information - Conditional */}
          {isMarried && (
            <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#0A2342] mb-4">
                Spouse Information
              </h2>

              <div className="space-y-4">
                <div>
                  <FormField label="Spouse Employer Name" required>
                    <TextInput
                      placeholder="e.g., Dallas Marketing Services"
                      value={formData.personalDetails1.spouseEmployer}
                      onChange={(val) => {
                        onUpdate({
                          personalDetails1: {
                            ...formData.personalDetails1,
                            spouseEmployer: val,
                          },
                        });
                        clearFieldError("spouseEmployer");
                      }}
                      hasError={!!fieldErrors.spouseEmployer}
                      autoComplete="organization"
                    />
                  </FormField>
                  {fieldErrors.spouseEmployer && (
                    <p
                      className="text-red-500 text-sm mt-2 flex items-center gap-1"
                      role="alert"
                    >
                      <ErrorIcon />
                      {fieldErrors.spouseEmployer}
                    </p>
                  )}
                </div>

                <div>
                  <FormField label="Spouse Employer Address" required>
                    <TextInput
                      placeholder="e.g., 1425 Mockingbird Plaza, Suite 320, Dallas, TX 75247"
                      value={formData.personalDetails1.employerAddress}
                      onChange={(val) => {
                        onUpdate({
                          personalDetails1: {
                            ...formData.personalDetails1,
                            employerAddress: val,
                          },
                        });
                        clearFieldError("employerAddress");
                      }}
                      hasError={!!fieldErrors.employerAddress}
                      autoComplete="street-address"
                    />
                  </FormField>
                  {fieldErrors.employerAddress && (
                    <p
                      className="text-red-500 text-sm mt-2 flex items-center gap-1"
                      role="alert"
                    >
                      <ErrorIcon />
                      {fieldErrors.employerAddress}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Years in County & Age Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className={`bg-white rounded-xl border-2 p-6 shadow-sm transition-colors ${
                fieldErrors.yearsInCounty ? "border-red-300" : "border-gray-200"
              }`}
            >
              <FormField label="Years in County" required>
                <Select
                  value={formData.personalDetails1.yearsInCounty}
                  onChange={(val) => {
                    onUpdate({
                      personalDetails1: {
                        ...formData.personalDetails1,
                        yearsInCounty: val,
                      },
                    });
                    clearFieldError("yearsInCounty");
                  }}
                  options={[
                    "One",
                    "Two",
                    "Three",
                    "Four",
                    "Five",
                    "Six or more",
                  ]}
                  placeholder="Select years"
                />
              </FormField>
              {fieldErrors.yearsInCounty && (
                <p
                  className="text-red-500 text-sm mt-2 flex items-center gap-1"
                  role="alert"
                >
                  <ErrorIcon />
                  {fieldErrors.yearsInCounty}
                </p>
              )}
            </div>

            <div
              className={`bg-white rounded-xl border-2 p-6 shadow-sm transition-colors ${
                fieldErrors.ageRange ? "border-red-300" : "border-gray-200"
              }`}
            >
              <FormField label="Age Range" required>
                <Select
                  value={formData.personalDetails1.ageRange}
                  onChange={(val) => {
                    onUpdate({
                      personalDetails1: {
                        ...formData.personalDetails1,
                        ageRange: val,
                      },
                    });
                    clearFieldError("ageRange");
                  }}
                  options={[
                    "18-24",
                    "25-29",
                    "30-39",
                    "40-49",
                    "50-59",
                    "60-69",
                    "70+",
                  ]}
                  placeholder="Select age range"
                />
              </FormField>
              {fieldErrors.ageRange && (
                <p
                  className="text-red-500 text-sm mt-2 flex items-center gap-1"
                  role="alert"
                >
                  <ErrorIcon />
                  {fieldErrors.ageRange}
                </p>
              )}
            </div>
          </div>

          {/* Gender & Education */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className={`bg-white rounded-xl border-2 p-6 shadow-sm transition-colors ${
                fieldErrors.gender ? "border-red-300" : "border-gray-200"
              }`}
            >
              <FormField label="Gender" required>
                <Select
                  value={formData.personalDetails1.gender}
                  onChange={(val) => {
                    onUpdate({
                      personalDetails1: {
                        ...formData.personalDetails1,
                        gender: val,
                      },
                    });
                    clearFieldError("gender");
                  }}
                  options={["Male", "Female", "Other", "Prefer not to say"]}
                  placeholder="Select gender"
                />
              </FormField>
              {fieldErrors.gender && (
                <p
                  className="text-red-500 text-sm mt-2 flex items-center gap-1"
                  role="alert"
                >
                  <ErrorIcon />
                  {fieldErrors.gender}
                </p>
              )}
            </div>

            <div
              className={`bg-white rounded-xl border-2 p-6 shadow-sm transition-colors ${
                fieldErrors.education ? "border-red-300" : "border-gray-200"
              }`}
            >
              <FormField label="Highest Level of Education" required>
                <Select
                  value={formData.personalDetails1.education}
                  onChange={(val) => {
                    onUpdate({
                      personalDetails1: {
                        ...formData.personalDetails1,
                        education: val,
                      },
                    });
                    clearFieldError("education");
                  }}
                  options={[
                    "High School",
                    "Associate's Degree",
                    "Bachelor's Degree",
                    "Master's Degree",
                    "Doctorate",
                  ]}
                  placeholder="Select education"
                />
              </FormField>
              {fieldErrors.education && (
                <p
                  className="text-red-500 text-sm mt-2 flex items-center gap-1"
                  role="alert"
                >
                  <ErrorIcon />
                  {fieldErrors.education}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="submit"
              className="w-full font-semibold px-8 py-4 rounded-xl transition-all shadow-md hover:shadow-lg bg-[#0A2342] text-white hover:bg-[#132c54] transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2"
            >
              Continue to Contact Information
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* ===========================================================
     RENDER SUB-STEP 2
     =========================================================== */

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-[#0A2342]">
            Contact Information
          </h1>
          <div className="text-sm font-medium text-gray-500">Step 2 of 2</div>
        </div>
        <p className="text-gray-600">
          Please provide your contact details and payment preferences. All
          fields are required.
        </p>
      </header>

      {/* Form */}
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {/* Name & Phone */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm space-y-4">
          <FormField
            label="Full Name"
            required
            validationErrors={validationErrors}
            fieldName="personalDetails2.name"
          >
            <TextInput
              placeholder="John Doe"
              value={formData.personalDetails2.name}
              onChange={(val) => handleTextChange("name", val)}
              hasError={!!validationErrors["personalDetails2.name"]}
              autoComplete="name"
            />
          </FormField>

          <FormField
            label="Phone Number"
            required
            validationErrors={validationErrors}
            fieldName="personalDetails2.phone"
          >
            <TextInput
              type="tel"
              placeholder="(832) 674-8776"
              value={formData.personalDetails2.phone}
              onChange={handlePhoneChange}
              hasError={!!validationErrors["personalDetails2.phone"]}
              autoComplete="tel"
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: (XXX) XXX-XXXX
            </p>
          </FormField>
        </div>

        {/* Address */}
        <section
          className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm space-y-4"
          aria-labelledby="address-heading"
        >
          <h2
            id="address-heading"
            className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2"
          >
            <MapPin className="text-blue-600" size={20} aria-hidden="true" />
            Address
          </h2>

          <FormField
            label="Address Line 1"
            required
            validationErrors={validationErrors}
            fieldName="personalDetails2.address1"
          >
            <TextInput
              placeholder="7423 Maple Hollow Dr"
              value={formData.personalDetails2.address1}
              onChange={(val) => handleTextChange("address1", val)}
              hasError={!!validationErrors["personalDetails2.address1"]}
              autoComplete="address-line1"
            />
          </FormField>

          <FormField label="Address Line 2">
            <TextInput
              placeholder="Apt, Suite, etc. (optional)"
              value={formData.personalDetails2.address2}
              onChange={(val) => handleTextChange("address2", val)}
              autoComplete="address-line2"
            />
          </FormField>

          <LocationDropdown
            label="State"
            value={formData.stateCode || formData.personalDetails2.state || ""}
            onChange={handleStateChange}
            options={availableStates}
            placeholder="Search for your state"
            required
            error={validationErrors["personalDetails2.state"]}
          />

          <LocationDropdown
            label="County"
            value={formData.countyCode || formData.personalDetails2.county || ""}
            onChange={handleCountyChange}
            options={availableCounties}
            placeholder="Search for your county"
            required
            disabled={!formData.stateCode}
            loading={countiesLoading}
            error={validationErrors["personalDetails2.county"]}
          />

          <LocationDropdown
            label="City"
            value={formData.cityCode || formData.personalDetails2.city || ""}
            onChange={handleCityChange}
            options={availableCities}
            placeholder="Search for your city"
            required
            disabled={!formData.stateCode}
            loading={citiesLoading}
            error={validationErrors["personalDetails2.city"]}
          />

          <FormField
            label="ZIP Code"
            required
            validationErrors={validationErrors}
            fieldName="personalDetails2.zip"
          >
            <TextInput
              placeholder="75123"
              value={formData.personalDetails2.zip}
              onChange={handleZipChange}
              hasError={!!validationErrors["personalDetails2.zip"]}
              type="text"
              autoComplete="postal-code"
            />
            <p className="text-xs text-gray-500 mt-1">
              5-digit ZIP or ZIP+4 format
            </p>
          </FormField>
        </section>

        {/* Payment Methods */}
        <section
          className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-6 shadow-sm"
          aria-labelledby="payment-heading"
        >
          <h2
            id="payment-heading"
            className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2"
          >
            <Wallet className="text-blue-600" size={20} aria-hidden="true" />
            Payment Method
          </h2>
          <FormField
            label="Select Your Preferred Payment Method"
            required
            validationErrors={validationErrors}
            fieldName="paymentMethod"
          >
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3"
              role="radiogroup"
              aria-label="Payment method selection"
            >
              <PaymentMethodButton
                label="Venmo"
                selected={formData.paymentMethod === "venmo"}
                onClick={() => {
                  onUpdate({ paymentMethod: "venmo" });
                  onClearError("paymentMethod");
                }}
                icon={
                  <CreditCard
                    size={20}
                    className="text-[#0A2342]"
                    aria-hidden="true"
                  />
                }
              />
              <PaymentMethodButton
                label="PayPal"
                selected={formData.paymentMethod === "paypal"}
                onClick={() => {
                  onUpdate({ paymentMethod: "paypal" });
                  onClearError("paymentMethod");
                }}
                icon={
                  <CreditCard
                    size={20}
                    className="text-[#0A2342]"
                    aria-hidden="true"
                  />
                }
              />
              <PaymentMethodButton
                label="Cash App"
                selected={formData.paymentMethod === "cashapp"}
                onClick={() => {
                  onUpdate({ paymentMethod: "cashapp" });
                  onClearError("paymentMethod");
                }}
                icon={
                  <CreditCard
                    size={20}
                    className="text-[#0A2342]"
                    aria-hidden="true"
                  />
                }
              />
              <PaymentMethodButton
                label="Zelle"
                selected={formData.paymentMethod === "zelle"}
                onClick={() => {
                  onUpdate({ paymentMethod: "zelle" });
                  onClearError("paymentMethod");
                }}
                icon={
                  <CreditCard
                    size={20}
                    className="text-[#0A2342]"
                    aria-hidden="true"
                  />
                }
              />
            </div>
            <p className="text-xs text-gray-600 mt-3">
              💡 Jury service compensation will be sent to your selected payment
              method
            </p>
          </FormField>
        </section>

        {/* Submit Button */}
        <div className="pt-6">
          <button
            type="submit"
            className="w-full font-semibold px-8 py-4 rounded-xl transition-all shadow-md hover:shadow-lg bg-[#0A2342] text-white hover:bg-[#132c54] transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2"
          >
            Continue to Email &amp; Password
          </button>
        </div>
      </form>
    </div>
  );
}

export default Step2PersonalDetails;
