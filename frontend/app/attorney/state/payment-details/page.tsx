// ===== PAYMENT DETAILS PAGE =====
// app/attorney/state/payment-details/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Stepper from "../../components/Stepper";
import FormContainer from "../../components/FormContainer";

export default function PaymentDetailsPage() {
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [caseTier, setCaseTier] = useState("");
  const [requiredJurors, setRequiredJurors] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Fixed payment amounts based on tier (no per-juror calculation)
  const tierAmounts: Record<string, number> = {
    "Tier 1": 300,
    "Tier 2": 400,
    "Tier 3": 500
  };

  // Get payment amount based on tier only
  const getPaymentAmount = (tier: string): number => {
    return tierAmounts[tier] || 0;
  };

  useEffect(() => {
    const savedPaymentMethod = localStorage.getItem("paymentMethod") || "";
    const savedTier = localStorage.getItem("caseTier") || "";

    setPaymentMethod(savedPaymentMethod);
    setCaseTier(savedTier);
    setRequiredJurors("7"); // Always 7 jurors

    // Auto-set payment amount based on tier
    if (savedTier) {
      const amount = getPaymentAmount(savedTier);
      setPaymentAmount(amount.toString());
    }
  }, []);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!paymentMethod) errors.paymentMethod = "Payment method is required";
    if (!paymentAmount || paymentAmount === "0") {
      errors.paymentAmount = "Payment amount calculation failed. Please go back and select tier and jurors.";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    localStorage.setItem("paymentMethod", paymentMethod);
    localStorage.setItem("paymentAmount", paymentAmount);
    router.push("/attorney/state/review-details");
  };

  return (
    <div className="min-h-screen flex bg-[#faf8f3] font-sans">
      <aside className="hidden lg:flex flex-col w-[265px]">
        <div className="flex-1 text-white bg-[#16305B] relative">
          <div className="absolute top-15 left-0 w-full">
            <Image
              src="/logo_sidebar_signup.png"
              alt="Quick Verdicts Logo"
              width={300}
              height={120}
              className="w-full object-cover"
              priority
            />
          </div>
          <div className="px-8 py-8 mt-30">
            <h2 className="text-3xl font-medium mb-4">New Case</h2>
            <div className="text-sm leading-relaxed text-blue-100 space-y-3">
              <p>Please fill out the following fields with the necessary information.</p>
              <p>Any with * is required.</p>
            </div>
          </div>
        </div>
      </aside>
      <section className="flex-1 flex flex-col min-h-screen bg-[#faf8f3] px-0 md:px-0 mb-20">
        <Stepper currentStep={5} />

        <FormContainer title="Payment Details">
          <form className="space-y-6" onSubmit={handleNext}>
              <div>
                <label className="block mb-1 text-[#16305B] font-medium">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B]"
                >
                  <option value="">Select Method</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
                {validationErrors.paymentMethod && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.paymentMethod}</p>
                )}
              </div>
              <div>
                <label className="block mb-1 text-[#16305B] font-medium">
                  Payment Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={paymentAmount ? `$${parseInt(paymentAmount).toLocaleString()}` : "$0"}
                    disabled
                    className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-gray-100 text-[#16305B] font-semibold text-lg cursor-not-allowed"
                  />
                  {caseTier && (
                    <p className="text-sm text-gray-600 mt-2">
                      Fixed amount for {caseTier} cases
                    </p>
                  )}
                </div>
                {validationErrors.paymentAmount && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.paymentAmount}</p>
                )}
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#16305B] text-white font-semibold px-8 py-2 rounded-md hover:bg-[#0A2342] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Loading...</span>
                    </>
                  ) : (
                    "Next"
                  )}
                </button>
              </div>
            </form>
        </FormContainer>
      </section>
    </div>
  );
}