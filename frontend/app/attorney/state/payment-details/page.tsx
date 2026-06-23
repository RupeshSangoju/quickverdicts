// ===== PAYMENT DETAILS PAGE =====
// app/attorney/state/payment-details/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import Stepper from "../../components/Stepper";
import FormContainer from "../../components/FormContainer";

const stripePromise = loadStripe("pk_test_51TU6lBCxJ6zxZKQSKejb6OtlMKNEQUFFr1jrJqhNRD5bdrH2MxMN52T1IVubfTKU3i210IuRRhi5GyeAWMrZ2giY00X6r75QVT");

const tierAmounts: Record<string, number> = {
  "Early Adopter": 2000,
  "Tier 1": 3500,
  "Tier 2": 4500,
  "Tier 3": 5500,
};

const CARD_ELEMENT_OPTIONS = {
  hidePostalCode: true,
  disableLink: true,
  style: {
    base: {
      color: "#16305B",
      fontFamily: "sans-serif",
      fontSize: "16px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#94a3b8" },
    },
    invalid: {
      color: "#ef4444",
      iconColor: "#ef4444",
    },
  },
};

function PaymentForm() {
  useProtectedRoute({ requiredUserType: "attorney" });
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [caseTier, setCaseTier] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [stripeCardError, setStripeCardError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponValidating, setCouponValidating] = useState(false);

  const isCardPayment = paymentMethod === "Credit Card" || paymentMethod === "Debit Card";
  const displayAmount = parseInt(paymentAmount) - couponDiscount;

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

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setValidationErrors(prev => ({ ...prev, coupon: "Please enter a coupon code" }));
      return;
    }

    setCouponValidating(true);
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, caseTier }),
      });
      const data = await response.json();

      if (data.success) {
        setCouponDiscount(data.discountAmount || 0);
        setValidationErrors(prev => {
          const { coupon, ...rest } = prev;
          return rest;
        });
        localStorage.setItem("appliedCoupon", couponCode.trim());
      } else {
        setValidationErrors(prev => ({ ...prev, coupon: data.message || "Coupon validation failed" }));
        setCouponDiscount(0);
        localStorage.removeItem("appliedCoupon");
      }
    } catch (error) {
      console.error("Coupon validation error:", error);
      setValidationErrors(prev => ({ ...prev, coupon: "Failed to validate coupon" }));
      setCouponDiscount(0);
    } finally {
      setCouponValidating(false);
    }
  };

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
      if (!cardholderName.trim()) {
        errors.cardholderName = "Cardholder name is required";
      } else if (!/^[a-zA-Z\s]+$/.test(cardholderName.trim())) {
        errors.cardholderName = "Cardholder name must contain only letters and spaces";
      }
      if (stripeCardError) {
        errors.card = stripeCardError;
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);

    if (isCardPayment) {
      if (!stripe || !elements) {
        setValidationErrors({ card: "Stripe is not ready. Please try again." });
        setIsSubmitting(false);
        return;
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setValidationErrors({ card: "Card element not found." });
        setIsSubmitting(false);
        return;
      }

      const { error, paymentMethod: pm } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
        billing_details: { name: cardholderName.trim() },
      });

      if (error) {
        setValidationErrors({ card: error.message || "Card error. Please check your details." });
        setIsSubmitting(false);
        return;
      }

      // Stored and used by schedule-trail/page.tsx when confirming the payment
      localStorage.setItem("stripePaymentMethodId", pm.id);
      localStorage.setItem("cardLastFour", pm.card?.last4 || "");
      localStorage.setItem("cardBrand", pm.card?.brand || "");
      localStorage.setItem("cardholderName", cardholderName.trim());
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
            {/* Payment Method */}
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

            {/* Stripe card inputs */}
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
                    Card Details <span className="text-red-500">*</span>
                  </label>
                  <div className="w-full px-4 py-3 border border-[#bfc6d1] rounded-md bg-white">
                    <CardElement
                      options={CARD_ELEMENT_OPTIONS}
                      onChange={e => setStripeCardError(e.error?.message || "")}
                    />
                  </div>
                  {(validationErrors.card || stripeCardError) && (
                    <p className="text-red-500 text-sm mt-1">
                      {validationErrors.card || stripeCardError}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Card details are securely handled by Stripe and never stored on our servers.
                  </p>
                </div>
              </>
            )}

            {/* Coupon Code Section */}
            {caseTier === "Tier 1" && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium text-blue-900 mb-3">
                  💰 Special Promotion: Use code <strong>TIER1LAUNCH</strong> for $1,000 off Tier 1 (first 50 cases only)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    disabled={couponDiscount > 0}
                    className="flex-1 px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B] disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleValidateCoupon}
                    disabled={couponValidating || couponDiscount > 0}
                    className="px-4 py-2 bg-[#16305B] text-white rounded-md hover:bg-[#0A2342] disabled:opacity-50 transition font-medium"
                  >
                    {couponValidating ? "Checking..." : couponDiscount > 0 ? "Applied ✓" : "Apply"}
                  </button>
                </div>
                {validationErrors.coupon && (
                  <p className="text-red-500 text-sm mt-2">{validationErrors.coupon}</p>
                )}
              </div>
            )}

            {/* Payment Amount (read-only, set by tier selection) */}
            <div>
              <label className="block mb-1 text-[#16305B] font-medium">
                Payment Amount <span className="text-red-500">*</span>
              </label>
              <div className="space-y-1">
                <input
                  type="text"
                  value={paymentAmount ? `$${parseInt(paymentAmount).toLocaleString()}` : "$0"}
                  disabled
                  className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-gray-100 text-[#16305B] font-semibold text-lg cursor-not-allowed"
                />
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 font-medium px-1">
                    <span>After discount:</span>
                    <span>${displayAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>
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
                disabled={isSubmitting || (isCardPayment && !stripe)}
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
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm />
    </Elements>
  );
}
