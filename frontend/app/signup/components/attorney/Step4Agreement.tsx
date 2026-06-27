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

    if (isAtBottom && !hasScrolledToBottom) {
      console.log(`📜 Scroll to bottom: true`);
      onScrolledToBottom(true);

      if (typeof window !== "undefined" && (window as any).gtag) {
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
    const date = getFormattedDate();

    import("jspdf").then(({ jsPDF }) => {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 50;
      const maxW = pageW - margin * 2;
      let y = margin;

      const addText = (text: string, size: number, bold: boolean, color: [number, number, number] = [0, 0, 0], extra = 0) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, maxW);
        lines.forEach((line: string) => {
          if (y + size + 4 > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += size + 4;
        });
        y += extra;
      };

      const addBullet = (text: string) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        const lines = doc.splitTextToSize(text, maxW - 16);
        lines.forEach((line: string, i: number) => {
          if (y + 14 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
          doc.text(i === 0 ? "•" : " ", margin + 2, y);
          doc.text(line, margin + 16, y);
          y += 14;
        });
      };

      // Header bar
      doc.setFillColor(10, 35, 66);
      doc.rect(0, 0, pageW, 60, "F");
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Attorney User Agreement for QuickVerdicts", margin, 38);
      y = 80;

      addText(`Effective Date: ${date}`, 10, false, [80, 80, 80]);
      addText(`Version: ${AGREEMENT_VERSION}`, 10, false, [80, 80, 80]);
      addText(`Attorney: ${attorneyName}`, 10, false, [80, 80, 80], 10);

      doc.setDrawColor(10, 35, 66);
      doc.setLineWidth(1);
      doc.line(margin, y, pageW - margin, y);
      y += 16;

      addText("This Attorney User Agreement (\"Agreement\") is entered into between QuickVerdicts (\"Platform\", \"we\", \"us\") and you (\"Attorney\", \"you\") as of the date of your electronic acceptance.", 10, false, [0, 0, 0], 10);

      const sections: { title: string; body?: string; bullets?: string[] }[] = [
        { title: "1. Acceptance of Terms", body: "By creating an attorney account on QuickVerdicts, you acknowledge that you have read, understood, and agree to be bound by this Agreement and all applicable laws and regulations." },
        { title: "2. Attorney Eligibility", body: "You represent and warrant that:", bullets: ["You are a licensed attorney in good standing in at least one U.S. jurisdiction", "Your bar license is current and has not been suspended or revoked", "You have the authority to represent clients in small claims matters", "All information provided during registration is accurate and complete"] },
        { title: "3. Platform Services", body: "QuickVerdicts provides a virtual platform for small claims dispute resolution. As an attorney user, you may:", bullets: ["Create and manage case filings on behalf of clients", "Participate in virtual trials before online juror panels", "Submit evidence and documentation electronically", "Communicate with jurors through the platform's messaging system"] },
        { title: "4. Professional Conduct", body: "You agree to:", bullets: ["Maintain the highest standards of professional ethics", "Comply with all applicable bar rules and regulations", "Treat all platform users with respect and professionalism", "Not engage in any fraudulent, misleading, or deceptive practices", "Protect client confidentiality and attorney-client privilege"] },
        { title: "5. Fees and Payment", body: "Attorney fees and platform usage fees are as follows:", bullets: ["Platform filing fees are outlined in our Fee Schedule", "You are responsible for collecting your own attorney fees from clients", "The Platform does not mediate fee disputes between attorneys and clients"] },
        { title: "6. Intellectual Property", body: "All content, trademarks, and materials on the Platform are owned by QuickVerdicts. You may not reproduce, distribute, or create derivative works without express written permission." },
        { title: "7. Data Privacy and Security", body: "We take data security seriously. However, you acknowledge that:", bullets: ["No online platform can guarantee 100% security", "You are responsible for maintaining the confidentiality of your login credentials", "You must use reasonable security measures when accessing the platform"] },
        { title: "8. Limitation of Liability", body: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, QUICKVERDICTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM." },
        { title: "9. Termination", body: "We reserve the right to terminate or suspend your account at any time for violation of this Agreement, misconduct, or any other reason at our sole discretion." },
        { title: "10. Governing Law", body: "This Agreement shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law provisions." },
      ];

      sections.forEach(({ title, body, bullets }) => {
        addText(title, 12, true, [10, 35, 66], 4);
        if (body) addText(body, 10, false, [0, 0, 0], bullets ? 4 : 10);
        if (bullets) { bullets.forEach(addBullet); y += 10; }
      });

      // Footer
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, maxW, 50, "F");
      y += 14;
      addText("END OF AGREEMENT", 11, true, [10, 35, 66]);
      addText(`Accepted on: ${date}`, 10, false, [80, 80, 80]);
      addText(`Attorney Signature: ${attorneyName}`, 10, false, [80, 80, 80]);

      doc.save(`QuickVerdicts-Attorney-Agreement-${Date.now()}.pdf`);
    });

    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "agreement_downloaded", { form_type: "attorney_signup", step: 4 });
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
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 flex items-center gap-2 transition-colors cursor-pointer"
            aria-label="Print agreement"
          >
            <Printer size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 flex items-center gap-2 transition-colors cursor-pointer"
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
            <p className="mb-4 font-semibold">
              Effective Date: Date of Registration
            </p>
            <p className="mb-4">
              Welcome to Adaki, LLC d/b/a Quick Verdicts ("Quick Verdicts"). This Attorney User Agreement ("Agreement") governs your use of Quick Verdicts' online virtual trial preparation and courtroom platform ("Platform"). By registering or using Quick Verdicts as an Attorney, you ("Attorney," "You," or "Your") agree to the following terms and conditions.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              1. Eligibility and Verification
            </h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>You must be a licensed attorney in good standing with the relevant state bar applicable to the jurisdiction of the case(s) to participate on the Platform.</li>
              <li>You agree to provide accurate and current verification information, including your bar license number and jurisdiction.</li>
              <li>Only you and your assistant or paralegal may have access to the War Room. Your assistant or paralegal may have access to the War Room through use of your unique login information.</li>
              <li>Your assistant or paralegal who has access to the Quick Verdicts platform is under your direction, control and supervision.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              2. Use of the Platform
            </h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>You may use Quick Verdicts solely for legitimate legal proceedings and on behalf of a claim or lawsuit in which you represent one of the parties and in compliance with all applicable laws, court rules governing privileged work product and/or summary or advisory jury trials, and ethical obligations.</li>
              <li>Your work on and through Quick Verdicts is treated as protected privileged work product under state and federal rules.</li>
              <li>You are responsible for all activity conducted under your account, including compliance with this Agreement and any Platform guidelines.</li>
              <li>You agree not to misuse the Platform, including, but not limited to, attempting unauthorized access and making false statements of fact.</li>
              <li>Your use of the Platform constitutes your retention of Quick Verdicts as a litigation support service. You and Quick Verdicts understand that all data concerning the Platform, including, but not limited to, preparation materials, juror feedback and the Final Verdict is privileged and confidential.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              3. Obligations of Quick Verdicts
            </h3>
            <p className="mb-4">
              Quick Verdicts agrees to permit Attorney access to a War Room for a period of time to prepare materials for a trial presentation of a pending claim or lawsuit. Quick Verdicts agrees to provide 6 – 8 mock jurors to appear online on the platform for a specified period to view case materials, attend a trial presentation and provide a deliberated Final Verdict. Quick Verdicts will make reasonable attempts to locate mock jurors who reside in the county, state and/or federal district of the applicable venue. If Quick Verdicts is unable to locate 6 – 8 mock jurors within the venue and schedule a trial within sixty (60) days of the request for a trial date, then Quick Verdicts will refund the fee paid for the case. Quick Verdicts agrees to provide its online QV Courtroom conference center for the presentation of the trial, mock jury deliberations resulting in a Final Verdict and a debriefing period between the attorneys and the mock jurors. Quick Verdicts agrees to provide Attorney a video recording of the deliberations and the mock jurors' opinions on the credibility of selected witnesses.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              4. Obligations of Attorneys
            </h3>
            <p className="mb-4">
              Attorney agrees to follow all instructions for case submission as set forth on this site, and to pay Quick Verdicts the prices outlined on the current price list for the applicable tier selected before access to the War Room is provided.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              5. Intellectual Property and Proprietary Rights
            </h3>
            <p className="mb-4">
              Attorney agrees that the information on this Platform, including the process by which it functions as a service to attorneys or others, is proprietary in nature. Attorney acknowledges that certain information on this Site is protected by copyright(s) and trademark(s). Attorney will not publish, post, distribute, disseminate or otherwise utilize any proprietary information on this Platform for financial gain without express authorization of Quick Verdicts.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              6. Contact with Mock Jurors prohibited
            </h3>
            <p className="mb-4">
              Attorney understands and agrees that the contact information of persons serving as Mock Jurors are confidential and that contact information of Mock Jurors shall not be provided. Attorney agrees not to take any action to contact any Mock Juror.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              7. Attorney Responsibility for Client Consent
            </h3>
            <p className="mb-4">
              Attorney represents that:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Attorney has authority to disclose all materials uploaded;</li>
              <li>Attorney has obtained any necessary client consents;</li>
              <li>Attorney has complied with court orders and protective orders;</li>
              <li>Attorney has independently determined that use of the Platform complies with applicable ethical rules.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              8. Case Management and Proceedings
            </h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>You acknowledge that virtual proceedings differ from traditional in-person court appearances and agree to adapt accordingly to ensure a fair and professional process.</li>
              <li>You are responsible for uploading, managing, and presenting case materials securely and in accordance with applicable confidentiality requirements.</li>
              <li>You agree to respect all deadlines, schedules, and platform instructions issued for cases handled via Quick Verdicts.</li>
              <li>You agree to advise Quick Verdicts at the time that you request a trial date of any information that is likely to be considered offensive by the local community, including, but not limited to, representations of serious bodily injuries or death.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              9. Confidentiality, Data Security and Conflicts
            </h3>
            <p className="mb-4">
              Attorney acknowledges that no electronic system is completely secure and that Quick Verdicts does not warrant that the Platform will be free from:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>unauthorized access;</li>
              <li>hacking;</li>
              <li>malware;</li>
              <li>interception;</li>
              <li>data loss;</li>
              <li>security breaches.</li>
            </ul>
            <p className="mb-4">
              Attorney assumes the risks inherent in transmitting information electronically.
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>For demonstrative aids uploaded in the War Room, Quick Verdicts allows jurors to access and view the demonstrative aids from their Case Information within their dashboards. Jurors are warned not to take screen shots or download demonstrative aids. Quick Verdicts has taken steps to prevent jurors downloading demonstrative aids. However Quick Verdicts cannot guarantee that jurors will not download or take screen shots of demonstrative aids.</li>
              <li>Cases are deleted three (3) business days after the conclusion of the mock trial.</li>
              <li>Case locks are automatically applied to each case according to the names of the litigants provided by Attorney in an effort to prevent conflicts of interest. Attorney understands that should Attorney use pseudonyms for litigants, Quick Verdicts is not able to conduct a meaningful conflicts check.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              10. Fees and Payment
            </h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Quick Verdicts requires payment at the time a case is scheduled. Payments are placed on hold until a case is scheduled for trial and Quick Verdicts has concluded its conflicts check.</li>
              <li>Payment terms for any applicable fees will be outlined separately and must be adhered to in order to maintain active use of the platform.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              11. Protecting the Opinions of Mock Jurors from Discovery by Opposing Attorneys
            </h3>
            <p className="mb-4">
              Attorney acknowledges that Attorney has asked Quick Verdicts and the Mock Jurors participating on this Platform to act as "consultants" for Attorney, by providing information, including opinions, answers, comments, and/or suggestions. Attorney further acknowledges that although Quick Verdicts and the Mock Jurors are functioning as "consultants," they are not employees of the Attorney. Quick Verdicts and Attorney agree that the factual statements contained within cases on this Platform are not to be construed as admissions, as they are experimental statements from various perspectives intended only to test the perception of the Mock Jurors participating on the Platform.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              12. INDEMNIFICATION AND HOLD HARMLESS
            </h3>
            <p className="mb-4">
              QUICK VERDICTS WILL TAKE REASONABLE STEPS TO ENSURE THAT INFORMATION SUBMITTED BY ATTORNEY AND POSTED TO THIS PLATFORM IS ACCESSED ONLY BY APPROPRIATE PERSONS. ATTORNEY ACKNOWLEDGES, HOWEVER, THAT UNAUTHORIZED OR INAPPROPRIATE ACCESS TO THIS PLATFORM IS ALWAYS A POSSIBILITY, DESPITE PRECAUTIONS. ATTORNEY AGREES TO RELEASE AND HOLD HARMLESS QUICK VERDICTS, ITS EMPLOYEES, AGENTS, AND ALL REGISTERED MOCK JURORS FROM ALL LIABILITY, RESPONSIBILITY, OR DAMAGE WHICH MAY OCCUR FROM UNAUTHORIZED OR INAPPROPRIATE ACCESS TO THIS PLATFORM AND/OR THE INFORMATION SUBMITTED BY ATTORNEY.
            </p>
            <p className="mb-4">
              ATTORNEY AGREES TO DEFEND, INDEMNIFY AND HOLD HARMLESS ADAKI, LLC D/B/A QUICK VERDICTS AND ITS OWNERS, EMPLOYEES, AGENTS, AFFILIATES, CONTRACTORS, AND MOCK JURORS FROM AND AGAINST ANY CLAIMS, ACTIONS, LIABILITIES, LOSSES, DAMAGES, COSTS, OR EXPENSES, INCLUDING ATTORNEYS' FEES, ARISING FROM:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>(A) MATERIALS UPLOADED OR PRESENTED BY ATTORNEY;</li>
              <li>(B) ATTORNEY'S VIOLATION OF LAW OR ETHICAL OBLIGATIONS;</li>
              <li>(C) ALLEGATIONS THAT UPLOADED MATERIALS INFRINGE INTELLECTUAL PROPERTY RIGHTS OR PRIVACY RIGHTS;</li>
              <li>(D) ATTORNEY'S FAILURE TO REDACT PROTECTED INFORMATION;</li>
              <li>(E) ATTORNEY'S INTERACTIONS WITH MOCK JURORS;</li>
              <li>(F) ATTORNEY'S MISUSE OF THE PLATFORM.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              13. No Guaranteed Results
            </h3>
            <p className="mb-4">
              Attorney understands and acknowledges that Quick Verdicts has not guaranteed, warranted, or represented that the Final Verdicts returned via this Platform will be the same or a similar result that Attorney achieves at trial. Although Quick Verdicts provides opinions from local Mock Jurors, results at trial may be substantially different.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              14. Complete Agreement
            </h3>
            <p className="mb-4">
              This Agreement represents the complete agreement between Quick Verdicts and Attorney with respect to the subject matter stated herein, and supersedes any other written or oral agreements. Attorney understands and agrees that Quick Verdicts may amend or modify these Terms and Conditions at any time. Attorney's continued participation by submitting cases to Quick Verdicts shall be deemed to constitute acceptance by Attorney of the then current Terms and Conditions (including any amendments, modifications, or new conditions) as published on the Platform.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              15. LIMITATION OF LIABILITY AND DISCLAIMER OF WARRANTIES
            </h3>
            <p className="mb-4">
              QUICK VERDICTS PROVIDES THE PLATFORM "AS IS" "AS AVAILABLE," AND WITH ALL FAULTS AND DOES NOT GUARANTEE OUTCOMES OR CASE RESULTS. QUICK VERDICTS DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING: MERCHANTABILITY; FITNESS FOR A PARTICULAR PURPOSE; NON-INFRINGEMENT; UNINTERRUPTED SERVICE; ACCURACY OF JUROR RESPONSES; REPRESENTATIVENESS OF JUROR DEMOGRAPHICS; AVAILABILITY OF MOCK JURORS; SECURITY FROM HACKING OR UNAUTHORIZED ACCESS; COMPATIBILITY WITH ATTORNEY HARDWARE OR SOFTWARE.
            </p>
            <p className="mb-4">
              QUICK VERDICTS IS NOT LIABLE FOR DELAYS, TECHNICAL FAILURES, OR THE ACTIONS OF OTHERS NOT UNDER THE CONTROL OF QUICK VERDICTS INCLUDING MOCK JURORS.
            </p>
            <p className="mb-4">
              NOTWITHSTANDING ANY OTHER PROVISION OF THIS AGREEMENT, THE PARTIES AGREE THAT, TO THE MAXIMUM EXTENT PERMITTED BY LAW, QUICK VERDICTS, ADAKI, LLC, ITS MEMBERS, MANAGERS, OFFICERS, EMPLOYEES, AGENTS, CONTRACTORS, MOCK JURORS, AFFILIATES, SUCCESSORS, AND ASSIGNS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, LOSS OF BUSINESS OPPORTUNITY, LOSS OF GOODWILL, LOSS OF DATA, OR LOSS OF ATTORNEY WORK PRODUCT, ARISING OUT OF OR RELATING TO THE PLATFORM OR THIS AGREEMENT, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="mb-4">
              IN NO EVENT SHALL QUICK VERDICTS' AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THIS AGREEMENT EXCEED THE TOTAL FEES PAID BY ATTORNEY TO QUICK VERDICTS FOR THE PARTICULAR MOCK TRIAL GIVING RISE TO THE CLAIM.
            </p>
            <p className="mb-4">
              THE FOREGOING LIMITATIONS APPLY REGARDLESS OF THE FORM OF ACTION, WHETHER IN CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE. THIS LIMITATION OF LIABILITY SHALL NOT APPLY TO LIABILITY RESULTING FROM GROSS NEGLIGENCE, WILLFUL MISCONDUCT, OR OBLIGATIONS THAT CANNOT LEGALLY BE WAIVED.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              16. DISCLAIMER OF RESPONSIBILITY FOR MOCK JUROR ACTIONS
            </h3>
            <p className="mb-4">
              Quick Verdicts does not control or guarantee the conduct of mock jurors and is not responsible for: statements made by mock jurors; screenshots or recordings made by mock jurors; juror misconduct; disclosure of case information by jurors; jurors failing to appear; juror technical problems; juror biases or inaccuracies.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              17. Attorney Representations Regarding Case Materials
            </h3>
            <p className="mb-4">
              Attorney expressly warrants that:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Attorney owns or has permission to use all uploaded materials;</li>
              <li>Attorney has authority from the client;</li>
              <li>Materials are lawfully disclosed;</li>
              <li>Protected information has been redacted as required;</li>
              <li>Materials do not violate court orders;</li>
              <li>Materials do not violate HIPAA, privacy laws, or protective orders.</li>
            </ul>
            <p className="mb-4">
              Attorney remains solely responsible for all uploaded content.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              18. QUICK VERDICTS IS NOT A LAW FIRM
            </h3>
            <p className="mb-4">
              Quick Verdicts is not:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>a law firm;</li>
              <li>a legal referral service;</li>
              <li>a provider of legal advice;</li>
              <li>a fiduciary;</li>
              <li>an expert witness;</li>
              <li>a party to the attorney-client relationship.</li>
            </ul>
            <p className="mb-4">
              Attorney remains solely responsible for:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>legal strategy;</li>
              <li>compliance with ethics rules;</li>
              <li>protecting privileged information;</li>
              <li>client communications;</li>
              <li>settlement decisions;</li>
              <li>trial strategy.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              19. Force Majeure
            </h3>
            <p className="mb-4">
              Quick Verdicts is not be liable for delays or failures beyond its control, including those caused by: internet outages; cloud service failures; power failures; cyberattacks; governmental action; natural disasters; labor disputes; acts of war or terrorism.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              20. Assumption of Risk
            </h3>
            <p className="mb-4">
              Attorney acknowledges and assumes the risk that:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>mock juror opinions may be inaccurate;</li>
              <li>mock jurors may not reflect actual juries;</li>
              <li>technology failures may occur;</li>
              <li>uploaded information may be viewed or copied despite safeguards;</li>
              <li>results may differ substantially from actual verdicts;</li>
              <li>demographic matching may be imperfect.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              21. Statute Of Limitations
            </h3>
            <p className="mb-4">
              Any claim arising from or relating to the Platform or this Agreement must be brought within two (2) years after the claim arises, regardless of any longer statute of limitations that might otherwise apply.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              Survival Clause
            </h3>
            <p className="mb-4">
              The following provisions survive termination:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>confidentiality;</li>
              <li>intellectual property;</li>
              <li>indemnification;</li>
              <li>limitation of liability;</li>
              <li>dispute resolution;</li>
              <li>arbitration;</li>
              <li>governing law;</li>
              <li>payment obligations.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              Severability Clause
            </h3>
            <p className="mb-4">
              If any provision is held unenforceable, the remainder of the Agreement remains in effect.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              Entire Agreement / No Reliance Clause
            </h3>
            <p className="mb-4">
              Attorney acknowledges that:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Attorney has not relied upon oral representations;</li>
              <li>Quick Verdicts has made no guarantees regarding results;</li>
              <li>This Agreement constitutes the entire agreement between the parties.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              Dispute Resolution and Mediation
            </h3>
            <p className="mb-4">
              In the event of any dispute, controversy, or claim arising out of or relating to this Agreement, including its formation, performance, or breach, the parties shall first attempt to resolve the matter through direct, good-faith negotiations. If the dispute cannot be settled within twenty-one (21) business days of written notice from one party to the other, the parties agree to submit the dispute to confidential, non-binding mediation before filing any lawsuit or initiating arbitration. The parties shall split the mediator's fees and administrative expenses equally, while each party bears its own legal fees and preparation costs. All communications, offers, and statements made during the mediation process shall be kept strictly confidential and treated as compromise negotiations, inadmissible in any subsequent legal proceedings.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              22. Account Termination
            </h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Quick Verdicts reserves the right to suspend or terminate Your registration and access to the Platform at any time for any reason whatsoever.</li>
              <li>You may terminate your account at any time by contacting QVTrial@quickverdicts.com.</li>
              <li>Quick Verdicts reserves the right to refuse service to any person, party, firm or business entity for any reason.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              23. Updates to the Agreement
            </h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Quick Verdicts may modify this Agreement at any time. Updated terms will be communicated to You, and continued use of the Platform after notice constitutes acceptance of the changes.</li>
              <li>You understand that all data and case materials you upload to www.quickverdicts.com for use with a mock jury will be deleted within 3 business days following the conclusion of the Mock Trial, and You will no longer have access to the case file or War Room case materials. If no trial is requested within eight (8) weeks of Your payment of fees You will receive a 10 day notice by email to download Your War Room case materials before they and Your case file are deleted.</li>
            </ul>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              24. Governing Law
            </h3>
            <p className="mb-4">
              This Agreement shall be governed by the laws of the State of Texas, without regard to conflict of law principles.
            </p>

            <h3 className="text-lg font-bold text-[#0A2342] mt-6 mb-3">
              25. Contact Information
            </h3>
            <p className="mb-4">
              For questions, account issues, or support, please contact us at QVTrial@quickverdicts.com.
            </p>

            <p className="mt-6 mb-4">
              COPYRIGHT © Adaki, LLC 2024-2026. All rights reserved. The Quick Verdicts logo is a trademark of Adaki, LLC.
            </p>

            <div className="mt-8 p-4 bg-gray-100 rounded-lg border-2 border-gray-300">
              <p className="text-center font-bold text-[#0A2342]">
                END OF AGREEMENT
              </p>
              <p className="text-center text-sm text-gray-600 mt-2">
                By clicking "Agree and Create Account", you acknowledge that you have read, understood, and accepted this Attorney User Agreement.
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
              ? "bg-[#0A2342] text-white hover:bg-[#132c54] hover:shadow-lg transform hover:scale-[1.02] cursor-pointer"
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
