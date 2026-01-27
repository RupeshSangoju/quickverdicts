"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, AlertCircle, Calendar, Briefcase, RefreshCw, DollarSign, TrendingUp } from "lucide-react";
import { format, parseISO, isToday } from "date-fns";
import { getToken, logout } from "@/lib/apiClient";
import { formatDateString } from "@/lib/dateUtils";

const AttorneyHelp = dynamic(() => import("./AttorneyHelp"), { ssr: false });
const AttorneyContact = dynamic(() => import("./AttorneyContact"), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_API_URL 
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

type AttorneyUser = {
  attorneyId: number;
  firstName: string;
  lastName: string;
  email: string;
  lawFirmName: string;
  phoneNumber?: string;
  isVerified: boolean;
  verificationStatus: string;
};

type Case = {
  Id: number;
  PlaintiffGroups: string;
  DefendantGroups: string;
  ScheduledDate: string;
  ScheduledTime?: string;
  attorneyEmail: string;
  status?: string;
  AdminApprovalStatus?: string;
  AttorneyStatus?: string;
  AdminRescheduledBy?: number | null;
  RescheduleRequired?: number | boolean;
  AlternateSlots?: string;
  OriginalScheduledDate?: string;
  OriginalScheduledTime?: string;
};

type PaymentStats = {
  totalPaid: string;
  pendingPayments: number;
  completedPayments: number;
  failedPayments: number;
  totalTransactions: number;
};

// Use getToken from apiClient (imported above)

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

function IntroductorySlider() {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const slides = [
    {
      title: "Welcome to Quick Verdicts!",
      description: "Your comprehensive platform for managing virtual trials efficiently and effectively.",
      image: "/image2.png"
    },
    {
      title: "Manage Your Cases",
      description: "Create, organize, and track all your cases in one centralized dashboard.",
      image: "/image3.png"
    },
    {
      title: "Virtual Courtroom",
      description: "Conduct trials seamlessly with our integrated video conferencing and case management tools.",
      image: "/image4.png"
    },
    {
      title: "War Room Collaboration",
      description: "Prepare for trials with document management, witness preparation, and team collaboration features.",
      image: "/image5.png"
    }
  ];

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
      <div className="relative">
        <div className="text-center mb-6">
          <div className="mb-6 flex justify-center">
            <img 
              src={slides[currentSlide].image} 
              alt={slides[currentSlide].title}
              className="h-64 w-auto object-contain rounded-lg"
            />
          </div>
          <h2 className="text-2xl font-bold text-[#16305B] mb-3">
            {slides[currentSlide].title}
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {slides[currentSlide].description}
          </p>
        </div>

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={prevSlide}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ChevronLeft size={24} className="text-[#16305B]" />
          </button>
          
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide ? "w-8 bg-[#16305B]" : "w-2 bg-gray-300"
                }`}
              />
            ))}
          </div>

          <button
            onClick={nextSlide}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ChevronRight size={24} className="text-[#16305B]" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AttorneyHomeSection() {
  const [user, setUser] = useState<AttorneyUser | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [paymentStatsLoading, setPaymentStatsLoading] = useState(false);
  const router = useRouter();
  
  const hasCheckedVerification = useRef(false);
  const lastVerificationCheck = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("attorneyUser");
      if (stored) {
        try {
          const parsedUser = JSON.parse(stored);
          console.log("📋 Loaded user:", parsedUser);
          setUser(parsedUser);
        } catch (error) {
          console.error("Failed to parse attorney user:", error);
        }
      }
      setLoading(false);
    }
  }, []);

  const checkVerificationStatus = useCallback(async () => {
    const now = Date.now();
    
    if (now - lastVerificationCheck.current < 10000) {
      console.log("⏱️ Skipping verification check - too soon");
      return;
    }
    
    lastVerificationCheck.current = now;

    const token = getToken();
    if (!token) {
      console.log("❌ No token found");
      return;
    }

    try {
      setCheckingVerification(true);
      
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Use centralized logout function
          logout();
        }
        return;
      }

      const data = await res.json();
      console.log("📦 Verification check response:", data);

      if (data.success && data.user) {
        const currentUser = localStorage.getItem("attorneyUser");

        if (currentUser) {
          const parsed = JSON.parse(currentUser);

          // ✅ FIXED: Map backend field names properly (IsVerified, not verified)
          const backendVerified = data.user.IsVerified || data.user.verified || false;
          const backendStatus = data.user.VerificationStatus || data.user.verificationStatus || "pending";

          if (parsed.isVerified !== backendVerified) {
            console.log("✅ VERIFICATION CHANGED! Was:", parsed.isVerified, "Now:", backendVerified);

            const updatedUser: AttorneyUser = {
              attorneyId: parsed.attorneyId || data.user.AttorneyId || data.user.id,
              firstName: data.user.FirstName || data.user.firstName || parsed.firstName,
              lastName: data.user.LastName || data.user.lastName || parsed.lastName,
              email: data.user.Email || data.user.email || parsed.email,
              lawFirmName: data.user.LawFirmEntityName || data.user.LawFirmName || data.user.lawFirmName || parsed.lawFirmName,
              isVerified: backendVerified,
              verificationStatus: backendStatus
            };

            localStorage.setItem("attorneyUser", JSON.stringify(updatedUser));
            setUser(updatedUser);

            window.dispatchEvent(new CustomEvent('verificationStatusChanged', {
              detail: { isVerified: backendVerified, verificationStatus: backendStatus }
            }));
          } else {
            // ✅ Even if verification didn't change, update other fields but preserve isVerified
            const updatedUser: AttorneyUser = {
              attorneyId: parsed.attorneyId || data.user.AttorneyId || data.user.id,
              firstName: data.user.FirstName || data.user.firstName || parsed.firstName,
              lastName: data.user.LastName || data.user.lastName || parsed.lastName,
              email: data.user.Email || data.user.email || parsed.email,
              lawFirmName: data.user.LawFirmEntityName || data.user.LawFirmName || data.user.lawFirmName || parsed.lawFirmName,
              isVerified: parsed.isVerified, // Preserve existing value
              verificationStatus: parsed.verificationStatus || backendStatus
            };

            localStorage.setItem("attorneyUser", JSON.stringify(updatedUser));
            setUser(updatedUser);
          }
        }
      }
    } catch (error) {
      console.error("Failed to check verification:", error);
    } finally {
      setCheckingVerification(false);
    }
  }, [router]);

  useEffect(() => {
    if (!hasCheckedVerification.current) {
      hasCheckedVerification.current = true;
      checkVerificationStatus();
    }

    const interval = setInterval(checkVerificationStatus, 30000);
    return () => clearInterval(interval);
  }, [checkVerificationStatus]);

  useEffect(() => {
    if (user?.isVerified) {
      console.log("✅ User verified, fetching cases");
      fetchCases();
      fetchPaymentStats();
    } else {
      console.log("❌ User not verified");
      setCases([]);
      setPaymentStats(null);
    }
  }, [user?.isVerified]);

  const fetchCases = async () => {
    if (!user?.isVerified) {
      console.log("❌ Fetch blocked: user not verified");
      return;
    }
    
    setCasesLoading(true);
    try {
      const token = getToken();
      if (!token) {
        console.error("❌ No auth token found");
        throw new Error("No token");
      }

      // FIXED: Changed to /api/case/cases
      console.log("📞 Calling:", `${API_BASE}/api/case/cases`);

      const response = await fetch(`${API_BASE}/api/case/cases`, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log("📦 Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Response error:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ Cases data:", data);
      
      if (data.success && Array.isArray(data.cases)) {
        setCases(data.cases);
      } else {
        console.warn("⚠️ Unexpected data format:", data);
        setCases([]);
      }
    } catch (error: any) {
      console.error("❌ Failed to fetch cases:", error);
      setCases([]);
    } finally {
      setCasesLoading(false);
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

      const response = await fetch(`${API_BASE}/api/payments/attorney/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.stats) {
        setPaymentStats(data.stats);
      } else {
        setPaymentStats(null);
      }
    } catch (error: any) {
      console.error("❌ Failed to fetch payment stats:", error);
      setPaymentStats(null);
    } finally {
      setPaymentStatsLoading(false);
    }
  };

  const handleManualRefresh = () => {
    lastVerificationCheck.current = 0;
    checkVerificationStatus();
    if (user?.isVerified) {
      fetchCases();
      fetchPaymentStats();
    }
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return cases
      .filter(c => {
        // Only show approved cases, not pending ones
        if (!c.ScheduledDate || c.AdminApprovalStatus !== "approved") return false;
        const eventDate = new Date(`${c.ScheduledDate}T${c.ScheduledTime || '00:00'}`);
        return eventDate >= now;
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.ScheduledDate}T${a.ScheduledTime || '00:00'}`);
        const dateB = new Date(`${b.ScheduledDate}T${b.ScheduledTime || '00:00'}`);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 6);
  };

  const getRecentCases = () => {
    // Only show approved cases, not pending ones
    const approvedCases = cases.filter(c => c.AdminApprovalStatus === "approved");
    const pendingCases = cases.filter(c => c.AdminApprovalStatus === "pending");
    console.log('🏠 Home Section - Approved cases:', approvedCases.length, '| Pending cases:', pendingCases.length);
    return approvedCases.slice(0, 6);
  };

  if (loading) {
    return (
      <main className="flex-1 px-10 py-8 bg-[#F7F6F3] flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#16305B]" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  if (showContact) {
    return <AttorneyContact onBack={() => { setShowContact(false); setShowHelp(true); }} />;
  }

  if (showHelp) {
    return <AttorneyHelp onContact={() => { setShowHelp(false); setShowContact(true); }} />;
  }

  const isVerified = user?.isVerified || false;
  const upcomingEvents = getUpcomingEvents();
  const recentCases = getRecentCases();

  // Timezone conversion functions (same as AttorneyCasesSection.tsx)
  function applyOffsetToUtcTime(utcTime: string, dateString: string, timezoneOffset: string, offsetMinutesMap:number) {
    const offsetMinutes = offsetMinutesMap * 2;
    if (offsetMinutes === null) throw new Error('Invalid timezoneOffset');

    // Build a UTC instant (number of ms since epoch)
    const utcMs = Date.parse(`${dateString}T${utcTime}Z`);
    if (isNaN(utcMs)) throw new Error('Invalid UTC date/time');

    // If timezoneOffset includes '+' subtract offsetMinutes, if '-' add it
    const signChar = timezoneOffset.includes('+') ? '+' : timezoneOffset.includes('-') ? '-' : '+';
    const resultMs = signChar === '+'
      ? utcMs - offsetMinutes * 60_000
      : utcMs + Math.abs(offsetMinutes) * 60_000;

    const resultDate = new Date(resultMs);
    return {
      date: resultDate,
      "12HoursTime": resultDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
      "24HoursTime" : resultDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false })
    };
  }

  function getSystemTimezoneInfo() {
    const offset = new Date().getTimezoneOffset();
    const offsetHours = offset / 60;
    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const sign = offset <= 0 ? '+' : '-';
    const absHours = Math.floor(Math.abs(offsetHours));
    const minutes = Math.abs(offsetHours % 1) * 60;

    return {
      offsetHours: -offsetHours, // Negate because getTimezoneOffset returns opposite sign
      offsetMinutes: -offset,
      timezoneName,
      sign,
      formatOffset: `UTC${sign}${String(absHours).padStart(2, '0')}:${String(Math.round(minutes)).padStart(2, '0')}`
    };
  }

  function formatTime(timeString: string, scheduledDate?: string) {
    try {
      if (!timeString) return "";

      // If scheduledDate is provided, apply timezone conversion
      if (scheduledDate) {
        const systemTz = getSystemTimezoneInfo();
        let zoneMap  = '';

        // use the formatOffset returned from getSystemTimezoneInfo and ensure offsetMinutes is numeric
        zoneMap = systemTz.formatOffset ? systemTz.formatOffset : "";
        const offsetMinutes = typeof systemTz.offsetMinutes === 'number' ? systemTz.offsetMinutes : 0;

        const dataSystemmap = applyOffsetToUtcTime(timeString, scheduledDate, zoneMap, offsetMinutes);
        return dataSystemmap["24HoursTime"];
      }

      // Fallback to simple formatting if no scheduledDate
      const [hours, minutes] = timeString.split(":");
      const hour = parseInt(hours || "0", 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes || '00'} ${ampm}`;
    } catch {
      return timeString || "";
    }
  }

  function getTimeWarning(scheduledDate: string, scheduledTime?: string) {
    try {
      const trialDateTime = new Date(`${scheduledDate}T${scheduledTime || '00:00'}`);
      const now = new Date();
      const diffInMs = trialDateTime.getTime() - now.getTime();
      const diffInMinutes = Math.floor(diffInMs / 60000);
      if (diffInMinutes > 0 && diffInMinutes < 60) {
        return `Starts in ${diffInMinutes} min`;
      } else if (diffInMinutes < 0) {
        return "In Progress";
      }
      return null;
    } catch {
      return null;
    }
  }

  function getStatusInfo(c: Case) {
    if (c.AdminApprovalStatus === "pending") {
      return { label: "Pending Approval", color: "bg-yellow-100 text-yellow-700 border-yellow-300" };
    }
    if (c.AdminApprovalStatus === "rejected") {
      return { label: "Rejected", color: "bg-red-100 text-red-700 border-red-300" };
    }
    if (c.AttorneyStatus === "join_trial") {
      return { label: "Ready for Trial", color: "bg-green-100 text-green-700 border-green-300" };
    }
    if (c.AttorneyStatus === "view_details") {
      return { label: "Completed", color: "bg-purple-100 text-purple-700 border-purple-300" };
    }
    if (c.AttorneyStatus === "war_room") {
      // Check if admin rescheduled this case
      if (c.AdminRescheduledBy) {
        return { label: "Admin Rescheduled Case", color: "bg-orange-100 text-orange-700 border-orange-300" };
      }
      return { label: "Open for Applications", color: "bg-blue-100 text-blue-700 border-blue-300" };
    }
    return null;
  }

  const handleCaseClick = (caseId: number) => {
    router.push(`/attorney/cases/${caseId}/war-room`);
  };

  return (
    <main className="flex-1 px-10 py-8 bg-[#F7F6F3] transition-all duration-300 ease-in-out">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#16305B]">
          Welcome back{user ? `, ${user.firstName}!` : "!"}
        </h1>
        <div className="flex items-center gap-4">
          <button
            onClick={handleManualRefresh}
            disabled={checkingVerification}
            className="flex items-center gap-2 text-[#16305B] hover:text-[#1e417a] transition-colors disabled:opacity-50"
            title="Refresh verification status"
          >
            <RefreshCw size={18} className={checkingVerification ? 'animate-spin' : ''} />
            <span className="text-sm font-medium">Refresh</span>
          </button>
          <button 
            className="text-[#16305B] hover:text-[#1e417a] transition-colors font-semibold" 
            onClick={() => setShowHelp(true)}
          >
            Help & Support
          </button>
        </div>
      </div>

      {!isVerified && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="text-yellow-600 mr-3 mt-0.5 flex-shrink-0" size={20} />
            <div className="flex-1">
              <h3 className="text-yellow-800 font-semibold mb-1">Account Pending Verification</h3>
              <p className="text-yellow-700 text-sm mb-2">
                Your account is under review. You'll gain full access once verified (usually within 24-48 hours).
              </p>
              <p className="text-yellow-600 text-xs">
                Status checks automatically every 30 seconds. Click "Refresh" above to check manually.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isVerified && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-[#16305B] mb-4">Get Started with Quick Verdicts</h2>
          <IntroductorySlider />
        </section>
      )}


      {/* Payment Statistics Section */}
{/* 
      {isVerified && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-[#16305B] mb-4 flex items-center gap-2">
            <DollarSign size={20} />
            Payment Overview
          </h2>
          {paymentStatsLoading ? (
            <div className="bg-white rounded-lg shadow-md p-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-b-4 border-[#16305B]"></div>
            </div>
          ) : paymentStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-md p-6 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-green-900">Total Paid</h3>
                  <DollarSign className="text-green-600" size={20} />
                </div>
                <p className="text-3xl font-bold text-green-700">${parseFloat(paymentStats.totalPaid).toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">Lifetime case filing payments</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-blue-900">Completed</h3>
                  <TrendingUp className="text-blue-600" size={20} />
                </div>
                <p className="text-3xl font-bold text-blue-700">{paymentStats.completedPayments}</p>
                <p className="text-xs text-blue-600 mt-1">Successful transactions</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg shadow-md p-6 border border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-yellow-900">Pending</h3>
                  <AlertCircle className="text-yellow-600" size={20} />
                </div>
                <p className="text-3xl font-bold text-yellow-700">{paymentStats.pendingPayments}</p>
                <p className="text-xs text-yellow-600 mt-1">Awaiting processing</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg shadow-md p-6 border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-purple-900">Total Transactions</h3>
                  <Briefcase className="text-purple-600" size={20} />
                </div>
                <p className="text-3xl font-bold text-purple-700">{paymentStats.totalTransactions}</p>
                <p className="text-xs text-purple-600 mt-1">All-time payments</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600">No payment data available yet</p>
            </div>
          )}
        </section>
      )}
*/}
      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <Briefcase className="text-[#16305B]" size={24} />
            <div>
              <h2 className="text-lg font-bold text-[#16305B]">Your Cases</h2>
              <p className="text-sm text-gray-600">
                {isVerified ? "Manage and access your cases" : "Available after verification"}
              </p>
            </div>
          </div>
          {isVerified && cases.filter(c => c.RescheduleRequired).length > 0 && (
            <button
              onClick={() => router.push('/attorney/reschedule-requests')}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors animate-pulse"
            >
              <AlertCircle className="w-4 h-4" />
              <span>{cases.filter(c => c.RescheduleRequired).length} Reschedule{cases.filter(c => c.RescheduleRequired).length > 1 ? 's' : ''} Needed</span>
            </button>
          )}
        </div>
        
        {isVerified ? (
          casesLoading ? (
            <div className="bg-white rounded-xl shadow p-12 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-[#16305B] mb-4" />
              <p className="text-gray-600">Loading your cases...</p>
            </div>
          ) : recentCases.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {recentCases.map((c) => {
                  const statusInfo = getStatusInfo(c);
                  const timeWarning = c.AttorneyStatus === "join_trial" ? getTimeWarning(c.ScheduledDate, c.ScheduledTime) : null;
                  const caseTitle = getCaseName(c.PlaintiffGroups, c.DefendantGroups);

                  return (
                    <div
                      key={c.Id}
                      onClick={() => handleCaseClick(c.Id)}
                      className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all cursor-pointer border border-gray-200 hover:border-[#16305B] overflow-hidden"
                    >
                      <div className="p-4 bg-gradient-to-r from-[#16305B] to-[#1e417a] relative">
                        <h3 className="font-bold text-white mb-1 line-clamp-2">
                          {caseTitle}
                        </h3>
                        <p className="text-xs text-blue-200">Case #{c.Id}</p>
                        
                        {c.RescheduleRequired ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push('/attorney/reschedule-requests');
                            }}
                            className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-semibold bg-red-600 text-white animate-pulse hover:bg-red-700 transition-colors"
                          >
                            ⚠️ RESCHEDULE NEEDED
                          </button>
                        ) : statusInfo && (
                          <div className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-semibold ${statusInfo.color}`}>
                            {statusInfo.label}
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <Calendar className="w-4 h-4" />
                          {formatDateString(c.ScheduledDate, { month: 'short', day: 'numeric', year: 'numeric' })} • {formatTime(c.ScheduledTime || '', c.ScheduledDate)}
                        </div>

                        {timeWarning && (
                          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded mb-3">
                            <p className="text-xs font-bold text-red-700">{timeWarning}</p>
                          </div>
                        )}

                        {/* Join Trial Button */}
                        {c.AttorneyStatus === 'join_trial' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/attorney/cases/${c.Id}/trial/conference`, '_blank');
                            }}
                            className="w-full mt-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Join Trial
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Showing {recentCases.length} of {cases.length} cases
                </p>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow p-12 text-center">
              <Briefcase className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Cases Yet</h3>
              <p className="text-gray-600">
                Create your first case to get started
              </p>
            </div>
          )
        ) : (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Cases Section Locked</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Access to cases will be enabled once your account is verified
            </p>
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="text-[#16305B]" size={24} />
            <div>
              <h2 className="text-lg font-bold text-[#16305B]">Upcoming Events</h2>
              <p className="text-sm text-gray-600">
                {isVerified ? "Your scheduled trials" : "Available after verification"}
              </p>
            </div>
          </div>
        </div>
        
        {isVerified ? (
          upcomingEvents.length > 0 ? (
            <div className="bg-white rounded-xl shadow">
              <div className="divide-y">
                {upcomingEvents.map((event) => (
                  <div key={event.Id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => handleCaseClick(event.Id)}>
                    <div className="flex items-start gap-3">
                      <div className="text-sm font-medium text-[#16305B] w-24">
                        {formatTime(event.ScheduledTime || '', event.ScheduledDate)}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {getCaseName(event.PlaintiffGroups, event.DefendantGroups)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatDateString(event.ScheduledDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow p-12 text-center">
              <Calendar className="mx-auto h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Upcoming Events</h3>
              <p className="text-gray-600">Schedule a case to see events here</p>
            </div>
          )
        ) : (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Calendar Section Locked</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Access to calendar will be enabled once your account is verified
            </p>
          </div>
        )}
      </section>
    </main>
  );
}