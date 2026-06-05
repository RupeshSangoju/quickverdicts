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
      <title>Juror Participation Agreement - Quick Verdicts</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #0A2342; }
        h2, h3 { color: #0A2342; margin-top: 20px; }
        .header { border-bottom: 2px solid #0A2342; padding-bottom: 10px; margin-bottom: 20px; }
        .footer { border-top: 2px solid #0A2342; padding-top: 10px; margin-top: 20px; }
        ul { margin: 8px 0 12px 20px; }
        li { margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Juror Participation Agreement – Quick Verdicts</h1>
        <p><strong>Effective Date:</strong> Date of Registration</p>
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

    if (isAtBottom && !hasScrolledToBottom) {
      onScrolledToBottom(true);

      if (typeof window !== "undefined" && (window as any).gtag) {
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
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "agreement_printed", { form_type: "juror_signup", step: 4 });
      }
    }
  }, [formData.personalDetails2]);

  const handleDownload = useCallback(() => {
    const jurorName = formData.personalDetails2?.name?.trim() || "Juror";
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
        doc.splitTextToSize(text, maxW).forEach((line: string) => {
          if (y + size + 4 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
          doc.text(line, margin, y);
          y += size + 4;
        });
        y += extra;
      };

      const addBullet = (text: string) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.splitTextToSize(text, maxW - 16).forEach((line: string, i: number) => {
          if (y + 14 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
          doc.text(i === 0 ? "•" : " ", margin + 2, y);
          doc.text(line, margin + 16, y);
          y += 14;
        });
      };

      // Header bar
      doc.setFillColor(10, 35, 66);
      doc.rect(0, 0, pageW, 60, "F");
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("Juror Participation Agreement – Quick Verdicts", margin, 38);
      y = 80;

      addText("Effective Date: Date of Registration", 10, false, [80, 80, 80]);
      addText(`Juror: ${jurorName}`, 10, false, [80, 80, 80], 10);

      doc.setDrawColor(10, 35, 66);
      doc.setLineWidth(1);
      doc.line(margin, y, pageW - margin, y);
      y += 16;

      addText(
        "Welcome, and thank you for your interest in serving as a mock juror with Adaki, LLC d/b/a Quick Verdicts (\"Quick Verdicts\"). This Juror Participation Agreement (\"Agreement\") sets out the terms that govern your participation on Quick Verdicts' virtual mock jury platform (the \"Platform\"). By registering to serve as a juror, participating in a session, or accepting compensation for your services, you agree to be bound by this Agreement.",
        10, false, [0, 0, 0], 10
      );

      const sections: { title: string; intro?: string; bullets?: string[]; subsections?: { title: string; body: string }[] }[] = [
        {
          title: "1. Eligibility and Verification",
          intro: "To serve as a juror with Quick Verdicts, you must meet the following eligibility requirements and provide accurate, complete registration information.",
          bullets: [
            "Be at least 18 years old.",
            "Be a legal resident of the United States.",
            "Be legally qualified to vote, whether or not you are registered to vote.",
            "Reside in the county and state identified in your registration.",
            "Have no current legal disqualification from jury service in the applicable county, state, or federal district, including any disqualifying felony conviction or any pending indictment or other qualifying criminal accusation.",
            "Be of sound mind and good moral character.",
            "Be able to read, write, understand, and communicate in English.",
            "Be able to participate in online video conferencing and follow the Platform's procedures.",
            "Not currently work for an insurance company, litigation support company, third-party administrator, claims handling company, litigation funding company, or law firm.",
            "Not have worked for an insurance company, litigation support company, third-party claims administrator, claims handling company, or litigation funding company within the past two (2) years.",
            "Not have worked for a law firm within the past two (2) years.",
            "Not have practiced law as a licensed attorney within the past ten (10) years.",
            "By signing this Agreement and participating as a juror, you represent that the information you provide to Quick Verdicts is accurate and complete.",
          ],
        },
        {
          title: "2. Juror Responsibilities",
          intro: "In exchange for compensation, you agree to perform your role as a mock juror honestly, attentively, and in accordance with Quick Verdicts' procedures.",
          bullets: [
            "Respond truthfully and completely to screening questions and requests for information.",
            "Appear on time for each scheduled session and remain present for the full trial and debriefing period unless excused.",
            "Participate from a private location where other persons cannot overhear the proceedings.",
            "Remain visible on camera for the duration of the session as instructed by Quick Verdicts.",
            "Review the case materials presented during the session, listen carefully to all evidence and testimony, and follow the moderator's instructions.",
            "Deliberate respectfully with fellow jurors and provide your honest feedback, evaluations, and verdict based only on the materials and instructions presented.",
            "Comply with the onboarding requirements communicated by Quick Verdicts, including those described in the Jury Onboarding Video.",
            "Remain impartial and refrain from discussing the case outside the virtual courtroom or debriefing process.",
          ],
        },
        {
          title: "3. Confidentiality",
          intro: "All case materials, trial presentations, recordings, and discussions are confidential and may include attorney work product or other protected information. You must protect the confidentiality of the proceedings at all times. Confidentiality obligations survive completion of the mock trial and termination of participation indefinitely.",
          bullets: [
            "Do not share, discuss, disclose, or post information about the case with any person or on any social media platform unless disclosure is required by law or court order.",
            "Do not record, photograph, copy, or take screenshots of the proceedings or of any materials displayed during the session.",
            "Do not retain, copy, photograph, summarize, transcribe, or preserve any materials and destroy any notes immediately following the session.",
            "Respect the privacy of all participants and preserve the integrity of the mock jury process.",
            "If you are later called to serve as a juror in the same case, you agree to notify the court that you previously participated in a mock trial involving that matter.",
            "Juror acknowledges that all materials, testimony, recordings, discussions, verdicts, evaluations, notes, and communications constitute attorney work product and/or privileged information and agrees not to disclose them under any circumstances except as required by law.",
          ],
        },
        {
          title: "4. Data Privacy and Consent & Disclosure of Contact Information",
          intro: "During a virtual session, your name and image may be visible to attorneys, their staff, and other authorized participants. Quick Verdicts will use reasonable measures to protect your contact information from unauthorized disclosure. To the fullest extent permitted by law, you agree that Quick Verdicts will not be liable for unauthorized disclosure of your contact information that occurs despite those reasonable measures. Juror acknowledges that additional data privacy and consent provisions are contained in the separate Quick Verdicts Privacy Policy and that it is incorporated into This Agreement as though set out herein, verbatim.",
        },
        {
          title: "5. Technology Requirements",
          intro: "You are responsible for having the equipment and environment needed to participate fully in a virtual session.",
          bullets: [
            "A reliable internet connection.",
            "A computer or mobile device with working audio and video capability.",
            "A private, quiet location where you can participate without interruption or distraction.",
            "Prompt notice to Quick Verdicts or its support team if you experience technical issues during a session.",
          ],
        },
        {
          title: "6. Compensation",
          intro: "Compensation is case-specific and is offered in exchange for your full and satisfactory participation in the assigned session.",
          bullets: [
            "To receive payment, you must maintain a valid Zelle, PayPal, or Venmo account and provide any information reasonably needed to process payment, which may include the last four digits of your phone number if required by the payment provider.",
            "You must complete the full session, including the debriefing period, and submit all requested responses, including your final verdict, witness evaluations, and comments, if requested for that case.",
            "The compensation amount for each case will be listed on the applicable Job Board posting.",
            "Quick Verdicts will issue payment after the conclusion of the assigned session and debriefing period, subject to your compliance with this Agreement and the session requirements.",
            "Jurors are independent participants and are not employees, agents, partners, or representatives of Quick Verdicts. Participation in any mock trial does not create an employment relationship, and Jurors are solely responsible for any taxes associated with compensation received.",
            "Juror acknowledges responsibility for reporting compensation received and agrees to provide any tax documentation reasonably required by Quick Verdicts.",
          ],
        },
        {
          title: "7. Recordings, Publicity Release & Intellectual Property Assignment",
          intro: "You understand and agree that your participation in the Quick Verdicts virtual courtroom may be audio recorded, video recorded, or both, and that those recordings may be provided to the attorneys involved after the mock trial. All recordings are the sole property of Quick Verdicts and/or its clients. Juror waives any ownership interest in such recordings and grants a perpetual right to record and use Juror's participation for litigation-support purposes. All verdict forms, comments, evaluations, feedback, opinions, and written submissions become the exclusive property of Quick Verdicts and its clients.",
        },
        {
          title: "8. Code of Conduct",
          intro: "You agree to conduct yourself professionally and to follow all reasonable instructions given by Quick Verdicts, the moderator, or the court facilitator.",
          bullets: [
            "Arrive on time and remain present throughout the session unless excused.",
            "Treat all participants with respect and professionalism.",
            "Maintain only one registration on the Platform.",
            "Promptly update your contact information if your primary residence or other registration information changes.",
            "Follow all session procedures and all reasonable instructions from Quick Verdicts personnel.",
            "Quick Verdicts may remove a juror from a session or terminate a registration for failure to comply with this Agreement, failure to follow instructions, disruptive conduct, failure to answer honestly, technical issues, inattentiveness, violations of confidentiality, suspected conflicts of interest, or other legitimate business or procedural reasons.",
          ],
        },
        {
          title: "9. No Guarantee of Selection",
          intro: "Registration does not guarantee selection for any mock trial or any minimum amount of compensation.",
        },
        {
          title: "10. Conflict Disclosure Requirement",
          intro: "Jurors to disclose prior knowledge of parties, relationships with attorneys involved in the mock trial, prior involvement in the dispute, financial interests in the lawsuit, social media or personal connections to the parties involved in the lawsuit, both before and during participation.",
        },
        {
          title: "11. DISCLAIMER OF WARRANTIES; LIMITATION OF LIABILITY (IMPORTANT—PLEASE READ CAREFULLY)",
          intro: "(a) DISCLAIMER OF WARRANTIES\nTHE PLATFORM, ALL MOCK TRIAL SESSIONS, AND ALL RELATED MATERIALS AND SERVICES ARE PROVIDED \"AS IS\" AND \"AS AVAILABLE,\" WITHOUT ANY WARRANTIES OF ANY KIND.\nTO THE FULLEST EXTENT PERMITTED BY TEXAS LAW, QUICK VERDICTS EXPRESSLY DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY, RELIABILITY, OR COMPLETENESS OF ANY CONTENT OR RESULTS.\n\n(b) LIMITATION OF DAMAGES\nTO THE FULLEST EXTENT PERMITTED BY TEXAS LAW, QUICK VERDICTS WILL NOT BE LIABLE FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THIS AGREEMENT, THE PLATFORM, OR YOUR PARTICIPATION, REGARDLESS OF THE LEGAL THEORY.\n\n(c) EXCLUSION OF CONSEQUENTIAL DAMAGES\nIN NO EVENT SHALL QUICK VERDICTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING LOST INCOME, LOSS OF OPPORTUNITY, REPUTATIONAL HARM, EMOTIONAL DISTRESS, OR LOSS OF DATA.\n\n(d) LIABILITY CAP\nTO THE FULLEST EXTENT PERMITTED BY TEXAS LAW, THE TOTAL AGGREGATE LIABILITY OF QUICK VERDICTS FOR ANY CLAIM ARISING OUT OF OR RELATED TO THIS AGREEMENT WILL NOT EXCEED THE AMOUNT OF COMPENSATION ACTUALLY PAID TO YOU FOR THE SPECIFIC SESSION GIVING RISE TO THE CLAIM. IF NO COMPENSATION WAS PAID, QUICK VERDICTS SHALL HAVE NO LIABILITY.\n\n(e) EXPRESS ACKNOWLEDGMENT\nYOU ACKNOWLEDGE THAT THESE LIMITATIONS ARE A MATERIAL PART OF THIS AGREEMENT, THEY REFLECT A FAIR ALLOCATION OF RISK, AND YOUR PARTICIPATION AND COMPENSATION ARE BASED ON THESE LIMITATIONS.\n\n(f) MAXIMUM ENFORCEABILITY UNDER TEXAS LAW\nTHE LIMITATIONS, DISCLAIMERS, AND EXCLUSIONS IN THIS SECTION ARE INTENDED TO BE ENFORCED TO THE MAXIMUM EXTENT PERMITTED UNDER TEXAS LAW AND WILL SURVIVE TERMINATION OF THIS AGREEMENT.",
        },
        {
          title: "12. INDEMNIFICATION BY JUROR",
          intro: "JUROR AGREES TO INDEMNIFY AND HOLD HARMLESS QUICK VERDICTS FROM LOSSES, DAMAGES, CLAIMS, COSTS, AND ATTORNEY FEES ARISING FROM JUROR'S BREACH OF THIS AGREEMENT, MISREPRESENTATION DURING REGISTRATION, OR UNAUTHORIZED DISCLOSURE OF CONFIDENTIAL INFORMATION.",
        },
        {
          title: "13. Proprietary Information",
          intro: "The Platform, its processes, and related materials are proprietary to Quick Verdicts and may be protected by copyright, trademark, and other applicable laws. You may not publish, post, distribute, reproduce, disclose, or otherwise use proprietary Platform information without Quick Verdicts' prior express authorization.",
        },
        {
          title: "14. Class Action Waiver",
          intro: "Claims against Quick Verdicts must be brought individually and not as part of a class or representative action.",
        },
        {
          title: "15. Arbitration Clause",
          intro: "Disputes between Quick Verdicts and jurors shall be resolved through binding arbitration in Texas.",
        },
        {
          title: "16. Force Majeure",
          intro: "Quick Verdicts will not be liable for any failure or delay in the performance of its obligations under this Agreement if such failure or delay is caused, directly or indirectly, by events or circumstances beyond its reasonable control (\"Force Majeure Event\"), including acts of God, natural disasters, fire, flood, epidemic or pandemic, war, terrorism, governmental orders, power outages, internet or telecommunications failures, cyberattacks, and failures of third-party platforms or service providers.",
          bullets: [
            "Quick Verdicts may suspend, delay, reschedule, modify, or cancel any mock trial session without liability.",
            "Quick Verdicts will have no obligation to provide compensation if a session is canceled, shortened, or materially disrupted due to a Force Majeure Event, except as determined by Quick Verdicts in its sole discretion.",
            "Partial participation caused by a Force Majeure Event will not entitle Juror to full compensation unless Quick Verdicts determines otherwise.",
            "Juror acknowledges that the Platform relies on third-party technology and internet-based systems, and that interruptions or failures of such systems are inherent risks.",
          ],
        },
        {
          title: "17. Changes to This Agreement",
          intro: "Quick Verdicts may revise this Agreement from time to time. Quick Verdicts will provide notice of material changes. Your continued registration or participation after any revision becomes effective constitutes your acceptance of the revised Agreement.",
        },
        {
          title: "18. Consent to Electronic Communications and E-Signatures",
          intro: "Juror consents to receive notices electronically and agrees that electronic acceptance of this Agreement constitutes a legally binding signature.",
        },
        {
          title: "19. AI and Technology Restrictions",
          intro: "Juror may not use artificial intelligence tools, search engines, outside research, or third parties when evaluating a case unless expressly authorized.",
        },
        {
          title: "20. Removal from Registration",
          intro: "You may end your registration and participation with Quick Verdicts by sending notice by email to QVTrial@quickverdicts.com.",
        },
        {
          title: "21. Suspension for Fraud or Misrepresentation",
          intro: "Quick Verdicts may immediately terminate participation of Juror if it believes a juror has misrepresented qualifications, used another person's identity, participated multiple times under different accounts, or used AI or outside assistance when responding.",
        },
        {
          title: "22. Governing Law and Venue",
          intro: "This Agreement is governed by the laws of the State of Texas. Exclusive venue for disputes shall be Dallas County, Texas.",
        },
        {
          title: "23. Contact Information",
          intro: "For questions, technical issues, or support, please contact Quick Verdicts at QVTrial@quickverdicts.com.",
        },
      ];

      sections.forEach(({ title, intro, bullets }) => {
        addText(title, 12, true, [10, 35, 66], 4);
        if (intro) addText(intro, 10, false, [0, 0, 0], bullets ? 4 : 10);
        if (bullets) { bullets.forEach(addBullet); y += 10; }
      });

      // Footer
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, maxW, 50, "F");
      y += 14;
      addText("END OF AGREEMENT", 11, true, [10, 35, 66]);
      addText(`Accepted on: ${date}`, 10, false, [80, 80, 80]);
      addText(`Juror Signature: ${jurorName}`, 10, false, [80, 80, 80]);

      doc.save(`QuickVerdicts-Juror-Agreement-${Date.now()}.pdf`);
    });

    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "agreement_downloaded", { form_type: "juror_signup", step: 4 });
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
        (window as any).gtag("event", "agreement_accepted", { form_type: "juror_signup", step: 4 });
      }
    },
    [onUpdate, onClearError]
  );

  /* ===========================================================
     RENDER HELPERS
     =========================================================== */

  function SectionHeader({ num, title }: { num: number; title: string }) {
    return (
      <h3 className="font-bold text-base text-[#0A2342] mb-3 flex items-start gap-2 mt-6">
        <span className="bg-[#0A2342] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5" aria-hidden="true">
          {num}
        </span>
        {title}
      </h3>
    );
  }

  /* ===========================================================
     RENDER
     =========================================================== */

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center" role="img" aria-label="User agreement document">
            <FileText className="w-6 h-6 text-[#0A2342]" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#0A2342]">Juror Participation Agreement</h1>
            <p className="text-gray-600 text-sm">Please read and accept the terms to complete your registration</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handlePrint}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 flex items-center gap-2 transition-colors cursor-pointer"
            aria-label="Print agreement">
            <Printer size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button type="button" onClick={handleDownload}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 flex items-center gap-2 transition-colors cursor-pointer"
            aria-label="Download agreement">
            <Download size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </header>

      {/* Agreement Container */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-lg overflow-hidden">
        {/* Agreement Header */}
        <div className="bg-gradient-to-r from-[#0A2342] to-[#132c54] px-6 py-4">
          <h2 className="text-xl font-bold text-white">Juror Participation Agreement – Quick Verdicts</h2>
          <div className="text-blue-100 text-sm mt-1">
            <span><strong>Effective Date:</strong> Date of Registration</span>
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
          aria-label="Juror participation agreement content"
          tabIndex={0}
        >
          <div id="agreement-content">
            <p className="mb-6">
              Welcome, and thank you for your interest in serving as a mock juror with <strong>Adaki, LLC d/b/a Quick Verdicts</strong> (&quot;Quick Verdicts&quot;). This Juror Participation Agreement (&quot;Agreement&quot;) sets out the terms that govern your participation on Quick Verdicts&apos; virtual mock jury platform (the &quot;Platform&quot;). By registering to serve as a juror, participating in a session, or accepting compensation for your services, you agree to be bound by this Agreement.
            </p>

            {/* Section 1 */}
            <section aria-labelledby="s1">
              <SectionHeader num={1} title="Eligibility and Verification" />
              <p className="mb-3 text-gray-700">To serve as a juror with Quick Verdicts, you must meet the following eligibility requirements and provide accurate, complete registration information.</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-700 mb-4">
                <li>Be at least 18 years old.</li>
                <li>Be a legal resident of the United States.</li>
                <li>Be legally qualified to vote, whether or not you are registered to vote.</li>
                <li>Reside in the county and state identified in your registration.</li>
                <li>Have no current legal disqualification from jury service in the applicable county, state, or federal district, including any disqualifying felony conviction or any pending indictment or other qualifying criminal accusation.</li>
                <li>Be of sound mind and good moral character.</li>
                <li>Be able to read, write, understand, and communicate in English.</li>
                <li>Be able to participate in online video conferencing and follow the Platform&apos;s procedures.</li>
                <li>Not currently work for an insurance company, litigation support company, third-party administrator, claims handling company, litigation funding company, or law firm.</li>
                <li>Not have worked for an insurance company, litigation support company, third-party claims administrator, claims handling company, or litigation funding company within the past two (2) years.</li>
                <li>Not have worked for a law firm within the past two (2) years.</li>
                <li>Not have practiced law as a licensed attorney within the past ten (10) years.</li>
                <li>By signing this Agreement and participating as a juror, you represent that the information you provide to Quick Verdicts is accurate and complete.</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section aria-labelledby="s2">
              <SectionHeader num={2} title="Juror Responsibilities" />
              <p className="mb-3 text-gray-700">In exchange for compensation, you agree to perform your role as a mock juror honestly, attentively, and in accordance with Quick Verdicts&apos; procedures.</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-700 mb-4">
                <li>Respond truthfully and completely to screening questions and requests for information.</li>
                <li>Appear on time for each scheduled session and remain present for the full trial and debriefing period unless excused.</li>
                <li>Participate from a private location where other persons cannot overhear the proceedings.</li>
                <li>Remain visible on camera for the duration of the session as instructed by Quick Verdicts.</li>
                <li>Review the case materials presented during the session, listen carefully to all evidence and testimony, and follow the moderator&apos;s instructions.</li>
                <li>Deliberate respectfully with fellow jurors and provide your honest feedback, evaluations, and verdict based only on the materials and instructions presented.</li>
                <li>Comply with the onboarding requirements communicated by Quick Verdicts, including those described in the Jury Onboarding Video.</li>
                <li>Remain impartial and refrain from discussing the case outside the virtual courtroom or debriefing process.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section aria-labelledby="s3">
              <SectionHeader num={3} title="Confidentiality" />
              <p className="mb-3 text-gray-700">All case materials, trial presentations, recordings, and discussions are confidential and may include attorney work product or other protected information. You must protect the confidentiality of the proceedings at all times. Confidentiality obligations survive completion of the mock trial and termination of participation indefinitely.</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-700 mb-3">
                <li>Do not share, discuss, disclose, or post information about the case with any person or on any social media platform unless disclosure is required by law or court order.</li>
                <li>Do not record, photograph, copy, or take screenshots of the proceedings or of any materials displayed during the session.</li>
                <li>Do not retain, copy, photograph, summarize, transcribe, or preserve any materials and destroy any notes immediately following the session.</li>
                <li>Respect the privacy of all participants and preserve the integrity of the mock jury process.</li>
                <li>If you are later called to serve as a juror in the same case, you agree to notify the court that you previously participated in a mock trial involving that matter.</li>
              </ul>
              <p className="text-gray-700 mb-4">Juror acknowledges that all materials, testimony, recordings, discussions, verdicts, evaluations, notes, and communications constitute attorney work product and/or privileged information and agrees not to disclose them under any circumstances except as required by law.</p>
            </section>

            {/* Section 4 */}
            <section aria-labelledby="s4">
              <SectionHeader num={4} title="Data Privacy and Consent & Disclosure of Contact Information" />
              <p className="mb-3 text-gray-700">During a virtual session, your name and image may be visible to attorneys, their staff, and other authorized participants. Quick Verdicts will use reasonable measures to protect your contact information from unauthorized disclosure. To the fullest extent permitted by law, you agree that Quick Verdicts will not be liable for unauthorized disclosure of your contact information that occurs despite those reasonable measures.</p>
              <p className="text-gray-700 mb-4">Juror acknowledges that additional data privacy and consent provisions are contained in the separate Quick Verdicts Privacy Policy and that it is incorporated into this Agreement as though set out herein, verbatim.</p>
            </section>

            {/* Section 5 */}
            <section aria-labelledby="s5">
              <SectionHeader num={5} title="Technology Requirements" />
              <p className="mb-3 text-gray-700">You are responsible for having the equipment and environment needed to participate fully in a virtual session.</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-700 mb-4">
                <li>A reliable internet connection.</li>
                <li>A computer or mobile device with working audio and video capability.</li>
                <li>A private, quiet location where you can participate without interruption or distraction.</li>
                <li>Prompt notice to Quick Verdicts or its support team if you experience technical issues during a session.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section aria-labelledby="s6">
              <SectionHeader num={6} title="Compensation" />
              <p className="mb-3 text-gray-700">Compensation is case-specific and is offered in exchange for your full and satisfactory participation in the assigned session.</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-700 mb-4">
                <li>To receive payment, you must maintain a valid Zelle, PayPal, or Venmo account and provide any information reasonably needed to process payment, which may include the last four digits of your phone number if required by the payment provider.</li>
                <li>You must complete the full session, including the debriefing period, and submit all requested responses, including your final verdict, witness evaluations, and comments, if requested for that case.</li>
                <li>The compensation amount for each case will be listed on the applicable Job Board posting.</li>
                <li>Quick Verdicts will issue payment after the conclusion of the assigned session and debriefing period, subject to your compliance with this Agreement and the session requirements.</li>
                <li>Jurors are independent participants and are not employees, agents, partners, or representatives of Quick Verdicts. Participation in any mock trial does not create an employment relationship, and Jurors are solely responsible for any taxes associated with compensation received.</li>
                <li>Juror acknowledges responsibility for reporting compensation received and agrees to provide any tax documentation reasonably required by Quick Verdicts.</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section aria-labelledby="s7">
              <SectionHeader num={7} title="Recordings, Publicity Release & Intellectual Property Assignment" />
              <p className="text-gray-700 mb-4">You understand and agree that your participation in the Quick Verdicts virtual courtroom may be audio recorded, video recorded, or both, and that those recordings may be provided to the attorneys involved after the mock trial. All recordings are the sole property of Quick Verdicts and/or its clients. Juror waives any ownership interest in such recordings and grants a perpetual right to record and use Juror&apos;s participation for litigation-support purposes. All verdict forms, comments, evaluations, feedback, opinions, and written submissions become the exclusive property of Quick Verdicts and its clients.</p>
            </section>

            {/* Section 8 */}
            <section aria-labelledby="s8">
              <SectionHeader num={8} title="Code of Conduct" />
              <p className="mb-3 text-gray-700">You agree to conduct yourself professionally and to follow all reasonable instructions given by Quick Verdicts, the moderator, or the court facilitator.</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-700 mb-4">
                <li>Arrive on time and remain present throughout the session unless excused.</li>
                <li>Treat all participants with respect and professionalism.</li>
                <li>Maintain only one registration on the Platform.</li>
                <li>Promptly update your contact information if your primary residence or other registration information changes.</li>
                <li>Follow all session procedures and all reasonable instructions from Quick Verdicts personnel.</li>
                <li>Quick Verdicts may remove a juror from a session or terminate a registration for failure to comply with this Agreement, failure to follow instructions, disruptive conduct, failure to answer honestly, technical issues, inattentiveness, violations of confidentiality, suspected conflicts of interest, or other legitimate business or procedural reasons.</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section aria-labelledby="s9">
              <SectionHeader num={9} title="No Guarantee of Selection" />
              <p className="text-gray-700 mb-4">Registration does not guarantee selection for any mock trial or any minimum amount of compensation.</p>
            </section>

            {/* Section 10 */}
            <section aria-labelledby="s10">
              <SectionHeader num={10} title="Conflict Disclosure Requirement" />
              <p className="text-gray-700 mb-4">Jurors must disclose prior knowledge of parties, relationships with attorneys involved in the mock trial, prior involvement in the dispute, financial interests in the lawsuit, and social media or personal connections to the parties involved in the lawsuit, both before and during participation.</p>
            </section>

            {/* Section 11 */}
            <section aria-labelledby="s11">
              <SectionHeader num={11} title="DISCLAIMER OF WARRANTIES; LIMITATION OF LIABILITY (IMPORTANT—PLEASE READ CAREFULLY)" />
              <div className="space-y-3 text-gray-700 mb-4">
                <div>
                  <p className="font-semibold text-gray-900">(a) DISCLAIMER OF WARRANTIES</p>
                  <p>THE PLATFORM, ALL MOCK TRIAL SESSIONS, AND ALL RELATED MATERIALS AND SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot; WITHOUT ANY WARRANTIES OF ANY KIND. TO THE FULLEST EXTENT PERMITTED BY TEXAS LAW, QUICK VERDICTS EXPRESSLY DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY, RELIABILITY, OR COMPLETENESS OF ANY CONTENT OR RESULTS. QUICK VERDICTS DOES NOT WARRANT THAT THE PLATFORM OR SESSIONS WILL BE UNINTERRUPTED OR ERROR-FREE, OR THAT ANY MOCK TRIAL OUTCOME, FEEDBACK, OR VERDICT WILL REFLECT ACTUAL JURY RESULTS.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">(b) LIMITATION OF DAMAGES</p>
                  <p>TO THE FULLEST EXTENT PERMITTED BY TEXAS LAW, QUICK VERDICTS WILL NOT BE LIABLE FOR ANY CLAIMS ARISING OUT OF OR RELATED TO THIS AGREEMENT, THE PLATFORM, OR YOUR PARTICIPATION, REGARDLESS OF THE LEGAL THEORY (INCLUDING CONTRACT, TORT, NEGLIGENCE, OR OTHERWISE).</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">(c) EXCLUSION OF CONSEQUENTIAL DAMAGES (CONSPICUOUS RISK ALLOCATION)</p>
                  <p>IN NO EVENT SHALL QUICK VERDICTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION: LOST INCOME OR COMPENSATION, LOSS OF OPPORTUNITY, REPUTATIONAL HARM, EMOTIONAL DISTRESS, OR LOSS OF DATA OR USE. THIS EXCLUSION APPLIES EVEN IF QUICK VERDICTS HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">(d) LIABILITY CAP</p>
                  <p>TO THE FULLEST EXTENT PERMITTED BY TEXAS LAW, THE TOTAL AGGREGATE LIABILITY OF QUICK VERDICTS FOR ANY CLAIM ARISING OUT OF OR RELATED TO THIS AGREEMENT WILL NOT EXCEED THE AMOUNT OF COMPENSATION ACTUALLY PAID TO YOU FOR THE SPECIFIC SESSION GIVING RISE TO THE CLAIM. IF NO COMPENSATION WAS PAID, QUICK VERDICTS SHALL HAVE NO LIABILITY.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">(e) EXPRESS ACKNOWLEDGMENT</p>
                  <p>YOU ACKNOWLEDGE THAT THESE LIMITATIONS ARE A MATERIAL PART OF THIS AGREEMENT, THEY REFLECT A FAIR ALLOCATION OF RISK, AND YOUR PARTICIPATION AND COMPENSATION ARE BASED ON THESE LIMITATIONS.</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">(f) MAXIMUM ENFORCEABILITY UNDER TEXAS LAW</p>
                  <p>THE LIMITATIONS, DISCLAIMERS, AND EXCLUSIONS IN THIS SECTION ARE INTENDED TO BE ENFORCED TO THE MAXIMUM EXTENT PERMITTED UNDER TEXAS LAW AND WILL SURVIVE TERMINATION OF THIS AGREEMENT.</p>
                </div>
              </div>
            </section>

            {/* Section 12 */}
            <section aria-labelledby="s12">
              <SectionHeader num={12} title="INDEMNIFICATION BY JUROR" />
              <p className="text-gray-700 mb-4">JUROR AGREES TO INDEMNIFY AND HOLD HARMLESS QUICK VERDICTS FROM LOSSES, DAMAGES, CLAIMS, COSTS, AND ATTORNEY FEES ARISING FROM JUROR&apos;S BREACH OF THIS AGREEMENT, MISREPRESENTATION DURING REGISTRATION, OR UNAUTHORIZED DISCLOSURE OF CONFIDENTIAL INFORMATION.</p>
            </section>

            {/* Section 13 */}
            <section aria-labelledby="s13">
              <SectionHeader num={13} title="Proprietary Information" />
              <p className="text-gray-700 mb-4">The Platform, its processes, and related materials are proprietary to Quick Verdicts and may be protected by copyright, trademark, and other applicable laws. You may not publish, post, distribute, reproduce, disclose, or otherwise use proprietary Platform information without Quick Verdicts&apos; prior express authorization.</p>
            </section>

            {/* Section 14 */}
            <section aria-labelledby="s14">
              <SectionHeader num={14} title="Class Action Waiver" />
              <p className="text-gray-700 mb-4">Claims against Quick Verdicts must be brought individually and not as part of a class or representative action.</p>
            </section>

            {/* Section 15 */}
            <section aria-labelledby="s15">
              <SectionHeader num={15} title="Arbitration Clause" />
              <p className="text-gray-700 mb-4">Disputes between Quick Verdicts and jurors shall be resolved through binding arbitration in Texas.</p>
            </section>

            {/* Section 16 */}
            <section aria-labelledby="s16">
              <SectionHeader num={16} title="Force Majeure" />
              <p className="mb-3 text-gray-700">Quick Verdicts will not be liable for any failure or delay in the performance of its obligations under this Agreement if such failure or delay is caused, directly or indirectly, by events or circumstances beyond its reasonable control (&quot;Force Majeure Event&quot;), including without limitation: acts of God; natural disasters; fire; flood; severe weather; epidemic or pandemic; war; terrorism; civil unrest; labor disputes; governmental orders, regulations, or restrictions; power outages; internet or telecommunications failures; cyberattacks; software or hardware failures; and failures, interruptions, or delays involving third-party platforms, vendors, or service providers.</p>
              <p className="mb-2 text-gray-700">In the event of a Force Majeure Event:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-gray-700 mb-3">
                <li>Quick Verdicts may suspend, delay, reschedule, modify, or cancel any mock trial session, juror participation, or related activity, in whole or in part, without liability.</li>
                <li>Quick Verdicts will have no obligation to provide compensation to Juror if a session is canceled, shortened, or materially disrupted due to a Force Majeure Event, except as determined by Quick Verdicts in its sole discretion.</li>
                <li>Partial participation caused by a Force Majeure Event will not entitle Juror to full compensation unless Quick Verdicts determines otherwise.</li>
                <li>Quick Verdicts&apos; obligations will be suspended for the duration of the Force Majeure Event and for a reasonable period thereafter to allow for recovery and resumption of services.</li>
              </ul>
              <p className="text-gray-700 mb-4">Juror acknowledges and agrees that the Platform relies on third-party technology and internet-based systems, and that interruptions, delays, or failures of such systems are inherent risks that may occur despite reasonable safeguards.</p>
            </section>

            {/* Section 17 */}
            <section aria-labelledby="s17">
              <SectionHeader num={17} title="Changes to This Agreement" />
              <p className="text-gray-700 mb-4">Quick Verdicts may revise this Agreement from time to time. Quick Verdicts will provide notice of material changes. Your continued registration or participation after any revision becomes effective constitutes your acceptance of the revised Agreement.</p>
            </section>

            {/* Section 18 */}
            <section aria-labelledby="s18">
              <SectionHeader num={18} title="Consent to Electronic Communications and E-Signatures" />
              <p className="text-gray-700 mb-4">Juror consents to receive notices electronically and agrees that electronic acceptance of this Agreement constitutes a legally binding signature.</p>
            </section>

            {/* Section 19 */}
            <section aria-labelledby="s19">
              <SectionHeader num={19} title="AI and Technology Restrictions" />
              <p className="text-gray-700 mb-4">Juror may not use artificial intelligence tools, search engines, outside research, or third parties when evaluating a case unless expressly authorized.</p>
            </section>

            {/* Section 20 */}
            <section aria-labelledby="s20">
              <SectionHeader num={20} title="Removal from Registration" />
              <p className="text-gray-700 mb-4">You may end your registration and participation with Quick Verdicts by sending notice by email to <strong>QVTrial@quickverdicts.com</strong>.</p>
            </section>

            {/* Section 21 */}
            <section aria-labelledby="s21">
              <SectionHeader num={21} title="Suspension for Fraud or Misrepresentation" />
              <p className="text-gray-700 mb-4">Quick Verdicts may immediately terminate participation of Juror if it believes a juror has misrepresented qualifications; used another person&apos;s identity; participated multiple times under different accounts; or used AI or outside assistance when responding.</p>
            </section>

            {/* Section 22 */}
            <section aria-labelledby="s22">
              <SectionHeader num={22} title="Governing Law and Venue" />
              <p className="text-gray-700 mb-4">This Agreement is governed by the laws of the State of Texas. Exclusive venue for disputes shall be Dallas County, Texas.</p>
            </section>

            {/* Section 23 */}
            <section aria-labelledby="s23">
              <SectionHeader num={23} title="Contact Information" />
              <p className="text-gray-700 mb-4">For questions, technical issues, or support, please contact Quick Verdicts at <strong>QVTrial@quickverdicts.com</strong>.</p>
            </section>

            {/* End Marker */}
            <div className="mt-8 pt-6 border-t-2 border-gray-200 text-center text-gray-500">
              <p className="text-sm font-semibold">— End of Agreement —</p>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        {!hasScrolledToBottom && showScrollHint && (
          <div className="px-6 py-3 bg-yellow-50 border-t-2 border-yellow-200 flex items-center gap-3" role="alert" aria-live="polite">
            <svg className="animate-bounce w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <p className="text-sm text-yellow-800 font-medium">
              Please scroll to the bottom to read the complete agreement ({scrollProgress}% read)
            </p>
          </div>
        )}

        {hasScrolledToBottom && (
          <div className="px-6 py-3 bg-green-50 border-t-2 border-green-200 flex items-center gap-3" role="status" aria-live="polite">
            <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden="true" />
            <p className="text-sm text-green-800 font-medium">
              ✓ You&apos;ve read the complete agreement. You may now accept the terms below.
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
              formData.agreedToTerms ? "bg-[#0A2342] border-[#0A2342]" : "bg-white border-gray-300"
            }`}
            aria-hidden="true"
          >
            {formData.agreedToTerms && <CheckCircle2 size={16} className="text-white" />}
          </div>
          <div>
            <span
              id="agreement-checkbox-description"
              className={`font-medium ${!hasScrolledToBottom ? "text-gray-400" : "text-gray-700"}`}
            >
              I have read and agree to the Juror Participation Agreement for Quick Verdicts{" "}
              <span className="text-red-500" aria-label="required">*</span>
            </span>
            {!hasScrolledToBottom && (
              <p className="text-sm text-gray-500 mt-1">📜 Please scroll to the bottom of the agreement first</p>
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
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mt-4 flex items-start gap-3" role="alert">
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
              ? "bg-[#0A2342] text-white hover:bg-[#132c54] hover:shadow-lg transform hover:scale-[1.02] cursor-pointer"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
          aria-label="Agree to terms and create account"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
