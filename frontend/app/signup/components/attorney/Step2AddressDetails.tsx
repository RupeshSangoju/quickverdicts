"use client";

import React, { useCallback } from "react";
import { FormField, TextInput } from "@/components/forms/FormField";
import { LocationDropdown } from "../shared/LocationDropdown";
import type {
  AttorneyFormData,
  LocationOption,
  ValidationErrors,
} from "@/types/signup.types";
import { Building, MapPin, AlertCircle, Info } from "lucide-react";

/* ===========================================================
   ALERT COMPONENTS
   =========================================================== */

const StateRequiredAlert = () => (
  <div
    className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded"
    role="alert"
  >
    <div className="flex items-start gap-3">
      <AlertCircle
        className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div className="text-sm text-yellow-700">
        Please select a state in Step 1 before choosing a county.
      </div>
    </div>
  </div>
);

const CountyRequiredAlert = () => (
  <div
    className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded"
    role="alert"
  >
    <div className="flex items-start gap-3">
      <Info
        className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div className="text-sm text-blue-700">
        Please select a county before choosing a city.
      </div>
    </div>
  </div>
);

/* ===========================================================
   UTILITY FUNCTIONS
   =========================================================== */

/**
 * Format ZIP code to 12345 or 12345-6789
 */
function formatZipCode(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Sanitize address input
 */
function sanitizeAddress(value: string): string {
  return value.replace(/\s+/g, " ").trimStart();
}

/* ===========================================================
   TYPES
   =========================================================== */

interface Step2AddressDetailsProps {
  formData: AttorneyFormData;
  onUpdate: (data: Partial<AttorneyFormData>) => void;
  validationErrors: ValidationErrors;
  onClearError: (field: keyof AttorneyFormData) => void;
  availableCounties: LocationOption[];
  availableCities: LocationOption[];
  countiesLoading?: boolean;
  citiesLoading?: boolean;
  onNext: () => void;
}

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

export function Step2AddressDetails({
  formData,
  onUpdate,
  validationErrors,
  onClearError,
  availableCounties,
  availableCities,
  countiesLoading = false,
  citiesLoading = false,
  onNext,
}: Step2AddressDetailsProps) {
  /* ===========================================================
     EVENT HANDLERS
     =========================================================== */

  const handleCountyChange = useCallback(
    (option: LocationOption) => {
      onUpdate({
        county: option.label,
        countyCode: option.value,
        city: "",
        cityCode: "",
      });
      onClearError("county");

      // Track county selection
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "county_selected", {
          form_type: "attorney_signup",
          step: 2,
          county: option.label,
        });
      }
    },
    [onUpdate, onClearError]
  );

  const handleCityChange = useCallback(
    (option: LocationOption) => {
      onUpdate({
        city: option.label,
        cityCode: option.value,
      });
      onClearError("city");

      // Track city selection
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "city_selected", {
          form_type: "attorney_signup",
          step: 2,
          city: option.label,
        });
      }
    },
    [onUpdate, onClearError]
  );

  const handleAddressChange = useCallback(
    (field: "officeAddress1" | "officeAddress2", value: string) => {
      const sanitized = sanitizeAddress(value);
      onUpdate({ [field]: sanitized });
      if (field === "officeAddress1") {
        onClearError("officeAddress1");
      }
    },
    [onUpdate, onClearError]
  );

  const handleZipChange = useCallback(
    (value: string) => {
      const formatted = formatZipCode(value);
      onUpdate({ zipCode: formatted });
      onClearError("zipCode");
    },
    [onUpdate, onClearError]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Track form submission
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "step2_submit", {
          form_type: "attorney_signup",
        });
      }

      onNext();
    },
    [onNext]
  );

  /* ===========================================================
     COMPUTED VALUES
     =========================================================== */

  const showAddressSummary =
    formData.officeAddress1 &&
    formData.city &&
    formData.state &&
    formData.zipCode &&
    !validationErrors.zipCode &&
    !validationErrors.city &&
    !validationErrors.county &&
    !validationErrors.officeAddress1;

  /* ===========================================================
     RENDER
     =========================================================== */

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#0A2342] mb-2">
          Office Address
        </h1>
        <p className="text-gray-600">
          Please provide your registered office address. All fields marked with{" "}
          <span className="text-red-500">*</span> are required.
        </p>
      </header>

      {/* Form */}
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {/* Street Address Section */}
        <section
          className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm space-y-4"
          aria-labelledby="street-address-heading"
        >
          <h2
            id="street-address-heading"
            className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2"
          >
            <Building
              className="text-blue-600"
              size={20}
              aria-hidden="true"
            />
            Street Address
          </h2>

          {/* Address Line 1 */}
          <FormField
            label="Office Address Line 1"
            required
            validationErrors={validationErrors}
            fieldName="officeAddress1"
          >
            <TextInput
              placeholder="123 Main Street, Suite 400"
              value={formData.officeAddress1 || ""}
              onChange={(value) => handleAddressChange("officeAddress1", value)}
              hasError={!!validationErrors.officeAddress1}
              autoComplete="address-line1"
            />
          </FormField>

          {/* Address Line 2 */}
          <FormField
            label="Office Address Line 2"
            validationErrors={validationErrors}
            fieldName="officeAddress2"
          >
            <TextInput
              placeholder="Building B, Floor 3 (optional)"
              value={formData.officeAddress2 || ""}
              onChange={(value) => handleAddressChange("officeAddress2", value)}
              autoComplete="address-line2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Additional address details (optional)
            </p>
          </FormField>
        </section>

        {/* Location Details Section */}
        <section
          className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm space-y-4"
          aria-labelledby="location-details-heading"
        >
          <h2
            id="location-details-heading"
            className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2"
          >
            <MapPin className="text-blue-600" size={20} aria-hidden="true" />
            Location Details
          </h2>

          {/* County Dropdown */}
          <div>
            <LocationDropdown
              label="County"
              value={formData.countyCode || formData.county || ""}
              onChange={handleCountyChange}
              options={availableCounties}
              placeholder="Search for your county"
              required
              disabled={!formData.state}
              loading={countiesLoading}
              error={validationErrors.county}
              noOptionsMessage={
                countiesLoading
                  ? "Loading counties..."
                  : availableCounties.length === 0
                  ? "No counties available"
                  : undefined
              }
            />
            {!formData.state && <StateRequiredAlert />}
          </div>

          {/* City Dropdown */}
          <div>
            <LocationDropdown
              label="City"
              value={formData.cityCode || formData.city || ""}
              onChange={handleCityChange}
              options={availableCities}
              placeholder="Search for your city"
              required
              disabled={!formData.county}
              loading={citiesLoading}
              error={validationErrors.city}
              noOptionsMessage={
                citiesLoading
                  ? "Loading cities..."
                  : availableCities.length === 0
                  ? "No cities available"
                  : undefined
              }
            />
            {formData.state && !formData.county && <CountyRequiredAlert />}
          </div>

          {/* ZIP Code */}
          <FormField
            label="ZIP Code"
            required
            validationErrors={validationErrors}
            fieldName="zipCode"
          >
            <TextInput
              placeholder="12345 or 12345-6789"
              value={formData.zipCode || ""}
              onChange={handleZipChange}
              hasError={!!validationErrors.zipCode}
              autoComplete="postal-code"
            />
            <p className="text-xs text-gray-500 mt-1">
              5-digit ZIP code or ZIP+4 format
            </p>
          </FormField>

          {/* Address Summary */}
          {showAddressSummary && (
            <div
              className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4"
              role="status"
              aria-live="polite"
            >
              <h3 className="text-sm font-semibold text-green-800 mb-2">
                Address Summary
              </h3>
              <address className="text-sm text-green-700 not-italic">
                {formData.officeAddress1}
                {formData.officeAddress2 && <>, {formData.officeAddress2}</>}
                <br />
                {formData.city}, {formData.state} {formData.zipCode}
                {formData.county && (
                  <>
                    <br />
                    County: {formData.county}
                  </>
                )}
              </address>
            </div>
          )}
        </section>

        {/* Continue Button */}
        <div className="pt-6">
          <button
            type="submit"
            className="w-full font-semibold px-8 py-4 rounded-xl shadow-md hover:shadow-lg bg-[#0A2342] text-white hover:bg-[#132c54] transition-all transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Continue to email and password"
          >
            Continue to Email &amp; Password
          </button>
        </div>
      </form>
    </div>
  );
}

export default Step2AddressDetails;
