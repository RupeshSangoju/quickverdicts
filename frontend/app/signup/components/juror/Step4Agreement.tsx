"use client";

import React, { useRef, useCallback, useState, useEffect } from "react";
import type { JurorFormData, ValidationErrors } from "@/types/signup.types";
import {
  FileText,
  CheckCircle2,
  Download,
  Printer,
  AlertCircle,
} from "lucide-react";

/* ===========================================================
   TYPES
   =========================================================== */

interface Step4AgreementProps {
  formData: JurorFormData;
  onUpdate: (data: Partial<JurorFormData>) => void;
  validationErrors: ValidationErrors;
  onClearError: (field: keyof JurorFormData | string) => void;
  hasScrolledToBottom: boolean;
  onScrolledToBottom: (scrolled: boolean) => void;
  onSubmit: () => void;
  loading?: boolean;
  error?: string | null;
}

/* ===========================================================
   CONSTANTS
   =========================================================== */

const AGREEMENT_VERSION = "1.0";
const SCROLL_THRESHOLD = 20;

/* ===========================================================
   UTILITY FUNCTIONS
   =========================================================== */

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Generate printable agreement content
 */
function generateAgreementHTML(jurorName: string): string {
  const date = getFormattedDate();
  const agreementContent =
    typeof window !== "undefined"
      ? document.getElementById("agreement-content")?.innerHTML || ""
      : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Juror User Agreement - QuickVerdicts</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          max-width: 800px; 
          margin: 0 auto; 
          padding: 20px; 
        }
        h1 { color: #0A2342; }
        h2 { color: #0A2342; margin-top: 20px; }
        .header { 
          border-bottom: 2px solid #0A2342; 
          padding-bottom: 10px; 
          margin-bottom: 20px; 
        }
        .footer { 
          border-top: 2px solid #0A2342; 
          padding-top: 10px; 
          margin-top: 20px; 
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Juror User Agreement for QuickVerdicts</h1>
        <p><strong>Effective Date:</strong> ${date}</p>
        <p><strong>Version:</strong> ${AGREEMENT_VERSION}</p>
        <p><strong>Juror:</strong> ${jurorName}</p>
      </div>
      ${agreementContent}
      <div class="footer">
        <p><strong>Accepted on:</strong> ${date}</p>
        <p><strong>Juror Signature:</strong> ${jurorName}</p>
      </div>
    </body>
    </html>
  `;
}

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

export function Step4Agreement({
  formData,
  onUpdate,
  validationErrors,
  onClearError,
  hasScrolledToBottom,
  onScrolledToBottom,
  onSubmit,
  loading = false,
  error,
}: Step4AgreementProps) {
  const agreementRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const scrollCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* ===========================================================
     SCROLL TRACKING
     =========================================================== */

  const handleAgreementScroll = useCallback(() => {
    const element = agreementRef.current;
    if (!element) return;

    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    const maxScroll = scrollHeight - clientHeight;
    const progress =
      maxScroll > 0 ? Math.min(100, Math.round((scrollTop / maxScroll) * 100)) : 100;
    setScrollProgress(progress);

    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceFromBottom <= SCROLL_THRESHOLD;

    if (isAtBottom !== hasScrolledToBottom) {
      onScrolledToBottom(isAtBottom);

      if (isAtBottom && typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "agreement_read_complete", {
          form_type: "juror_signup",
          step: 4,
        });
      }
    }

    if (progress > 20 && showScrollHint) {
      setShowScrollHint(false);
    }
  }, [hasScrolledToBottom, onScrolledToBottom, showScrollHint]);

  const debouncedScrollHandler = useCallback(() => {
    if (scrollCheckTimeoutRef.current !== null) {
      clearTimeout(scrollCheckTimeoutRef.current);
    }

    scrollCheckTimeoutRef.current = setTimeout(() => {
      handleAgreementScroll();
    }, 100);
  }, [handleAgreementScroll]);

  useEffect(() => {
    handleAgreementScroll();
    return () => {
      if (scrollCheckTimeoutRef.current !== null) {
        clearTimeout(scrollCheckTimeoutRef.current);
      }
    };
  }, [handleAgreementScroll]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleAgreementScroll();
    }, 300);

    return () => clearTimeout(timer);
  }, [handleAgreementScroll]);

  /* ===========================================================
     PRINT/DOWNLOAD HANDLERS
     =========================================================== */

  const handlePrint = useCallback(() => {
    const jurorName = formData.personalDetails2?.name?.trim() || "Juror";
    const printWindow = window.open("", "_blank");

    if (printWindow) {
      printWindow.document.write(generateAgreementHTML(jurorName));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);

      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "agreement_printed", {
          form_type: "juror_signup",
          step: 4,
        });
      }
    }
  }, [formData.personalDetails2]);

  const handleDownload = useCallback(() => {
    const jurorName = formData.personalDetails2?.name?.trim() || "Juror";
    const htmlContent = generateAgreementHTML(jurorName);
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `QuickVerdicts-Juror-Agreement-${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "agreement_downloaded", {
        form_type: "juror_signup",
        step: 4,
      });
    }
  }, [formData.personalDetails2]);

  /* ===========================================================
     CHECKBOX HANDLER
     =========================================================== */

  const handleCheckboxChange = useCallback(
    (checked: boolean) => {
      onUpdate({ agreedToTerms: checked });
      onClearError("agreedToTerms");

      if (checked && typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "agreement_accepted", {
          form_type: "juror_signup",
          step: 4,
        });
      }
    },
    [onUpdate, onClearError]
  );

  /* ===========================================================
     RENDER
     =========================================================== */

  const jurorName = formData.personalDetails2?.name?.trim() || "Juror";

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"
            role="img"
            aria-label="User agreement document"
          >
            <FileText className="w-6 h-6 text-[#0A2342]" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#0A2342]">User Agreement</h1>
            <p className="text-gray-600 text-sm">
              Please read and accept the terms to complete your registration
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 flex items-center gap-2 transition-colors"
            aria-label="Print agreement"
          >
            <Printer size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 flex items-center gap-2 transition-colors"
            aria-label="Download agreement"
          >
            <Download size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </header>

      {/* Agreement Container */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
        {/* Agreement Header */}
        <div className="bg-gradient-to-r from-[#0A2342] to-[#132c54] px-6 py-4">
          <h2 className="text-xl font-bold text-white">
            Juror User Agreement for QuickVerdicts
          </h2>
          <div className="text-blue-100 text-sm mt-1 flex flex-wrap gap-4">
            <span>
              <strong>Effective Date:</strong> {getFormattedDate()}
            </span>
            <span>
              <strong>Version:</strong> {AGREEMENT_VERSION}
            </span>
          </div>
        </div>

        {/* Scroll Progress Bar */}
        <div className="h-2 bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
            style={{ width: `${scrollProgress}%` }}
            role="progressbar"
            aria-valuenow={scrollProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Agreement reading progress: ${scrollProgress}%`}
          />
        </div>

        {/* Scrollable Agreement Content */}
        <div
          ref={agreementRef}
          onScroll={debouncedScrollHandler}
          className="max-h-[500px] overflow-y-auto p-8 text-sm text-gray-800 leading-relaxed"
          role="article"
          aria-label="Juror user agreement content"
          tabIndex={0}
        >
          <div id="agreement-content">
            <p className="mb-6">
              Welcome to QuickVerdicts. This Juror User Agreement ("Agreement")
              governs your use of our virtual courtroom platform ("Platform"). By
              registering or using QuickVerdicts as a juror, you ("Juror," "You," or
              "Your") agree to the following terms and conditions.
            </p>

            {/* Section 1 */}
            <section className="mb-6" aria-labelledby="section-1">
              <h3
                id="section-1"
                className="font-bold text-lg text-[#0A2342] mb-3 flex items-center gap-2"
              >
                <span
                  className="bg-[#0A2342] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  aria-hidden="true"
                >
                  1
                </span>
                Eligibility and Verification
              </h3>
              <div className="pl-8 space-y-2 text-gray-700">
                <p>
                  You must meet all eligibility requirements to participate as a
                  juror on QuickVerdicts.
                </p>
                <p>
                  • You agree to provide accurate and current verification
                  information.
                </p>
                <p>
                  • You acknowledge that verification steps may be required before
                  you can access full platform features.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section className="mb-6" aria-labelledby="section-2">
              <h3
                id="section-2"
                className="font-bold text-lg text-[#0A2342] mb-3 flex items-center gap-2"
              >
                <span
                  className="bg-[#0A2342] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  aria-hidden="true"
                >
                  2
                </span>
                Use of the Platform
              </h3>
              <div className="pl-8 space-y-2 text-gray-700">
                <p>
                  You may use QuickVerdicts solely for legitimate jury service and in
                  compliance with all applicable laws and regulations.
                </p>
                <p>• You are responsible for all activity conducted under your account.</p>
                <p>
                  • You agree not to misuse the platform, including attempting
                  unauthorized access, disrupting proceedings, or engaging in
                  inappropriate conduct.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section className="mb-6" aria-labelledby="section-3">
              <h3
                id="section-3"
                className="font-bold text-lg text-[#0A2342] mb-3 flex items-center gap-2"
              >
                <span
                  className="bg-[#0A2342] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  aria-hidden="true"
                >
                  3
                </span>
                Jury Service and Proceedings
              </h3>
              <div className="pl-8 space-y-2 text-gray-700">
                <p>
                  • You acknowledge that virtual jury proceedings may differ from
                  traditional in-person jury service and agree to adapt accordingly.
                </p>
                <p>
                  • You are responsible for maintaining confidentiality of case
                  materials and deliberations as required by law.
                </p>
                <p>
                  • You agree to participate actively and professionally in all
                  assigned proceedings.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section className="mb-6" aria-labelledby="section-4">
              <h3
                id="section-4"
                className="font-bold text-lg text-[#0A2342] mb-3 flex items-center gap-2"
              >
                <span
                  className="bg-[#0A2342] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  aria-hidden="true"
                >
                  4
                </span>
                Professional Conduct and Confidentiality
              </h3>
              <div className="pl-8 space-y-2 text-gray-700">
                <p>
                  • You agree to maintain appropriate standards of conduct at all
                  times while using the Platform.
                </p>
                <p>
                  • You must not discuss cases outside of official proceedings or with
                  unauthorized individuals.
                </p>
                <p>
                  • You are responsible for ensuring your environment is appropriate
                  for jury service (quiet, private, and free from distractions).
                </p>
                <p>
                  • You must not record, screenshot, or share any case materials,
                  testimony, or deliberations without explicit authorization.
                </p>
                <p>
                  • Violations of confidentiality may result in immediate account
                  termination and potential legal consequences.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section className="mb-6" aria-labelledby="section-5">
              <h3
                id="section-5"
                className="font-bold text-lg text-[#0A2342] mb-3 flex items-center gap-2"
              >
                <span
                  className="bg-[#0A2342] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  aria-hidden="true"
                >
                  5
                </span>
                Compensation and Payment
              </h3>
              <div className="pl-8 space-y-2 text-gray-700">
                <p>
                  • QuickVerdicts will provide compensation for jury service as
                  outlined in individual case assignments.
                </p>
                <p>
                  • Payment will be processed through your selected payment method
                  after completion of service.
                </p>
                <p>
                  • You are responsible for any applicable taxes on compensation
                  received.
                </p>
                <p>
                  • Compensation may be withheld if you fail to complete assigned
                  duties or violate this Agreement.
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section className="mb-6" aria-labelledby="section-6">
              <h3
                id="section-6"
                className="font-bold text-lg text-[#0A2342] mb-3 flex items-center gap-2"
              >
                <span
                  className="bg-[#0A2342] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  aria-hidden="true"
                >
                  6
                </span>
                Limitation of Liability
              </h3>
              <div className="pl-8 space-y-2 text-gray-700">
                <p>
                  • QuickVerdicts provides the platform "as is" and does not guarantee
                  specific outcomes.
                </p>
                <p>
                  • QuickVerdicts is not liable for technical failures, delays, or any
                  indirect consequences arising from platform use.
                </p>
                <p>
                  • Your participation is voluntary and you acknowledge the inherent
                  responsibilities of jury service.
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section className="mb-6" aria-labelledby="section-7">
              <h3
                id="section-7"
                className="font-bold text-lg text-[#0A2342] mb-3 flex items-center gap-2"
              >
                <span
                  className="bg-[#0A2342] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  aria-hidden="true"
                >
                  7
                </span>
                Account Termination
              </h3>
              <div className="pl-8 space-y-2 text-gray-700">
                <p>
                  • QuickVerdicts reserves the right to suspend or terminate your
                  access for violations of this Agreement.
                </p>
                <p>
                  • You may deactivate your account at any time by contacting support,
                  subject to completion of any ongoing case assignments.
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section className="mb-6" aria-labelledby="section-8">
              <h3
                id="section-8"
                className="font-bold text-lg text-[#0A2342] mb-3 flex items-center gap-2"
              >
                <span
                  className="bg-[#0A2342] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  aria-hidden="true"
                >
                  8
                </span>
                Updates to Agreement
              </h3>
              <div className="pl-8 space-y-2 text-gray-700">
                <p>
                  • QuickVerdicts may modify this Agreement at any time with notice to
                  users.
                </p>
                <p>• Continued use after changes constitutes acceptance of updated terms.</p>
              </div>
            </section>

            {/* Section 9 */}
            <section className="mb-6" aria-labelledby="section-9">
              <h3
                id="section-9"
                className="font-bold text-lg text-[#0A2342] mb-3 flex items-center gap-2"
              >
                <span
                  className="bg-[#0A2342] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  aria-hidden="true"
                >
                  9
                </span>
                Governing Law
              </h3>
              <div className="pl-8 space-y-2 text-gray-700">
                <p>
                  This Agreement shall be governed by the laws of the State of Texas.
                </p>
              </div>
            </section>

            {/* Section 10 */}
            <section className="mb-4" aria-labelledby="section-10">
              <h3
                id="section-10"
                className="font-bold text-lg text-[#0A2342] mb-3 flex items-center gap-2"
              >
                <span
                  className="bg-[#0A2342] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  aria-hidden="true"
                >
                  10
                </span>
                Contact Information
              </h3>
              <div className="pl-8 space-y-2 text-gray-700">
                <p>
                  For questions or support, please contact us at{" "}
                  <strong>support@quickverdicts.com</strong>.
                </p>
              </div>
            </section>

            {/* End Marker */}
            <div className="mt-8 pt-6 border-t-2 border-gray-200 text-center text-gray-500">
              <p className="text-sm">— End of Agreement —</p>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        {!hasScrolledToBottom && showScrollHint && (
          <div
            className="px-6 py-3 bg-yellow-50 border-t-2 border-yellow-200 flex items-center gap-3"
            role="alert"
            aria-live="polite"
          >
            <svg
              className="animate-bounce w-5 h-5 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            <p className="text-sm text-yellow-800 font-medium">
              Please scroll to the bottom to read the complete agreement (
              {scrollProgress}% read)
            </p>
          </div>
        )}

        {/* Completion Indicator */}
        {hasScrolledToBottom && (
          <div
            className="px-6 py-3 bg-green-50 border-t-2 border-green-200 flex items-center gap-3"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden="true" />
            <p className="text-sm text-green-800 font-medium">
              ✓ You've read the complete agreement. You may now accept the terms
              below.
            </p>
          </div>
        )}
      </div>

      {/* Scroll Validation Error */}
      {validationErrors.scroll && (
        <div className="mt-3 flex items-center gap-2 text-red-500 text-sm" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{validationErrors.scroll}</span>
        </div>
      )}

      {/* Acceptance Checkbox */}
      <div className="mt-6">
        <label
          className={`flex items-start gap-4 p-6 bg-white rounded-xl border-2 transition-all ${
            hasScrolledToBottom
              ? "border-gray-200 hover:border-[#0A2342] cursor-pointer"
              : "border-gray-200 cursor-not-allowed opacity-60"
          }`}
          htmlFor="agreement-checkbox"
        >
          <input
            id="agreement-checkbox"
            type="checkbox"
            className="sr-only"
            checked={formData.agreedToTerms || false}
            disabled={!hasScrolledToBottom}
            onChange={(e) => handleCheckboxChange(e.target.checked)}
            aria-describedby="agreement-checkbox-description"
            aria-invalid={!!validationErrors.agreedToTerms}
          />
          <div
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              formData.agreedToTerms
                ? "bg-[#0A2342] border-[#0A2342]"
                : "bg-white border-gray-300"
            }`}
            aria-hidden="true"
          >
            {formData.agreedToTerms && (
              <CheckCircle2 size={16} className="text-white" />
            )}
          </div>
          <div>
            <span
              id="agreement-checkbox-description"
              className={`font-medium ${
                !hasScrolledToBottom ? "text-gray-400" : "text-gray-700"
              }`}
            >
              I have read and agree to the Juror User Agreement for QuickVerdicts{" "}
              <span className="text-red-500" aria-label="required">
                *
              </span>
            </span>
            {!hasScrolledToBottom && (
              <p className="text-sm text-gray-500 mt-1">
                📜 Please scroll to the bottom of the agreement first
              </p>
            )}
          </div>
        </label>

        {validationErrors.agreedToTerms && (
          <p className="text-red-500 text-sm mt-2 flex items-center gap-1" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            {validationErrors.agreedToTerms}
          </p>
        )}
      </div>

      {/* General Error */}
      {error && (
        <div
          className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mt-4 flex items-start gap-3"
          role="alert"
        >
          <div className="bg-red-100 rounded-full p-2 flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
          </div>
          <p className="text-red-700 text-sm font-medium flex-1">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-6">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!hasScrolledToBottom || !formData.agreedToTerms || loading}
          className={`w-full font-semibold px-8 py-4 rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
            hasScrolledToBottom && formData.agreedToTerms && !loading
              ? "bg-[#0A2342] text-white hover:bg-[#132c54] hover:shadow-lg transform hover:scale-[1.02]"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          aria-label="Agree to terms and create account"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Creating Your Account...</span>
            </span>
          ) : (
            "Agree and Create Account"
          )}
        </button>
      </div>
    </div>
  );
}

export default Step4Agreement;
