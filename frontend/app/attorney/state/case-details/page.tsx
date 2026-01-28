"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Stepper from "../../components/Stepper";
import FormContainer from "../../components/FormContainer";

export default function CaseDetailsPage() {
  const [state, setState] = useState("");
  const [stateCode, setStateCode] = useState(""); // For fetching counties from Census API
  const [county, setCounty] = useState("");
  const [caseType, setCaseType] = useState("");
  const [caseTier, setCaseTier] = useState("");
  const [requiredJurors] = useState("7"); // Fixed to 7 jurors always
  const [caseDescription, setCaseDescription] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [caseJurisdiction, setCaseJurisdiction] = useState<string | null>(null);
  const [availableStates, setAvailableStates] = useState<{ label: string; value: string; code: string }[]>([]);
  const [availableCounties, setAvailableCounties] = useState<{ label: string; value: string }[]>([]);
  const [countiesLoading, setCountiesLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State search dropdown
  const [stateSearchTerm, setStateSearchTerm] = useState("");
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const stateDropdownRef = useRef<HTMLDivElement>(null);

  // County search dropdown
  const [countySearchTerm, setCountySearchTerm] = useState("");
  const [showCountyDropdown, setShowCountyDropdown] = useState(false);
  const countyDropdownRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCaseJurisdiction(localStorage.getItem("caseJurisdiction"));
      // Load saved data
      setState(localStorage.getItem("state") || "");
      setCounty(localStorage.getItem("county") || "");
      // Always set case type to "Civil" - only option available
      setCaseType("Civil");
      localStorage.setItem("caseType", "Civil");
      setCaseTier(localStorage.getItem("caseTier") || "");
      // requiredJurors is always 7, no need to load from localStorage
      setCaseDescription(localStorage.getItem("caseDescription") || "");

      // Set state search term from saved state
      const savedState = localStorage.getItem("state");
      if (savedState) {
        const stateObj = JSON.parse(localStorage.getItem("availableStates") || "[]").find((s: any) => s.value === savedState);
        if (stateObj) setStateSearchTerm(stateObj.label);
      }

      // Set county search term from saved county
      const savedCounty = localStorage.getItem("county");
      if (savedCounty) {
        setCountySearchTerm(savedCounty);
      }
    }
  }, []);

  // Fetch states on mount
  useEffect(() => {
    async function fetchStates() {
      try {
        const res = await fetch("https://api.census.gov/data/2020/dec/pl?get=NAME&for=state:*");
        const data = await res.json();
        const states = data.slice(1).map((row: [string, string]) => ({
          label: row[0], // Display name: "Texas"
          value: row[0].toUpperCase(), // Stored value: "TEXAS"
          code: row[1] // Census code for API: "48"
        }));
        // Sort states alphabetically by label
        states.sort((a: { label: string; value: string; code: string }, b: { label: string; value: string; code: string }) => a.label.localeCompare(b.label));
        setAvailableStates(states);
        if (typeof window !== "undefined") {
          localStorage.setItem("availableStates", JSON.stringify(states));
        }
      } catch (error) {
        setAvailableStates([]);
      }
    }
    fetchStates();
  }, []);

  // Fetch counties when state changes
  useEffect(() => {
    async function fetchCounties() {
      if (stateCode) {
        setCountiesLoading(true);
        try {
          const res = await fetch(
            `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${stateCode.padStart(2, "0")}`
          );
          const data = await res.json();
          setAvailableCounties(
            data.slice(1).map((row: [string, string, string]) => {
              // row[0] = "Anderson County, Texas"
              // Extract just "Anderson"
              const fullName = row[0];
              const countyName = fullName
                .replace(/ County.*$/i, '') // Remove " County" and everything after
                .replace(/ Parish.*$/i, '') // Handle Louisiana parishes
                .trim();
              return {
                label: fullName, // Display: "Anderson County, Texas"
                value: countyName // Store: "Anderson"
              };
            })
          );
        } catch (error) {
          setAvailableCounties([]);
        } finally {
          setCountiesLoading(false);
        }
      } else {
        setAvailableCounties([]);
      }
    }
    fetchCounties();
  }, [stateCode]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target as Node)) {
        setShowStateDropdown(false);
      }
      if (countyDropdownRef.current && !countyDropdownRef.current.contains(event.target as Node)) {
        setShowCountyDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredStates = availableStates.filter(s =>
    s.label.toLowerCase().includes(stateSearchTerm.toLowerCase())
  );

  const filteredCounties = availableCounties.filter(c =>
    c.label.toLowerCase().includes(countySearchTerm.toLowerCase()) ||
    c.value.toLowerCase().includes(countySearchTerm.toLowerCase())
  );

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!state) errors.state = "State is required";
    if (!county) errors.county = "County is required";
    // caseType is always "Civil", no validation needed
    if (!caseTier) errors.caseTier = "Trial case tier is required";
    // requiredJurors is always 7, no validation needed
    if (!caseDescription.trim()) errors.caseDescription = "Case description is required";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    // Simulate small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));

    localStorage.setItem("state", state);
    localStorage.setItem("county", county);
    localStorage.setItem("caseType", caseType);
    localStorage.setItem("caseTier", caseTier);
    localStorage.setItem("requiredJurors", requiredJurors);
    localStorage.setItem("caseDescription", caseDescription);

    router.push("/attorney/state/plaintiff-details");
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
        <Stepper currentStep={1} />

        {/* Case Details Form */}
        <FormContainer
          title={`Case Details ${caseJurisdiction ? `(${caseJurisdiction})` : ""}`}
        >
          <form className="space-y-6" onSubmit={handleNext}>
              {/* State - Searchable Dropdown */}
              <div ref={stateDropdownRef}>
                <label className="block mb-1 text-[#16305B] font-medium">
                  State <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={stateSearchTerm}
                    onChange={(e) => {
                      setStateSearchTerm(e.target.value);
                      setShowStateDropdown(true);
                    }}
                    onFocus={() => setShowStateDropdown(true)}
                    placeholder="Search state..."
                    className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B]"
                  />
                  {showStateDropdown && filteredStates.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-[#bfc6d1] rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredStates.map((s) => (
                        <div
                          key={s.value}
                          onClick={() => {
                            setState(s.value);
                            setStateCode(s.code);
                            setStateSearchTerm(s.label);
                            setShowStateDropdown(false);
                            setCounty(""); // Reset county when state changes
                            setCountySearchTerm(""); // Reset county search term
                          }}
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-[#16305B]"
                        >
                          {s.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {validationErrors.state && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.state}</p>
                )}
              </div>

              {/* County - Searchable Dropdown */}
              <div ref={countyDropdownRef}>
                <label className="block mb-1 text-[#16305B] font-medium">
                  County <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={countySearchTerm}
                    onChange={(e) => {
                      setCountySearchTerm(e.target.value);
                      setShowCountyDropdown(true);
                    }}
                    onFocus={() => setShowCountyDropdown(true)}
                    placeholder={countiesLoading ? "Loading counties..." : !state ? "Select state first" : "Search county..."}
                    disabled={!state || countiesLoading}
                    className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {countiesLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#16305B]"></div>
                    </div>
                  )}
                  {showCountyDropdown && !countiesLoading && filteredCounties.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-[#bfc6d1] rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredCounties.map((c) => (
                        <div
                          key={c.value}
                          onClick={() => {
                            setCounty(c.value);
                            setCountySearchTerm(c.label);
                            setShowCountyDropdown(false);
                          }}
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-[#16305B]"
                        >
                          {c.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {validationErrors.county && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.county}</p>
                )}
              </div>

              {/* Type of Trial Case - Fixed to Civil */}
              <div>
                <label className="block mb-1 text-[#16305B] font-medium">
                  Type of Trial Case <span className="text-red-500">*</span>
                </label>
                <div className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-gray-100 text-[#16305B] font-semibold">
                  Civil (Standard)
                </div>
                <p className="text-xs text-gray-500 mt-1">Currently, only civil cases are supported</p>
              </div>

              {/* Trial Case Tier */}
              <div>
                <label className="block mb-1 text-[#16305B] font-medium">
                  Trial Case Tier <span className="text-red-500">*</span>
                </label>
                <select
                  value={caseTier}
                  onChange={e => setCaseTier(e.target.value)}
                  className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B]"
                >
                  <option value="">Select Trial Case Tier</option>
                  <option value="Tier 1">Tier 1 - 2.5 hours, $3,500</option>
                  <option value="Tier 2">Tier 2 - 3.5 hours, $4,500</option>
                  <option value="Tier 3">Tier 3 - 4.5 hours, $5,500</option>
                </select>
                {validationErrors.caseTier && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.caseTier}</p>
                )}
              </div>

              {/* Required Jurors - Fixed to 7 */}
              <div>
                <label className="block mb-1 text-[#16305B] font-medium">
                  Number of Required Jurors <span className="text-red-500">*</span>
                </label>
                <div className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-gray-100 text-[#16305B] font-semibold">
                  Minimum 6 to Maximum 10
                </div>
                <p className="text-xs text-gray-500 mt-1">All cases require Minimum 6 to Maximum 10 jurors</p>
              </div>

              {/* Case Description */}
              <div>
                <label className="block mb-1 text-[#16305B] font-medium">
                  Case Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={caseDescription}
                  onChange={e => setCaseDescription(e.target.value)}
                  placeholder="This section will be posted on the juror job board. Please do not include any confidential information."
                  className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B]"
                  rows={3}
                />
                {validationErrors.caseDescription && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.caseDescription}</p>
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