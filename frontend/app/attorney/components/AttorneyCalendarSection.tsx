"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, Lock, ArrowLeft, RefreshCw } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  subDays,
  addDays,
  isToday,
  parseISO,
  subMonths,
  addMonths
} from "date-fns";
import { getToken } from "@/lib/apiClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

type AttorneyUser = {
  attorneyId: number;
  firstName: string;
  lastName: string;
  email: string;
  isVerified: boolean;
  verificationStatus: string;
};

type Case = {
  Id: number;
  PlaintiffGroups: string;
  DefendantGroups: string;
  ScheduledDate: string;
  ScheduledTime: string;
  attorneyEmail: string;
  CaseTitle?: string;
  status?: string;
  AdminApprovalStatus?: string;
  AttorneyStatus?: string;
};

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}

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

function formatTime(timeString: string) {
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return timeString;
  }
}

interface AttorneyCalendarSectionProps {
  onBack: () => void;
}

export default function AttorneyCalendarSection({ onBack }: AttorneyCalendarSectionProps) {
  const [user, setUser] = useState<AttorneyUser | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"calendar" | "list">("list");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("attorneyUser");
      if (stored) {
        try {
          const parsedUser = JSON.parse(stored);
          setUser(parsedUser);
        } catch (error) {
          console.error("Failed to parse attorney user:", error);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (user && user.isVerified) {
      fetchCases();
    } else {
      setLoading(false);
    }
  }, [user]);

  // ✅ AUTO-REFRESH: Poll for new cases every 30 seconds
  useEffect(() => {
    if (!user?.isVerified) return;

    // Set up interval to auto-refresh cases
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing calendar...');
      fetchCases(true); // Use true to show refresh indicator
    }, 30000); // 30 seconds

    // Clean up interval when component unmounts
    return () => clearInterval(refreshInterval);
  }, [user]);

  // ✅ LISTEN FOR CASE UPDATES: Refresh when a new case is created
  useEffect(() => {
    const handleCaseUpdate = () => {
      console.log('📅 Case updated - refreshing calendar...');
      fetchCases(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('case-updated', handleCaseUpdate as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('case-updated', handleCaseUpdate as EventListener);
      }
    };
  }, [user]);

  const fetchCases = async (showRefreshIndicator = false) => {
    if (!user) return;

    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // ✅ FIXED: Use getToken() from apiClient instead of getCookie
      const token = getToken();

      if (!token) {
        throw new Error("Authentication token not found");
      }

      // ✅ FIXED: Correct endpoint without userId query param
      const res = await fetch(`${API_BASE}/api/case/cases`, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please login again.");
        }
        throw new Error(`Failed to fetch cases: ${res.status}`);
      }

      const data = await res.json();

      if (data.success && Array.isArray(data.cases)) {
        // Debug logging to check AdminApprovalStatus
        console.log('📋 Cases fetched for calendar:', data.cases.map((c: Case) => ({
          Id: c.Id,
          AdminApprovalStatus: c.AdminApprovalStatus,
          AttorneyStatus: c.AttorneyStatus
        })));
        setCases(data.cases);
      } else {
        console.error("Unexpected response format:", data);
        setCases([]);
      }
    } catch (err) {
      console.error("Failed to fetch cases:", err);
      setError(err instanceof Error ? err.message : "Failed to load cases");
      setCases([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchCases(true);
  };

  // Group cases by date - ONLY show approved cases
  const groupCasesByDate = () => {
    const grouped: { [date: string]: Case[] } = {};
    cases.forEach((c) => {
      // Only show approved cases in calendar
      if (c.ScheduledDate && c.AdminApprovalStatus === "approved") {
        grouped[c.ScheduledDate] = grouped[c.ScheduledDate] || [];
        grouped[c.ScheduledDate].push(c);
      } else if (c.ScheduledDate) {
        // Log cases that are filtered out
        console.log(`🚫 Case #${c.Id} filtered out - Status: ${c.AdminApprovalStatus}`);
      }
    });
    console.log('📅 Grouped approved cases:', Object.keys(grouped).length, 'dates with cases');
    return grouped;
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const grouped = groupCasesByDate();
    const selectedGroup: Case[] = selectedDate ? (grouped[selectedDate] || []) : [];

    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#16305B]">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-[#16305B]"
              aria-label="Previous month"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 text-sm font-medium text-[#16305B] hover:bg-gray-100 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-[#16305B]"
              aria-label="Next month"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center font-semibold text-sm text-[#16305B] py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {/* Previous month's overflow days */}
          {Array.from({ length: getDay(monthStart) }).map((_, index) => (
            <div key={`prev-${index}`} className="p-3 text-center text-gray-400">
              <span className="text-sm">
                {format(subDays(monthStart, getDay(monthStart) - index), 'd')}
              </span>
            </div>
          ))}

          {/* Current month's days */}
          {days.map((day) => {
            const formattedDate = format(day, 'yyyy-MM-dd');
            const hasEvents = Boolean(grouped[formattedDate]);
            const dayEvents = grouped[formattedDate] || [];
            const isSelected = selectedDate === formattedDate;
            const isTodays = isToday(day);

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDate(formattedDate)}
                className={`relative p-3 text-center cursor-pointer rounded-lg transition-all duration-200 min-h-[60px] flex flex-col items-center justify-center
                  ${isSelected 
                    ? 'bg-[#16305B] text-white shadow-lg transform scale-105' 
                    : hasEvents 
                      ? 'bg-blue-50 hover:bg-blue-100' 
                      : 'hover:bg-gray-50'
                  }
                  ${isTodays && !isSelected ? 'ring-2 ring-[#16305B] ring-opacity-50' : ''}
                `}
              >
                <div className={`text-sm font-medium ${
                  isSelected 
                    ? 'text-white' 
                    : isTodays 
                      ? 'text-[#16305B] font-bold' 
                      : 'text-gray-700'
                }`}>
                  {format(day, 'd')}
                </div>
                {hasEvents && (
                  <div className="mt-1 flex justify-center gap-1">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-white' : 'bg-[#16305B]'
                    }`}></span>
                    {dayEvents.length > 1 && (
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-[#16305B]'
                      }`}></span>
                    )}
                    {dayEvents.length > 2 && (
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-[#16305B]'
                      }`}></span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Next month's overflow days */}
          {Array.from({
            length: (7 - ((getDay(monthStart) + days.length) % 7)) % 7
          }).map((_, index) => (
            <div key={`next-${index}`} className="p-3 text-center text-gray-400">
              <span className="text-sm">
                {format(addDays(monthEnd, index + 1), 'd')}
              </span>
            </div>
          ))}
        </div>

        {/* Selected date cases panel */}
        {selectedDate && selectedGroup.length > 0 && (
          <div className="mt-6 border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#16305B]">
                Cases on {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
              </h3>
              <button 
                onClick={() => setSelectedDate(null)}
                className="text-sm text-gray-600 hover:text-[#16305B] font-medium"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              {selectedGroup.map((c) => (
                <div
                  key={c.Id}
                  className="p-4 bg-gradient-to-r from-blue-50 to-white rounded-lg hover:shadow-md transition-all border border-gray-200 cursor-pointer"
                  onClick={() => router.push(`/attorney/cases/${c.Id}/war-room`)}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#16305B] mb-1">
                        {getCaseName(c.PlaintiffGroups, c.DefendantGroups)}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">{formatTime(c.ScheduledTime)}</span> • Case #{c.Id}
                      </p>
                      {c.AdminApprovalStatus && (
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                          c.AdminApprovalStatus === 'approved' 
                            ? 'bg-green-100 text-green-700' 
                            : c.AdminApprovalStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {c.AdminApprovalStatus.charAt(0).toUpperCase() + c.AdminApprovalStatus.slice(1)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/attorney/cases/${c.Id}/war-room`);
                        }}
                        className="text-sm text-[#16305B] hover:underline font-medium"
                      >
                        View Case
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderList = () => {
    const grouped = groupCasesByDate();
    const sortedDates = Object.keys(grouped).sort().reverse(); // Latest dates first

    if (sortedDates.length === 0) {
      return (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <CalendarIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Scheduled Cases</h3>
          <p className="text-gray-600 mb-6">You do not have any scheduled cases yet.</p>
          <button
            onClick={() => router.push("/attorney/state/case-type")}
            className="px-6 py-3 bg-[#16305B] text-white rounded-lg hover:bg-[#1e417a] transition-colors font-semibold"
          >
            Create New Case
          </button>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="divide-y divide-gray-200">
          {sortedDates.map(date => (
            <div key={date} className="p-6 hover:bg-gray-50 transition-colors">
              <h3 className="font-bold text-lg text-[#16305B] mb-4 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
              </h3>
              <div className="space-y-3">
                {grouped[date].map(c => (
                  <div
                    key={c.Id}
                    className="flex items-start justify-between p-4 bg-gradient-to-r from-blue-50 to-white rounded-lg hover:shadow-md transition-all border border-gray-200 cursor-pointer"
                    onClick={() => router.push(`/attorney/cases/${c.Id}/war-room`)}
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#16305B] mb-1">
                        {getCaseName(c.PlaintiffGroups, c.DefendantGroups)}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">{formatTime(c.ScheduledTime)}</span> • Case #{c.Id}
                      </p>
                      {c.AdminApprovalStatus && (
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                          c.AdminApprovalStatus === 'approved' 
                            ? 'bg-green-100 text-green-700' 
                            : c.AdminApprovalStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {c.AdminApprovalStatus.charAt(0).toUpperCase() + c.AdminApprovalStatus.slice(1)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/attorney/cases/${c.Id}/war-room`);
                        }}
                        className="text-sm text-[#16305B] hover:underline font-medium"
                      >
                        View Case
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Show locked state for unverified attorneys
  if (!user?.isVerified) {
    return (
      <main className="flex-1 px-10 py-8 bg-[#F7F6F3] transition-all duration-300 ease-in-out">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#16305B] hover:text-[#1e417a] transition-colors group"
            aria-label="Go back to home"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold">Back</span>
          </button>
          <div className="h-8 w-px bg-gray-300" />
          <h1 className="text-3xl font-bold text-[#16305B]">Calendar</h1>
        </div>

        <div className="flex items-center justify-center min-h-[400px]">
          <div className="bg-white rounded-xl shadow-lg p-12 max-w-md text-center">
            <div className="mb-6">
              <Lock className="mx-auto h-16 w-16 text-yellow-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Verification Required</h2>
            <p className="text-gray-600 mb-4">
              Your calendar will be available once your account is verified by an administrator.
            </p>
            <p className="text-sm text-gray-500">
              This usually takes 24-48 hours. You will receive a notification once verified.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-10 py-8 bg-[#F7F6F3] transition-all duration-300 ease-in-out">
      {/* Header with Back Button */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#16305B] hover:text-[#1e417a] transition-colors group"
            aria-label="Go back to home"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold">Back</span>
          </button>
          <div className="h-8 w-px bg-gray-300" />
          <div>
            <h1 className="text-3xl font-bold text-[#16305B]">Calendar</h1>
            <p className="text-sm text-gray-600 mt-1">View and manage your scheduled cases</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2.5 border-2 border-[#16305B] text-[#16305B] rounded-lg flex items-center gap-2 hover:bg-[#16305B] hover:text-white transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh calendar"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* View Toggle */}
          <div className="flex items-center bg-white rounded-lg shadow-sm p-1">
            <button
              onClick={() => setView("calendar")}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                view === "calendar"
                  ? "bg-[#16305B] text-white"
                  : "text-gray-600 hover:text-[#16305B]"
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                view === "list"
                  ? "bg-[#16305B] text-white"
                  : "text-gray-600 hover:text-[#16305B]"
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">{error}</p>
            <button
              onClick={() => fetchCases()}
              className="text-sm text-red-600 hover:text-red-800 underline mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Calendar/List Content */}
      {loading ? (
        <div className="flex flex-col justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#16305B] mb-4" />
          <p className="text-gray-600 font-medium">Loading your calendar...</p>
        </div>
      ) : (
        <div>
          {view === "list" ? renderList() : renderCalendar()}
        </div>
      )}
    </main>
  );
}