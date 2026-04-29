// ===== PAYMENT DETAILS PAGE =====
// app/attorney/state/payment-details/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import Stepper from "../../components/Stepper";
import FormContainer from "../../components/FormContainer";

export default function PaymentDetailsPage() {
  useProtectedRoute({ requiredUserType: 'attorney' });
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [caseTier, setCaseTier] = useState("");
  const [requiredJurors, setRequiredJurors] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  const isCardPayment = paymentMethod === "Credit Card" || paymentMethod === "Debit Card";

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };
  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length === 0) return "";
    // Clamp month: first two digits must be 01–12
    let month = digits.slice(0, 2);
    if (month.length === 2) {
      const m = parseInt(month, 10);
      if (m === 0) month = "01";
      else if (m > 12) month = "12";
    }
    const rest = digits.slice(2);
    return rest.length > 0 ? month + "/" + rest : month;
  };
  const formatCvv = (value: string) => value.replace(/\D/g, "").slice(0, 3);

  // Fixed payment amounts based on tier (no per-juror calculation)
  const tierAmounts: Record<string, number> = {
    "Early Adopter": 2000,
    "Tier 1": 3500,
    "Tier 2": 4500,
    "Tier 3": 5500
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
    setLoaded(true);
  }, []);

  // Auto-save as user changes payment method
  useEffect(() => {
    if (loaded) {
      localStorage.setItem("paymentMethod", paymentMethod);
      localStorage.setItem("paymentAmount", paymentAmount);
    }
  }, [paymentMethod, paymentAmount, loaded]);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!paymentMethod) errors.paymentMethod = "Payment method is required";
    if (!paymentAmount || paymentAmount === "0") {
      errors.paymentAmount = "Payment amount calculation failed. Please go back and select tier and jurors.";
    }
    if (isCardPayment) {
      if (!cardholderName.trim()) errors.cardholderName = "Cardholder name is required";
      else if (!/^[a-zA-Z\s]+$/.test(cardholderName.trim())) errors.cardholderName = "Cardholder name must contain only letters and spaces";
      const rawCard = cardNumber.replace(/\s/g, "");
      if (!rawCard || rawCard.length < 16) errors.cardNumber = "Enter a valid 16-digit card number";
      if (!expiryDate || expiryDate.length < 5) {
        errors.expiryDate = "Enter a valid expiry date (MM/YY)";
      } else {
        const month = parseInt(expiryDate.slice(0, 2), 10);
        if (month < 1 || month > 12) errors.expiryDate = "Month must be between 01 and 12";
      }
      if (!cvv || cvv.length !== 3) errors.cvv = "CVV must be exactly 3 digits";
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
    if (isCardPayment) {
      localStorage.setItem("cardholderName", cardholderName);
      localStorage.setItem("cardLastFour", cardNumber.replace(/\s/g, "").slice(-4));
    }
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

              {isCardPayment && (
                <>
                  <div>
                    <label className="block mb-1 text-[#16305B] font-medium">
                      Cardholder Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={cardholderName}
                      onChange={e => setCardholderName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                      className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B]"
                    />
                    {validationErrors.cardholderName && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.cardholderName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block mb-1 text-[#16305B] font-medium">
                      Card Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                      maxLength={19}
                      className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B] tracking-widest"
                    />
                    {validationErrors.cardNumber && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.cardNumber}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 text-[#16305B] font-medium">
                        Expiry Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="MM/YY"
                        value={expiryDate}
                        onChange={e => setExpiryDate(formatExpiry(e.target.value))}
                        maxLength={5}
                        className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B]"
                      />
                      {validationErrors.expiryDate && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.expiryDate}</p>
                      )}
                    </div>
                    <div>
                      <label className="block mb-1 text-[#16305B] font-medium">
                        CVV <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        placeholder="•••"
                        value={cvv}
                        onChange={e => setCvv(formatCvv(e.target.value))}
                        maxLength={4}
                        className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B]"
                      />
                      {validationErrors.cvv && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.cvv}</p>
                      )}
                    </div>
                  </div>
                </>
              )}

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
                  className="w-full bg-[#16305B] text-white font-semibold px-8 py-2 rounded-md hover:bg-[#0A2342] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
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