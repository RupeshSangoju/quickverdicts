"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Users, UserCheck, Calendar, FileText, CheckCircle2, Clock, Building2,
  XCircle, Video, UserIcon, Download, ExternalLink, Bell, Activity,
  Phone, Mail, AlertCircle, TrendingUp, Eye, PlayCircle, PauseCircle,
  MapPin, Briefcase, Trash2
} from "lucide-react";
import ConflictModal from "@/components/modals/ConflictModal";
import { formatDateString, formatTime, formatDateTime, getDayOfWeek } from "@/lib/dateUtils";
import { getToken, getUser, isAdmin, clearAuth } from "@/lib/apiClient";

const BLUE = "#0A2342";
const BG = "#FAF9F6";
const LIGHT_BLUE = "#e6ecf5";
const API_BASE = process.env.NEXT_PUBLIC_API_URL 
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

// Auth helper function with better error handling
const getAuthHeaders = () => {
  if (typeof window === 'undefined') return {};

  const token = getToken();
  if (!token) {
    console.warn('No auth token found in localStorage');
    return {};
  }

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Check if user is authenticated as admin
const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;

  const token = getToken();
  const user = getUser();

  // Must have token AND user must be an admin
  if (!token) {
    console.warn('❌ No auth token found');
    return false;
  }

  if (!user) {
    console.warn('❌ No user data found');
    return false;
  }

  if (!isAdmin(user)) {
    console.warn('❌ User is not an admin - type:', user.type);
    return false;
  }

  console.log('✅ Admin authentication verified');
  return true;
};

type Attorney = {
  AttorneyId: number;
  FirstName: string;
  LastName: string;
  Email: string;
  PhoneNumber?: string;
  LawFirmName: string;
  State: string;
  StateBarNumber: string;
  IsVerified: boolean;
  CreatedAt: string;
  VerificationStatus?: string;
};

type Juror = {
  JurorId: number;
  Name: string;
  Email: string;
  County: string;
  State: string;
  IsVerified: boolean;
  Status?: string;
  IsActive?: boolean;
  OnboardingCompleted?: boolean;
  CreatedAt: string;
  VerificationStatus?: string;
  CriteriaResponses?: { question: string; answer: string }[];
};

type Notification = {
  NotificationId: number;
  Title: string;
  Message: string;
  Type: string;
  IsRead: boolean;
  CreatedAt: string;
};

type Witness = {
  WitnessId: number;
  WitnessName: string;
  Email: string | null;
  Side: string;
  Description: string;
  IsAccepted: boolean;
};

type JuryQuestion = {
  QuestionId: number;
  QuestionText: string;
  QuestionType: string;
  Options: string[];
};

type JurorApplication = {
  ApplicationId: number;
  JurorId: number;
  Status: string;
  AppliedAt: string;
  JurorName: string;
  JurorEmail: string;
  County: string;
  State: string;
};

type TeamMember = {
  Id: number;
  Name: string;
  Email: string;
  Role: string;
};

type CaseDetail = {
  CaseId: number;
  CaseTitle: string;
  CaseType: string;
  County: string;
  State: string;
  ScheduledDate: string;
  ScheduledTime: string;
  AttorneyStatus: string;
  PlaintiffGroups: string;
  DefendantGroups: string;
  AttorneyName: string;
  AttorneyEmail: string;
  AttorneyPhone?: string;
  LawFirmName: string;
  RoomId: string | null;
  ThreadId: string | null;
  MeetingStatus: string | null;
  IsRecording?: boolean;
  witnesses: Witness[];
  juryQuestions: JuryQuestion[];
  jurors: JurorApplication[];
  teamMembers: TeamMember[];
  approvedJurorCount: number;
  canJoin: boolean;
};

type PendingCase = {
  CaseId: number;
  CaseTitle: string;
  AttorneyName: string;
  LawFirmName: string;
  ScheduledDate: string;
  ScheduledTime: string;
  County: string;
  CaseType: string;
};

type TimeSlot = {
  date: string;
  time: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [jurors, setJurors] = useState<Juror[]>([]);
  const [pendingCases, setPendingCases] = useState<PendingCase[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [backendError, setBackendError] = useState(false);
  const [stats, setStats] = useState({
    totalAttorneys: 0,
    verifiedAttorneys: 0,
    totalJurors: 0,
    verifiedJurors: 0,
    pendingCases: 0,
    activeTrials: 0,
    scheduledTrials: 0,
    unreadNotifications: 0,
    pendingRescheduleRequests: 0,
  });

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [casesForDate, setCasesForDate] = useState<CaseDetail[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);

  const [readyTrials, setReadyTrials] = useState<CaseDetail[]>([]);
  const [loadingReadyTrials, setLoadingReadyTrials] = useState(false);

  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineType, setDeclineType] = useState<"attorney" | "juror">("attorney");
  const [declineId, setDeclineId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showCriteriaPopup, setShowCriteriaPopup] = useState(false);
  const [currentCriteriaResponses, setCurrentCriteriaResponses] = useState<{ question: string; answer: string }[]>([]);
  const [attorneyFilter, setAttorneyFilter] = useState<"all" | "verified" | "not_verified" | "declined">("all");
  const [jurorFilter, setJurorFilter] = useState<"all" | "verified" | "not_verified" | "declined">("all");
  const [attorneyPage, setAttorneyPage] = useState(1);
  const [jurorPage, setJurorPage] = useState(1);
  const PAGE_SIZE = 10;
  const [attorneySearchQuery, setAttorneySearchQuery] = useState("");
  const [attorneySortBy, setAttorneySortBy] = useState<"name" | "email" | "lawFirm" | "status" | "date">("date");
  const [attorneySortOrder, setAttorneySortOrder] = useState<"asc" | "desc">("desc");

  const [showCaseRejectModal, setShowCaseRejectModal] = useState(false);
  const [rejectCaseId, setRejectCaseId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectComments, setRejectComments] = useState("");
  const [suggestedSlots, setSuggestedSlots] = useState<TimeSlot[]>([
    { date: "", time: "" },
    { date: "", time: "" },
    { date: "", time: "" }
  ]);
  const [caseActionLoading, setCaseActionLoading] = useState<number | null>(null);

  // Case approval modal states
  const [showCaseApprovalModal, setShowCaseApprovalModal] = useState(false);
  const [approveCaseId, setApproveCaseId] = useState<number | null>(null);

  // Witness delete modal states
  const [showDeleteWitnessModal, setShowDeleteWitnessModal] = useState(false);
  const [deleteWitnessId, setDeleteWitnessId] = useState<number | null>(null);
  const [deleteWitnessName, setDeleteWitnessName] = useState<string>("");
  const [deleteWitnessCaseId, setDeleteWitnessCaseId] = useState<number | null>(null);
  const [deletingWitness, setDeletingWitness] = useState(false);

  // Juror delete modal states
  const [showDeleteJurorModal, setShowDeleteJurorModal] = useState(false);
  const [deleteJurorApplicationId, setDeleteJurorApplicationId] = useState<number | null>(null);
  const [deleteJurorName, setDeleteJurorName] = useState<string>("");
  const [deleteJurorCaseId, setDeleteJurorCaseId] = useState<number | null>(null);
  const [deletingJuror, setDeletingJuror] = useState(false);

  // Date blocking modal states
  const [showBlockDateModal, setShowBlockDateModal] = useState(false);
  const [blockDateForm, setBlockDateForm] = useState({ date: "", reason: "" });
  const [blockingDate, setBlockingDate] = useState(false);
  const [blockedDates, setBlockedDates] = useState<any[]>([]);
  const [loadingBlockedDates, setLoadingBlockedDates] = useState(false);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [blockWholeDay, setBlockWholeDay] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Unblock confirmation modal states
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [unblockDate, setUnblockDate] = useState<string>("");
  const [unblocking, setUnblocking] = useState(false);

  // Case delete modal states
  const [showDeleteCaseModal, setShowDeleteCaseModal] = useState(false);
  const [deleteCaseId, setDeleteCaseId] = useState<number | null>(null);
  const [deleteCaseTitle, setDeleteCaseTitle] = useState<string>("");
  const [deletingCase, setDeletingCase] = useState(false);

  // Case reschedule modal states
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleCaseId, setRescheduleCaseId] = useState<number | null>(null);
  const [rescheduleCaseTitle, setRescheduleCaseTitle] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState<string>("");
  const [rescheduling, setRescheduling] = useState(false);

  const [approvalComments, setApprovalComments] = useState("");

  // Date blocking functions
  const fetchBlockedDates = async () => {
    setLoadingBlockedDates(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin-calendar/blocked?startDate=${new Date().toISOString().split('T')[0]}&endDate=${new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`);
      if (response.ok) {
        const data = await response.json();
        // Group by date to show blocked dates (not individual time slots)
        const blockedByDate = data.blockedSlots.reduce((acc: any, slot: any) => {
          // Extract date string directly without timezone conversion
          const date = slot.BlockedDate.substring(0, 10);
          if (!acc[date]) {
            acc[date] = { date, reason: slot.Reason, slots: [] };
          }
          acc[date].slots.push(slot);
          return acc;
        }, {});
        setBlockedDates(Object.values(blockedByDate));
      }
    } catch (error) {
      console.error("Error fetching blocked dates:", error);
    } finally {
      setLoadingBlockedDates(false);
    }
  };

  const handleBlockDate = async () => {
    if (!blockDateForm.date || !blockDateForm.reason) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!blockWholeDay && selectedTimeSlots.length === 0) {
      toast.error("Please select at least one time slot to block");
      return;
    }

    setBlockingDate(true);
    try {
      // Determine which time slots to block
      let timeSlotsToBlock = blockWholeDay
        ? Array.from({ length: 48 }, (_, i) => {
            const hours = Math.floor(i / 2);
            const minutes = i % 2 === 0 ? "00" : "30";
            return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
          })
        : selectedTimeSlots;

      // Filter out past time slots if blocking today
      const isToday = blockDateForm.date === new Date().toISOString().split('T')[0];
      if (isToday && blockWholeDay) {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTotalMinutes = currentHours * 60 + currentMinutes;

        timeSlotsToBlock = timeSlotsToBlock.filter(timeSlot => {
          const [hours, minutes] = timeSlot.split(':').map(Number);
          const slotTotalMinutes = hours * 60 + minutes;
          return slotTotalMinutes >= currentTotalMinutes;
        });

        if (timeSlotsToBlock.length === 0) {
          toast.error("No future time slots available to block for today");
          setBlockingDate(false);
          return;
        }
      }

      console.log(`Blocking ${timeSlotsToBlock.length} time slots for ${blockDateForm.date}`);

      // Block each time slot with error checking
      const blockResults = await Promise.allSettled(
        timeSlotsToBlock.map(async (time) => {
          const response = await fetchWithAuth(`${API_BASE}/api/admin-calendar/block`, {
            method: 'POST',
            body: JSON.stringify({
              blockedDate: blockDateForm.date,
              blockedTime: time,
              duration: 30,
              reason: blockDateForm.reason,
              skipBusinessHoursCheck: true  // Allow blocking outside 9 AM - 5 PM
            })
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to block ${time}: ${error.message || response.statusText}`);
          }

          return response.json();
        })
      );

      // Count successes and failures
      const successful = blockResults.filter(r => r.status === 'fulfilled').length;
      const failed = blockResults.filter(r => r.status === 'rejected').length;

      console.log(`Blocked ${successful} slots successfully, ${failed} failed`);

      if (failed > 0) {
        // Log first few failures for debugging
        const failures = blockResults
          .filter(r => r.status === 'rejected')
          .slice(0, 5)
          .map(r => r.reason.message);
        console.error('Some slot blocking failures:', failures);
      }

      if (successful === 0) {
        throw new Error('Failed to block any time slots');
      }

      // Send notifications to all attorneys and jurors
      const notifyResponse = await fetchWithAuth(`${API_BASE}/api/admin/notify-blocked-date`, {
        method: 'POST',
        body: JSON.stringify({
          date: blockDateForm.date,
          reason: blockDateForm.reason,
          blockedTimeSlots: timeSlotsToBlock,
          isWholeDay: blockWholeDay
        })
      });

      const totalSlots = blockWholeDay ? 48 : selectedTimeSlots.length;
      const blockType = blockWholeDay ? "whole day" : `${selectedTimeSlots.length} time slot(s)`;

      if (notifyResponse.ok) {
        toast.success(`${blockType} blocked for ${blockDateForm.date}! ${successful}/${totalSlots} slots blocked. Notifications sent to all users.`);
      } else {
        toast.success(`${blockType} blocked for ${blockDateForm.date}! ${successful}/${totalSlots} slots blocked.`);
      }

      // Reset form and close modal
      setBlockDateForm({ date: "", reason: "" });
      setSelectedTimeSlots([]);
      setBlockWholeDay(true);
      setShowBlockDateModal(false);
      fetchBlockedDates();
      fetchCasesForDate(selectedDate);
    } catch (error) {
      console.error("Error blocking date:", error);
      toast.error("Failed to block date. Please try again.");
    } finally {
      setBlockingDate(false);
    }
  };

  const handleUnblockDate = async (date: string) => {
    setUnblockDate(date);
    setShowUnblockModal(true);
  };

  const confirmUnblock = async () => {
    setUnblocking(true);
    try {
      // Get all blocked slots for this date
      const response = await fetchWithAuth(`${API_BASE}/api/admin-calendar/blocked?startDate=${unblockDate}&endDate=${unblockDate}`);
      if (response.ok) {
        const data = await response.json();
        const slotsToUnblock = data.blockedSlots || [];

        // Unblock all slots for this date
        const unblockPromises = slotsToUnblock.map((slot: any) =>
          fetchWithAuth(`${API_BASE}/api/admin-calendar/unblock/${slot.CalendarId}`, {
            method: 'DELETE'
          })
        );

        await Promise.all(unblockPromises);

        // Send notifications to all attorneys and jurors
        const notifyResponse = await fetchWithAuth(`${API_BASE}/api/admin/notify-unblocked-date`, {
          method: 'POST',
          body: JSON.stringify({
            date: unblockDate,
            unblockCount: slotsToUnblock.length
          })
        });

        if (notifyResponse.ok) {
          toast.success(`Date ${unblockDate} unblocked successfully! Notifications sent to all users.`);
        } else {
          toast.success(`Date ${unblockDate} unblocked successfully!`);
        }

        setShowUnblockModal(false);
        setUnblockDate("");
        fetchBlockedDates();
        fetchCasesForDate(selectedDate);
      }
    } catch (error) {
      console.error("Error unblocking date:", error);
      toast.error("Failed to unblock date. Please try again.");
    } finally {
      setUnblocking(false);
    }
  };

  // Listen for optimistic case status updates (from war-room submit)
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const detail = e.detail || {};
        const updatedCaseId = detail.caseId;
        const status = detail.status;
        if (!updatedCaseId) return;
        // Update modal if open
        setSelectedCase(prev => prev && prev.CaseId === updatedCaseId ? { ...prev, AttorneyStatus: status } : prev);
        // Update cases shown for the selected date
        setCasesForDate(prev => prev.map(c => c.CaseId === updatedCaseId ? { ...c, AttorneyStatus: status } : c));
        // Update ready trials list
        setReadyTrials(prev => prev.map(c => c.CaseId === updatedCaseId ? { ...c, AttorneyStatus: status } : c));
      } catch (err) {
        // ignore
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('caseStatusUpdated', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('caseStatusUpdated', handler as EventListener);
      }
    };
  }, []);

  // Conflict modal states
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictCaseId, setConflictCaseId] = useState<number | null>(null);
  const [conflictCaseTitle, setConflictCaseTitle] = useState("");
  const [blockedSlot, setBlockedSlot] = useState<{ date: string; time: string }>({ date: "", time: "" });

  const attorneySectionRef = useRef<HTMLDivElement>(null);
  const jurorSectionRef = useRef<HTMLDivElement>(null);
  const casesSectionRef = useRef<HTMLDivElement>(null);

  const REJECTION_REASONS = [
    { value: "scheduling_conflict", label: "🔄 Scheduling Conflict - I'm unavailable at this time" },
    { value: "invalid_case_details", label: "📋 Invalid Case Details - Information incomplete/inappropriate" },
    { value: "missing_documentation", label: "📄 Missing Documentation - Required documents not provided" },
    { value: "jurisdictional_issues", label: "⚖️ Jurisdictional Issues - Case outside platform scope" },
    { value: "duplicate_submission", label: "🔁 Duplicate Submission - Case already exists" },
    { value: "insufficient_lead_time", label: "⏰ Insufficient Lead Time - Trial date too soon" },
    { value: "other", label: "✏️ Other - Specify in comments" }
  ];

  // Check authentication on mount
  useEffect(() => {
    if (!isAuthenticated()) {
      console.error('❌ Not authenticated as admin - redirecting to admin login');
      // Clear any invalid tokens
      clearAuth();
      setAuthError(true);
      setLoading(false);
      // Redirect to admin login page
      router.push('/admin/login');
      return;
    } else {
      setIsAuthChecked(true);
      fetchDashboardData();
      fetchReadyTrials();
      fetchNotifications();
    }
  }, [router]);

  useEffect(() => {
    if (!isAuthChecked) return;

    const interval = setInterval(() => {
      if (isAuthenticated()) {
        fetchReadyTrials();
        fetchNotifications();
        // ✅ AUTO-REFRESH: Also refresh cases for selected date to update witness counts
        if (selectedDate) {
          fetchCasesForDate(selectedDate);
        }
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isAuthChecked, selectedDate]); // Added selectedDate dependency

  useEffect(() => {
    if (selectedDate && isAuthChecked) {
      fetchCasesForDate(selectedDate);
    }
  }, [selectedDate, isAuthChecked]);

  useEffect(() => {
    if (isAuthChecked) {
      fetchBlockedDates();
    }
  }, [isAuthChecked]);

  // ✅ LISTEN FOR WITNESS/CASE UPDATES: Refresh when attorneys modify case data
  useEffect(() => {
    if (!isAuthChecked) return;

    const handleWitnessUpdate = () => {
      console.log('👤 Witness updated - refreshing admin dashboard...');
      fetchReadyTrials();
      if (selectedDate) {
        fetchCasesForDate(selectedDate);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('witness-updated', handleWitnessUpdate as EventListener);
      window.addEventListener('case-updated', handleWitnessUpdate as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('witness-updated', handleWitnessUpdate as EventListener);
        window.removeEventListener('case-updated', handleWitnessUpdate as EventListener);
      }
    };
  }, [isAuthChecked, selectedDate]);

  // Enhanced fetch with error handling
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = getAuthHeaders();

    if (!headers.Authorization) {
      throw new Error('No authentication token available');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (response.status === 401) {
        console.error('❌ Authentication failed - token may be invalid or expired');
        // Clear invalid auth data
        clearAuth();
        setAuthError(true);
        // Redirect immediately to admin login
        router.push('/admin/login');
        throw new Error('Authentication failed');
      }

      // Clear backend error on successful connection
      setBackendError(false);
      return response;
    } catch (error: any) {
      // Handle network errors (backend not running, connection issues, etc.)
      if (error.message === 'Authentication failed') {
        throw error; // Re-throw auth errors
      }

      // Network error - backend likely not running
      console.error('Network error - backend may not be running:', error);
      setBackendError(true);
      throw new Error('Unable to connect to server. Please ensure the backend is running.');
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/stats/comprehensive`);
      const data = await response.json();
      
      if (data.success) {
        setStats(prev => ({
          ...prev,
          unreadNotifications: data.stats.UnreadNotifications || 0
        }));
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchCasesForDate = async (date: string) => {
    setLoadingCases(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/calendar/cases-by-date?date=${date}`);
      const data = await response.json();

      if (data.success) {
        // Filter out any deleted cases as extra safeguard
        const activeCases = (data.cases || []).filter((c: any) => c.IsDeleted === 0 || !c.IsDeleted);
        setCasesForDate(activeCases);
      } else {
        setCasesForDate([]);
      }
    } catch (error) {
      console.error('Error fetching cases for date:', error);
      setCasesForDate([]);
    } finally {
      setLoadingCases(false);
    }
  };

  const fetchReadyTrials = async () => {
    setLoadingReadyTrials(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/trials/ready`);
      const data = await response.json();

      if (data.success) {
        // Filter out any deleted cases as extra safeguard
        const activeTrials = (data.trials || []).filter((t: any) => t.IsDeleted === 0 || !t.IsDeleted);
        setReadyTrials(activeTrials);
      } else {
        setReadyTrials([]);
      }
    } catch (error) {
      console.error('Error fetching ready trials:', error);
      setReadyTrials([]);
    } finally {
      setLoadingReadyTrials(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, attRes, jurRes, casesRes, statsRes, rescheduleRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/api/admin/dashboard`),
        fetchWithAuth(`${API_BASE}/api/admin/attorneys`),
        fetchWithAuth(`${API_BASE}/api/admin/jurors`),
        fetchWithAuth(`${API_BASE}/api/admin/cases/pending`),
        fetchWithAuth(`${API_BASE}/api/admin/stats/comprehensive`),
        fetchWithAuth(`${API_BASE}/api/admin/reschedule-requests`),
      ]);

      const dashboardData = await dashboardRes.json();
      const attData = await attRes.json();
      const jurData = await jurRes.json();
      const casesData = await casesRes.json();
      const statsData = await statsRes.json();
      const rescheduleData = await rescheduleRes.json();

      if (dashboardData.success) {
        // Filter out any deleted cases as extra safeguard
        const activeCases = (dashboardData.pendingCases || []).filter((c: any) => c.IsDeleted === 0 || !c.IsDeleted);
        setPendingCases(activeCases);
      }

      const pendingRescheduleCount = rescheduleData.success ? (rescheduleData.count || 0) : 0;

      if (statsData.success) {
        setStats({
          totalAttorneys: statsData.stats.VerifiedAttorneys + statsData.stats.PendingAttorneys,
          verifiedAttorneys: statsData.stats.VerifiedAttorneys,
          totalJurors: statsData.stats.VerifiedJurors + statsData.stats.PendingJurors,
          verifiedJurors: statsData.stats.VerifiedJurors,
          pendingCases: statsData.stats.PendingCases,
          activeTrials: statsData.stats.ActiveTrials,
          scheduledTrials: statsData.stats.ScheduledTrials,
          unreadNotifications: statsData.stats.UnreadNotifications,
          pendingRescheduleRequests: pendingRescheduleCount,
        });
      }

      const attorneysList = Array.isArray(attData.attorneys) 
        ? attData.attorneys 
        : (Array.isArray(attData) ? attData : []);

      setAttorneys(attorneysList);

      const jurorsList = Array.isArray(jurData.jurors) 
        ? jurData.jurors 
        : (Array.isArray(jurData) ? jurData : []);

      setJurors(jurorsList.map((j: any) => ({
        JurorId: j.JurorId ?? j.id,
        Name: j.Name ?? j.name,
        Email: j.Email ?? j.email,
        County: j.County ?? j.county,
        State: j.State ?? j.state,
        IsVerified: j.IsVerified ?? j.verified,
        Status: j.Status ?? j.status,
        IsActive: j.IsActive ?? j.isActive,
        OnboardingCompleted: j.OnboardingCompleted ?? j.onboardingCompleted,
        CreatedAt: j.CreatedAt ?? j.createdAt,
        VerificationStatus: j.VerificationStatus,
        CriteriaResponses: j.CriteriaResponses ?? j.criteriaResponses ?? [],
      })));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCase = (caseId: number) => {
    setApproveCaseId(caseId);
    setApprovalComments("");
    setShowCaseApprovalModal(true);
  };

  const confirmApproveCase = async () => {
    if (!approveCaseId) return;

    setCaseActionLoading(approveCaseId);
    try {
      // Step 1: Check slot availability BEFORE approving
      console.log(`🔍 Checking slot availability for case ${approveCaseId}...`);

      const checkResponse = await fetchWithAuth(`${API_BASE}/api/admin/cases/${approveCaseId}/check-slot-availability`, {
        method: "POST",
      });

      console.log(`📡 Check response status: ${checkResponse.status}`);

      if (checkResponse.ok) {
        const availabilityData = await checkResponse.json();
        console.log("📊 Availability data:", availabilityData);

        // If slot is not available, show conflict modal
        if (!availabilityData.available) {
          console.log("⚠️ Time slot conflict detected:", availabilityData);

          // Get case title from pending cases
          const caseData = pendingCases.find(c => c.CaseId === approveCaseId);

          // Close approval modal and open conflict modal
          setShowCaseApprovalModal(false);
          setConflictCaseId(approveCaseId);
          setConflictCaseTitle(caseData?.CaseTitle || "Case");
          setBlockedSlot({
            date: availabilityData.scheduledDate,
            time: availabilityData.scheduledTime,
          });
          setShowConflictModal(true);

          toast.error("Time slot is already booked! Please provide alternate slots.", {
            duration: 4000,
            icon: "⚠️",
          });

          setCaseActionLoading(null);
          return;
        }

        console.log("✅ Slot is available, proceeding with approval...");
      } else {
        // If check fails, log error but don't proceed
        const errorData = await checkResponse.json();
        console.error("❌ Slot availability check failed:", errorData);

        toast.error(`Cannot check slot availability: ${errorData.message || 'Unknown error'}. Please try again.`, {
          duration: 5000,
        });

        setCaseActionLoading(null);
        return;
      }

      // Step 2: If slot is available, proceed with approval
      console.log(`✅ Proceeding to approve case ${approveCaseId}...`);

      const response = await fetchWithAuth(`${API_BASE}/api/admin/cases/${approveCaseId}/review`, {
        method: "POST",
        body: JSON.stringify({
          decision: "approved",
          comments: approvalComments || "Case approved by admin"
        }),
      });

      if (response.ok) {
        console.log(`✅ Case ${approveCaseId} approved successfully`);
        setPendingCases(prev => prev.filter(c => c.CaseId !== approveCaseId));
        setShowCaseApprovalModal(false);
        setApproveCaseId(null);
        setApprovalComments("");
        // Update stats locally instead of refetching all data
        setStats((prev) => ({
          ...prev,
          pendingCases: Math.max(0, prev.pendingCases - 1),
        }));
        toast.success("Case approved successfully! It will now be visible to jurors.", {
          duration: 4000,
          icon: "✅",
        });
      } else {
        const error = await response.json();
        console.error("❌ Approval failed:", error);
        toast.error(`Failed to approve case: ${error.message}`, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error("❌ Error in confirmApproveCase:", error);
      toast.error("Failed to approve case. Please try again.", {
        duration: 5000,
      });
    } finally {
      setCaseActionLoading(null);
    }
  };

  const handleSubmitAlternateSlots = async (alternateSlots: Array<{ date: string; time: string }>) => {
    if (!conflictCaseId) return;

    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/cases/${conflictCaseId}/request-reschedule`, {
        method: "POST",
        body: JSON.stringify({ alternateSlots }),
      });

      if (response.ok) {
        setShowConflictModal(false);
        setConflictCaseId(null);
        setConflictCaseTitle("");
        setBlockedSlot({ date: "", time: "" });
        setApproveCaseId(null);

        toast.success("Reschedule request sent to attorney successfully!", {
          duration: 4000,
          icon: "✅",
        });

        // Optionally refresh pending cases
        // fetchDashboardData();
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to send reschedule request");
      }
    } catch (error: any) {
      console.error("Error submitting alternate slots:", error);
      toast.error(`Failed to send reschedule request: ${error.message}`, {
        duration: 5000,
      });
      throw error; // Re-throw to let ConflictModal handle it
    }
  };

  const handleRejectCase = (caseId: number) => {
    setRejectCaseId(caseId);
    setRejectionReason("");
    setRejectComments("");
    setSuggestedSlots([
      { date: "", time: "" },
      { date: "", time: "" },
      { date: "", time: "" }
    ]);
    setShowCaseRejectModal(true);
  };

  const confirmRejectCase = async () => {
    if (!rejectCaseId || !rejectionReason) return;

    if (rejectionReason === "scheduling_conflict") {
      const validSlots = suggestedSlots.filter(slot => slot.date && slot.time);
      if (validSlots.length !== 3) {
        toast.error("Please provide all 3 alternative time slots (date and time required for each)", {
          duration: 4000,
        });
        return;
      }
    }

    if (rejectionReason === "other" && !rejectComments.trim()) {
      toast.error("Please provide comments for 'Other' rejection reason", {
        duration: 4000,
      });
      return;
    }

    setCaseActionLoading(rejectCaseId);
    try {
      const validSlots = suggestedSlots.filter(slot => slot.date && slot.time);
      
      const response = await fetchWithAuth(`${API_BASE}/api/admin/cases/${rejectCaseId}/review`, {
        method: "POST",
        body: JSON.stringify({
          decision: "rejected",
          rejectionReason,
          comments: rejectComments || "",
          suggestedSlots: rejectionReason === "scheduling_conflict" ? validSlots : []
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // ✅ OPTION 1: Scheduling conflict keeps case in pending list
        // Other rejections remove the case from pending list
        if (result.decision === "reschedule_requested") {
          // Scheduling conflict - case stays pending
          toast.success("Reschedule request sent! Case stays pending until attorney responds.", {
            duration: 5000,
            icon: "🔄",
          });
          // Don't remove from pending list, don't decrement stats
        } else {
          // Final rejection - remove from pending list
          setPendingCases(prev => prev.filter(c => c.CaseId !== rejectCaseId));
          setStats((prev) => ({
            ...prev,
            pendingCases: Math.max(0, prev.pendingCases - 1),
          }));
          toast.success("Case rejected successfully! Attorney has been notified.", {
            duration: 4000,
            icon: "✅",
          });
        }

        setShowCaseRejectModal(false);
        setRejectCaseId(null);
        setRejectionReason("");
        setRejectComments("");
      } else {
        const error = await response.json();
        toast.error(`Failed to reject case: ${error.message}`, {
          duration: 5000,
        });
      }
    } catch (error) {
      console.error("Error rejecting case:", error);
      toast.error("Failed to reject case. Please try again.", {
        duration: 5000,
      });
    } finally {
      setCaseActionLoading(null);
    }
  };

  const handleVerifyAttorney = async (attorneyId: number) => {
    setActionLoading(attorneyId);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/attorneys/${attorneyId}/verify`, {
        method: "POST",
        body: JSON.stringify({ status: "verified" }),
      });
      if (response.ok) {
        // Update attorney in local state
        setAttorneys((prev) =>
          prev.map((a) => a.AttorneyId === attorneyId ? { ...a, VerificationStatus: "verified", IsVerified: true } : a)
        );
        // Update stats locally instead of refetching all data
        setStats((prev) => ({
          ...prev,
          verifiedAttorneys: prev.verifiedAttorneys + 1,
        }));
        toast.success("Attorney verified successfully!", {
          duration: 3000,
          icon: "✅",
        });
      }
    } catch (error) {
      console.error("Error verifying attorney:", error);
      toast.error("Failed to verify attorney. Please try again.", {
        duration: 4000,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineAttorney = (attorneyId: number) => {
    setDeclineType("attorney");
    setDeclineId(attorneyId);
    setDeclineReason("");
    setShowDeclineModal(true);
  };

  const handleVerifyJuror = async (jurorId: number) => {
    setActionLoading(jurorId);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/jurors/${jurorId}/verify`, {
        method: "POST",
        body: JSON.stringify({ status: "verified" }),
      });
      if (response.ok) {
        // Update juror in local state
        setJurors((prev) =>
          prev.map((j) => j.JurorId === jurorId ? { ...j, VerificationStatus: "verified", IsVerified: true } : j)
        );
        // Update stats locally instead of refetching all data
        setStats((prev) => ({
          ...prev,
          verifiedJurors: prev.verifiedJurors + 1,
        }));
        toast.success("Juror verified successfully!", {
          duration: 3000,
          icon: "✅",
        });
      }
    } catch (error) {
      console.error("Error verifying juror:", error);
      toast.error("Failed to verify juror. Please try again.", {
        duration: 4000,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineJuror = (jurorId: number) => {
    setDeclineType("juror");
    setDeclineId(jurorId);
    setDeclineReason("");
    setShowDeclineModal(true);
  };

  const confirmDecline = async () => {
    if (!declineId) return;
    setActionLoading(declineId);
    try {
      const endpoint = declineType === "attorney"
        ? `${API_BASE}/api/admin/attorneys/${declineId}/verify`
        : `${API_BASE}/api/admin/jurors/${declineId}/verify`;
      const response = await fetchWithAuth(endpoint, {
        method: "POST",
        body: JSON.stringify({ status: "declined", comments: declineReason || "No reason provided" }),
      });
      if (response.ok) {
        if (declineType === "attorney") {
          setAttorneys((prev) =>
            prev.map((a) => a.AttorneyId === declineId ? { ...a, VerificationStatus: "declined", IsVerified: false } : a)
          );
          toast.success("Attorney declined successfully.", {
            duration: 3000,
          });
        } else {
          setJurors((prev) =>
            prev.map((j) => j.JurorId === declineId ? { ...j, VerificationStatus: "declined", IsVerified: false } : j)
          );
          toast.success("Juror declined successfully.", {
            duration: 3000,
          });
        }
        setShowDeclineModal(false);
      }
    } catch (error) {
      console.error(`Error declining ${declineType}:`, error);
      toast.error(`Failed to decline ${declineType}. Please try again.`, {
        duration: 4000,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAttorneys = attorneys
    .filter((a) => {
      // Filter by verification status
      if (attorneyFilter === "verified") return a.IsVerified;
      if (attorneyFilter === "not_verified") return !a.IsVerified && a.VerificationStatus !== "declined";
      if (attorneyFilter === "declined") return a.VerificationStatus === "declined";
      return true;
    })
    .filter((a) => {
      // Filter by search query
      if (!attorneySearchQuery) return true;
      const query = attorneySearchQuery.toLowerCase();
      const fullName = `${a.FirstName} ${a.LastName}`.toLowerCase();
      return (
        fullName.includes(query) ||
        a.Email.toLowerCase().includes(query) ||
        a.LawFirmName.toLowerCase().includes(query) ||
        a.StateBarNumber.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      // Sort by selected field
      let comparison = 0;
      switch (attorneySortBy) {
        case "name":
          const nameA = `${a.FirstName} ${a.LastName}`.toLowerCase();
          const nameB = `${b.FirstName} ${b.LastName}`.toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        case "email":
          comparison = a.Email.toLowerCase().localeCompare(b.Email.toLowerCase());
          break;
        case "lawFirm":
          comparison = a.LawFirmName.toLowerCase().localeCompare(b.LawFirmName.toLowerCase());
          break;
        case "status":
          const statusA = a.VerificationStatus === "declined" ? 2 : (a.IsVerified ? 0 : 1);
          const statusB = b.VerificationStatus === "declined" ? 2 : (b.IsVerified ? 0 : 1);
          comparison = statusA - statusB;
          break;
        case "date":
          comparison = new Date(a.CreatedAt).getTime() - new Date(b.CreatedAt).getTime();
          break;
      }
      return attorneySortOrder === "asc" ? comparison : -comparison;
    });
  const paginatedAttorneys = filteredAttorneys.slice((attorneyPage - 1) * PAGE_SIZE, attorneyPage * PAGE_SIZE);

  const handleAttorneySortChange = (column: "name" | "email" | "lawFirm" | "status" | "date") => {
    if (attorneySortBy === column) {
      // Toggle sort order if clicking the same column
      setAttorneySortOrder(attorneySortOrder === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to ascending
      setAttorneySortBy(column);
      setAttorneySortOrder("asc");
    }
  };

  const filteredJurors = jurors.filter((j) => {
    if (jurorFilter === "verified") return j.IsVerified;
    if (jurorFilter === "not_verified") return !j.IsVerified && j.VerificationStatus !== "declined";
    if (jurorFilter === "declined") return j.VerificationStatus === "declined";
    return true;
  });
  const paginatedJurors = filteredJurors.slice((jurorPage - 1) * PAGE_SIZE, jurorPage * PAGE_SIZE);

  // Show auth error screen
  if (authError) {
    return (
      <main className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: BG }}>
        <div className="flex flex-col items-center space-y-4 max-w-md text-center p-8">
          <AlertCircle className="h-20 w-20 text-red-500" />
          <h1 className="text-2xl font-bold text-red-600">Authentication Required</h1>
          <p className="text-gray-700">You need to be logged in to access the admin dashboard.</p>
          <p className="text-sm text-gray-600">Redirecting to login page...</p>
          <button 
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: BG }}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4" style={{ borderColor: BLUE }}></div>
          <p className="text-xl font-semibold" style={{ color: BLUE }}>Loading Control Center...</p>
        </div>
      </main>
    );
  }

  const handleDownloadWitnesses = async (caseId: number) => {
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/case/cases/${caseId}/witnesses/export/text`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `witnesses-case-${caseId}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading witnesses:', error);
      alert('Failed to download witnesses');
    }
  };

  const handleDownloadJuryQuestionsText = async (caseId: number) => {
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/case/cases/${caseId}/jury-charge/export/text`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jury-charge-case-${caseId}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading jury questions:', error);
      alert('Failed to download jury questions');
    }
  };

  const handleDownloadJuryQuestionsMSForms = async (caseId: number) => {
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/case/cases/${caseId}/jury-charge/export/ms-forms`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ms-forms-template-case-${caseId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading MS Forms template:', error);
      alert('Failed to download MS Forms template');
    }
  };

  const handleDeleteWitness = (witnessId: number, witnessName: string, caseId: number) => {
    setDeleteWitnessId(witnessId);
    setDeleteWitnessName(witnessName);
    setDeleteWitnessCaseId(caseId);
    setShowDeleteWitnessModal(true);
  };

  const confirmDeleteWitness = async () => {
    if (!deleteWitnessId || !deleteWitnessCaseId) return;

    setDeletingWitness(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/witnesses/${deleteWitnessId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Update the selectedCase to remove the deleted witness
        if (selectedCase && selectedCase.CaseId === deleteWitnessCaseId) {
          setSelectedCase({
            ...selectedCase,
            witnesses: selectedCase.witnesses.filter(w => w.WitnessId !== deleteWitnessId)
          });
        }

        // Update casesForDate to remove the deleted witness
        setCasesForDate(prevCases =>
          prevCases.map(c =>
            c.CaseId === deleteWitnessCaseId
              ? { ...c, witnesses: c.witnesses.filter(w => w.WitnessId !== deleteWitnessId) }
              : c
          )
        );

        alert('Witness deleted successfully');
        setShowDeleteWitnessModal(false);
        setDeleteWitnessId(null);
        setDeleteWitnessName("");
        setDeleteWitnessCaseId(null);
      } else {
        const data = await response.json();
        alert(`Failed to delete witness: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting witness:', error);
      alert('Failed to delete witness');
    } finally {
      setDeletingWitness(false);
    }
  };

  const handleDeleteJuror = (applicationId: number, jurorName: string, caseId: number) => {
    setDeleteJurorApplicationId(applicationId);
    setDeleteJurorName(jurorName);
    setDeleteJurorCaseId(caseId);
    setShowDeleteJurorModal(true);
  };

  const confirmDeleteJuror = async () => {
    if (!deleteJurorApplicationId || !deleteJurorCaseId) return;

    setDeletingJuror(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/juror-applications/${deleteJurorApplicationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Update the selectedCase to remove the deleted juror
        if (selectedCase && selectedCase.CaseId === deleteJurorCaseId) {
          setSelectedCase({
            ...selectedCase,
            jurors: selectedCase.jurors.filter(j => j.ApplicationId !== deleteJurorApplicationId)
          });
        }

        // Update casesForDate to remove the deleted juror
        setCasesForDate(prevCases =>
          prevCases.map(c =>
            c.CaseId === deleteJurorCaseId
              ? { ...c, jurors: c.jurors.filter(j => j.ApplicationId !== deleteJurorApplicationId) }
              : c
          )
        );

        alert('Juror application deleted successfully');
        setShowDeleteJurorModal(false);
        setDeleteJurorApplicationId(null);
        setDeleteJurorName("");
        setDeleteJurorCaseId(null);
      } else {
        const data = await response.json();
        alert(`Failed to delete juror application: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting juror application:', error);
      alert('Failed to delete juror application');
    } finally {
      setDeletingJuror(false);
    }
  };

  const handleDeleteCase = (caseId: number, caseTitle: string) => {
    setDeleteCaseId(caseId);
    setDeleteCaseTitle(caseTitle);
    setShowDeleteCaseModal(true);
  };

  const confirmDeleteCase = async () => {
    if (!deleteCaseId) return;

    setDeletingCase(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/cases/${deleteCaseId}/delete`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();

        // Close the case modal
        setShowCaseModal(false);
        setSelectedCase(null);

        // Remove case from pending cases list
        setPendingCases(prevCases => prevCases.filter(c => c.CaseId !== deleteCaseId));

        // Remove case from casesForDate list
        setCasesForDate(prevCases => prevCases.filter(c => c.CaseId !== deleteCaseId));

        // Remove case from ready trials list
        setReadyTrials(prevTrials => prevTrials.filter(t => t.CaseId !== deleteCaseId));

        toast.success(`Case "${deleteCaseTitle}" deleted successfully. ${data.data?.notificationsSent || 0} notifications sent to affected users.`);

        setShowDeleteCaseModal(false);
        setDeleteCaseId(null);
        setDeleteCaseTitle("");

        // Refresh dashboard stats
        fetchDashboardData();
      } else {
        const data = await response.json();
        toast.error(`Failed to delete case: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting case:', error);
      toast.error('Failed to delete case. Please try again.');
    } finally {
      setDeletingCase(false);
    }
  };

  const handleRescheduleCase = (caseId: number, caseTitle: string) => {
    setRescheduleCaseId(caseId);
    setRescheduleCaseTitle(caseTitle);
    setRescheduleReason("");
    setShowRescheduleModal(true);
  };

  const confirmRescheduleCase = async () => {
    if (!rescheduleCaseId) return;

    if (!rescheduleReason || rescheduleReason.trim().length === 0) {
      toast.error("Please provide a reason for rescheduling");
      return;
    }

    setRescheduling(true);
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/admin/cases/${rescheduleCaseId}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ reason: rescheduleReason.trim() }),
      });

      if (response.ok) {
        const data = await response.json();

        // Close the case modal
        setShowCaseModal(false);
        setSelectedCase(null);

        // Refresh the case lists
        toast.success(`Case "${rescheduleCaseTitle}" rescheduled successfully. ${data.notificationsSent || 0} notifications sent.`);

        setShowRescheduleModal(false);
        setRescheduleCaseId(null);
        setRescheduleCaseTitle("");
        setRescheduleReason("");

        // Refresh dashboard data
        fetchDashboardData();
      } else {
        const data = await response.json();
        toast.error(`Failed to reschedule case: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error rescheduling case:', error);
      toast.error('Failed to reschedule case. Please try again.');
    } finally {
      setRescheduling(false);
    }
  };

  const getJurorDecisionLabel = (status?: string) => {
    const normalized = (status || "").toString().trim().toLowerCase();
    if (normalized === 'approved') return 'Accepted';
    if (normalized === 'rejected') return 'Rejected';
    if (normalized === 'pending') return 'Pending';
    if (!normalized) return 'Unknown';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const getJurorDecisionClasses = (status?: string) => {
    const normalized = (status || "").toString().trim().toLowerCase();
    if (normalized === 'approved') return 'bg-green-100 text-green-700';
    if (normalized === 'rejected') return 'bg-red-100 text-red-700';
    if (normalized === 'pending') return 'bg-yellow-100 text-yellow-700';
    if (!normalized) return 'bg-gray-100 text-gray-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  function applyOffsetToUtcTime(utcTime: string, dateString: string, timezoneOffset: string, offsetMinutesMap:number) {
  const offsetMinutes = offsetMinutesMap * 2;
  if (offsetMinutes === null) throw new Error('Invalid timezoneOffset');

  // Build a UTC instant (number of ms since epoch)
  const utcMs = Date.parse(`${dateString}T${utcTime}Z`);
  if (isNaN(utcMs)) throw new Error('Invalid UTC date/time');

  // If timezoneOffset includes '+' subtract offsetMinutes, if '-' add it
  const signChar = timezoneOffset.includes('+') ? '+' : timezoneOffset.includes('-') ? '-' : '+';
        // console.log("utcMs:",new Date(utcMs))
  const resultMs = signChar === '+'
    ? utcMs - offsetMinutes * 60_000
    : utcMs + Math.abs(offsetMinutes) * 60_000;

  const resultDate = new Date(resultMs);
  return {
    date: resultDate,
    "12HoursTime": resultDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
    "24HoursTime" : resultDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false }),
    "dateString": resultDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
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


function formatTime(timeString: string, scheduledDate: string) {

  const systemTz = getSystemTimezoneInfo();
    let zoneMap  = '';

    // use the formatOffset returned from getSystemTimezoneInfo and ensure offsetMinutes is numeric
    zoneMap = systemTz.formatOffset ? systemTz.formatOffset : "";
    const offsetMinutes = typeof systemTz.offsetMinutes === 'number' ? systemTz.offsetMinutes : 0;

    // console.log(applyOffsetToUtcTime(timeString, scheduledDate, zoneMap, offsetMinutes));

    const dataSystemmap = applyOffsetToUtcTime(timeString, scheduledDate, zoneMap, offsetMinutes);
    return `${dataSystemmap["dateString"]} - ${dataSystemmap["24HoursTime"]}`;
}
  
  return (
    <main className="min-h-screen w-full" style={{ backgroundColor: BG }}>
      {/* Header */}
      <div className="bg-white shadow-md border-b-2 border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: BLUE }}>
                Admin Control Center
              </h1>
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Manage attorneys, jurors, and cases
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => router.push('/admin/notifications')}
                  className="relative p-3 rounded-full hover:bg-gray-100 transition-colors"
                  title="View notifications"
                >
                  <Bell className="h-6 w-6 text-gray-700" />
                  {stats.unreadNotifications > 0 && (
                    <span className="absolute top-1 right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                      {stats.unreadNotifications}
                    </span>
                  )}
                </button>
              </div>
              <div className="text-sm text-gray-500 text-right">
                <div className="font-semibold">Last updated</div>
                <div>{new Date().toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backend Connection Error Banner */}
      {backendError && (
        <div className="max-w-7xl mx-auto px-8 pt-8">
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 shadow-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-bold text-red-900">Unable to Connect to Backend Server</h3>
                <div className="mt-2 text-sm text-red-800">
                  <p className="mb-2">The admin dashboard cannot connect to the backend API. This could be because:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>The backend server is not running</li>
                    <li>The backend is running on a different port than expected</li>
                    <li>There are network connectivity issues</li>
                  </ul>
                  <p className="mt-3 font-semibold">Please ensure the backend server is running on <code className="bg-red-100 px-2 py-1 rounded text-red-900">{API_BASE || 'http://localhost:4000'}</code></p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setBackendError(false);
                      window.location.reload();
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl hover:scale-105 transition-all border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Attorneys</p>
                <p className="text-4xl font-bold mt-2" style={{ color: BLUE }}>{stats.totalAttorneys}</p>
                <p className="text-gray-500 text-xs mt-1">{stats.verifiedAttorneys} verified</p>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: LIGHT_BLUE }}>
                <Building2 className="h-8 w-8" style={{ color: BLUE }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl hover:scale-105 transition-all border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Jurors</p>
                <p className="text-4xl font-bold mt-2" style={{ color: BLUE }}>{stats.totalJurors}</p>
                <p className="text-gray-500 text-xs mt-1">{stats.verifiedJurors} verified</p>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: LIGHT_BLUE }}>
                <Users className="h-8 w-8" style={{ color: BLUE }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl hover:scale-105 transition-all border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Pending Cases</p>
                <p className="text-4xl font-bold mt-2" style={{ color: BLUE }}>{stats.pendingCases}</p>
                <p className="text-gray-500 text-xs mt-1">Need approval</p>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: LIGHT_BLUE }}>
                <Clock className="h-8 w-8" style={{ color: BLUE }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl hover:scale-105 transition-all border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Trials</p>
                <p className="text-4xl font-bold mt-2" style={{ color: BLUE }}>{stats.activeTrials}</p>
                <p className="text-gray-500 text-xs mt-1">{stats.scheduledTrials} scheduled</p>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: LIGHT_BLUE }}>
                <Video className="h-8 w-8" style={{ color: BLUE }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl hover:scale-105 transition-all border border-gray-200 cursor-pointer" onClick={() => router.push('/admin/reschedule-requests')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Reschedule Requests</p>
                <p className="text-4xl font-bold mt-2" style={{ color: BLUE }}>{stats.pendingRescheduleRequests}</p>
                <p className="text-gray-500 text-xs mt-1">Need review</p>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: LIGHT_BLUE }}>
                <Calendar className="h-8 w-8" style={{ color: BLUE }} />
              </div>
            </div>
          </div>
        </div>

{/* Calendar and Cases View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Quick Actions + Calendar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" style={{ color: BLUE }}>
                <TrendingUp className="h-5 w-5" />
                Quick Actions
              </h2>
              <div className="space-y-3">
                <button 
                  className="w-full bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 text-left font-medium hover:shadow-md transition-all border border-blue-200 group" 
                  onClick={() => attorneySectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-500 rounded-lg mr-3 group-hover:scale-110 transition-transform">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-gray-900 group-hover:text-blue-600 font-semibold">Attorneys Management</span>
                  </div>
                </button>
                <button 
                  className="w-full bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 text-left font-medium hover:shadow-md transition-all border border-green-200 group" 
                  onClick={() => jurorSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-green-500 rounded-lg mr-3 group-hover:scale-110 transition-transform">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-gray-900 group-hover:text-green-600 font-semibold">Jurors Management</span>
                  </div>
                </button>
                <button
                  className="w-full bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-4 text-left font-medium hover:shadow-md transition-all border border-yellow-200 group"
                  onClick={() => casesSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-500 rounded-lg mr-3 group-hover:scale-110 transition-transform">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-gray-900 group-hover:text-yellow-600 font-semibold">Pending Cases</span>
                  </div>
                </button>
                <button
                  className="w-full bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg p-4 text-left font-medium hover:shadow-md transition-all border border-amber-200 group"
                  onClick={() => router.push('/admin/reschedule-requests')}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-amber-500 rounded-lg mr-3 group-hover:scale-110 transition-transform">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-gray-900 group-hover:text-amber-600 font-semibold">Reschedule Requests</span>
                      {stats.pendingRescheduleRequests > 0 && (
                        <span className="px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">
                          {stats.pendingRescheduleRequests}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <button
                  className="w-full bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-4 text-left font-medium hover:shadow-md transition-all border border-red-200 group"
                  onClick={() => setShowBlockDateModal(true)}
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-red-500 rounded-lg mr-3 group-hover:scale-110 transition-transform">
                      <XCircle className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-gray-900 group-hover:text-red-600 font-semibold">Block Dates</span>
                      {blockedDates.length > 0 && (
                        <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                          {blockedDates.length}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Calendar Selector */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold" style={{ color: BLUE }}>Trial Calendar</h2>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-900 text-lg font-medium hover:border-blue-400 transition-colors"
              />
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-700">
                  <strong className="text-blue-700 text-lg">{casesForDate.length}</strong> {casesForDate.length === 1 ? 'case' : 'cases'} scheduled
                </p>
              </div>
            </div>
          </div>

          {/* Right: Cases for Selected Date */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: BLUE }}>
                  {formatDateString(selectedDate, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h2>
                <p className="text-gray-600 text-sm mt-1">Scheduled trials for this date</p>
              </div>
              {casesForDate.length > 0 && (
                <span className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-sm font-bold shadow-lg">
                  {casesForDate.length} {casesForDate.length === 1 ? 'Case' : 'Cases'}
                </span>
              )}
            </div>

            {loadingCases ? (
              <div className="flex justify-center items-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4" style={{ borderColor: BLUE }}></div>
              </div>
            ) : casesForDate.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Calendar className="h-20 w-20 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No trials scheduled</p>
                <p className="text-gray-500 text-sm mt-2">Select a different date to view scheduled trials</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {casesForDate.map((caseItem) => (
                  <div
                    key={caseItem.CaseId}
                    className="border-2 border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer bg-gradient-to-r from-gray-50 to-white group"
                    onClick={() => {
                      setSelectedCase(caseItem);
                      setShowCaseModal(true);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-lg mb-1">{caseItem.CaseTitle}</h3>
                        <p className="text-sm text-gray-600">Case #{caseItem.CaseId}</p>
                      </div>
                      {caseItem.IsRecording && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold flex items-center gap-1">
                          <span className="inline-block w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                          REC
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Clock className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{caseItem.ScheduledTime}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Users className="h-3.5 w-3.5 text-green-500" />
                        <span>{caseItem.approvedJurorCount} Jurors</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Building2 className="h-3.5 w-3.5 text-purple-500" />
                        <span className="truncate">{caseItem.LawFirmName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Briefcase className="h-3.5 w-3.5 text-orange-500" />
                        <span>{caseItem.CaseType}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">
                        {caseItem.witnesses?.length || 0} Witnesses
                      </span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
                        {caseItem.juryQuestions?.length || 0} Questions
                      </span>
                      {caseItem.canJoin && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Ready
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Cases */}
        <div ref={casesSectionRef} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-yellow-100 rounded-lg mr-3">
              <FileText className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="text-2xl font-bold" style={{ color: BLUE }}>Pending Case Approvals</h3>
            <span className="ml-4 px-4 py-1.5 bg-yellow-100 text-yellow-800 text-sm font-bold rounded-full">
              {pendingCases.length} pending
            </span>
          </div>
          {pendingCases.length === 0 ? (
            <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <p className="font-semibold text-lg">All caught up!</p>
              <p className="text-sm mt-1">No cases pending approval</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingCases.map((caseItem) => (
                <div key={caseItem.CaseId} className="border-2 border-gray-200 rounded-xl p-5 bg-gradient-to-r from-yellow-50 to-white hover:shadow-lg transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold text-blue-900 text-xl mb-2">{caseItem.CaseTitle}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-blue-500" />
                          <span><strong>Attorney:</strong> {caseItem.AttorneyName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-purple-500" />
                          <span><strong>Firm:</strong> {caseItem.LawFirmName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-500" />
                          <span><strong>Location:</strong> {caseItem.County}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-orange-500" />
                          <span><strong>Type:</strong> {caseItem.CaseType}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span><strong>Scheduled:</strong> {formatTime(caseItem.ScheduledTime, caseItem.ScheduledDate)}</span>
                      </div>
                    </div>
                    <div className="flex space-x-3 ml-6">
                      <button 
                        onClick={() => handleApproveCase(caseItem.CaseId)}
                        disabled={caseActionLoading === caseItem.CaseId}
                        className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                      >
                        {caseActionLoading === caseItem.CaseId ? (
                          <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                        ) : (
                          <>
                            <CheckCircle2 className="h-5 w-5" />
                            Approve
                          </>
                        )}
                      </button>
                      <button 
                        onClick={() => handleRejectCase(caseItem.CaseId)}
                        disabled={caseActionLoading === caseItem.CaseId}
                        className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
                      >
                        <XCircle className="h-5 w-5" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Trials - Admin can join */}
        <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-xl shadow-lg p-6 border-2 border-indigo-300">
          <div className="flex items-center mb-6">
            <div className={`p-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg mr-3 ${readyTrials.length > 0 ? 'animate-pulse' : ''}`}>
              <Video className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Live Trials
              </h3>
              <p className="text-gray-700 text-sm font-medium">Join as admin to monitor and record proceedings</p>
            </div>
            <span className={`ml-auto px-4 py-2 ${readyTrials.length > 0 ? 'bg-gradient-to-r from-red-500 to-pink-500 animate-pulse' : 'bg-gray-400'} text-white rounded-full text-sm font-bold shadow-lg`}>
              {readyTrials.length} LIVE
            </span>
          </div>

          {loadingReadyTrials ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
            </div>
          ) : readyTrials.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                <Video className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">No live trials at the moment</p>
              <p className="text-gray-500 text-sm mt-2">Trials scheduled for today will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {readyTrials.map((trial) => (
                  <div
                    key={trial.CaseId}
                    className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-5 border-2 border-indigo-200 hover:border-indigo-400"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-lg mb-1">{trial.CaseTitle}</h4>
                        <p className="text-sm text-gray-600">Case #{trial.CaseId}</p>
                      </div>
                      {trial.IsRecording && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold flex items-center gap-1">
                          <span className="inline-block w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                          REC
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Clock className="h-3.5 w-3.5 text-indigo-500" />
                        <span>{trial.ScheduledTime}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Users className="h-3.5 w-3.5 text-green-500" />
                        <span>{trial.approvedJurorCount} Jurors</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Building2 className="h-3.5 w-3.5 text-purple-500" />
                        <span className="truncate">{trial.LawFirmName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Briefcase className="h-3.5 w-3.5 text-orange-500" />
                        <span>{trial.CaseType}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => window.open(`/admin/trial/${trial.CaseId}/conference`, '_blank')}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                    >
                      <Video className="h-5 w-5" />
                      Join Trial
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        {/* Reschedule Requests */}
        <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 rounded-xl shadow-lg p-6 border-2 border-orange-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-r from-orange-600 to-amber-600 rounded-lg mr-3">
                <Calendar className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                  Reschedule Requests
                </h3>
                <p className="text-gray-700 text-sm font-medium">Attorney-initiated case reschedule requests pending approval</p>
              </div>
            </div>
            <span className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full text-sm font-bold shadow-lg">
              {stats.pendingRescheduleRequests} Pending
            </span>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => router.push('/admin/reschedule-requests')}
              className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2"
            >
              <Calendar className="h-5 w-5" />
              View All Reschedule Requests
            </button>
          </div>
        </div>

        {/* Attorneys Table */}
        <div ref={attorneySectionRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-blue-500 rounded-lg mr-3">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: BLUE }}>Attorneys Management</h2>
                  <p className="text-gray-600 text-sm">{filteredAttorneys.length} attorneys total</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  placeholder="Search by name, email, law firm, or bar number..."
                  className="border-2 border-gray-300 rounded-lg px-4 py-2 text-sm text-black bg-white focus:border-blue-500 focus:outline-none w-96"
                  value={attorneySearchQuery}
                  onChange={(e) => { setAttorneySearchQuery(e.target.value); setAttorneyPage(1); }}
                />
                <select
                  className="border-2 border-gray-300 rounded-lg px-4 py-2 text-sm text-black bg-white font-medium focus:border-blue-500 focus:outline-none"
                  value={attorneyFilter}
                  onChange={(e) => { setAttorneyFilter(e.target.value as any); setAttorneyPage(1); }}
                >
                  <option value="all">All Attorneys</option>
                  <option value="verified">✓ Verified</option>
                  <option value="not_verified">⏳ Pending</option>
                  <option value="declined">✗ Declined</option>
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th
                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors select-none"
                    onClick={() => handleAttorneySortChange("name")}
                  >
                    <div className="flex items-center gap-2">
                      Attorney Info
                      {attorneySortBy === "name" && (
                        <span className="text-blue-600">{attorneySortOrder === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors select-none"
                    onClick={() => handleAttorneySortChange("email")}
                  >
                    <div className="flex items-center gap-2">
                      Contact
                      {attorneySortBy === "email" && (
                        <span className="text-blue-600">{attorneySortOrder === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors select-none"
                    onClick={() => handleAttorneySortChange("lawFirm")}
                  >
                    <div className="flex items-center gap-2">
                      Law Firm
                      {attorneySortBy === "lawFirm" && (
                        <span className="text-blue-600">{attorneySortOrder === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Bar Number</th>
                  <th
                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors select-none"
                    onClick={() => handleAttorneySortChange("status")}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {attorneySortBy === "status" && (
                        <span className="text-blue-600">{attorneySortOrder === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors select-none"
                    onClick={() => handleAttorneySortChange("date")}
                  >
                    <div className="flex items-center gap-2">
                      Joined
                      {attorneySortBy === "date" && (
                        <span className="text-blue-600">{attorneySortOrder === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginatedAttorneys.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium text-lg">No attorneys found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedAttorneys.map((attorney) => (
                    <tr key={attorney.AttorneyId} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 text-lg">{attorney.FirstName} {attorney.LastName}</div>
                        <div className="text-sm text-gray-600">{attorney.State}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                          <Mail className="h-4 w-4 text-blue-500" />
                          <span>{attorney.Email}</span>
                        </div>
                        {attorney.PhoneNumber && (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Phone className="h-4 w-4 text-green-500" />
                            <span>{attorney.PhoneNumber}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{attorney.LawFirmName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-semibold bg-gray-200 text-gray-900 px-3 py-1.5 rounded">{attorney.StateBarNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        {attorney.VerificationStatus === "declined" ? (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                            <XCircle className="h-4 w-4 mr-1" />Declined
                          </span>
                        ) : attorney.IsVerified ? (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                            <CheckCircle2 className="h-4 w-4 mr-1" />Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                            <Clock className="h-4 w-4 mr-1" />Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(attorney.CreatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {!attorney.IsVerified && attorney.VerificationStatus !== "declined" && (
                          <div className="flex justify-center space-x-2">
                            <button 
                              onClick={() => handleVerifyAttorney(attorney.AttorneyId)} 
                              disabled={actionLoading === attorney.AttorneyId} 
                              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold text-white bg-green-600 hover:bg-green-700 hover:shadow-lg disabled:opacity-50 transition-all"
                            >
                              {actionLoading === attorney.AttorneyId ? (
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                              ) : (
                                <><CheckCircle2 className="h-4 w-4 mr-1" />Verify</>
                              )}
                            </button>
                            <button 
                              onClick={() => handleDeclineAttorney(attorney.AttorneyId)} 
                              disabled={actionLoading === attorney.AttorneyId} 
                              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 hover:shadow-lg disabled:opacity-50 transition-all"
                            >
                              <XCircle className="h-4 w-4 mr-1" />Decline
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Showing {filteredAttorneys.length === 0 ? 0 : (attorneyPage - 1) * PAGE_SIZE + 1} to{" "}
                {Math.min(attorneyPage * PAGE_SIZE, filteredAttorneys.length)} of {filteredAttorneys.length} results
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-4 py-2 rounded-lg bg-gray-200 text-black font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={attorneyPage === 1}
                onClick={() => setAttorneyPage(attorneyPage - 1)}
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(filteredAttorneys.length / PAGE_SIZE));
                  const pages = [];

                  if (totalPages <= 7) {
                    // Show all pages if 7 or fewer
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    // Show first page, last page, current page and neighbors
                    if (attorneyPage <= 3) {
                      pages.push(1, 2, 3, 4, -1, totalPages);
                    } else if (attorneyPage >= totalPages - 2) {
                      pages.push(1, -1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                    } else {
                      pages.push(1, -1, attorneyPage - 1, attorneyPage, attorneyPage + 1, -2, totalPages);
                    }
                  }

                  return pages.map((page, index) => {
                    if (page === -1 || page === -2) {
                      return (
                        <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setAttorneyPage(page)}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          attorneyPage === page
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-black hover:bg-gray-300"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  });
                })()}
              </div>
              <button
                className="px-4 py-2 rounded-lg bg-gray-200 text-black font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={attorneyPage * PAGE_SIZE >= filteredAttorneys.length}
                onClick={() => setAttorneyPage(attorneyPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>

{/* Jurors Table */}
        <div ref={jurorSectionRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-green-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-green-500 rounded-lg mr-3">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: BLUE }}>Jurors Management</h2>
                  <p className="text-gray-600 text-sm">{filteredJurors.length} jurors total</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <select 
                  className="border-2 border-gray-300 rounded-lg px-4 py-2 text-sm text-black bg-white font-medium focus:border-green-500 focus:outline-none" 
                  value={jurorFilter} 
                  onChange={(e) => { setJurorFilter(e.target.value as any); setJurorPage(1); }}
                >
                  <option value="all">All Jurors</option>
                  <option value="verified">✓ Verified</option>
                  <option value="not_verified">⏳ Pending</option>
                  <option value="declined">✗ Declined</option>
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Juror Info</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Verification</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Onboarding</th>
                  <th className="px-6 py-4 text-sm text-gray-600">Joined</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginatedJurors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium text-lg">No jurors found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedJurors.map((juror) => (
                    <tr key={juror.JurorId} className="hover:bg-green-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 text-lg">{juror.Name}</div>
                        <div className="text-sm text-gray-600">{juror.Email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900 font-medium">{juror.County}</div>
                        <div className="text-sm text-gray-600">{juror.State}</div>
                      </td>
                      <td className="px-6 py-4">
                        {juror.VerificationStatus === "declined" ? (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                            <XCircle className="h-4 w-4 mr-1" />Declined
                          </span>
                        ) : juror.IsVerified ? (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                            <CheckCircle2 className="h-4 w-4 mr-1" />Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                            <Clock className="h-4 w-4 mr-1" />Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getJurorDecisionClasses(juror.Status)}`}>
                          {getJurorDecisionLabel(juror.Status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          {juror.OnboardingCompleted ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                              Complete
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                              Pending
                            </span>
                          )}
                          {juror.CriteriaResponses && juror.CriteriaResponses.length > 0 && (
                            <button 
                              className="px-2 py-1 rounded text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors" 
                              onClick={() => { 
                                setCurrentCriteriaResponses(juror.CriteriaResponses!); 
                                setShowCriteriaPopup(true); 
                              }}
                            >
                              View
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(juror.CreatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {!juror.IsVerified && juror.VerificationStatus !== "declined" && (
                          <div className="flex justify-center space-x-2">
                            <button 
                              onClick={() => handleVerifyJuror(juror.JurorId)} 
                              disabled={actionLoading === juror.JurorId} 
                              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold text-white bg-green-600 hover:bg-green-700 hover:shadow-lg disabled:opacity-50 transition-all"
                            >
                              {actionLoading === juror.JurorId ? (
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                              ) : (
                                <><CheckCircle2 className="h-4 w-4 mr-1" />Verify</>
                              )}
                            </button>
                            <button 
                              onClick={() => handleDeclineJuror(juror.JurorId)} 
                              disabled={actionLoading === juror.JurorId} 
                              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 hover:shadow-lg disabled:opacity-50 transition-all"
                            >
                              <XCircle className="h-4 w-4 mr-1" />Decline
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button 
              className="px-4 py-2 rounded-lg bg-gray-200 text-black font-medium hover:bg-gray-300 disabled:opacity-50 transition-colors" 
              disabled={jurorPage === 1} 
              onClick={() => setJurorPage(jurorPage - 1)}
            >
              Previous
            </button>
            <span className="text-sm font-semibold text-black">
              Page {jurorPage} of {Math.max(1, Math.ceil(filteredJurors.length / PAGE_SIZE))}
            </span>
            <button 
              className="px-4 py-2 rounded-lg bg-gray-200 text-black font-medium hover:bg-gray-300 disabled:opacity-50 transition-colors" 
              disabled={jurorPage * PAGE_SIZE >= filteredJurors.length} 
              onClick={() => setJurorPage(jurorPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Case Details Modal */}
      {showCaseModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedCase.CaseTitle}</h2>
                <p className="text-sm text-gray-600">Case #{selectedCase.CaseId} • {formatDateTime(selectedCase.ScheduledDate, selectedCase.ScheduledTime)}</p>
              </div>
              <button onClick={() => { setShowCaseModal(false); setSelectedCase(null); }} className="text-gray-400 hover:text-gray-600">
                <XCircle className="h-8 w-8" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-3">Case Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="font-medium text-gray-700">Attorney:</span><p className="text-gray-900">{selectedCase.AttorneyName}</p></div>
                  <div><span className="font-medium text-gray-700">Law Firm:</span><p className="text-gray-900">{selectedCase.LawFirmName}</p></div>
                  <div><span className="font-medium text-gray-700">Email:</span><p className="text-gray-900">{selectedCase.AttorneyEmail}</p></div>
                  {selectedCase.AttorneyPhone && (
                    <div><span className="font-medium text-gray-700">Phone:</span><p className="text-gray-900">{selectedCase.AttorneyPhone}</p></div>
                  )}
                  <div><span className="font-medium text-gray-700">Case Type:</span><p className="text-gray-900">{selectedCase.CaseType}</p></div>
                  <div><span className="font-medium text-gray-700">Location:</span><p className="text-gray-900">{selectedCase.County}, {selectedCase.State}</p></div>
                  <div><span className="font-medium text-gray-700">Approved Jurors:</span><p className="text-gray-900">{selectedCase.approvedJurorCount}</p></div>
                  {selectedCase.IsRecording && (
                    <div><span className="font-medium text-gray-700">Recording:</span><p className="text-red-600 font-bold">● REC</p></div>
                  )}
                </div>
              </div>

              {/* Join Trial Button - Admin Exclusive */}
              {selectedCase.AttorneyStatus === 'join_trial' && (
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
                        <Video className="h-6 w-6" />
                        Trial is Live
                      </h3>
                      <p className="text-indigo-100 text-sm">
                        Join the trial session as an administrator to monitor the proceedings
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        window.open(`/admin/trial/${selectedCase.CaseId}/conference`, '_blank');
                      }}
                      className="flex items-center gap-3 px-8 py-4 bg-white text-indigo-600 rounded-xl hover:bg-indigo-50 font-bold text-lg shadow-xl hover:scale-105 transition-all"
                    >
                      <Video className="h-6 w-6" />
                      Join Trial
                    </button>
                  </div>
                </div>
              )}

              {/* Team Members Section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center mb-3">
                  <Users className="h-5 w-5 mr-2 text-indigo-600" />
                  <h3 className="font-semibold text-indigo-900">Team Members ({selectedCase.teamMembers?.length || 0})</h3>
                </div>
                {!selectedCase.teamMembers || selectedCase.teamMembers.length === 0 ? (
                  <div className="text-center py-6 bg-white rounded-lg border-2 border-dashed border-indigo-200">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-full mb-2">
                      <Users className="w-6 h-6 text-indigo-600" />
                    </div>
                    <p className="text-indigo-700 font-medium text-sm">No Team Members</p>
                    <p className="text-indigo-600 text-xs mt-1">Attorney hasn't added team members yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedCase.teamMembers.map((member) => (
                      <div
                        key={member.Id}
                        className="bg-white rounded-lg p-3 border border-indigo-200 hover:border-indigo-400 transition-all"
                      >
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 bg-indigo-100 rounded">
                            <UserIcon className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-gray-900 text-sm truncate">{member.Name}</h4>
                              <span className="px-2 py-0.5 bg-indigo-100 rounded text-xs font-semibold text-indigo-700 ml-2 shrink-0">
                                {member.Role}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Mail className="w-3 h-3" />
                              <span className="truncate">{member.Email}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <UserIcon className="h-5 w-5 mr-2 text-purple-600" />
                    <h3 className="font-semibold text-gray-900">Witnesses ({selectedCase.witnesses.length})</h3>
                  </div>
                  <button onClick={() => handleDownloadWitnesses(selectedCase.CaseId)} className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                    <Download className="h-4 w-4" />Download
                  </button>
                </div>
                {selectedCase.witnesses.length === 0 ? (
                  <p className="text-gray-500 text-sm">No witnesses added</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Name</th>
                          {/* <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Side</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Actions</th> */}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedCase.witnesses.map((witness) => (
                          <tr key={witness.WitnessId} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{witness.WitnessName}</td>
                            {/* <td className="px-4 py-3 text-sm text-gray-600">{witness.Email || 'N/A'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${witness.Side === "Plaintiff" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                                {witness.Side}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${witness.IsAccepted ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                {witness.IsAccepted ? 'Accepted' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleDeleteWitness(witness.WitnessId, witness.WitnessName, selectedCase.CaseId)}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium transition-colors"
                              >
                                <XCircle className="h-3 w-3" />
                                Delete
                              </button>
                            </td> */}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 mr-2 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Jurors ({selectedCase.jurors?.length || 0})</h3>
                  </div>
                </div>
                {!selectedCase.jurors || selectedCase.jurors.length === 0 ? (
                  <p className="text-gray-500 text-sm">No juror applications yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedCase.jurors.map((juror) => (
                          <tr key={juror.ApplicationId} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{juror.JurorName}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{juror.JurorEmail}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getJurorDecisionClasses(juror.Status)}`}>
                                {getJurorDecisionLabel(juror.Status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleDeleteJuror(juror.ApplicationId, juror.JurorName, selectedCase.CaseId)}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium transition-colors"
                              >
                                <XCircle className="h-3 w-3" />
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-green-600" />
                    <h3 className="font-semibold text-gray-900">Jury Charge Questions ({selectedCase.juryQuestions.length})</h3>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownloadJuryQuestionsText(selectedCase.CaseId)} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                      <Download className="h-4 w-4" />Text
                    </button>
                    <button onClick={() => handleDownloadJuryQuestionsMSForms(selectedCase.CaseId)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                      <Download className="h-4 w-4" />MS Forms
                    </button>
                  </div>
                </div>
                {selectedCase.juryQuestions.length === 0 ? (
                  <p className="text-gray-500 text-sm">No jury questions added</p>
                ) : (
                  <div className="space-y-3">
                    {selectedCase.juryQuestions.map((question, index) => (
                      <div key={question.QuestionId} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex gap-2 mb-2">
                          <span className="font-bold text-purple-600">Q{index + 1}</span>
                          <div className="flex-1">
                            <p className="text-gray-900 font-medium">{question.QuestionText}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">{question.QuestionType}</span>
                          </div>
                        </div>
                        {question.QuestionType === "Multiple Choice" && question.Options && question.Options.length > 0 && (
                          <div className="ml-6 mt-2 space-y-1">
                            {question.Options.map((option, optIndex) => (
                              <div key={optIndex} className="text-sm text-gray-600">{optIndex + 1}. {option}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between">
              <div className="flex gap-3">
                <button
                  onClick={() => handleRescheduleCase(selectedCase.CaseId, selectedCase.CaseTitle)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                  Reschedule Case
                </button>
                <button
                  onClick={() => handleDeleteCase(selectedCase.CaseId, selectedCase.CaseTitle)}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Case
                </button>
              </div>
              <button onClick={() => { setShowCaseModal(false); setSelectedCase(null); }} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <XCircle className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Decline {declineType === "attorney" ? "Attorney" : "Juror"}</h3>
            </div>
            <p className="text-gray-600 mb-4">Provide a reason for declining. This will be sent via email.</p>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" rows={4} placeholder="Enter reason (optional)" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} />
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowDeclineModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
              <button onClick={confirmDecline} disabled={actionLoading !== null} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium disabled:opacity-50 inline-flex items-center">
                {actionLoading ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Declining...</> : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Witness Confirmation Modal */}
      {showDeleteWitnessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <XCircle className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Delete Witness</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete witness <span className="font-semibold">{deleteWitnessName}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteWitnessModal(false)}
                disabled={deletingWitness}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteWitness}
                disabled={deletingWitness}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium disabled:opacity-50 inline-flex items-center"
              >
                {deletingWitness ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                    Deleting...
                  </>
                ) : (
                  "Delete Witness"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Juror Confirmation Modal */}
      {showDeleteJurorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <XCircle className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Delete Juror Application</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete the application from <span className="font-semibold">{deleteJurorName}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteJurorModal(false)}
                disabled={deletingJuror}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteJuror}
                disabled={deletingJuror}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium disabled:opacity-50 inline-flex items-center"
              >
                {deletingJuror ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                    Deleting...
                  </>
                ) : (
                  "Delete Application"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Case Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <Calendar className="h-6 w-6 text-blue-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Reschedule Case</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Reschedule the case <span className="font-semibold">"{rescheduleCaseTitle}"</span>
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800 font-medium mb-2">
                ℹ️ Rescheduling this case will:
              </p>
              <ul className="text-sm text-blue-700 ml-4 list-disc space-y-1">
                <li>Delete all juror applications (approved, pending, rejected)</li>
                <li>Reset the case status to war room</li>
                <li>Notify the attorney and all affected jurors</li>
                <li>Attorney can then update the trial schedule and resubmit</li>
              </ul>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reason for Reschedule <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Enter the reason for rescheduling this case..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={rescheduling}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRescheduleModal(false)}
                disabled={rescheduling}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRescheduleCase}
                disabled={rescheduling || !rescheduleReason.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium disabled:opacity-50 inline-flex items-center"
              >
                {rescheduling ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                    Rescheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Confirm Reschedule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Case Confirmation Modal */}
      {showDeleteCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <Trash2 className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Delete Case</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete the case <span className="font-semibold">"{deleteCaseTitle}"</span>?
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800 font-medium">
                ⚠️ This action cannot be undone. The case will be permanently removed and:
              </p>
              <ul className="text-sm text-yellow-700 mt-2 ml-4 list-disc space-y-1">
                <li>The attorney will be notified</li>
                <li>All jurors will be notified</li>
                <li>The case will disappear from all user views</li>
              </ul>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteCaseModal(false)}
                disabled={deletingCase}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCase}
                disabled={deletingCase}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium disabled:opacity-50 inline-flex items-center"
              >
                {deletingCase ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Case
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock Date Confirmation Modal */}
      {showUnblockModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <Calendar className="h-6 w-6 text-green-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Unblock Date</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to unblock <span className="font-semibold">{unblockDate}</span>?
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800 font-medium">
                ✅ This will make the date available again:
              </p>
              <ul className="text-sm text-green-700 mt-2 ml-4 list-disc space-y-1">
                <li>All attorneys will be notified</li>
                <li>All jurors will be notified</li>
                <li>The date will be available for case scheduling</li>
              </ul>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowUnblockModal(false);
                  setUnblockDate("");
                }}
                disabled={unblocking}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmUnblock}
                disabled={unblocking}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium disabled:opacity-50 inline-flex items-center"
              >
                {unblocking ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                    Unblocking...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Unblock Date
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Criteria Popup */}
      {showCriteriaPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">Criteria Responses</h3>
            <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto">
              {currentCriteriaResponses.map((resp, idx) => (
                <div key={idx} className="text-sm text-gray-800 border-b pb-2">
                  <span className="font-semibold">{resp.question}:</span> {resp.answer}
                </div>
              ))}
              {currentCriteriaResponses.length === 0 && <div className="text-sm text-gray-400">No responses</div>}
            </div>
            <button className="px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700" onClick={() => setShowCriteriaPopup(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Case Rejection Modal */}
      {showCaseRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center mb-4">
              <XCircle className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Reject Case</h3>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reason *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 relative z-[60]" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}>
                <option value="">Select a reason...</option>
                {REJECTION_REASONS.map(reason => (
                  <option key={reason.value} value={reason.value}>{reason.label}</option>
                ))}
              </select>
            </div>

            {rejectionReason === "scheduling_conflict" && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900 mb-3">Suggest Alternative Time Slots (All 3 required) <span className="text-red-600">*</span></h4>
                <p className="text-xs text-blue-700 mb-3">📅 Weekdays only • 🕐 Business hours: 9:00 AM - 5:00 PM</p>
                <div className="space-y-3">
                  {suggestedSlots.map((slot, idx) => (
                    <div key={idx}>
                      <label className="block text-xs font-medium text-blue-900 mb-1">
                        Slot {idx + 1} <span className="text-red-600">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          className="flex-1 border border-gray-300 rounded px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={slot.date}
                          min={new Date().toISOString().split('T')[0]}
                          required
                          onChange={(e) => {
                          // Use timezone-agnostic day validation to prevent timezone shifts
                          const dayOfWeek = getDayOfWeek(e.target.value);
                          // 0 = Sunday, 6 = Saturday
                          if (dayOfWeek === 0 || dayOfWeek === 6) {
                            toast.error("Please select a weekday (Monday-Friday)", { duration: 3000 });
                            return;
                          }
                          const newSlots = [...suggestedSlots];
                          newSlots[idx].date = e.target.value;
                          setSuggestedSlots(newSlots);
                        }}
                      />
                      <select
                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 relative z-[60]"
                        value={slot.time}
                        required
                        onChange={(e) => {
                          const newSlots = [...suggestedSlots];
                          newSlots[idx].time = e.target.value;
                          setSuggestedSlots(newSlots);
                        }}
                      >
                        <option value="">Select time...</option>
                        <option value="09:00">9:00 AM</option>
                        <option value="09:30">9:30 AM</option>
                        <option value="10:00">10:00 AM</option>
                        <option value="10:30">10:30 AM</option>
                        <option value="11:00">11:00 AM</option>
                        <option value="11:30">11:30 AM</option>
                        <option value="12:00">12:00 PM</option>
                        <option value="12:30">12:30 PM</option>
                        <option value="13:00">1:00 PM</option>
                        <option value="13:30">1:30 PM</option>
                        <option value="14:00">2:00 PM</option>
                        <option value="14:30">2:30 PM</option>
                        <option value="15:00">3:00 PM</option>
                        <option value="15:30">3:30 PM</option>
                        <option value="16:00">4:00 PM</option>
                        <option value="16:30">4:30 PM</option>
                        <option value="17:00">5:00 PM</option>
                      </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Comments {rejectionReason === "other" && <span className="text-red-600">*</span>}</label>
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500" rows={4} placeholder="Enter additional details..." value={rejectComments} onChange={(e) => setRejectComments(e.target.value)} />
            </div>

            <div className="flex justify-end space-x-3">
              <button onClick={() => { setShowCaseRejectModal(false); setRejectCaseId(null); setRejectionReason(""); setRejectComments(""); }} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
              <button onClick={confirmRejectCase} disabled={caseActionLoading !== null || !rejectionReason} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium disabled:opacity-50 inline-flex items-center">
                {caseActionLoading ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Rejecting...</> : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Approval Modal */}
      {showCaseApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl">
            <div className="flex items-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 mr-3" />
              <h3 className="text-xl font-semibold text-gray-900">Approve Case</h3>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comments (Optional)
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={3}
                placeholder="Enter any comments for the attorney..."
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
              />
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-green-900 mb-2">What happens next?</h4>
              <ul className="text-xs text-green-800 space-y-1 list-disc list-inside">
                <li>Case will be approved and visible to jurors in the county</li>
                <li>Jurors can apply to serve on this case</li>
                <li>Attorney can build jury charge questions in the war room</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCaseApprovalModal(false);
                  setApproveCaseId(null);
                  setApprovalComments("");
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmApproveCase}
                disabled={caseActionLoading !== null}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium disabled:opacity-50 inline-flex items-center"
              >
                {caseActionLoading ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Confirm Approval
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Date Modal */}
      {showBlockDateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold" style={{ color: BLUE }}>Block Dates</h2>
                <button
                  onClick={() => {
                    setShowBlockDateModal(false);
                    setBlockDateForm({ date: "", reason: "" });
                    setSelectedTimeSlots([]);
                    setBlockWholeDay(true);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Block New Date Form */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Block Date/Time Slots</h3>
                <div className="space-y-4">
                  {/* Calendar Month Navigation */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => {
                          if (calendarMonth === 0) {
                            setCalendarMonth(11);
                            setCalendarYear(calendarYear - 1);
                          } else {
                            setCalendarMonth(calendarMonth - 1);
                          }
                        }}
                        className="p-2 hover:bg-blue-100 rounded-lg"
                      >
                        ←
                      </button>
                      <h4 className="font-semibold text-gray-900">
                        {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h4>
                      <button
                        onClick={() => {
                          if (calendarMonth === 11) {
                            setCalendarMonth(0);
                            setCalendarYear(calendarYear + 1);
                          } else {
                            setCalendarMonth(calendarMonth + 1);
                          }
                        }}
                        className="p-2 hover:bg-blue-100 rounded-lg"
                      >
                        →
                      </button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="font-semibold text-gray-600 py-2">{day}</div>
                      ))}
                      {(() => {
                        const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
                        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                        const days = [];

                        // Empty cells for days before month starts
                        for (let i = 0; i < firstDay; i++) {
                          days.push(<div key={`empty-${i}`} className="py-2"></div>);
                        }

                        // Days of the month
                        for (let day = 1; day <= daysInMonth; day++) {
                          const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const isSelected = blockDateForm.date === dateStr;

                          // Allow today and future dates, disable past dates
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const dateObj = new Date(dateStr + 'T00:00:00');
                          const isPast = dateObj < today;

                          // Check if this date has any blocked slots
                          const blockedForDate = blockedDates.find((b: any) => b.date === dateStr);
                          const hasBlockedSlots = !!blockedForDate;
                          const blockedSlotsCount = blockedForDate?.slots?.length || 0;

                          days.push(
                            <button
                              key={day}
                              type="button"
                              onClick={() => !isPast && setBlockDateForm({ ...blockDateForm, date: dateStr })}
                              disabled={isPast}
                              className={`py-2 rounded-lg relative ${
                                isSelected
                                  ? 'bg-blue-600 text-white font-bold'
                                  : isPast
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : hasBlockedSlots
                                  ? 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 font-semibold'
                                  : 'hover:bg-blue-100'
                              }`}
                              title={hasBlockedSlots ? `${blockedSlotsCount} slot(s) already blocked` : ''}
                            >
                              {day}
                              {hasBlockedSlots && !isSelected && (
                                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1 text-xs font-bold text-white bg-red-600 rounded-full">
                                  {blockedSlotsCount}
                                </span>
                              )}
                            </button>
                          );
                        }

                        return days;
                      })()}
                    </div>

                    {blockDateForm.date && (
                      <p className="text-sm text-blue-700 font-medium">
                        Selected: {(() => {
                          const [year, month, day] = blockDateForm.date.split('-').map(Number);
                          const date = new Date(year, month - 1, day);
                          return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                        })()}
                      </p>
                    )}
                  </div>

                  {/* Whole Day Checkbox */}
                  <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-blue-300">
                    <input
                      type="checkbox"
                      id="blockWholeDay"
                      checked={blockWholeDay}
                      onChange={(e) => {
                        setBlockWholeDay(e.target.checked);
                        if (e.target.checked) {
                          setSelectedTimeSlots([]);
                        }
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="blockWholeDay" className="text-sm font-medium text-gray-900 cursor-pointer">
                      Block Whole Day (All 48 time slots)
                    </label>
                  </div>

                  {/* Time Slot Selector (only shown if not blocking whole day) */}
                  {!blockWholeDay && blockDateForm.date && (
                    <div className="bg-white p-3 rounded-lg border border-blue-300 max-h-64 overflow-y-auto">
                      <h4 className="font-semibold text-gray-900 mb-2 text-sm">Select Time Slots to Block:</h4>
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 48 }, (_, i) => {
                          const hours = Math.floor(i / 2);
                          const minutes = i % 2 === 0 ? "00" : "30";
                          const timeSlot = `${hours.toString().padStart(2, '0')}:${minutes}:00`;
                          const displayTime = `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
                          const isSelected = selectedTimeSlots.includes(timeSlot);

                          // Check if this time slot is in the past for today's date
                          const isToday = blockDateForm.date === new Date().toISOString().split('T')[0];
                          const isPastTime = isToday && (() => {
                            const now = new Date();
                            const currentHours = now.getHours();
                            const currentMinutes = now.getMinutes();
                            const slotTotalMinutes = hours * 60 + parseInt(minutes);
                            const currentTotalMinutes = currentHours * 60 + currentMinutes;
                            return slotTotalMinutes < currentTotalMinutes;
                          })();

                          return (
                            <button
                              key={timeSlot}
                              type="button"
                              disabled={isPastTime}
                              onClick={() => {
                                if (!isPastTime) {
                                  if (isSelected) {
                                    setSelectedTimeSlots(selectedTimeSlots.filter(t => t !== timeSlot));
                                  } else {
                                    setSelectedTimeSlots([...selectedTimeSlots, timeSlot]);
                                  }
                                }
                              }}
                              className={`text-xs py-1.5 px-2 rounded-lg border ${
                                isPastTime
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-red-600 text-white border-red-700'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-red-50'
                              }`}
                              title={isPastTime ? 'This time has already passed' : ''}
                            >
                              {displayTime}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        {selectedTimeSlots.length} slot(s) selected
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Blocking
                    </label>
                    <select
                      value={blockDateForm.reason}
                      onChange={(e) => setBlockDateForm({ ...blockDateForm, reason: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Holiday">Holiday</option>
                      <option value="System Maintenance">System Maintenance</option>
                      <option value="Staff Training">Staff Training</option>
                      <option value="Emergency Closure">Emergency Closure</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <button
                    onClick={handleBlockDate}
                    disabled={blockingDate || !blockDateForm.date || !blockDateForm.reason || (!blockWholeDay && selectedTimeSlots.length === 0)}
                    className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                  >
                    {blockingDate ? (
                      <>
                        <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                        Blocking...
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 mr-2" />
                        Block {blockWholeDay ? 'Whole Day' : `${selectedTimeSlots.length} Slot(s)`}
                      </>
                    )}
                  </button>
                  <p className="text-sm text-gray-600">
                    ⚠️ This will {blockWholeDay ? 'block all time slots' : `block ${selectedTimeSlots.length} selected time slot(s)`} for {blockDateForm.date && new Date(blockDateForm.date).toLocaleDateString()} and send notifications to all attorneys and jurors.
                  </p>
                </div>
              </div>

              {/* Currently Blocked Dates */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Currently Blocked Dates</h3>
                {loadingBlockedDates ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading blocked dates...</p>
                  </div>
                ) : blockedDates.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">No dates are currently blocked</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blockedDates.map((blocked: any) => (
                      <div key={blocked.date} className="bg-white border border-red-200 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-100 rounded-lg">
                            <Calendar className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {formatDateString(blocked.date, {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                            <p className="text-sm text-gray-600">Reason: {blocked.reason}</p>
                            <p className="text-xs text-gray-500">{blocked.slots.length} time slot(s) blocked</p>
                            {blocked.slots.length <= 10 && (
                              <p className="text-xs text-red-600 mt-1">
                                🕐 {blocked.slots.map((slot: any) => {
                                  const time = slot.BlockedTime.substring(0, 5);
                                  const [hours, minutes] = time.split(':');
                                  const hour = parseInt(hours);
                                  const period = hour >= 12 ? 'PM' : 'AM';
                                  const displayHour = hour % 12 || 12;
                                  return `${displayHour}:${minutes} ${period}`;
                                }).join(', ')}
                              </p>
                            )}
                            {blocked.slots.length > 10 && (
                              <p className="text-xs text-red-600 mt-1">
                                🕐 {blocked.slots.slice(0, 5).map((slot: any) => {
                                  const time = slot.BlockedTime.substring(0, 5);
                                  const [hours, minutes] = time.split(':');
                                  const hour = parseInt(hours);
                                  const period = hour >= 12 ? 'PM' : 'AM';
                                  const displayHour = hour % 12 || 12;
                                  return `${displayHour}:${minutes} ${period}`;
                                }).join(', ')} + {blocked.slots.length - 5} more
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnblockDate(blocked.date)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowBlockDateModal(false);
                  setBlockDateForm({ date: "", reason: "" });
                  setSelectedTimeSlots([]);
                  setBlockWholeDay(true);
                }}
                className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Modal for Time Slot Conflicts */}
      <ConflictModal
        isOpen={showConflictModal}
        onClose={() => {
          setShowConflictModal(false);
          setConflictCaseId(null);
          setConflictCaseTitle("");
          setBlockedSlot({ date: "", time: "" });
        }}
        caseTitle={conflictCaseTitle}
        blockedSlot={blockedSlot}
        onSubmit={handleSubmitAlternateSlots}
      />
    </main>
  );
}