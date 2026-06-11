// ===== PAYMENT DETAILS PAGE =====
// app/attorney/state/payment-details/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import Stepper from "../../components/Stepper";
import FormContainer from "../../components/FormContainer";

const tierAmounts: Record<string, number> = {
  "Early Adopter": 2000,
  "Tier 1": 3500,
  "Tier 2": 4500,
  "Tier 3": 5500,
};

function detectCardBrand(number: string): string {
  const n = number.replace(/\s/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(6011|65)/.test(n)) return "discover";
  return "unknown";
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function PaymentForm() {
  useProtectedRoute({ requiredUserType: "attorney" });
  const router = useRouter();

  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [caseTier, setCaseTier] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isCardPayment = paymentMethod === "Credit Card" || paymentMethod === "Debit Card";

  useEffect(() => {
    const savedMethod = localStorage.getItem("paymentMethod") || "";
    const savedTier = localStorage.getItem("caseTier") || "";
    setPaymentMethod(savedMethod);
    setCaseTier(savedTier);
    if (savedTier) {
      setPaymentAmount((tierAmounts[savedTier] || 0).toString());
    }
    setLoaded(true);
  }, []);

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
      errors.paymentAmount = "Payment amount missing. Please go back and select a tier.";
    }
    if (isCardPayment) {
      if (!cardholderName.trim()) errors.cardholderName = "Cardholder name is required";
      else if (!/^[a-zA-Z\s]+$/.test(cardholderName.trim()))
        errors.cardholderName = "Cardholder name must contain only letters and spaces";

      const rawNumber = cardNumber.replace(/\s/g, "");
      if (!rawNumber) errors.cardNumber = "Card number is required";
      else if (rawNumber.length < 13) errors.cardNumber = "Enter a valid card number";

      if (!cardExpiry) errors.cardExpiry = "Expiry date is required";
      else {
        const [mm, yy] = cardExpiry.split("/");
        const month = parseInt(mm, 10);
        const year = parseInt(`20${yy}`, 10);
        const now = new Date();
        if (month < 1 || month > 12) errors.cardExpiry = "Invalid month";
        else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1))
          errors.cardExpiry = "Card is expired";
      }

      if (!cardCvv) errors.cardCvv = "CVV is required";
      else if (cardCvv.length < 3) errors.cardCvv = "CVV must be 3–4 digits";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);

    if (isCardPayment) {
      const rawNumber = cardNumber.replace(/\s/g, "");
      localStorage.setItem("cardLastFour", rawNumber.slice(-4));
      localStorage.setItem("cardBrand", detectCardBrand(rawNumber));
      localStorage.setItem("cardholderName", cardholderName.trim());
      localStorage.setItem("cardExpiry", cardExpiry);
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
                    onChange={e => setCardholderName(e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
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
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                    inputMode="numeric"
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
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                      inputMode="numeric"
                      className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B]"
                    />
                    {validationErrors.cardExpiry && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.cardExpiry}</p>
                    )}
                  </div>
                  <div>
                    <label className="block mb-1 text-[#16305B] font-medium">
                      CVV <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="•••"
                      value={cardCvv}
                      onChange={e => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4}
                      inputMode="numeric"
                      className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B]"
                    />
                    {validationErrors.cardCvv && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.cardCvv}</p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Your card details are securely handled and never stored on our servers.
                </p>
              </>
            )}

            <div>
              <label className="block mb-1 text-[#16305B] font-medium">
                Payment Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={paymentAmount ? `$${parseInt(paymentAmount).toLocaleString()}` : "$0"}
                disabled
                className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-gray-100 text-[#16305B] font-semibold text-lg cursor-not-allowed"
              />
              {caseTier && (
                <p className="text-sm text-gray-600 mt-2">Fixed amount for {caseTier} cases</p>
              )}
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
                    <span>Processing...</span>
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

export default function PaymentDetailsPage() {
  return <PaymentForm />;
}
