// ===== CASE TYPE PAGE (FIRST PAGE) =====
// app/attorney/case-type/page.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import Stepper from "../../components/Stepper";
import FormContainer from "../../components/FormContainer";

export default function CaseTypePage() {
  const router = useRouter();
  const [selected, setSelected] = useState("");

  // Clear all previous case data when this page loads
  useEffect(() => {
    const keysToRemove = [
      "caseJurisdiction",
      "state",
      "county",
      "caseType",
      "caseTier",
      "caseDescription",
      "plaintiffGroups",
      "defendantGroups",
      "voirDire2Questions",
      "paymentMethod",
      "paymentAmount",
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log("✅ Previous case data cleared");
  }, []);

  const handleSelect = (jurisdiction: string) => {
    setSelected(jurisdiction);
    // Store as "State" or "Federal" with capital first letter
    localStorage.setItem("caseJurisdiction", jurisdiction.charAt(0).toUpperCase() + jurisdiction.slice(1));
    setTimeout(() => {
      router.push("/attorney/state/case-details");
    }, 300);
  };

  const handleBack = () => {
    router.push("/attorney");
  };

  return (
    <div className="min-h-screen flex bg-[#faf8f3] font-sans">
      {/* Sidebar */}
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

      {/* Main Content */}
      <section className="flex-1 flex flex-col min-h-screen bg-[#faf8f3] px-0 md:px-0 mb-20">
        <Stepper currentStep={0} onBack={handleBack} />

        <FormContainer title="Case Type">
          <div className="space-y-6">
            <p className="text-gray-700 text-center">Please select which type of case you are filing for.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                className={`bg-[#f5ecd7] px-8 py-8 rounded-lg shadow-md text-2xl font-bold text-[#16305B] border-4 transition-all hover:shadow-xl ${
                  selected === "state" ? "border-[#16305B] scale-105" : "border-transparent hover:border-gray-300"
                }`}
                onClick={() => handleSelect("state")}
              >
                State
                <div className="mt-3 text-sm font-normal text-[#16305B] leading-relaxed">
                  Cases involving state laws such as family disputes, contracts, property, and most crimes.
                </div>
              </button>
              <button
                className={`bg-[#f5ecd7] px-8 py-8 rounded-lg shadow-md text-2xl font-bold text-[#16305B] border-4 transition-all hover:shadow-xl ${
                  selected === "federal" ? "border-[#16305B] scale-105" : "border-transparent hover:border-gray-300"
                }`}
                onClick={() => handleSelect("federal")}
              >
                Federal
                <div className="mt-3 text-sm font-normal text-[#16305B] leading-relaxed">
                  Cases involving federal laws, constitutional issues, or disputes between citizens of different states with high dollar amounts.
                </div>
              </button>
            </div>
          </div>
        </FormContainer>
      </section>
    </div>
  );
}