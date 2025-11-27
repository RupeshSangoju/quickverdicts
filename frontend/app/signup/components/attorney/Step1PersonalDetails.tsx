"use client";

import React, { useCallback } from "react";
import { FormField, TextInput } from "@/components/forms/FormField";
import { LocationDropdown } from "../shared/LocationDropdown";
import type {
  AttorneyFormData,
  LocationOption,
  ValidationErrors,
} from "@/types/signup.types";
import { User, Building2, Phone, Award } from "lucide-react";

/* ===========================================================
   TYPES
   =========================================================== */

interface Step1PersonalDetailsProps {
  formData: AttorneyFormData;
  onUpdate: (data: Partial<AttorneyFormData>) => void;
  validationErrors: ValidationErrors;
  onClearError: (field: keyof AttorneyFormData) => void;
  availableStates: LocationOption[];
  onNext: () => void;
}

/* ===========================================================
   UTILITY FUNCTIONS
   =========================================================== */

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6)
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function sanitizeText(value: string): string {
  return value.replace(/\s+/g, " ").trimStart();
}

function formatBarNumber(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

export function Step1PersonalDetails({
  formData,
  onUpdate,
  validationErrors,
  onClearError,
  availableStates,
  onNext,
}: Step1PersonalDetailsProps) {
  /* ===========================================================
     EVENT HANDLERS
     =========================================================== */

  const handleStateChange = useCallback(
    (option: LocationOption) => {
      // ✅ Store BOTH the label (name) and value (code)
      onUpdate({
        state: option.label,
        stateCode: option.value,
      });
      onClearError("state");

      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "state_selected", {
          form_type: "attorney_signup",
          step: 1,
          state: option.label,
        });
      }
    },
    [onUpdate, onClearError]
  );

  const handlePhoneChange = useCallback(
    (value: string) => {
      const formatted = formatPhoneNumber(value);
      onUpdate({ phoneNumber: formatted });
      onClearError("phoneNumber");
    },
    [onUpdate, onClearError]
  );

  const handleBarNumberChange = useCallback(
    (value: string) => {
      const formatted = formatBarNumber(value);
      onUpdate({ stateBarNumber: formatted });
      onClearError("stateBarNumber");
    },
    [onUpdate, onClearError]
  );

  const handleTextChange = useCallback(
    (field: keyof AttorneyFormData, value: string) => {
      const sanitized = sanitizeText(value);
      onUpdate({ [field]: sanitized });
      onClearError(field);
    },
    [onUpdate, onClearError]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "step1_submit", {
          form_type: "attorney_signup",
        });
      }

      onNext();
    },
    [onNext]
  );

  /* ===========================================================
     RENDER
     =========================================================== */

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#0A2342] mb-2">
          Personal Information
        </h1>
        <p className="text-gray-600">
          Please provide your professional details. All fields marked with{" "}
          <span className="text-red-500">*</span> are required.
        </p>
      </header>

      {/* Form */}
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {/* Personal Details */}
        <section
          className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm space-y-4"
          aria-labelledby="personal-details-heading"
        >
          <h2
            id="personal-details-heading"
            className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2"
          >
            <User className="text-blue-600" size={20} aria-hidden="true" />
            Personal Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <FormField
              label="First Name"
              required
              validationErrors={validationErrors}
              fieldName="firstName"
            >
              <TextInput
                placeholder="John"
                value={formData.firstName || ""}
                onChange={(value) => handleTextChange("firstName", value)}
                hasError={!!validationErrors.firstName}
                autoComplete="given-name"
              />
            </FormField>

            {/* Middle Name */}
            <FormField
              label="Middle Name"
              validationErrors={validationErrors}
              fieldName="middleName"
            >
              <TextInput
                placeholder="Michael"
                value={formData.middleName || ""}
                onChange={(value) => handleTextChange("middleName", value)}
                autoComplete="additional-name"
              />
            </FormField>
          </div>

          {/* Last Name */}
          <FormField
            label="Last Name"
            required
            validationErrors={validationErrors}
            fieldName="lastName"
          >
            <TextInput
              placeholder="Doe"
              value={formData.lastName || ""}
              onChange={(value) => handleTextChange("lastName", value)}
              hasError={!!validationErrors.lastName}
              autoComplete="family-name"
            />
          </FormField>
        </section>

        {/* Professional Details */}
        <section
          className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm space-y-4"
          aria-labelledby="professional-details-heading"
        >
          <h2
            id="professional-details-heading"
            className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2"
          >
            <Building2
              className="text-blue-600"
              size={20}
              aria-hidden="true"
            />
            Professional Information
          </h2>

          {/* Law Firm Name */}
          <FormField
            label="Law Firm Entity Name"
            required
            validationErrors={validationErrors}
            fieldName="lawFirmName"
          >
            <TextInput
              placeholder="Smith & Associates Law Firm"
              value={formData.lawFirmName || ""}
              onChange={(value) => handleTextChange("lawFirmName", value)}
              hasError={!!validationErrors.lawFirmName}
              autoComplete="organization"
            />
          </FormField>

          {/* Phone Number */}
          <FormField
            label="Phone Number"
            required
            validationErrors={validationErrors}
            fieldName="phoneNumber"
          >
            <div className="relative">
              <Phone
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                size={20}
                aria-hidden="true"
              />
              <TextInput
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phoneNumber || ""}
                onChange={handlePhoneChange}
                hasError={!!validationErrors.phoneNumber}
                className="pl-10"
                autoComplete="tel"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Format: (555) 123-4567
            </p>
          </FormField>
        </section>

        {/* Bar License */}
        <section
          className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm space-y-4"
          aria-labelledby="bar-license-heading"
        >
          <h2
            id="bar-license-heading"
            className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2"
          >
            <Award className="text-blue-600" size={20} aria-hidden="true" />
            Bar License Information
          </h2>

          {/* State Selection */}
          <LocationDropdown
            label="State"
            value={formData.stateCode || formData.state || ""}
            onChange={handleStateChange}
            options={availableStates}
            placeholder="Search for your state"
            required
            error={validationErrors.state}
            loading={availableStates.length === 0}
          />

          {/* State Bar Number */}
          <FormField
            label="State Bar Number"
            required
            validationErrors={validationErrors}
            fieldName="stateBarNumber"
          >
            <TextInput
              placeholder="123456789"
              value={formData.stateBarNumber || ""}
              onChange={handleBarNumberChange}
              hasError={!!validationErrors.stateBarNumber}
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter your bar license number without spaces or special
              characters
            </p>
          </FormField>

          {/* Verification Notice */}
          <div
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4"
            role="note"
          >
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Your bar license will be verified during
              account review. You will have limited access until verification is
              complete.
            </p>
          </div>
        </section>

        {/* Continue Button */}
        <div className="pt-6">
          <button
            type="submit"
            className="w-full font-semibold px-8 py-4 rounded-xl transition-all shadow-md hover:shadow-lg bg-[#0A2342] text-white hover:bg-[#132c54] transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Continue to address details"
          >
            Continue to Address Details
          </button>
        </div>
      </form>
    </div>
  );
}

export default Step1PersonalDetails;
