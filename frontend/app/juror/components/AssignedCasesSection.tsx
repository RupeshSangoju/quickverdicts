"use client";

import {
  QuestionMarkCircleIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/apiClient";
import { formatDateString } from "@/lib/dateUtils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

type ApprovedCase = {
  ApplicationId: number;
  CaseId: number;
  CaseTitle: string;
  ScheduledDate: string;
  ScheduledTime: string;
  PaymentAmount: number;
  LawFirmName: string;
  AttorneyStatus?: string;
};

export default function AssignedCasesSection() {
  const [approvedCases, setApprovedCases] = useState<ApprovedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkLocalStorage = () => {
      const storedUser = localStorage.getItem("jurorUser");
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          const verified = user.isVerified || false;
          setIsVerified(prev => {
            if (prev !== verified) {
              console.log("🔐 AssignedCases - Verification status changed:", verified);
            }
            return verified;
          });
        } catch (e) {
          console.error("Failed to parse localStorage:", e);
        }
      }
    };

    const fetchData = async () => {
      try {
        // Check localStorage first
        checkLocalStorage();

        const token = getToken();

        // Fetch juror profile to check approval status
        const profileRes = await fetch(`${API_BASE}/api/juror/profile`, {
          headers: {
            "Authorization": token ? `Bearer ${token}` : "",
          },
        });
        const profileData = await profileRes.json();

        // ✅ FIXED: Backend returns camelCase fields
        if (profileData.success && profileData.data?.juror) {
          const jurorData = profileData.data.juror;
          const verified = jurorData.isVerified || false;

          console.log("📦 AssignedCases - Backend data:", {
            isVerified: jurorData.isVerified
          });

          setIsVerified(verified);

          // Fetch approved cases only if verified
          if (verified) {
            const res = await fetch(`${API_BASE}/api/juror/applications`, {
              headers: {
                "Authorization": token ? `Bearer ${token}` : "",
              },
            });
            const data = await res.json();
            console.log("📦 Applications data:", data);

            if (data.success) {
              // Handle both data.applications and data.data.applications formats
              const applications = data.applications || data.data?.applications || [];
              if (Array.isArray(applications)) {
                const approved = applications.filter((app: any) => app.Status === "approved");
                console.log("📦 AssignedCases - Approved cases with timing:", approved.map((app: any) => ({
                  id: app.CaseId,
                  title: app.CaseTitle,
                  status: app.AttorneyStatus,
                  scheduledDate: app.ScheduledDate
                })));
                setApprovedCases(approved);
              } else {
                console.warn("No applications data received or invalid format");
                setApprovedCases([]);
              }
            } else {
              console.warn("API request failed:", data);
              setApprovedCases([]);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // ✅ Poll localStorage every 3 seconds to catch verification updates
    const pollInterval = setInterval(checkLocalStorage, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  if (loading) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#0C2D57]"></div>
          <span className="mt-4 text-lg text-[#0C2D57]">Loading...</span>
        </div>
      </main>
    );
  }

  // Show locked state for unverified jurors
  if (!isVerified) {
    return (
      <main className="flex-1 min-h-screen overflow-y-auto p-0 bg-[#FAF9F6]">
        <div className="p-8 md:p-10 w-full">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-[#0C2D57] leading-tight">
                Assigned Cases
              </h1>
              <p className="mt-2 text-sm text-gray-600">Cases you've been approved for</p>
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
                Your account is pending verification by an administrator. You will be able to access the Assigned Cases section once your account is verified.
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

  return (
    <main className="flex-1 min-h-screen overflow-y-auto p-0">
      <div className="p-8 md:p-10 bg-[#FAF9F6] min-h-screen w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#0C2D57] leading-tight">
              Assigned Cases
            </h1>
            <p className="mt-2 text-sm text-gray-600">Cases you've been approved for</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <button className="flex items-center gap-2 px-3 py-1 rounded hover:bg-white/60">
              <QuestionMarkCircleIcon className="w-5 h-5 text-gray-600" />
              <span>Help</span>
            </button>
          </div>
        </div>

        {/* Approved Cases */}
        <section>
          {approvedCases.length === 0 ? (
            <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow-sm">
              <p className="mb-4">You do not have any approved cases yet.</p>
              <button 
                className="px-4 py-2 bg-[#0C2D57] text-white rounded-md hover:bg-[#0a2347]"
                onClick={() => router.push("/juror")}
              >
                Browse Available Cases
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {approvedCases.map((caseItem) => {
                // ✅ FIXED: Check if war room is accessible (1 hour before trial)
                // Combine ScheduledDate and ScheduledTime for accurate timing
                const trialDateTime = new Date(`${caseItem.ScheduledDate}T${caseItem.ScheduledTime || '00:00:00'}`);
                const now = new Date();
                const hoursUntilTrial = (trialDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                const isAccessible = hoursUntilTrial <= 1; // Can access 1 hour before trial

                // Determine status badge based on case state and timing
                let statusBadge = { text: '', color: '', icon: '' };

                if (caseItem.AttorneyStatus === "view_details") {
                  statusBadge = {
                    text: 'Trial Completed',
                    color: 'bg-purple-100 text-purple-800 border-purple-300',
                    icon: '✓'
                  };
                } else if (caseItem.AttorneyStatus === "join_trial") {
                  statusBadge = {
                    text: 'Ready to Join Trial',
                    color: 'bg-green-100 text-green-800 border-green-300',
                    icon: '🎥'
                  };
                } else if (isAccessible) {
                  statusBadge = {
                    text: 'War Room Available',
                    color: 'bg-green-100 text-green-800 border-green-300',
                    icon: '✓'
                  };
                } else {
                  statusBadge = {
                    text: 'Preparing for Trial',
                    color: 'bg-blue-100 text-blue-800 border-blue-300',
                    icon: '📋'
                  };
                }

                return (
                  <div key={caseItem.ApplicationId} className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-[#0C2D57] mb-2">{caseItem.CaseTitle}</h3>
                      <p className="text-sm text-gray-600">{caseItem.LawFirmName}</p>
                    </div>

                    {/* Status Badge */}
                    <div className="mb-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge.color}`}>
                        <span>{statusBadge.icon}</span>
                        <span>{statusBadge.text}</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Trial Date:</span>
                        <span className="font-medium text-gray-800">
                          {formatDateString(caseItem.ScheduledDate, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Time:</span>
                        <span className="font-medium text-gray-800">{caseItem.ScheduledTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Compensation:</span>
                        <span className="font-semibold text-green-600">${caseItem.PaymentAmount}</span>
                      </div>
                    </div>

                    {/* ✅ FIXED: Conditional access based on trial timing */}
                    {(caseItem.AttorneyStatus === "view_details" || caseItem.AttorneyStatus === "join_trial" || isAccessible) ? (
                      <button
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0C2D57] text-white rounded-md hover:bg-[#0a2347] transition"
                        onClick={() => {
                          if (caseItem.AttorneyStatus === "join_trial") {
                            window.open(`/juror/trial/${caseItem.CaseId}/setup`, '_blank');
                          } else {
                            router.push(`/juror/war-room/${caseItem.CaseId}`);
                          }
                        }}
                      >
                        <span>{caseItem.AttorneyStatus === "join_trial" ? "Join Trial" : caseItem.AttorneyStatus === "view_details" ? "View Details" : "Access War Room"}</span>
                        <ArrowRightIcon className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <button
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed"
                          disabled
                        >
                          <Lock className="w-4 h-4" />
                          <span>War Room Locked</span>
                        </button>
                        <p className="text-xs text-center text-gray-600">
                          {hoursUntilTrial > 24
                            ? `Available ${Math.floor(hoursUntilTrial / 24)} day${Math.floor(hoursUntilTrial / 24) > 1 ? 's' : ''} before trial`
                            : hoursUntilTrial > 1
                            ? `Available in ${Math.ceil(hoursUntilTrial)} hour${Math.ceil(hoursUntilTrial) > 1 ? 's' : ''}`
                            : 'Available soon'}
                        </p>
                      </div>
                    )}
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