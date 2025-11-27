"use client";

import Image from "next/image";
import {
  QuestionMarkCircleIcon,
  ArrowUpRightIcon,
} from "@heroicons/react/24/outline";
import {
  BanknotesIcon,
  TruckIcon,
} from "@heroicons/react/24/solid";
import { Lock, DollarSign, TrendingUp, Briefcase, AlertCircle, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/apiClient";
import { formatDateString } from "@/lib/dateUtils";
import VideoIntroOverlay from "./VideoIntroOverlay";
import JurorQuizOverlay from "./JurorQuizOverlay";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

function getCaseName(plaintiffGroups: string, defendantGroups: string) {
  try {
    const plaintiffs = JSON.parse(plaintiffGroups);
    const defendants = JSON.parse(defendantGroups);
    const plaintiffName = plaintiffs[0]?.plaintiffs?.[0]?.name || "Plaintiff";
    const defendantName = defendants[0]?.defendants?.[0]?.name || "Defendant";
    return `${plaintiffName} v. ${defendantName}`;
  } catch {
    return "Case";
  }
}

type Application = {
  ApplicationId: number;
  CaseId: number;
  Status: "pending" | "approved" | "rejected";
  AppliedAt: string;
  CaseTitle: string;
  ScheduledDate: string;
  ScheduledTime?: string;
  PaymentAmount: number;
  AttorneyStatus?: string; // To track case state: war_room, join_trial, view_details
};

type PaymentStats = {
  totalEarned: string;
  pendingPayments: number;
  completedPayments: number;
  failedPayments: number;
  totalTransactions: number;
};

export default function HomeSection({ sidebarCollapsed }: { sidebarCollapsed: boolean }) {
  const [juror, setJuror] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIntroVideo, setShowIntroVideo] = useState(false);
  const [introVideoCompleted, setIntroVideoCompleted] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [availableCases, setAvailableCases] = useState<any[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [assignedCases, setAssignedCases] = useState<Application[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [paymentStatsLoading, setPaymentStatsLoading] = useState(false);
  const router = useRouter();

  const fetchJurorProfile = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/juror/profile`, {
        method: "GET",
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (data.success && data.data?.juror) {
        const jurorData = data.data.juror;
        setJuror(jurorData);

        // ✅ FIXED: Backend returns camelCase fields - use strict equality
        const introCompleted = jurorData.introVideoCompleted === true;
        const quizDone = jurorData.jurorQuizCompleted === true;
        const verified = jurorData.isVerified === true;

        console.log("📦 HomeSection - Backend data:", {
          isVerified: jurorData.isVerified,
          introVideoCompleted: jurorData.introVideoCompleted,
          jurorQuizCompleted: jurorData.jurorQuizCompleted,
          calculated: { introCompleted, quizDone, verified }
        });

        // ✅ FIXED: Always trust backend as source of truth
        // Backend database is the single source of truth for completion status
        // This prevents stale localStorage data from showing false completion
        setIntroVideoCompleted(introCompleted);
        setQuizCompleted(quizDone);
        setIsVerified(verified);

        // Save to localStorage for persistence on refresh
        // Always sync localStorage with backend database values
        const jurorUser = {
          jurorId: jurorData.id,
          email: jurorData.email,
          firstName: jurorData.name?.split(' ')[0] || '',
          lastName: jurorData.name?.split(' ').slice(1).join(' ') || '',
          isVerified: verified,
          verificationStatus: jurorData.verificationStatus || 'pending',
          introVideoCompleted: introCompleted,
          jurorQuizCompleted: quizDone,
          onboardingCompleted: introCompleted && quizDone
        };
        localStorage.setItem("jurorUser", JSON.stringify(jurorUser));

        return jurorData;
      } else {
        setError("Failed to fetch juror details");
      }
    } catch (err) {
      setError("Failed to fetch juror details");
    }
    return null;
  };

  const fetchMyApplications = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/juror/applications`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (data.success) {
        const allApplications = data.data?.applications || [];
        // Separate approved cases (assigned) from pending/rejected
        const approved = allApplications.filter((app: Application) => app.Status === "approved");
        const others = allApplications.filter((app: Application) => app.Status !== "approved");
        setAssignedCases(approved);
        setApplications(others);
      }
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    }
  };

  const fetchPaymentStats = async () => {
    try {
      setPaymentStatsLoading(true);
      const token = getToken();

      if (!token) {
        console.log("❌ No auth token, cannot fetch payment stats");
        return;
      }

      const res = await fetch(`${API_BASE}/api/payments/juror/stats`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.success && data.stats) {
        setPaymentStats(data.stats);
      } else {
        setPaymentStats(null);
      }
    } catch (err) {
      console.error("❌ Failed to fetch payment stats:", err);
      setPaymentStats(null);
    } finally {
      setPaymentStatsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      // Restore from localStorage first (for persistence on refresh)
      const checkLocalStorage = () => {
        const storedUser = localStorage.getItem("jurorUser");
        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            const intro = user.introVideoCompleted === true;  // Strict check
            const quiz = user.jurorQuizCompleted === true;   // Strict check
            const verified = user.isVerified === true;       // Strict check

            console.log("📦 localStorage values:", {
              intro,
              quiz,
              verified,
              raw: user
            });

            // Only update if values actually changed to prevent unnecessary re-renders
            setIntroVideoCompleted(prev => prev !== intro ? intro : prev);
            setQuizCompleted(prev => prev !== quiz ? quiz : prev);
            setIsVerified(prev => {
              if (prev !== verified) {
                console.log("✅ Verification status changed in localStorage:", verified);
                return verified;
              }
              return prev;
            });
          } catch (e) {
            console.error("Failed to parse localStorage:", e);
          }
        } else {
          console.log("📦 No jurorUser in localStorage - fresh login");
        }
      };

      // Initial check
      checkLocalStorage();

      // Then fetch fresh data from backend
      await fetchJurorProfile();
      await fetchMyApplications();
      setLoading(false);

      // ✅ Poll localStorage every 3 seconds to catch verification updates from parent page
      const pollInterval = setInterval(checkLocalStorage, 3000);

      return () => clearInterval(pollInterval);
    };
    init();
  }, []);

  useEffect(() => {
  // Fetch available cases and payment stats if verified and onboarding completed
  const fetchAvailableCases = async () => {
    const assignmentsCompletedLocal = introVideoCompleted && quizCompleted;
    if (!isVerified || !assignmentsCompletedLocal) return;

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/juror/cases/available`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (data.success) {
        // 🔍 DEBUGGING LOGS
        console.log("=== HOME SECTION - FRONTEND RECEIVED DATA ===");
        console.log("Full response:", data);
        console.log("Cases from data.data.cases:", data.data?.cases);

        // ✅ FIXED: Backend wraps everything in 'data' property
        const cases = data.data?.cases || [];

        if (cases.length > 0) {
          console.log("First case:", cases[0]);
          console.log("RequiredJurors:", cases[0].RequiredJurors);
          console.log("ApprovedJurors:", cases[0].ApprovedJurors);
          console.log("Spots left:", cases[0].RequiredJurors - cases[0].ApprovedJurors);
        }

        setAvailableCases(cases.slice(0, 8)); // Show first 8 cases
      }
    } catch (err) {
      console.error("Failed to fetch available cases:", err);
    }
  };

  fetchAvailableCases();

  // Fetch payment stats if verified
  if (isVerified) {
    fetchPaymentStats();
  }
}, [isVerified, introVideoCompleted, quizCompleted]);

  // ✅ AUTO-SHOW video on first login
  useEffect(() => {
    // Only run after loading is complete and data is fetched
    if (!loading && !introVideoCompleted && !showIntroVideo) {
      console.log("🎬 Auto-showing intro video for first-time user");
      setShowIntroVideo(true);
    }
  }, [loading, introVideoCompleted, showIntroVideo]);

  const handleVideoNext = async () => {
    try {
      const token = getToken();
      // ✅ FIXED: Correct endpoint is /onboarding/:taskId/complete
      const res = await fetch(`${API_BASE}/api/juror/onboarding/intro_video/complete`, {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
          "Content-Type": "application/json"
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Backend error:", errorText);
        throw new Error(`Failed to update video completion: ${res.status}`);
      }

      const data = await res.json();
      console.log("✅ Video completion saved:", data);

      // Update state immediately
      setShowIntroVideo(false);
      setIntroVideoCompleted(true);

      // Update localStorage immediately to prevent overwrites
      const storedUser = localStorage.getItem("jurorUser");
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          user.introVideoCompleted = true;
          localStorage.setItem("jurorUser", JSON.stringify(user));
          console.log("✅ Updated localStorage with video completion");
        } catch (e) {
          console.error("Failed to update localStorage:", e);
        }
      }

      // Wait a bit before fetching to ensure backend has committed
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchJurorProfile();
    } catch (error) {
      console.error("Failed to update video completion:", error);
      alert("Failed to save video completion. Please try again.");
    }
  };

  const handleQuizFinish = async () => {
    try {
      const token = getToken();
      // ✅ FIXED: Correct endpoint is /onboarding/:taskId/complete
      const res = await fetch(`${API_BASE}/api/juror/onboarding/juror_quiz/complete`, {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
          "Content-Type": "application/json"
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Backend error:", errorText);
        throw new Error(`Failed to update quiz completion: ${res.status}`);
      }

      const data = await res.json();
      console.log("✅ Quiz completion saved:", data);

      // Update state immediately
      setShowQuiz(false);
      setQuizCompleted(true);

      // Update localStorage immediately to prevent overwrites
      const storedUser = localStorage.getItem("jurorUser");
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          user.jurorQuizCompleted = true;
          user.onboardingCompleted = user.introVideoCompleted && true; // Both must be true
          localStorage.setItem("jurorUser", JSON.stringify(user));
          console.log("✅ Updated localStorage with quiz completion");
        } catch (e) {
          console.error("Failed to update localStorage:", e);
        }
      }

      // Wait a bit before fetching to ensure backend has committed
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchJurorProfile();
    } catch (error) {
      console.error("Failed to update quiz completion:", error);
      alert("Failed to save quiz completion. Please try again.");
    }
  };

  const tasks = [
    {
      title: "Introduction to Quick Verdicts Video",
      duration: "5 minutes",
      img: "/introduction_video.png",
      key: "intro-video"
    },
    {
      title: "Juror Quiz",
      duration: "3 minutes",
      img: "/juror_quiz.png",
      key: "quiz"
    },
  ];

  const assignmentsCompleted = introVideoCompleted && quizCompleted;

  // ✅ DEBUG: Log state values
  console.log("🎯 HomeSection state:", {
    loading,
    introVideoCompleted,
    quizCompleted,
    assignmentsCompleted,
    isVerified,
    showIntroVideo,
    showQuiz
  });

  if (loading) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[60vh]">
          <div className="animate-spin rounded-full h-20 w-20 border-t-8 border-b-8 border-[#0C2D57] mb-6" />
          <span className="text-lg text-[#0C2D57] font-semibold">Loading dashboard...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-screen overflow-y-auto p-0 relative">
      <VideoIntroOverlay
        open={showIntroVideo}
        onClose={() => setShowIntroVideo(false)}
        onNext={handleVideoNext}
        sidebarCollapsed={sidebarCollapsed}
      />
      <JurorQuizOverlay
        open={showQuiz}
        onClose={() => setShowQuiz(false)}
        onFinish={handleQuizFinish}
        sidebarCollapsed={sidebarCollapsed}
      />
      <div className="p-8 md:p-10 bg-[#FAF9F6] min-h-screen w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#0C2D57] leading-tight">
              {`Welcome, ${juror?.name || "Juror"}!`}
            </h1>
            <p className="mt-2 text-sm text-gray-600">Good to see you — here's what's next</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <button className="flex items-center gap-2 px-3 py-1 rounded hover:bg-white/60">
              <QuestionMarkCircleIcon className="w-5 h-5 text-gray-600" />
              <span>Help</span>
            </button>
          </div>
        </div>

        {/* Approval Status Alert */}
        {!isVerified && (
          <div className="mb-8 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Account Pending Verification</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Your account is currently under review. You will gain full access to Assigned Cases and Job Board once verified by an administrator.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Earnings Overview */}
        {isVerified && assignmentsCompleted && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-[#0C2D57] mb-4 flex items-center gap-2">
              <DollarSign size={20} />
              Your Earnings
            </h2>
            {paymentStatsLoading ? (
              <div className="bg-white rounded-lg shadow-md p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-b-4 border-[#0C2D57]"></div>
              </div>
            ) : paymentStats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-md p-6 border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-green-900">Total Earned</h3>
                    <DollarSign className="text-green-600" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-green-700">${parseFloat(paymentStats.totalEarned).toLocaleString()}</p>
                  <p className="text-xs text-green-600 mt-1">Lifetime earnings</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-blue-900">Completed Trials</h3>
                    <TrendingUp className="text-blue-600" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-blue-700">{paymentStats.completedPayments}</p>
                  <p className="text-xs text-blue-600 mt-1">Trials completed</p>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg shadow-md p-6 border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-yellow-900">Pending</h3>
                    <AlertCircle className="text-yellow-600" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-yellow-700">{paymentStats.pendingPayments}</p>
                  <p className="text-xs text-yellow-600 mt-1">Awaiting payment</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg shadow-md p-6 border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-purple-900">Total Trials</h3>
                    <Briefcase className="text-purple-600" size={20} />
                  </div>
                  <p className="text-3xl font-bold text-purple-700">{paymentStats.totalTransactions}</p>
                  <p className="text-xs text-purple-600 mt-1">All-time trials</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-600">No earnings data available yet. Complete trials to start earning!</p>
              </div>
            )}
          </section>
        )}

        {/* Platform Info Section - How It Works */}
        {isVerified && assignmentsCompleted && (
          <section className="mb-10">
            <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 border border-slate-200 rounded-2xl p-8 shadow-sm">
              <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-[#0C2D57] mb-2">
                    Earn Money as a Virtual Juror
                  </h2>
                  <p className="text-slate-600 text-sm">
                    Participate in mock trials and help attorneys prepare for real cases while earning competitive compensation
                  </p>
                </div>

                {/* Payment Tiers */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Tier 1 */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tier 1</span>
                      <span className="text-2xl font-bold text-[#0C2D57]">$65</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-slate-600">2.5 hours duration</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500">Shorter cases, quicker turnaround</p>
                    </div>
                  </div>

                  {/* Tier 2 */}
                  <div className="bg-white border-2 border-blue-200 rounded-xl p-5 hover:shadow-md transition-shadow relative">
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Tier 2</span>
                      <span className="text-2xl font-bold text-[#0C2D57]">$75</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-slate-600">3 hours duration</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500">Standard cases, balanced commitment</p>
                    </div>
                  </div>

                  {/* Tier 3 */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tier 3</span>
                      <span className="text-2xl font-bold text-[#0C2D57]">$90</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-slate-600">4 hours duration</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500">Complex cases, premium compensation</p>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <BanknotesIcon className="w-5 h-5 text-[#0C2D57] mr-1" />
                      <p className="text-sm font-semibold text-[#0C2D57]">Instant Payment</p>
                    </div>
                    <p className="text-xs text-slate-500">Paid upon trial completion</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <svg className="w-5 h-5 text-[#0C2D57] mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-semibold text-[#0C2D57]">Flexible Schedule</p>
                    </div>
                    <p className="text-xs text-slate-500">Choose trials that fit your time</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <svg className="w-5 h-5 text-[#0C2D57] mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <p className="text-sm font-semibold text-[#0C2D57]">Work from Home</p>
                    </div>
                    <p className="text-xs text-slate-500">100% virtual participation</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Assigned Cases - Always show if verified and onboarding complete */}
        {isVerified && assignmentsCompleted && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-[#0C2D57]">My Assigned Cases</h2>
                <p className="text-sm text-slate-600">
                  Cases you've been selected for — review details and access war rooms
                </p>
              </div>
              <div className="px-4 py-2 bg-blue-50 rounded-lg">
                <span className="text-sm font-semibold text-blue-700">{assignedCases.length} Active</span>
              </div>
            </div>

            {assignedCases.length === 0 ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                <div className="max-w-sm mx-auto">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">No Assigned Cases Yet</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Once an attorney approves your application, your assigned cases will appear here. You'll be able to access the war room 1 hour before the trial begins.
                  </p>
                  <a href="#available-cases" className="inline-flex items-center gap-2 px-4 py-2 bg-[#0C2D57] text-white rounded-lg text-sm font-semibold hover:bg-[#0a2347] transition-colors">
                    Browse Available Cases
                    <ArrowUpRightIcon className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedCases.map((app) => {
                // Determine state based on AttorneyStatus
                let statusBadge = { text: '', color: '', icon: '' };
                let actionButtons = null;

                if (app.AttorneyStatus === "view_details") {
                  // Trial completed
                  statusBadge = {
                    text: 'Trial Completed',
                    color: 'bg-purple-100 text-purple-800 border-purple-300',
                    icon: '✓'
                  };
                  actionButtons = (
                    <button
                      className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-1.5"
                      onClick={() => router.push(`/juror/war-room/${app.CaseId}`)}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      View Details
                    </button>
                  );
                } else if (app.AttorneyStatus === "join_trial") {
                  // Trial is ready to start
                  statusBadge = {
                    text: 'Ready to Join Trial',
                    color: 'bg-green-100 text-green-800 border-green-300',
                    icon: '🎥'
                  };

                  // Combine ScheduledDate and ScheduledTime for accurate timing
                  const trialDateTime = new Date(`${app.ScheduledDate}T${app.ScheduledTime || '00:00:00'}`);
                  const now = new Date();
                  const hoursUntilTrial = (trialDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                  const isTrialSoon = hoursUntilTrial <= 24 && hoursUntilTrial >= -2;

                  actionButtons = (
                    <div className="space-y-1.5">
                      <button
                        className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                          isTrialSoon
                            ? 'bg-green-600 text-white hover:bg-green-700 animate-pulse'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                        onClick={() => window.open(`/juror/trial/${app.CaseId}/setup`, '_blank')}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {isTrialSoon ? 'Join Now' : 'Join Trial'}
                      </button>
                      <button
                        className="w-full px-3 py-1.5 bg-slate-100 text-[#0C2D57] rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                        onClick={() => router.push(`/juror/war-room/${app.CaseId}`)}
                      >
                        War Room
                      </button>
                    </div>
                  );
                } else {
                  // War room state (default for approved) - only clickable 1 hour before trial
                  // Combine ScheduledDate and ScheduledTime for accurate timing
                  const trialDateTime = new Date(`${app.ScheduledDate}T${app.ScheduledTime || '00:00:00'}`);
                  const now = new Date();
                  const hoursUntilTrial = (trialDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                  const isAccessible = hoursUntilTrial <= 1; // Can access 1 hour before trial

                  statusBadge = {
                    text: isAccessible ? 'War Room Available' : 'Preparing for Trial',
                    color: isAccessible ? 'bg-green-100 text-green-800 border-green-300' : 'bg-blue-100 text-blue-800 border-blue-300',
                    icon: isAccessible ? '✓' : '📋'
                  };

                  actionButtons = isAccessible ? (
                    <button
                      className="w-full px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5"
                      onClick={() => router.push(`/juror/war-room/${app.CaseId}`)}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Enter War Room
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-full px-3 py-2 bg-slate-100 text-slate-500 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed">
                        <Lock className="w-3.5 h-3.5" />
                        War Room Locked
                      </div>
                      <p className="text-xs text-center text-slate-600">
                        {hoursUntilTrial > 24
                          ? `Available ${Math.floor(hoursUntilTrial / 24)} days before trial`
                          : hoursUntilTrial > 1
                          ? `Available in ${Math.ceil(hoursUntilTrial)} hours`
                          : 'Available soon'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div
                    key={app.ApplicationId}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all duration-300 overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="bg-gradient-to-r from-[#0C2D57] to-[#1a4d8f] px-4 py-3">
                      <h3 className="font-bold text-sm text-white line-clamp-1">
                        {app.CaseTitle}
                      </h3>
                      <p className="text-xs text-blue-200 mt-0.5">Case #{app.CaseId}</p>
                    </div>

                    {/* Card Body */}
                    <div className="p-4">
                      {/* Status Badge */}
                      <div className="mb-3">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge.color}`}>
                          <span>{statusBadge.icon}</span>
                          <span className="line-clamp-1">{statusBadge.text}</span>
                        </div>
                      </div>

                      {/* Case Details */}
                      <div className="space-y-1.5 mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Trial Date:
                          </span>
                          <span className="font-semibold text-slate-800 text-xs">
                            {formatDateString(app.ScheduledDate, {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Time:
                          </span>
                          <span className="font-semibold text-slate-800 text-xs">
                            {app.ScheduledTime ? app.ScheduledTime.substring(0, 5) : 'TBD'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-slate-100">
                        {actionButtons}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </section>
        )}

        {/* Pending Applications - Show non-approved applications */}
        {applications.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[#0C2D57]">Pending Applications</h2>
                <p className="text-sm text-slate-600">
                  Track your applications awaiting attorney review
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {applications.map((app) => {
                // Determine application state and styling
                let statusBadge = { text: '', color: '', icon: '' };
                let actionButtons = null;
                
                if (app.Status === "pending") {
                  statusBadge = {
                    text: 'Pending Attorney Approval',
                    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                    icon: '⏳'
                  };
                } else if (app.Status === "rejected") {
                  statusBadge = {
                    text: 'Not Selected',
                    color: 'bg-red-100 text-red-800 border-red-300',
                    icon: '✕'
                  };
                } else if (app.Status === "approved") {
                  // Determine state based on AttorneyStatus
                  if (app.AttorneyStatus === "view_details") {
                    // Trial completed
                    statusBadge = {
                      text: 'Trial Completed',
                      color: 'bg-purple-100 text-purple-800 border-purple-300',
                      icon: '✓'
                    };
                    actionButtons = (
                      <button
                        className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-1.5"
                        onClick={() => router.push(`/juror/war-room/${app.CaseId}`)}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View Details
                      </button>
                    );
                  } else if (app.AttorneyStatus === "join_trial") {
                    // Trial is ready to start
                    statusBadge = {
                      text: 'Trial Room - Ready to Join',
                      color: 'bg-green-100 text-green-800 border-green-300',
                      icon: '🎥'
                    };

                    // Check if trial is happening soon
                    // Combine ScheduledDate and ScheduledTime for accurate timing
                    const trialDateTime = new Date(`${app.ScheduledDate}T${app.ScheduledTime || '00:00:00'}`);
                    const now = new Date();
                    const hoursUntilTrial = (trialDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                    const isTrialSoon = hoursUntilTrial <= 24 && hoursUntilTrial >= -2;
                    
                    actionButtons = (
                      <div className="space-y-1.5">
                        <button
                          className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                            isTrialSoon
                              ? 'bg-green-600 text-white hover:bg-green-700 animate-pulse'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                          onClick={() => window.open(`/juror/trial/${app.CaseId}/setup`, '_blank')}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {isTrialSoon ? 'Join Now' : 'Join Trial'}
                        </button>
                        <button
                          className="w-full px-3 py-1.5 bg-gray-100 text-[#0C2D57] rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                          onClick={() => router.push(`/juror/war-room/${app.CaseId}`)}
                        >
                          War Room
                        </button>
                      </div>
                    );
                  } else {
                    // War room state (default for approved)
                    statusBadge = {
                      text: 'Approved - War Room Access',
                      color: 'bg-blue-100 text-blue-800 border-blue-300',
                      icon: '📋'
                    };
                    actionButtons = (
                      <button
                        className="w-full px-3 py-2 bg-[#0C2D57] text-white rounded-lg text-xs font-semibold hover:bg-[#0a2347] transition-colors flex items-center justify-center gap-1.5"
                        onClick={() => router.push(`/juror/war-room/${app.CaseId}`)}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        War Room
                      </button>
                    );
                  }
                }
                
                return (
                  <div
                    key={app.ApplicationId}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="bg-gradient-to-r from-[#0C2D57] to-[#1a4d8f] px-4 py-2.5">
                      <h3 className="font-bold text-sm text-white line-clamp-1">
                        {app.CaseTitle}
                      </h3>
                      <p className="text-xs text-blue-200 mt-0.5">App #{app.ApplicationId}</p>
                    </div>
                    
                    {/* Card Body */}
                    <div className="p-4">
                      {/* Status Badge */}
                      <div className="mb-3">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusBadge.color}`}>
                          <span>{statusBadge.icon}</span>
                          <span className="line-clamp-1">{statusBadge.text}</span>
                        </div>
                      </div>
                      
                      {/* Case Details */}
                      <div className="space-y-1.5 mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Trial:
                          </span>
                          <span className="font-semibold text-gray-800 text-xs">
                            {formatDateString(app.ScheduledDate, {
                              month: "short",
                              day: "numeric"
                            })}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pay:
                          </span>
                          <span className="font-bold text-green-600 text-xs">${app.PaymentAmount}</span>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-gray-100">
                        {actionButtons || (
                          <div className="text-center text-xs text-gray-500 py-1.5">
                            {app.Status === "pending" ? "Awaiting review" : "No actions"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* My Tasks - Show if assignments not completed */}
        {!assignmentsCompleted && (
          <section className="mb-10">
            {/* Enhanced Header with Progress */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-[#0C2D57] mb-2">Complete Your Onboarding</h2>
                  <p className="text-sm text-gray-700">
                    Finish these required tasks to start applying to cases and earning money
                  </p>
                </div>
                <div className="ml-4 bg-white rounded-full px-4 py-2 shadow-sm">
                  <p className="text-xs text-gray-600 font-medium">Progress</p>
                  <p className="text-2xl font-bold text-[#0C2D57]">
                    {introVideoCompleted && quizCompleted ? '2' : introVideoCompleted ? '1' : '0'}/2
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${((introVideoCompleted ? 1 : 0) + (quizCompleted ? 1 : 0)) * 50}%`
                  }}
                />
              </div>
            </div>

            {/* Tasks Grid - Responsive */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tasks.map((t, i) => {
                const isIntroVideo = t.key === "intro-video";
                const isQuiz = t.key === "quiz";
                const isCompleted = isIntroVideo ? introVideoCompleted : quizCompleted;
                const isLocked = isQuiz && !introVideoCompleted;

                return (
                  <article
                    key={i}
                    className={`relative rounded-xl bg-white shadow-lg border-2 overflow-hidden transition-all duration-300 ${
                      isCompleted
                        ? 'border-green-400 bg-gradient-to-br from-green-50 to-white'
                        : isLocked
                          ? 'border-gray-300 opacity-60'
                          : 'border-blue-200 hover:border-blue-400 hover:shadow-xl'
                    }`}
                  >
                    {/* Completion Badge */}
                    {isCompleted && (
                      <div className="absolute top-4 right-4 z-10 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Completed
                      </div>
                    )}

                    {/* Lock Badge */}
                    {isLocked && (
                      <div className="absolute top-4 right-4 z-10 bg-gray-400 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Locked
                      </div>
                    )}

                    <div className="p-6">
                      <div className="relative w-full h-48 rounded-xl overflow-hidden mb-4 bg-gray-100">
                        <Image
                          src={t.img}
                          alt={t.title}
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="mb-4">
                        <h3 className="font-bold text-lg text-[#0C2D57] mb-2">
                          {t.title}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{t.duration}</span>
                        </div>
                        {isLocked && (
                          <p className="text-xs text-amber-600 mt-2 font-medium">
                            ⚠️ Complete the intro video first
                          </p>
                        )}
                      </div>

                      {/* Action Button */}
                      {isIntroVideo ? (
                        <button
                          className={`w-full py-3 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 ${
                            isCompleted
                              ? 'bg-green-100 text-green-700 border-2 border-green-300 cursor-default'
                              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                          }`}
                          onClick={() => !isCompleted && setShowIntroVideo(true)}
                          disabled={isCompleted}
                        >
                          {isCompleted ? (
                            <>
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Completed
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                              </svg>
                              Watch Video
                            </>
                          )}
                        </button>
                      ) : isQuiz ? (
                        <button
                          className={`w-full py-3 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 ${
                            isCompleted
                              ? 'bg-green-100 text-green-700 border-2 border-green-300 cursor-default'
                              : isLocked
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed border-2 border-gray-300'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                          }`}
                          onClick={() => !isLocked && !isCompleted && setShowQuiz(true)}
                          disabled={isLocked || isCompleted}
                        >
                          {isCompleted ? (
                            <>
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Completed
                            </>
                          ) : isLocked ? (
                            <>
                              <Lock className="w-4 h-4" />
                              Complete Video First
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Start Quiz
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Helpful Info */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <QuestionMarkCircleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <p className="font-semibold text-[#0C2D57] mb-1">Need Help?</p>
                  <p>
                    {!introVideoCompleted && "Start with the introduction video to learn about Quick Verdicts, then complete the quiz. "}
                    {introVideoCompleted && !quizCompleted && "Great job! Now take the quiz to test your knowledge. "}
                    {introVideoCompleted && quizCompleted && "You're all set! You can now apply to cases and start earning. "}
                    If you encounter any issues, contact support.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}


        {/* Job Board - Available Cases */}
        <section id="available-cases">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-[#0C2D57]">Available Cases</h2>
            <p className="text-sm text-slate-600">
              {isVerified && assignmentsCompleted
                ? "Browse and apply to cases in your area"
                : !isVerified
                  ? "Available after account verification"
                  : "Complete onboarding tasks to unlock job board"}
            </p>
          </div>
          
          {!isVerified ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="max-w-md mx-auto">
                <div className="mb-4">
                  <Lock className="mx-auto h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Job Board Locked</h3>
                <p className="text-gray-600">
                  You will be able to browse and apply for cases once your account is verified by an administrator.
                </p>
              </div>
            </div>
          ) : availableCases.length === 0 ? (
            <div className="text-center text-gray-500 py-12 bg-white rounded-lg shadow-sm">
              <TruckIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium">No cases currently available</p>
              <p className="text-sm mt-2">Check back later for new trial postings</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {availableCases.map((caseItem) => {
                const caseName = getCaseName(
                  caseItem.PlaintiffGroups,
                  caseItem.DefendantGroups
                );
                const trialDate = formatDateString(caseItem.ScheduledDate, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const spotsLeft = caseItem.RequiredJurors - caseItem.ApprovedJurors;

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
                      {/* Attorney & Spots */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <svg className="w-4 h-4 text-[#0C2D57] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="font-semibold text-sm text-[#0C2D57] truncate">
                            {caseItem.AttorneyName || 'Attorney'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded flex-shrink-0">
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
                          <span className="font-medium text-gray-900">{caseItem.ScheduledTime}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Location:</span>
                          <span className="font-medium text-gray-900 truncate ml-2">{caseItem.County}</span>
                        </div>
                      </div>

                      {/* Apply Button */}
                      <button
                        onClick={() => router.push(`/juror/apply/${caseItem.CaseId}`)}
                        disabled={!assignmentsCompleted}
                        className="w-full mt-3 py-2.5 bg-[#0C2D57] text-white rounded-md font-semibold text-sm hover:bg-[#0a2347] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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