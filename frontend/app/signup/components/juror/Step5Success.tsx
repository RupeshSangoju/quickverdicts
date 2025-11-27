"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  ArrowRight,
  Mail,
  Shield,
  FileCheck,
  Users,
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
  firstName = "Juror",
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
      `JUR-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .substring(2, 6)
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
        form_type: "juror_signup",
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
        form_type: "juror_signup",
      });
    }

    router.push("/login/juror");
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
            <h1
              id="success-heading"
              className="text-4xl font-bold text-white mb-3"
            >
              Welcome to QuickVerdicts{firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="text-green-50 text-lg">
              Your juror account has been created successfully
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
            {/* Welcome Message */}
            <div className="text-center mb-8">
              <p className="text-gray-700 text-lg">
                You're all set! Your account is now active and ready to use.
              </p>
            </div>

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
                  "Log in to your dashboard using the credentials you just created",
                  "Complete onboarding by watching the introduction video and taking the juror quiz",
                  "Browse available cases on the Job Board and start applying",
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

            {/* Juror Benefits */}
            <section
              className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200"
              aria-labelledby="benefits-heading"
            >
              <h3
                id="benefits-heading"
                className="font-semibold text-gray-900 mb-3 flex items-center gap-2"
              >
                <Users className="text-purple-600" size={20} aria-hidden="true" />
                As a Juror, You Can:
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                {[
                  "Participate in virtual cases",
                  "Earn compensation",
                  "Flexible scheduling",
                  "Serve from home",
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

            {/* Important Notice */}
            <section
              className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border-2 border-indigo-200"
              aria-labelledby="notice-heading"
            >
              <h3
                id="notice-heading"
                className="font-semibold text-gray-900 mb-2 flex items-center gap-2"
              >
                <FileCheck
                  className="text-indigo-600"
                  size={20}
                  aria-hidden="true"
                />
                Important: Complete Your Onboarding
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Before you can apply for cases, you must complete the onboarding
                process:
              </p>
              <ul className="text-xs text-gray-600 space-y-1" role="list">
                <li>• Watch the juror orientation video (10 minutes)</li>
                <li>• Pass the juror qualification quiz (80% required)</li>
                <li>• Review platform guidelines and code of conduct</li>
              </ul>
            </section>

            {/* Help Section */}
            <section
              className="bg-gray-50 rounded-xl p-6 border border-gray-200"
              aria-labelledby="help-heading"
            >
              <h3 id="help-heading" className="font-semibold text-gray-900 mb-2">
                Need Help?
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                If you have any questions about getting started or using the
                platform:
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="mailto:support@quickverdicts.com"
                  className="text-[#0A2342] hover:underline text-sm font-semibold flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded px-2 py-1 transition-colors"
                  aria-label="Email support at support@quickverdicts.com"
                >
                  <Mail size={16} aria-hidden="true" />
                  <span>Email Support</span>
                </a>
                <span className="hidden sm:inline text-gray-400">•</span>
                <a
                  href="tel:+1-555-123-4567"
                  className="text-[#0A2342] hover:underline text-sm font-semibold flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded px-2 py-1 transition-colors"
                  aria-label="Call support at +1-555-123-4567"
                >
                  <Shield size={16} aria-hidden="true" />
                  <span>Call Support</span>
                </a>
              </div>
            </section>

            {/* CTA Button */}
            <div className="pt-4">
              <button
                onClick={handleLoginRedirect}
                className="w-full px-8 py-4 bg-[#0A2342] text-white rounded-xl hover:bg-[#132c54] font-semibold transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2"
                aria-label="Proceed to juror login portal"
              >
                <span>Proceed to Juror Login</span>
                <ArrowRight size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Footer Note */}
            <footer
              className="text-center text-sm text-gray-600 pt-4 border-t-2 border-gray-100"
              role="contentinfo"
            >
              <p className="mb-2">
                Ready to start serving? Log in and complete your onboarding!
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
            We've sent a welcome email with important information about getting
            started.
          </p>
          <ul className="text-xs text-gray-500 space-y-1" role="list">
            <li>• Account activation details</li>
            <li>• Onboarding instructions</li>
            <li>• Platform access guide</li>
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
