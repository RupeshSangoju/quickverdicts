"use client";

import React, { useRef, useCallback, useState, useEffect } from "react";
import type {
  AttorneyFormData,
  ValidationErrors,
} from "@/types/signup.types";
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
  formData: AttorneyFormData;
  onUpdate: (data: Partial<AttorneyFormData>) => void;
  validationErrors: ValidationErrors;
  onClearError: (field: keyof AttorneyFormData) => void;
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

function generateAgreementHTML(attorneyName: string): string {
  const date = getFormattedDate();
  const content = document.getElementById("agreement-content")?.innerHTML || "";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Attorney User Agreement - QuickVerdicts</title>
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
        <h1>Attorney User Agreement for QuickVerdicts</h1>
        <p><strong>Effective Date:</strong> ${date}</p>
        <p><strong>Version:</strong> ${AGREEMENT_VERSION}</p>
        <p><strong>Attorney:</strong> ${attorneyName}</p>
      </div>
      ${content}
      <div class="footer">
        <p><strong>Accepted on:</strong> ${date}</p>
        <p><strong>Attorney Signature:</strong> ${attorneyName}</p>
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
     DEBUG LOGGING
     =========================================================== */

  useEffect(() => {
    console.log("📋 Step4Agreement State:", {
      hasScrolledToBottom,
      agreedToTerms: formData.agreedToTerms,
      loading,
      canSubmit: hasScrolledToBottom && formData.agreedToTerms && !loading,
    });
  }, [hasScrolledToBottom, formData.agreedToTerms, loading]);

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
      console.log(`📜 Scroll to bottom: ${isAtBottom}`);
      onScrolledToBottom(isAtBottom);

      if (isAtBottom && typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "agreement_read_complete", {
          form_type: "attorney_signup",
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
     PRINT & DOWNLOAD
     =========================================================== */

  const handlePrint = useCallback(() => {
    const attorneyName = `${formData.firstName} ${formData.lastName}`.trim();
    const printWindow = window.open("", "_blank");

    if (printWindow) {
      printWindow.document.write(generateAgreementHTML(attorneyName));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);

      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "agreement_printed", {
          form_type: "attorney_signup",
          step: 4,
        });
      }
    }
  }, [formData.firstName, formData.lastName]);

  const handleDownload = useCallback(() => {
    const attorneyName = `${formData.firstName} ${formData.lastName}`.trim();
    const htmlContent = generateAgreementHTML(attorneyName);
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `QuickVerdicts-Agreement-${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "agreement_downloaded", {
        form_type: "attorney_signup",
        step: 4,
      });
    }
  }, [formData.firstName, formData.lastName]);

  /* ===========================================================
     CHECKBOX HANDLER
     =========================================================== */

  const handleCheckboxChange = useCallback(
    (checked: boolean) => {
      console.log(`✅ Checkbox changed: ${checked}`);
      onUpdate({ agreedToTerms: checked });
      onClearError("agreedToTerms");

      if (checked && typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "agreement_accepted", {
          form_type: "attorney_signup",
          step: 4,
        });
      }
    },
    [onUpdate, onClearError]
  );

  /* ===========================================================
     SUBMIT HANDLER
     =========================================================== */

  const handleSubmit = useCallback(() => {
    console.log("🚀 Submit button clicked");
    console.log("State:", {
      hasScrolledToBottom,
      agreedToTerms: formData.agreedToTerms,
      loading,
    });

    if (!hasScrolledToBottom) {
      console.warn("⚠️ Not scrolled to bottom");
      return;
    }

    if (!formData.agreedToTerms) {
      console.warn("⚠️ Terms not agreed");
      return;
    }

    if (loading) {
      console.warn("⚠️ Already loading");
      return;
    }

    console.log("✅ All checks passed, calling onSubmit");
    onSubmit();
  }, [hasScrolledToBottom, formData.agreedToTerms, loading, onSubmit]);

  /* ===========================================================
     RENDER
     =========================================================== */

  const attorneyName = `${formData.firstName} ${formData.lastName}`.trim();
  const canSubmit = hasScrolledToBottom && formData.agreedToTerms && !loading;

  console.log("🎨 Rendering - canSubmit:", canSubmit);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"
            role="img"
            aria-label="User agreement document"
          >
            <FileText className="w-6 h-6 text-[#0A2342]" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#0A2342]">
              User Agreement
            </h1>
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
      </div>

      {/* Agreement Box */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
        {/* Gradient Header */}
        <div className="bg-gradient-to-r from-[#0A2342] to-[#132c54] px-6 py-4">
          <h2 className="text-xl font-bold text-white">
            Attorney User Agreement for QuickVerdicts
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

        {/* Scroll Progress */}
        <div className="h-2 bg-gray-200">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
            style={{ width: `${scrollProgress}%` }}
            role="progressbar"
            aria-valuenow={scrollProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Agreement read progress: ${scrollProgress}%`}
          />
        </div>

        {/* Agreement Scrollable Content */}
        <div
          ref={agreementRef}
          onScroll={debouncedScrollHandler}
          className="max-h-[500px] overflow-y-auto p-8 text-sm text-gray-800 leading-relaxed"
          role="article"
          aria-label="Attorney user agreement content"
          tabIndex={0}
        >
          <div id="agreement-content">
            <p className="mb-4">
              This Attorney User Agreement ("Agreement") is entered into between QuickVerdicts ("Platform", "we", "us") and you ("Attorney", "you") as of the date of your electronic acceptance.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              1. Acceptance of Terms
            </h3>
            <p className="mb-4">
              By creating an attorney account on QuickVerdicts, you acknowledge that you have read, understood, and agree to be bound by this Agreement and all applicable laws and regulations.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              2. Attorney Eligibility
            </h3>
            <p className="mb-4">
              You represent and warrant that:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>You are a licensed attorney in good standing in at least one U.S. jurisdiction</li>
              <li>Your bar license is current and has not been suspended or revoked</li>
              <li>You have the authority to represent clients in small claims matters</li>
              <li>All information provided during registration is accurate and complete</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              3. Platform Services
            </h3>
            <p className="mb-4">
              QuickVerdicts provides a virtual platform for small claims dispute resolution. As an attorney user, you may:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Create and manage case filings on behalf of clients</li>
              <li>Participate in virtual trials before online juror panels</li>
              <li>Submit evidence and documentation electronically</li>
              <li>Communicate with jurors through the platform's messaging system</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              4. Professional Conduct
            </h3>
            <p className="mb-4">
              You agree to:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Maintain the highest standards of professional ethics</li>
              <li>Comply with all applicable bar rules and regulations</li>
              <li>Treat all platform users with respect and professionalism</li>
              <li>Not engage in any fraudulent, misleading, or deceptive practices</li>
              <li>Protect client confidentiality and attorney-client privilege</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              5. Fees and Payment
            </h3>
            <p className="mb-4">
              Attorney fees and platform usage fees are as follows:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Platform filing fees are outlined in our Fee Schedule</li>
              <li>You are responsible for collecting your own attorney fees from clients</li>
              <li>The Platform does not mediate fee disputes between attorneys and clients</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              6. Intellectual Property
            </h3>
            <p className="mb-4">
              All content, trademarks, and materials on the Platform are owned by QuickVerdicts. You may not reproduce, distribute, or create derivative works without express written permission.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              7. Data Privacy and Security
            </h3>
            <p className="mb-4">
              We take data security seriously. However, you acknowledge that:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>No online platform can guarantee 100% security</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials</li>
              <li>You must use reasonable security measures when accessing the platform</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              8. Limitation of Liability
            </h3>
            <p className="mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, QUICKVERDICTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              9. Termination
            </h3>
            <p className="mb-4">
              We reserve the right to terminate or suspend your account at any time for violation of this Agreement, misconduct, or any other reason at our sole discretion.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              10. Governing Law
            </h3>
            <p className="mb-4">
              This Agreement shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law provisions.
            </p>

            <div className="mt-8 p-4 bg-gray-100 rounded-lg border-2 border-gray-300">
              <p className="text-center font-bold text-[#0A2342]">
                END OF AGREEMENT
              </p>
              <p className="text-center text-sm text-gray-600 mt-2">
                By accepting this agreement, you acknowledge that you have read and understood all terms and conditions.
              </p>
            </div>
          </div>
        </div>

        {/* Scroll Hints & Completion */}
        {!hasScrolledToBottom && showScrollHint && (
          <div
            className="px-6 py-3 bg-yellow-50 border-t-2 border-yellow-200 flex items-center gap-3"
            role="alert"
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
              {scrollProgress}% complete)
            </p>
          </div>
        )}

        {hasScrolledToBottom && (
          <div
            className="px-6 py-3 bg-green-50 border-t-2 border-green-200 flex items-center gap-3"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2
              className="w-5 h-5 text-green-600"
              aria-hidden="true"
            />
            <p className="text-sm text-green-800 font-medium">
              ✓ You've read the complete agreement. You may now accept the terms
              below.
            </p>
          </div>
        )}
      </div>

      {/* Validation & Error Messages */}
      {validationErrors.scroll && (
        <div
          className="mt-3 flex items-center gap-2 text-red-500 text-sm"
          role="alert"
        >
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
              I have read and agree to the Attorney User Agreement for
              QuickVerdicts <span className="text-red-500">*</span>
            </span>
            {!hasScrolledToBottom && (
              <p className="text-sm text-gray-500 mt-1">
                📜 Please scroll to the bottom of the agreement first
              </p>
            )}
          </div>
        </label>

        {validationErrors.agreedToTerms && (
          <p
            className="text-red-500 text-sm mt-2 flex items-center gap-1"
            role="alert"
          >
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
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full font-semibold px-8 py-4 rounded-xl transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 ${
            canSubmit
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
