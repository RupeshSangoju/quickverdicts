// ===== SCHEDULE TRIAL PAGE =====
// app/attorney/state/schedule-trail/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Stepper from "../../components/Stepper";
import { Calendar, Clock, MapPin, Monitor, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { getToken } from "@/lib/apiClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

function BufferingAnimation() {
  return (
    <div className="flex items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#16305B]"></div>
    </div>
  );
}

// ✅ 24/7 SCHEDULING: All time slots available (no business hours restriction)
const allTimeSlots = [
  "00:00", "00:30", "01:00", "01:30", "02:00", "02:30", "03:00", "03:30",
  "04:00", "04:30", "05:00", "05:30", "06:00", "06:30", "07:00", "07:30",
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"
];

const getMonthName = (monthIndex: number) => {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[monthIndex];
};

const getDayName = (dayIndex: number) => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[dayIndex];
};

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

const isToday = (date: Date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
};

const formatDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (date: Date) => {
  const dayName = getDayName(date.getDay());
  const monthName = getMonthName(date.getMonth());
  const day = date.getDate();
  const year = date.getFullYear();
  return `${dayName}, ${monthName} ${day}, ${year}`;
};

type BlockedSlot = {
  BlockedDate: string;
  BlockedTime: string;
};

export default function ScheduleTrialPage() {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [showDetails, setShowDetails] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [scheduled, setScheduled] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfWeek = getFirstDayOfMonth(currentYear, currentMonth);
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  useEffect(() => {
    fetchBlockedSlots();
  }, [currentYear, currentMonth]);

  const fetchBlockedSlots = async () => {
    setLoadingSlots(true);
    try {
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(currentYear, currentMonth + 1, 0);

      const startDateStr = formatDateString(startDate);
      const endDateStr = formatDateString(endDate);

      const token = getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE}/api/admin-calendar/blocked?startDate=${startDateStr}&endDate=${endDateStr}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Blocked slots fetched:', data.blockedSlots);
        setBlockedSlots(data.blockedSlots || []);
      } else {
        console.error('Failed to fetch blocked slots:', response.status);
      }
    } catch (error) {
      console.error("Error fetching blocked slots:", error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const isDateAvailable = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    // ✅ Allow any future date including weekends (Saturday & Sunday)
    if (date < today) {
      return false;
    }

    const dateStr = formatDateString(date);
    const blockedTimesForDate = blockedSlots
      .filter(slot => {
        // Extract date string directly without timezone conversion
        const slotDateStr = slot.BlockedDate.substring(0, 10);
        return slotDateStr === dateStr;
      })
      .map(slot => slot.BlockedTime.substring(0, 5));

    const availableSlots = allTimeSlots.filter(time => !blockedTimesForDate.includes(time));
    return availableSlots.length > 0;
  };

  const getBlockedSlotsForDate = (date: Date) => {
    const dateStr = formatDateString(date);
    const blocked = blockedSlots
      .filter(slot => {
        // Extract date string directly without timezone conversion
        // BlockedDate comes as "2026-01-26T00:00:00.000Z" - just take the date part
        const slotDateStr = slot.BlockedDate.substring(0, 10); // "2026-01-26"
        console.log(`   Comparing: ${slotDateStr} === ${dateStr}`, slotDateStr === dateStr);
        return slotDateStr === dateStr;
      })
      .map(slot => {
        // BlockedTime is now in "HH:MM:SS" format from backend
        // Extract just HH:MM
        return slot.BlockedTime.substring(0, 5);
      });

    if (blocked.length > 0) {
      console.log(`📅 Date ${dateStr} has ${blocked.length} blocked slots:`, blocked);
    }
    return blocked;
  };

  const isDateBlockedByAdmin = (date: Date) => {
    const blockedTimesForDate = getBlockedSlotsForDate(date);
    // If all 48 time slots are blocked, the date is completely blocked by admin
    return blockedTimesForDate.length === 48;
  };

  const isDatePartiallyBlocked = (date: Date) => {
    const blockedTimesForDate = getBlockedSlotsForDate(date);
    // If some time slots are blocked but not all 48
    return blockedTimesForDate.length > 0 && blockedTimesForDate.length < 48;
  };

  const getAvailableTimeSlots = () => {
    if (!selectedDate) return [];

    const dateStr = formatDateString(selectedDate);
    console.log('🔍 Getting available time slots for:', dateStr);
    console.log('📊 Total blocked slots in state:', blockedSlots.length);

    const blockedTimesForDate = blockedSlots
      .filter(slot => {
        // Extract date string directly without timezone conversion
        const slotDateStr = slot.BlockedDate.substring(0, 10);
        console.log(`   Comparing: ${slotDateStr} === ${dateStr}`, slotDateStr === dateStr);
        return slotDateStr === dateStr;
      })
      .map(slot => {
        const time = slot.BlockedTime.substring(0, 5);
        console.log(`   Blocked time extracted: ${slot.BlockedTime} -> ${time}`);
        return time;
      });

    console.log('🚫 Blocked times for this date:', blockedTimesForDate);
    const available = allTimeSlots.filter(time => !blockedTimesForDate.includes(time));
    console.log('✅ Available time slots:', available.length, 'out of', allTimeSlots.length);
    return available;
  };

  const isTimeSlotBlocked = (time: string) => {
    if (!selectedDate) return false;
    const blockedTimesForDate = getBlockedSlotsForDate(selectedDate);
    return blockedTimesForDate.includes(time);
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentYear, currentMonth - 1, 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentYear, currentMonth + 1, 1);
    setCurrentDate(newDate);
  };

  const handleDateSelect = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    if (isDateAvailable(date)) {
      setSelectedDate(date);
      setSelectedTime("");
      setShowDetails(false);
    }
  };

  const handleTimeSelect = (slot: string) => {
    setSelectedTime(slot);
    setShowDetails(true);
  };

  const handleSchedule = async () => {
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setScheduled(true);
    setIsSubmitting(false);
  };

  const handleComplete = async () => {
    // Validate that date and time are selected
    if (!selectedDate) {
      toast.error("Please select a date for the trial.", {
        duration: 4000,
      });
      return;
    }

    if (!selectedTime || selectedTime.trim() === "") {
      toast.error("Please select a time for the trial.", {
        duration: 4000,
      });
      return;
    }

    // Validate all required fields from previous steps
    const requiredFields = {
      "caseJurisdiction": "Case Jurisdiction (State/Federal)",
      "county": "County",
      "caseTier": "Case Tier",
      "caseType": "Civil/Criminal Type",
      "plaintiffGroups": "Plaintiff Details",
      "defendantGroups": "Defendant Details"
    };

    const missingFields: string[] = [];

    for (const [key, label] of Object.entries(requiredFields)) {
      const value = localStorage.getItem(key);
      if (!value || value === "null" || value === "undefined" || value.trim() === "") {
        missingFields.push(label);
      }
    }

    if (missingFields.length > 0) {
      toast.error(
        `Please complete all previous steps:\n\n${missingFields.map(f => `• ${f}`).join('\n')}`,
        {
          duration: 7000,
          style: {
            maxWidth: '500px',
            whiteSpace: 'pre-line',
          },
        }
      );
      setRedirecting(false);
      return;
    }

    setRedirecting(true);

    try {
      const voirDire2Questions = JSON.parse(localStorage.getItem("voirDire2Questions") || "[]");

      const generateCaseTitle = () => {
        try {
          const plaintiffGroups = JSON.parse(localStorage.getItem("plaintiffGroups") || "[]");
          const defendantGroups = JSON.parse(localStorage.getItem("defendantGroups") || "[]");

          const plaintiffName = plaintiffGroups[0]?.plaintiffs?.[0]?.name || "Plaintiff";
          const defendantName = defendantGroups[0]?.defendants?.[0]?.name || "Defendant";

          return `${plaintiffName} v. ${defendantName}`;
        } catch {
          return "Case Title";
        }
      };

      // Capture attorney's timezone offset (in minutes from UTC)
      // Negative values mean behind UTC, positive means ahead of UTC
      const timezoneOffset = new Date().getTimezoneOffset(); // e.g., India = -330, UK = 0, US EST = 300
      const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone; // e.g., "Asia/Kolkata"

      console.log("📍 Attorney timezone info:", {
        timezoneName,
        timezoneOffset,
        localTime: selectedTime,
        scheduledDate: selectedDate ? formatDateString(selectedDate) : '',
      });

      const caseDetails = {
        state: localStorage.getItem("state"),
        county: localStorage.getItem("county"),
        caseJurisdiction: localStorage.getItem("caseJurisdiction"), // State or Federal
        caseType: localStorage.getItem("caseType"), // Civil or Criminal
        caseTier: localStorage.getItem("caseTier"),
        civilOrCriminal: localStorage.getItem("caseType"),
        caseDescription: localStorage.getItem("caseDescription") || "",
        paymentMethod: localStorage.getItem("paymentMethod") || "",
        paymentAmount: localStorage.getItem("paymentAmount") || "0",
        plaintiffGroups: JSON.parse(localStorage.getItem("plaintiffGroups") || "[]"),
        defendantGroups: JSON.parse(localStorage.getItem("defendantGroups") || "[]"),
        scheduledDate: selectedDate ? formatDateString(selectedDate) : '',
        scheduledTime: selectedTime.trim(), // Send as HH:MM format in attorney's LOCAL time
        timezoneOffset: -timezoneOffset, // Invert sign: positive = ahead of UTC, negative = behind UTC
        timezoneName: timezoneName,
        name,
        email,
      };

      const token = getToken();

      if (!token) {
        toast.error("Authentication required. Please login again.", {
          duration: 5000,
        });
        setRedirecting(false);
        router.push("/login/attorney");
        return;
      }

      // Prepare the payload
      const payload = {
        caseType: caseDetails.caseType, // Civil or Criminal
        caseJurisdiction: caseDetails.caseJurisdiction, // State or Federal
        caseTier: caseDetails.caseTier,
        state: caseDetails.state,
        county: caseDetails.county,
        caseTitle: generateCaseTitle(),
        caseDescription: caseDetails.caseDescription,
        paymentMethod: caseDetails.paymentMethod,
        paymentAmount: caseDetails.paymentAmount,
        scheduledDate: caseDetails.scheduledDate,
        scheduledTime: caseDetails.scheduledTime, // Attorney's LOCAL time
        timezoneOffset: caseDetails.timezoneOffset, // Minutes ahead of UTC
        timezoneName: caseDetails.timezoneName, // e.g., "Asia/Kolkata"
        plaintiffGroups: caseDetails.plaintiffGroups,
        defendantGroups: caseDetails.defendantGroups,
        voirDire2Questions: voirDire2Questions,
      };

      // Debug logging
      console.log("📤 Submitting case creation request:", {
        caseType: payload.caseType,
        caseJurisdiction: payload.caseJurisdiction,
        caseTier: payload.caseTier,
        state: payload.state,
        county: payload.county,
        caseTitle: payload.caseTitle,
        scheduledDate: payload.scheduledDate,
        scheduledTime: payload.scheduledTime,
        timezoneOffset: payload.timezoneOffset,
        timezoneName: payload.timezoneName,
        plaintiffCount: payload.plaintiffGroups?.length || 0,
        defendantCount: payload.defendantGroups?.length || 0,
        voirDireCount: payload.voirDire2Questions?.length || 0,
      });

      const response = await fetch(`${API_BASE}/api/case/cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("❌ Case creation failed:", {
          status: response.status,
          statusText: response.statusText,
          data: data
        });

        // Show specific error message with validation details
        let errorMessage = data.error || data.message || "Failed to create case. Please try again.";

        // If there are validation errors, show them
        if (data.validationErrors && Array.isArray(data.validationErrors)) {
          errorMessage = `Validation failed:\n\n${data.validationErrors.map((e: string) => `• ${e}`).join('\n')}`;
        }

        // If the error message contains "Missing required fields", highlight them
        if (errorMessage.includes("Missing required fields:")) {
          console.error("🚨 Missing fields detected. Payload sent:", payload);
          console.error("🗂️  LocalStorage state:", {
            caseJurisdiction: localStorage.getItem("caseJurisdiction"),
            caseType: localStorage.getItem("caseType"),
            county: localStorage.getItem("county"),
            caseTier: localStorage.getItem("caseTier"),
            state: localStorage.getItem("state"),
          });
        }

        toast.error(errorMessage, {
          duration: 7000,
          style: {
            maxWidth: '600px',
            whiteSpace: 'pre-line',
          },
        });

        setRedirecting(false);
        return;
      }

      console.log("✅ Case created successfully:", data);

      // Success! Show toast notification
      toast.success("Trial date pending QV confirmation. War Room will be accessible upon confirmation of trial setting.", {
        duration: 3000,
        icon: "⏳",
      });

      // ✅ TRIGGER CALENDAR REFRESH: Notify calendar to update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('case-updated', {
          detail: { caseId: data.caseId || data.case?.Id }
        }));
        console.log('📅 Dispatched case-updated event for calendar refresh');
      }

      // Clear localStorage items related to case creation
      const itemsToClear = [
        "state", "county", "caseJurisdiction", "caseTier", "caseType",
        "caseDescription", "paymentMethod", "paymentAmount",
        "plaintiffGroups", "defendantGroups", "voirDire2Questions"
      ];
      itemsToClear.forEach(item => localStorage.removeItem(item));

      // Redirect to attorney dashboard after a brief delay
      setTimeout(() => {
        router.push("/attorney");
      }, 2000);
    } catch (error) {
      console.error("❌ Unexpected error:", error);
      toast.error("An unexpected error occurred. Please try again.", {
        duration: 5000,
      });
      setRedirecting(false);
    }
  };

  function getEndTime(start: string) {
    // Get case tier from localStorage to determine duration
    const caseTier = localStorage.getItem("caseTier") || "Tier 1";

    // Define durations for each tier (in hours)
    // Note: caseTier is stored as "Tier 1", "Tier 2", "Tier 3" from case-details page
    const tierDurations: { [key: string]: number } = {
      "Tier 1": 2.5,  // 2 hours 30 minutes
      "Tier 2": 3.5,  // 3 hours 30 minutes
      "Tier 3": 4.5   // 4 hours 30 minutes
    };

    const durationHours = tierDurations[caseTier] || 2.5; // Default to 2.5 hours

    const [h, m] = start.split(":").map(Number);

    // Calculate total minutes
    const totalMinutes = (h * 60) + m + (durationHours * 60);

    // Convert back to hours and minutes
    let endH = Math.floor(totalMinutes / 60);
    let endM = totalMinutes % 60;

    // Handle 24-hour wrap (though unlikely for trials)
    if (endH >= 24) {
      endH = endH % 24;
    }

    return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  }

  const availableTimeSlots = selectedDate ? getAvailableTimeSlots() : [];

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
            <h2 className="text-3xl font-medium mb-4">Schedule Trial</h2>
            <div className="text-sm leading-relaxed text-blue-100 space-y-3">
              <p>Select your preferred date and time for the trial.</p>
              <p className="text-xs text-blue-200">⚠️ Only available dates are shown</p>
            </div>
          </div>
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-h-screen bg-[#faf8f3] px-0 md:px-0 mb-20">
        {redirecting ? (
          <div className="flex flex-col items-center justify-center w-full h-screen">
            <BufferingAnimation />
            <div className="mt-6 text-[#16305B] text-lg font-semibold">
              Creating case and opening dashboard...
            </div>
          </div>
        ) : (
          <>
            {/* Stepper - Full Width */}
            <Stepper currentStep={7} />

      <div className="w-full max-w-6xl mx-auto mb-8 px-20">
        <div className="flex w-full items-start">
          {/* Left section */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-[#16305B] mb-2">
              Schedule Trial
            </h1>
            <p className={`text-base ${scheduled ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
              {scheduled
                ? "Thank you! Confirmation of your requested trial date is pending."
                : "Choose your preferred date and time for this trial."}
            </p>
          </div>

          {/* Right message */}
          {!scheduled && (
            <div className="ml-1 mt-6 whitespace-nowrap text-lg font-bold text-red-600 text-right">
              Please schedule case at least four (4) weeks from today.
            </div>
          )}
        </div>
      </div>


            {scheduled ? (
              <div className="flex-1 flex flex-col items-center justify-center px-8">
                <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-gray-200 p-10">
                  <div className="bg-gray-50 rounded-xl p-6 mb-8 border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-4 text-lg">Trial Details</h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-[#16305B] mt-0.5" />
                        <div>
                          <div className="text-sm text-gray-600">Date</div>
                          <div className="font-medium text-gray-900">
                            {selectedDate ? formatDisplayDate(selectedDate) : "Not selected"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-[#16305B] mt-0.5" />
                        <div>
                          <div className="text-sm text-gray-600">Time</div>
                          <div className="font-medium text-gray-900">
                            {selectedTime ? `${selectedTime} - ${getEndTime(selectedTime)}` : "Not selected"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-[#16305B] mt-0.5" />
                        <div>
                          <div className="text-sm text-gray-600">Location</div>
                          <div className="font-medium text-gray-900">
                            {localStorage.getItem("county") || "County, State"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Monitor className="w-5 h-5 text-[#16305B] mt-0.5" />
                        <div>
                          <div className="text-sm text-gray-600">Format</div>
                          <div className="font-medium text-gray-900">Virtual Trial (Details will follow)</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full bg-[#16305B] text-white font-semibold px-8 py-3 rounded-lg hover:bg-[#0A2342] transition-colors"
                    onClick={handleComplete}
                  >
                    Complete & Go to Dashboard
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex justify-center px-8">
                <div className="w-full max-w-5xl bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="grid md:grid-cols-2">
                    {/* Left Side - Calendar */}
                    <div className="p-8 border-r border-gray-200">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-gray-900">Select Date</h2>
                        {loadingSlots && (
                          <span className="text-sm text-blue-600">Loading...</span>
                        )}
                      </div>

                      {/* Month Navigation */}
                      <div className="flex items-center justify-between mb-6">
                        <button 
                          onClick={handlePrevMonth}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="Previous month"
                        >
                          <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <span className="text-lg font-semibold text-gray-900">
                          {getMonthName(currentMonth)} {currentYear}
                        </span>
                        <button 
                          onClick={handleNextMonth}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          aria-label="Next month"
                        >
                          <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>

                      {/* Calendar Grid */}
                      <div className="mb-4">
                        <div className="grid grid-cols-7 gap-1 mb-2">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                            <div key={day} className="text-xs font-semibold text-gray-500 text-center py-2">
                              {day}
                            </div>
                          ))}
                        </div>
                        
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: startOffset }, (_, index) => (
                            <div key={`empty-${index}`} className="h-10"></div>
                          ))}
                          
                          {Array.from({ length: daysInMonth }, (_, index) => {
                            const day = index + 1;
                            const date = new Date(currentYear, currentMonth, day);
                            const isAvailable = isDateAvailable(date);
                            const isBlocked = isDateBlockedByAdmin(date);
                            const isPartiallyBlocked = isDatePartiallyBlocked(date);
                            const isTodayDate = isToday(date);
                            const isSelected = selectedDate &&
                              selectedDate.getDate() === day &&
                              selectedDate.getMonth() === currentMonth &&
                              selectedDate.getFullYear() === currentYear;

                            // Get blocked time slots for partially blocked dates
                            const blockedTimesForDate = isPartiallyBlocked ? getBlockedSlotsForDate(date) : [];
                            const partialBlockTooltip = isPartiallyBlocked
                              ? `Some hours blocked by admin: ${blockedTimesForDate.join(', ')}`
                              : '';

                            return (
                              <button
                                key={day}
                                type="button"
                                className={`h-10 rounded-lg text-sm font-medium transition-all relative ${
                                  isSelected
                                    ? "bg-[#16305B] text-white shadow-md"
                                    : isBlocked
                                    ? "bg-red-100 text-red-600 border-2 border-red-500 cursor-not-allowed line-through"
                                    : isPartiallyBlocked
                                    ? "bg-orange-50 text-orange-700 border-2 border-orange-400 hover:bg-orange-100"
                                    : isAvailable
                                    ? "text-gray-900 hover:bg-blue-50 border border-gray-200"
                                    : "text-gray-400 bg-gray-100 cursor-not-allowed opacity-50"
                                } ${
                                  isTodayDate && !isSelected
                                    ? "border-2 border-[#16305B]"
                                    : ""
                                }`}
                                disabled={!isAvailable}
                                onClick={() => handleDateSelect(day)}
                                title={isBlocked ? "This date has been blocked by admin" : partialBlockTooltip}
                              >
                                {isBlocked && (
                                  <span className="absolute inset-0 flex items-center justify-center text-red-600 font-bold">
                                    ✕
                                  </span>
                                )}
                                {isPartiallyBlocked && !isBlocked && (
                                  <span className="absolute top-0 right-0 text-orange-600 font-bold text-xs">
                                    ⚠
                                  </span>
                                )}
                                <span className={isBlocked ? "opacity-50" : ""}>{day}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="flex flex-wrap gap-4 text-xs text-gray-600 mt-6 pt-6 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-[#16305B] rounded"></div>
                          <span>Today</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-100 border-2 border-red-500 rounded relative flex items-center justify-center text-red-600 font-bold">✕</div>
                          <span>Fully Blocked by Admin</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-orange-50 border-2 border-orange-400 rounded relative flex items-center justify-center text-orange-600 font-bold text-xs">⚠</div>
                          <span>Partially Blocked (Some Hours)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
                          <span>Unavailable</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Side - Time Selection or Details */}
                    <div className="p-8 bg-gray-50">
                      {!selectedDate ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                          <Calendar className="w-16 h-16 text-gray-300 mb-4" />
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Date</h3>
                          <p className="text-gray-600 text-sm">
                            Choose an available date from the calendar to see time slots
                          </p>
                        </div>
                      ) : !showDetails ? (
                        <>
                          <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Select Time</h3>
                            <p className="text-sm text-gray-600">
                              {formatDisplayDate(selectedDate)}
                            </p>
                          </div>
                          
                          {availableTimeSlots.length === 0 ? (
                            <div className="text-center py-12">
                              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                              <p className="text-gray-600 font-medium mb-4">No available time slots</p>
                              <button
                                className="text-[#16305B] font-medium underline"
                                onClick={() => setSelectedDate(null)}
                              >
                                Choose a different date
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                              {allTimeSlots.map((slot) => {
                                const isBlocked = isTimeSlotBlocked(slot);
                                const isSelected = selectedTime === slot;
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    disabled={isBlocked}
                                    className={`py-3 px-4 text-center border-2 rounded-lg font-medium transition-all ${
                                      isBlocked
                                        ? "bg-red-100 text-red-600 border-red-400 cursor-not-allowed line-through"
                                        : isSelected
                                        ? "bg-[#16305B] text-white border-[#16305B] shadow-md"
                                        : "bg-white text-gray-900 border-gray-200 hover:border-[#16305B] hover:bg-blue-50"
                                    }`}
                                    onClick={() => !isBlocked && handleTimeSelect(slot)}
                                    title={isBlocked ? "This time slot has been blocked by admin" : ""}
                                  >
                                    {slot}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Enter Details</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDisplayDate(selectedDate)}</span>
                              <span className="mx-2">•</span>
                              <Clock className="w-4 h-4" />
                              <span>{selectedTime}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-4 mb-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Name <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16305B] focus:border-transparent"
                                placeholder="Enter your full name"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16305B] focus:border-transparent"
                                placeholder="Enter your email"
                              />
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-500 mb-6 p-3 bg-gray-100 rounded-lg">
                            By proceeding, you confirm that you agree to our Terms of Use and Privacy Policy.
                          </div>
                          
                          <button
                            type="button"
                            className="w-full bg-[#16305B] text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#0A2342] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            disabled={!name || !email || !selectedTime || isSubmitting}
                            onClick={handleSchedule}
                          >
                            {isSubmitting ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                <span>Loading...</span>
                              </>
                            ) : (
                              "Schedule Trial"
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}