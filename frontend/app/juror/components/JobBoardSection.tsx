"use client";

import Image from "next/image";
import {
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { TruckIcon, BanknotesIcon } from "@heroicons/react/24/solid";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/apiClient";
import { formatDateString } from "@/lib/dateUtils";

// Format time to clean format (remove milliseconds)
function formatTimeClean(timeStr: string): string {
  if (!timeStr) return "N/A";
  // Remove milliseconds (e.g., "16:00:00.0000000" -> "16:00:00")
  const cleanTime = timeStr.split('.')[0];
  // Extract hours and minutes only (e.g., "16:00:00" -> "16:00")
  const [hours, minutes] = cleanTime.split(':');
  return `${hours}:${minutes}`;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, "")
  : "http://localhost:4000";

type AvailableCase = {
  CaseId: number;
  CaseTitle: string;
  CaseDescription: string;
  CaseType: string;
  CaseTier: string;
  County: string;
  ScheduledDate: string;
  ScheduledTime: string;
  PaymentAmount: number;
  RequiredJurors: number;
  ApprovedJurors: number;
  LawFirmName: string;
  AttorneyName: string;
  PlaintiffGroups: string;
  DefendantGroups: string;
};

function getCaseName(plaintiffGroups: string, defendantGroups: string) {
  try {
    const plaintiffs = JSON.parse(plaintiffGroups);
    const defendants = JSON.parse(defendantGroups);
    const plaintiffName =
      plaintiffs[0]?.plaintiffs?.[0]?.name || "Plaintiff";
    const defendantName =
      defendants[0]?.defendants?.[0]?.name || "Defendant";
    return `${plaintiffName} v. ${defendantName}`;
  } catch {
    return "Case";
  }
}

export default function JobBoardSection() {
  const router = useRouter();
  const [cases, setCases] = useState<AvailableCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [jurorLocation, setJurorLocation] = useState({
    state: "",
    county: "",
  });
  const [showOnboardingRequired, setShowOnboardingRequired] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const checkLocalStorage = () => {
      const storedUser = localStorage.getItem("jurorUser");
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          const verified = user.isVerified || false;
          setIsVerified(prev => {
            if (prev !== verified) {
              console.log("🔐 JobBoard - Verification status changed:", verified);
            }
            return verified;
          });
        } catch (e) {
          console.error("Failed to parse localStorage:", e);
        }
      }
    };

    // Initial check
    checkLocalStorage();

    // Fetch cases
    fetchAvailableCases();

    // ✅ Poll localStorage every 3 seconds to catch verification updates
    const pollInterval = setInterval(checkLocalStorage, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  const fetchAvailableCases = async () => {
  setLoading(true);
  try {
    const token = getToken();

    // First check approval status
    const profileRes = await fetch(`${API_BASE}/api/juror/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (profileRes.ok) {
      const profileData = await profileRes.json();

      // ✅ FIXED: Backend returns camelCase fields
      if (profileData.success && profileData.data?.juror) {
        const jurorData = profileData.data.juror;
        const verified = jurorData.isVerified || false;

        console.log("📦 JobBoard - Backend data:", {
          isVerified: jurorData.isVerified
        });

        setIsVerified(verified);

        // Only fetch cases if verified
        if (!verified) {
          setLoading(false);
          return;
        }
      }
    }

    const response = await fetch(
      `${API_BASE}/api/juror/cases/available`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 403) {
      const errorData = await response.json();
      if (errorData.code === "ONBOARDING_REQUIRED") {
        setShowOnboardingRequired(true);
        return;
      }
    }

    if (!response.ok) {
      throw new Error("Failed to fetch cases");
    }

    const data = await response.json();
    if (data.success) {
      // 🔍 DEBUGGING LOGS
      console.log("=== JOB BOARD - FRONTEND RECEIVED DATA ===");
      console.log("Full response:", data);
      console.log("Cases from data.data.cases:", data.data?.cases);

      // ✅ FIXED: Backend wraps everything in 'data' property
      const cases = data.data?.cases || [];
      const filters = data.data?.filters || { state: "", county: "" };

      if (cases.length > 0) {
        console.log("First case:", cases[0]);
        console.log("RequiredJurors:", cases[0].RequiredJurors);
        console.log("ApprovedJurors:", cases[0].ApprovedJurors);
        console.log("Spots left:", cases[0].RequiredJurors - cases[0].ApprovedJurors);
      }

      setCases(cases);
      setJurorLocation(filters);
    }
  } catch (error) {
    console.error("Error fetching available cases:", error);
  } finally {
    setLoading(false);
  }
};

  const handleApply = (caseId: number) => {
    router.push(`/juror/apply/${caseId}`);
  };

  const handleGoToHome = () => {
    window.location.href = "/juror";
  };

  // Show locked state for unverified jurors
  if (!isVerified && !loading) {
    return (
      <main className="flex-1 min-h-screen overflow-y-auto p-0 bg-[#FAF9F6]">
        <div className="p-8 md:p-10 w-full">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-[#0C2D57] leading-tight">
                Job Board
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Apply to available trial postings
              </p>
            </div>
          </div>

          {/* Locked State */}
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="bg-white rounded-lg shadow-lg p-12 max-w-md text-center">
              <div className="mb-6">
                <Lock className="mx-auto h-16 w-16 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Access Restricted</h2>
              <p className="text-gray-600 mb-4">
                Your account is pending verification by an administrator. You will be able to access the Job Board section once your account is verified.
              </p>
              <p className="text-sm text-gray-500">
                This usually takes 24-48 hours. You'll receive a notification once your account is verified.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // show onboarding required message
  if (showOnboardingRequired) {
    return (
      <main className="flex-1 min-h-screen overflow-y-auto p-0">
        <div className="p-8 md:p-10 bg-[#FAF9F6] min-h-screen w-full flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full border-2 border-yellow-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <ExclamationTriangleIcon className="w-10 h-10 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-[#0C2D57] mb-3">
                Onboarding Required
              </h2>
              <p className="text-gray-600 mb-2">
                To access the Job Board and apply for cases, you must
                first complete the onboarding process.
              </p>
              <p className="text-gray-600 mb-6">
                Please complete the following requirements:
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6 w-full text-left">
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-[#0C2D57] rounded-full mr-3"></span>
                    Watch the Introduction Video
                  </li>
                  <li className="flex items-center">
                    <span className="w-2 h-2 bg-[#0C2D57] rounded-full mr-3"></span>
                    Complete the Juror Qualification Quiz
                  </li>
                </ul>
              </div>
              <button
                onClick={handleGoToHome}
                className="w-full bg-[#0C2D57] text-white py-3 px-6 rounded-lg font-semibold hover:bg-[#0a2347] transition-colors"
              >
                Go to Home to Complete Onboarding
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // filter cases
  const filteredCases = cases.filter((caseItem) => {
    const caseName = getCaseName(
      caseItem.PlaintiffGroups,
      caseItem.DefendantGroups
    );
    return (
      caseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caseItem.CaseTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // sort cases
  const sortedCases = [...filteredCases].sort((a, b) => {
    if (sortBy === "trialDateAscending") {
      return (
        new Date(a.ScheduledDate).getTime() -
        new Date(b.ScheduledDate).getTime()
      );
    }
    if (sortBy === "trialDateDescending") {
      return (
        new Date(b.ScheduledDate).getTime() -
        new Date(a.ScheduledDate).getTime()
      );
    }
    if (sortBy === "compensationAscending") {
      return a.PaymentAmount - b.PaymentAmount;
    }
    if (sortBy === "compensationDescending") {
      return b.PaymentAmount - a.PaymentAmount;
    }
    return 0;
  });

  return (
    <main className="flex-1 min-h-screen overflow-y-auto p-0">
      <div className="p-8 md:p-10 bg-[#FAF9F6] min-h-screen w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#0C2D57] leading-tight">
              Job Board
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Apply to available trial postings
              {jurorLocation.county && (
                <span className="ml-2 text-[#0C2D57] font-medium">
                  • Showing cases for {jurorLocation.county},{" "}
                  {jurorLocation.state}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <button className="flex items-center gap-2 px-3 py-1 rounded hover:bg-white/60">
              <QuestionMarkCircleIcon className="w-5 h-5 text-gray-600" />
              <span>Help</span>
            </button>
          </div>
        </div>

        {/* Search + Sort */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center w-2/3">
            <input
              type="text"
              placeholder="Search cases..."
              className="w-full px-4 py-2 border rounded-md text-sm text-gray-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="bg-[#0C2D57] text-white px-4 py-2 rounded-md ml-2">
              Search
            </button>
          </div>
          <div className="relative inline-block text-left">
            <select
              className="px-4 py-2 border rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0C2D57]"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="">Sort By</option>
              <option value="trialDateAscending">Trial Date (Earliest)</option>
              <option value="trialDateDescending">Trial Date (Latest)</option>
              <option value="compensationAscending">Pay (Low to High)</option>
              <option value="compensationDescending">Pay (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Job Board */}
        <section>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#0C2D57]"></div>
              <span className="ml-4 text-lg text-[#0C2D57]">
                Loading cases...
              </span>
            </div>
          ) : sortedCases.length === 0 ? (
            <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow-sm">
              <TruckIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">No cases currently available</p>
              <p className="text-sm mt-2">
                {searchQuery
                  ? "Try adjusting your search terms"
                  : "Check back later for new trial postings"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {sortedCases.map((caseItem) => {
                const caseName = getCaseName(
                  caseItem.PlaintiffGroups,
                  caseItem.DefendantGroups
                );
                const trialDate = formatDateString(caseItem.ScheduledDate, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const spotsLeft =
                  caseItem.RequiredJurors - caseItem.ApprovedJurors;

                return (
                  <div
                    key={caseItem.CaseId}
                    className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                  >
                    {/* Header */}
                    <div className="bg-slate-50 border-b border-gray-200 px-4 py-3">
                      <h3 className="font-semibold text-sm text-[#0C2D57] line-clamp-2 mb-1">
                        {caseName}
                      </h3>
                      <p className="text-xs text-gray-500">Case #{caseItem.CaseId}</p>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-3">
                      {/* Available Spots */}
                      <div className="flex items-center pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                          </svg>
                          <span className="text-xs font-semibold text-blue-700">{spotsLeft} open</span>
                        </div>
                      </div>

                      {/* Case Details */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Date:</span>
                          <span className="font-medium text-gray-900">{trialDate}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Time:</span>
                          <span className="font-medium text-gray-900">{formatTimeClean(caseItem.ScheduledTime)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Location:</span>
                          <span className="font-medium text-gray-900 truncate ml-2">{caseItem.County}</span>
                        </div>
                      </div>

                      {/* Apply Button */}
                      <button
                        onClick={() => handleApply(caseItem.CaseId)}
                        className="w-full mt-3 py-2.5 bg-[#0C2D57] text-white rounded-md font-semibold text-sm hover:bg-[#0a2347] transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}