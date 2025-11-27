"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  ArrowRight,
  Mail,
  Shield,
  AlertCircle,
  Clock,
  FileCheck,
} from "lucide-react";

/* ===========================================================
   TYPES
   =========================================================== */

interface Step5SuccessProps {
  email?: string;
  accountId?: string;
  firstName?: string;
}

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

export function Step5Success({
  email = "",
  accountId = "",
  firstName = "Attorney",
}: Step5SuccessProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  /* ===========================================================
     GENERATE STABLE ACCOUNT ID
     =========================================================== */

  const displayAccountId = useMemo(() => {
    return (
      accountId ||
      `ATT-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .substr(2, 4)
        .toUpperCase()}`
    );
  }, [accountId]);

  /* ===========================================================
     EFFECTS - ANIMATIONS & TRACKING
     =========================================================== */

  useEffect(() => {
    // Track signup success
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "signup_success", {
        form_type: "attorney_signup",
        method: "email",
      });

      // Optional conversion tracking (configure with real IDs)
      (window as any).gtag("event", "conversion", {
        send_to: "AW-CONVERSION_ID/CONVERSION_LABEL",
        value: 1.0,
        currency: "USD",
      });
    }

    // Trigger animations
    const timer1 = setTimeout(() => setIsVisible(true), 100);
    const timer2 = setTimeout(() => setShowConfetti(true), 500);
    const timer3 = setTimeout(() => setShowConfetti(false), 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  /* ===========================================================
     HANDLERS
     =========================================================== */

  const handleLoginRedirect = () => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "proceed_to_login", {
        form_type: "attorney_signup",
      });
    }

    router.push("/login/attorney");
  };

  /* ===========================================================
     RENDER
     =========================================================== */

  return (
    <>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div
          className={`bg-white rounded-2xl border-2 border-gray-200 shadow-xl overflow-hidden transition-all duration-500 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          role="main"
          aria-labelledby="success-heading"
        >
          {/* Success Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-12 text-center relative overflow-hidden">
            {/* Confetti Effect */}
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-white rounded-full animate-confetti"
                    style={{
                      left: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 0.5}s`,
                    }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}

            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div
                className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg animate-scaleIn"
                role="img"
                aria-label="Success checkmark"
              >
                <CheckCircle
                  size={48}
                  className="text-green-500"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Title */}
            <h1 id="success-heading" className="text-4xl font-bold text-white mb-3">
              Welcome to QuickVerdicts{firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="text-green-50 text-lg">
              Your attorney account has been created successfully
            </p>

            {/* Email Badge */}
            {email && (
              <div
                className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm"
                role="status"
              >
                <Mail size={16} aria-hidden="true" />
                <span>
                  Confirmation sent to <strong>{email}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            {/* Verification Notice */}
            <section
              className="bg-yellow-50 rounded-xl p-6 border-2 border-yellow-200"
              aria-labelledby="verification-heading"
            >
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="text-yellow-600 mt-1 flex-shrink-0"
                  size={24}
                  aria-hidden="true"
                />
                <div>
                  <h2
                    id="verification-heading"
                    className="font-semibold text-yellow-900 mb-2 flex items-center gap-2"
                  >
                    Bar License Verification Pending
                    <Clock size={16} className="text-yellow-600" aria-hidden="true" />
                  </h2>
                  <p className="text-sm text-yellow-800 leading-relaxed">
                    Your account has limited functionality until your bar license is
                    verified by our team. This process typically takes{" "}
                    <strong>2–3 business days</strong>. You'll receive an email once
                    verification is complete.
                  </p>
                </div>
              </div>
            </section>

            {/* Next Steps */}
            <section
              className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200"
              aria-labelledby="next-steps-heading"
            >
              <h2
                id="next-steps-heading"
                className="text-xl font-bold text-[#0A2342] mb-4 flex items-center gap-2"
              >
                <Shield className="text-blue-600" size={24} aria-hidden="true" />
                What's Next?
              </h2>
              <ol className="space-y-3 text-gray-700" role="list">
                {[
                  "Log in to your attorney portal using the credentials you just created",
                  "Complete your profile and explore the platform",
                  "Check your verification status in the dashboard",
                  "Once verified, start managing small claims cases with QuickVerdicts",
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="bg-blue-200 text-[#0A2342] rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Platform Benefits */}
            <section
              className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200"
              aria-labelledby="benefits-heading"
            >
              <h3
                id="benefits-heading"
                className="font-semibold text-gray-900 mb-3 flex items-center gap-2"
              >
                <FileCheck
                  className="text-purple-600"
                  size={20}
                  aria-hidden="true"
                />
                Platform Benefits
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                {[
                  "Virtual courtroom access",
                  "Case management tools",
                  "Secure document upload",
                  "Real-time notifications",
                ].map((benefit, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle
                      size={16}
                      className="text-green-500 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Help Section */}
            <section
              className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border-2 border-indigo-200"
              aria-labelledby="help-heading"
            >
              <h3 id="help-heading" className="font-semibold text-gray-900 mb-2">
                Need Help?
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                If you have questions about verification or need account assistance:
              </p>
              <a
                href="mailto:support@quickverdicts.com"
                className="text-[#0A2342] hover:underline text-sm font-semibold inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded px-2 py-1 transition-colors"
                aria-label="Email support at support@quickverdicts.com"
              >
                <Mail size={16} aria-hidden="true" />
                <span>support@quickverdicts.com</span>
              </a>
            </section>

            {/* CTA Button */}
            <div className="pt-4">
              <button
                onClick={handleLoginRedirect}
                className="w-full px-8 py-4 bg-[#0A2342] text-white rounded-xl hover:bg-[#132c54] font-semibold transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2"
                aria-label="Proceed to attorney login portal"
              >
                <span>Proceed to Attorney Portal</span>
                <ArrowRight size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Footer Note */}
            <footer
              className="text-center text-sm text-gray-600 pt-4 border-t-2 border-gray-100"
              role="contentinfo"
            >
              <p className="mb-2">
                Your verification status will be updated within 2–3 business days
              </p>
              <p className="text-xs text-gray-500 font-mono">
                Account ID: {displayAccountId}
              </p>
            </footer>
          </div>
        </div>

        {/* Email Info Card */}
        <div
          className="mt-6 bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
          role="complementary"
          aria-label="Additional information"
        >
          <h3 className="font-semibold text-gray-900 mb-3">📧 Check Your Email</h3>
          <p className="text-sm text-gray-600 mb-2">
            We've sent a confirmation email with important information about your
            account.
          </p>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Account activation details</li>
            <li>• Platform access instructions</li>
            <li>• Verification process timeline</li>
          </ul>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(500px) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes scaleIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-confetti {
          animation: confetti 2s ease-out forwards;
        }

        .animate-scaleIn {
          animation: scaleIn 0.5s ease-out forwards;
        }
      `}</style>
    </>
  );
}

export default Step5Success;
