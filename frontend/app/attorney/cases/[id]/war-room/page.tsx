"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import WitnessSection from "./components/WitnessSection";
import JuryChargeBuilder from "./components/JuryChargeBuilder";
import { formatDateString } from "@/lib/dateUtils";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  DocumentArrowUpIcon,
  UserGroupIcon,
  DocumentPlusIcon,
  TrashIcon,
  DocumentTextIcon,
  PlusIcon,
  ArrowUpTrayIcon,
  ClockIcon,
  MapPinIcon,
  EnvelopeIcon,
  BriefcaseIcon,
  LinkIcon,
  DocumentCheckIcon,
  CreditCardIcon,
  CalendarIcon,
  UserIcon,
  ArrowLeftIcon
} from "@heroicons/react/24/outline";

type TeamMember = {
  Name: string;
  Role: string;
  Email: string;
  Id?: number;
};

type Document = {
  Id: number;
  FileName: string;
  Description: string;
  FileUrl: string;
};

type FileToUpload = {
  file: File;
  description: string;
  progress: number;
  id: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  controller?: AbortController;
  uploadedDocId?: number;
  uploadedFileUrl?: string;
};

type Application = {
  ApplicationId: number;
  JurorId: number;
  JurorName: string;
  JurorEmail: string;
  County: string;
  State?: string;
  Status: "pending" | "approved" | "rejected";
  VoirDire1Responses: string | any[];
  VoirDire2Responses: string | any[];
  AppliedAt: string;
};

type CaseData = {
  Id: number;
  PlaintiffGroups: string;
  DefendantGroups: string;
  CaseTier?: 'tier_1' | 'tier_2' | 'tier_3';
  AttorneyStatus?: string;
  CaseTitle?: string;
  JuryChargeStatus?: 'pending' | 'completed';
  JuryChargeReleasedAt?: string | null;
  JuryChargeReleasedBy?: number | null;
  CaseType?: string;
  County?: string;
  State?: string;
  CaseJurisdiction?: string;
  ScheduledDate?: string;
  ScheduledTime?: string;
  RequiredJurors?: number;
  AdminApprovalStatus?: string;
  AdminRescheduledBy?: number | null;
  CaseDescription?: string;
  PaymentMethod?: string;
  PaymentAmount?: number;
  VoirDire1Questions?: any;
  VoirDire2Questions?: any;
  ApprovedAt?: string;
  ApprovedBy?: number;
  AdminComments?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
};

// Timezone helper functions (same logic as AttorneyHomeSection)
function getSystemTimezoneInfo() {
  const offset = new Date().getTimezoneOffset();
  const offsetHours = offset / 60;
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const sign = offset <= 0 ? '+' : '-';
  const absHours = Math.floor(Math.abs(offsetHours));
  const minutes = Math.abs(offsetHours % 1) * 60;

  return {
    offsetHours: -offsetHours,
    offsetMinutes: -offset,
    timezoneName,
    sign,
    formatOffset: `UTC${sign}${String(absHours).padStart(2, '0')}:${String(Math.round(minutes)).padStart(2, '0')}`
  };
}

function applyOffsetToUtcTime(utcTime: string, dateString: string, timezoneOffset: string, offsetMinutesMap: number) {
  const offsetMinutes = offsetMinutesMap * 2;
  if (offsetMinutes === null) throw new Error('Invalid timezoneOffset');

  const utcMs = Date.parse(`${dateString}T${utcTime}Z`);
  if (isNaN(utcMs)) throw new Error('Invalid UTC date/time');

  const signChar = timezoneOffset.includes('+') ? '+' : timezoneOffset.includes('-') ? '-' : '+';
  const resultMs = signChar === '+'
    ? utcMs - offsetMinutes * 60_000
    : utcMs + Math.abs(offsetMinutes) * 60_000;

  const resultDate = new Date(resultMs);
  return {
    date: resultDate,
    "12HoursTime": resultDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
    "24HoursTime": resultDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false })
  };
}

function formatTime(timeString: string | undefined, scheduledDate?: string): string {
  if (!timeString) return "N/A";
  try {
    // If scheduledDate is provided, apply timezone conversion (same as attorney home page)
    if (scheduledDate) {
      const systemTz = getSystemTimezoneInfo();
      let zoneMap = '';

      zoneMap = systemTz.formatOffset ? systemTz.formatOffset : "";
      const offsetMinutes = typeof systemTz.offsetMinutes === 'number' ? systemTz.offsetMinutes : 0;

      const dataSystemmap = applyOffsetToUtcTime(timeString, scheduledDate, zoneMap, offsetMinutes);
      return dataSystemmap["24HoursTime"];
    }

    // Fallback to simple formatting if no scheduledDate
    const cleanTime = timeString.split('.')[0];
    const [hours, minutes] = cleanTime.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (e) {
    return timeString;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("token");
  } catch (error) {
    console.error("Error reading token from localStorage:", error);
    return null;
  }
}

function createAuthHeaders(token?: string, extra?: Record<string, string>) {
  const headers: Record<string, string> = extra ? { ...extra } : {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
      <div className="text-center">
        <div className="relative inline-block">
          <div className="w-16 h-16 border-4 border-[#C6CDD9] border-t-[#16305B] rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-base font-semibold text-[#16305B]">Loading War Room...</p>
        <p className="mt-1 text-sm text-[#455A7C]">Please wait while we fetch your case details</p>
      </div>
    </div>
  );
}

function parseVoirDireResponses(responsesData: string | any[]) {
  if (Array.isArray(responsesData)) {
    return responsesData.length > 0 ? responsesData : null;
  }
  if (typeof responsesData === 'string') {
    try {
      const responses = JSON.parse(responsesData);
      if (Array.isArray(responses) && responses.length > 0) {
        return responses;
      }
      return null;
    } catch {
      return responsesData ? [{ question: "Response", answer: responsesData }] : null;
    }
  }
  return null;
}

// Modern Info Card Component
interface InfoCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  variant?: 'default' | 'blue' | 'green';
}

const InfoCard = ({ icon: Icon, label, value, variant = 'default' }: InfoCardProps) => {
  const variantStyles = {
    default: 'bg-white border-[#C6CDD9]',
    blue: 'bg-white border-[#C6CDD9]',
    green: 'bg-white border-[#C6CDD9]'
  };

  const iconStyles = {
    default: 'bg-[#16305B]/10 text-[#16305B]',
    blue: 'bg-[#16305B]/10 text-[#16305B]',
    green: 'bg-[#16305B]/10 text-[#16305B]'
  };

  return (
    <div className={`${variantStyles[variant]} rounded-lg p-3 border transition-all`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1 ${iconStyles[variant]} rounded`}>
          <Icon className="w-3 h-3" />
        </div>
        <p className="text-xs text-[#455A7C] font-semibold uppercase">
          {label}
        </p>
      </div>
      <p className="text-sm font-semibold text-[#0A2342]">{value}</p>
    </div>
  );
};

export default function WarRoomPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [applicationFilter, setApplicationFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  // Team modal state
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newMembers, setNewMembers] = useState<TeamMember[]>([{ Name: "", Role: "", Email: "" }]);
  const [isAddingTeam, setIsAddingTeam] = useState(false);

  // Document upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState<FileToUpload[]>([]);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);

  // Jury Charge
  const [juryChargeLocked, setJuryChargeLocked] = useState(false);

  // Application status update - track which action is in progress
  const [updatingStatus, setUpdatingStatus] = useState<"approved" | "rejected" | null>(null);

  // Submit war room
  const [submittingWarRoom, setSubmittingWarRoom] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Tier upgrade
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedNewTier, setSelectedNewTier] = useState<'tier_1' | 'tier_2' | 'tier_3' | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Document deletion confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ id: number; name: string } | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);

  // Reschedule request
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    newScheduledDate: "",
    newScheduledTime: "",
    reason: "",
    attorneyComments: "",
  });
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [pendingRescheduleRequest, setPendingRescheduleRequest] = useState<any>(null);

  useEffect(() => {
    fetchWarRoomData();
  }, [caseId]);

  // Auto-open reschedule modal if admin rescheduled the case
  useEffect(() => {
    if (caseData && caseData.AdminRescheduledBy && !showRescheduleModal) {
      setShowRescheduleModal(true);
      toast("Admin has requested that you reschedule this case. Please update the trial schedule.", {
        icon: '📅',
        duration: 5000,
      });
    }
  }, [caseData, showRescheduleModal]);

  async function fetchWarRoomData() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const [caseRes, teamRes, docsRes, appsRes, rescheduleRes] = await Promise.all([
        fetch(`${API_BASE}/api/case/cases/${caseId}`, {
          headers: createAuthHeaders(token)
        }),
        fetch(`${API_BASE}/api/war-room/cases/${caseId}/war-room/team`, {
          headers: createAuthHeaders(token)
        }),
        fetch(`${API_BASE}/api/war-room/cases/${caseId}/war-room/documents`, {
          headers: createAuthHeaders(token)
        }),
        fetch(`${API_BASE}/api/war-room/cases/${caseId}/applications`, {
          headers: createAuthHeaders(token)
        }),
        fetch(`${API_BASE}/api/attorney/cases/${caseId}/reschedule-status`, {
          headers: createAuthHeaders(token)
        })
      ]);

      if (caseRes.ok) {
        const caseJson = await caseRes.json();
        setCaseData(caseJson.case || caseJson);
      }

      if (teamRes.ok) {
        const teamJson = await teamRes.json();
        setTeamMembers(teamJson.members || teamJson.teamMembers || []);
      }

      if (docsRes.ok) {
        const docsJson = await docsRes.json();
        setDocuments(docsJson.documents || []);
      }

      if (appsRes.ok) {
        const appsJson = await appsRes.json();
        setApplications(appsJson.applications || []);
      }

      if (rescheduleRes.ok) {
        const rescheduleJson = await rescheduleRes.json();
        // Only set pending request if status is 'pending'
        const request = rescheduleJson.rescheduleRequest;
        setPendingRescheduleRequest(request && request.Status === 'pending' ? request : null);
      }
    } catch (error) {
      console.error("Error fetching war room data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function addTeamMembers(caseId: string, members: TeamMember[]) {
    const token = getToken();
    if (!token) return;

    setIsAddingTeam(true);
    try {
      const response = await fetch(`${API_BASE}/api/war-room/cases/${caseId}/war-room/team`, {
        method: "POST",
        headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ teamMembers: members })
      });

      if (response.ok) {
        await fetchWarRoomData();
        setShowAddTeam(false);
        setNewMembers([{ Name: "", Role: "", Email: "" }]);
      }
    } catch (error) {
      console.error("Error adding team members:", error);
    } finally {
      setIsAddingTeam(false);
    }
  }

  async function deleteTeamMember(memberId: number, memberName: string) {
    if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
      return;
    }

    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/war-room/cases/${caseId}/team/${memberId}`, {
        method: "DELETE",
        headers: createAuthHeaders(token)
      });

      if (response.ok) {
        // Remove from local state
        setTeamMembers(prev => prev.filter(m => m.Id !== memberId));
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Failed to remove team member");
      }
    } catch (error) {
      console.error("Error deleting team member:", error);
      alert("Failed to remove team member");
    }
  }

  async function uploadDocuments() {
    const token = getToken();
    if (!token) return;

    setUploadingDocuments(true);
    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const fileData = filesToUpload[i];

        // Skip if already completed or cancelled
        if (fileData.status === 'completed') continue;

        // Create abort controller
        const controller = new AbortController();

        // Update file status to uploading and store controller
        setFilesToUpload(prev => prev.map(f =>
          f.id === fileData.id
            ? { ...f, status: 'uploading' as const, controller }
            : f
        ));

        try {
          const formData = new FormData();
          formData.append("file", fileData.file);
          formData.append("description", fileData.description);

          // Use XMLHttpRequest for progress tracking
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                setFilesToUpload(prev => prev.map(f =>
                  f.id === fileData.id
                    ? { ...f, progress: percentComplete }
                    : f
                ));
              }
            });

            // Handle completion
            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const result = JSON.parse(xhr.responseText);
                  // Remove completed file from upload list immediately
                  setFilesToUpload(prev => prev.filter(f => f.id !== fileData.id));
                  resolve(result);
                } catch (e) {
                  reject(new Error('Failed to parse response'));
                }
              } else {
                reject(new Error(`Upload failed: ${xhr.statusText}`));
              }
            });

            // Handle errors
            xhr.addEventListener('error', () => {
              reject(new Error('Upload failed: Network error'));
            });

            // Handle abort
            xhr.addEventListener('abort', () => {
              reject(new Error('AbortError'));
            });

            // Connect abort controller to xhr
            controller.signal.addEventListener('abort', () => {
              xhr.abort();
            });

            // Configure and send request
            xhr.open('POST', `${API_BASE}/api/war-room/cases/${caseId}/war-room/documents`);
            const headers = createAuthHeaders(token);
            Object.entries(headers).forEach(([key, value]) => {
              if (key !== 'Content-Type') { // Let browser set Content-Type for FormData
                xhr.setRequestHeader(key, value as string);
              }
            });
            xhr.send(formData);
          });
        } catch (error: any) {
          // Check if it was aborted
          if (error.name === 'AbortError') {
            console.log('Upload cancelled for:', fileData.file.name);
            // File will be removed by cancelUpload function
          } else {
            console.error("Error uploading document:", error);
            setFilesToUpload(prev => prev.map(f =>
              f.id === fileData.id
                ? { ...f, status: 'error' as const, controller: undefined }
                : f
            ));
          }
        }
      }

      // Refresh documents list
      await fetchWarRoomData();

      // Close modal if no files left to upload
      if (filesToUpload.length === 0) {
        setShowUploadModal(false);
      }
    } catch (error) {
      console.error("Error uploading documents:", error);
    } finally {
      setUploadingDocuments(false);
    }
  }

  async function cancelUpload(fileId: string) {
    const fileData = filesToUpload.find(f => f.id === fileId);
    if (!fileData) return;

    // Abort the upload if in progress
    if (fileData.controller) {
      fileData.controller.abort();
    }

    // If file was already uploaded to blob storage, delete it
    if (fileData.uploadedDocId && fileData.uploadedFileUrl) {
      const token = getToken();
      if (token) {
        try {
          await fetch(`${API_BASE}/api/war-room/cases/${caseId}/war-room/documents/${fileData.uploadedDocId}`, {
            method: "DELETE",
            headers: createAuthHeaders(token)
          });
          console.log('Uploaded file cleaned up from blob storage:', fileData.file.name);
        } catch (error) {
          console.error("Error cleaning up uploaded file:", error);
        }
      }
    }

    // Remove from upload list
    setFilesToUpload(prev => prev.filter(f => f.id !== fileId));
  }

  function requestDeleteDocument(docId: number, docName: string) {
    setDocToDelete({ id: docId, name: docName });
    setShowDeleteConfirm(true);
  }

  async function confirmDeleteDocument() {
    if (!docToDelete) return;

    const token = getToken();
    if (!token) return;

    setDeletingDocument(true);
    try {
      await fetch(`${API_BASE}/api/war-room/cases/${caseId}/war-room/documents/${docToDelete.id}`, {
        method: "DELETE",
        headers: createAuthHeaders(token)
      });
      await fetchWarRoomData();
      setShowDeleteConfirm(false);
      setDocToDelete(null);
    } catch (error) {
      console.error("Error deleting document:", error);
      setShowDeleteConfirm(false);
      setDocToDelete(null);
    } finally {
      setDeletingDocument(false);
    }
  }

  async function updateApplicationStatus(appId: number, status: "approved" | "rejected") {
    const token = getToken();
    if (!token) return;

    setUpdatingStatus(status);
    try {
      await fetch(`${API_BASE}/api/war-room/cases/${caseId}/applications/${appId}`, {
        method: "PATCH",
        headers: createAuthHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ status })
      });
      await fetchWarRoomData();
      setShowApplicationModal(false);
    } catch (error) {
      console.error("Error updating application status:", error);
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function submitWarRoom() {
    const token = getToken();
    if (!token) return;

    // Immediately enable join trial in UI regardless of backend validation
    setCaseData(prev => prev ? { ...prev, AttorneyStatus: 'join_trial' } : prev);
    // Notify other parts of the app (e.g., attorney case list) so their Join buttons can enable
    try {
      window.dispatchEvent(new CustomEvent('caseStatusUpdated', { detail: { caseId: Number(caseId), status: 'join_trial' } }));
    } catch (e) {
      // ignore in non-browser contexts
    }
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 5000);

    setSubmittingWarRoom(true);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/war-room/cases/${caseId}/war-room/submit`, {
        method: "POST",
        headers: createAuthHeaders(token)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Still show server error messages, but do NOT revert the optimistic join status
        if (data.code === "ALREADY_SUBMITTED") {
          setErrorMessage(`War room has already been submitted. Current status: ${data.currentStatus}`);
        } else if (data.code === "INSUFFICIENT_JURORS") {
          setErrorMessage(data.message || "You need at least the required number of approved jurors");
        } else if (data.code === "TOO_MANY_JURORS") {
          setErrorMessage(data.message || "Maximum 7 jurors allowed");
        } else {
          setErrorMessage(data.message || "Failed to submit war room. Please try again.");
        }
      } else {
        // Success - show toast and redirect
        toast.success("War room successfully submitted!");
        setTimeout(() => {
          router.push("/attorney");
        }, 1500);
      }
    } catch (error) {
      console.error("Error submitting war room:", error);
      // Keep optimistic UI; show a generic error
      setErrorMessage("Failed to submit war room. Server unreachable.");
    } finally {
      setSubmittingWarRoom(false);
    }
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-[#f9f7f2] flex items-center justify-center">
        <p className="text-xl font-bold text-[#455A7C]">Case not found</p>
      </div>
    );
  }

  const approvedCount = applications.filter(app => app.Status === "approved").length;
  const pendingCount = applications.filter(app => app.Status === "pending").length;
  const rejectedCount = applications.filter(app => app.Status === "rejected").length;

  // Check if admin has approved the case
  const isAdminApproved = caseData?.AdminApprovalStatus === "approved";

  // Determine required jurors (use case setting, fallback to 1 for testing)
  const requiredJurors = caseData?.RequiredJurors ?? 1;
  // Check if war room can be submitted (jurors + case status)
  const isWarRoomStatus = caseData?.AttorneyStatus === "war_room";
  const canSubmitWarRoom = approvedCount >= requiredJurors && approvedCount <= 7 && isWarRoomStatus && isAdminApproved && !pendingRescheduleRequest;

  const jurorCountMessage = !isAdminApproved
    ? `⏳ Waiting for admin approval`
    : !isWarRoomStatus
    ? `✓ War room submitted (Status: ${caseData?.AttorneyStatus})`
    : pendingRescheduleRequest
    ? `⏳ Waiting for admin to approve reschedule request`
    : approvedCount < requiredJurors
    ? `Need ${requiredJurors - approvedCount} more approved juror${requiredJurors - approvedCount === 1 ? '' : 's'}`
    : approvedCount > 7
    ? 'Too many jurors! Maximum is 7'
    : `✓ Ready to submit (${approvedCount} approved jurors)`;

  const filteredApplications = applications.filter(app =>
    applicationFilter === "all" ? true : app.Status === applicationFilter
  );

  const getTierDisplay = (tier?: string) => {
    if (!tier) return 'Standard';
    return tier.replace('tier_', 'Tier ').replace('1', '1').replace('2', '2').replace('3', '3');
  };

  const getTierInfo = (tier: 'tier_1' | 'tier_2' | 'tier_3') => {
    const tiers = {
      tier_1: { name: 'Tier 1', price: 3500, duration: '2.5 hours', maxClaim: '$3,500', color: 'blue' },
      tier_2: { name: 'Tier 2', price: 4500, duration: '3.5 hours', maxClaim: '$4,500', color: 'green' },
      tier_3: { name: 'Tier 3', price: 5500, duration: '4.5 hours', maxClaim: '$5,500', color: 'purple' }
    };
    return tiers[tier];
  };

  const canUpgradeTier = (currentTier?: string) => {
    if (!currentTier) return false;
    return currentTier === 'tier_1' || currentTier === 'tier_2';
  };

  const getUpgradeOptions = (currentTier?: string) => {
    if (currentTier === 'tier_1') return ['tier_2', 'tier_3'];
    if (currentTier === 'tier_2') return ['tier_3'];
    return [];
  };

  const handleUpgradeTier = async () => {
    if (!selectedNewTier) {
      setErrorMessage("Please select a tier to upgrade to");
      return;
    }

    setProcessingPayment(true);
    setErrorMessage("");

    try {
      // Simulate Stripe test mode payment
      // In production, you would integrate with Stripe here
      await new Promise(resolve => setTimeout(resolve, 2000));

      const token = getToken();
      if (!token) {
        setErrorMessage("Authentication required");
        setProcessingPayment(false);
        return;
      }

      // Update case tier in backend
      const response = await fetch(`${API_BASE}/api/case/cases/${caseId}/upgrade-tier`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tier: selectedNewTier
        })
      });

      if (!response.ok) {
        throw new Error('Failed to upgrade tier');
      }

      // Refresh case data
      await fetchWarRoomData();

      setShowUpgradeModal(false);
      setSelectedNewTier(null);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 5000);
    } catch (error) {
      console.error("Tier upgrade error:", error);
      setErrorMessage("Failed to upgrade tier. Please try again.");
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleRescheduleRequest = async () => {
    try {
      setSubmittingReschedule(true);
      setErrorMessage("");

      // Validate inputs
      if (!rescheduleData.newScheduledDate || !rescheduleData.newScheduledTime) {
        setErrorMessage("Please provide both new date and time");
        return;
      }

      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`${API_BASE}/api/attorney/cases/${caseId}/request-reschedule`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rescheduleData),
      });

      if (!response.ok) {
        let errorMessage = "Failed to submit reschedule request";
        try {
          const error = await response.json();
          console.error("Reschedule request error response:", error);
          errorMessage = error.message || error.error || errorMessage;
        } catch (e) {
          console.error("Failed to parse error response:", e);
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Success - close modal and show success message
      setShowRescheduleModal(false);
      setRescheduleData({
        newScheduledDate: "",
        newScheduledTime: "",
        reason: "",
        attorneyComments: "",
      });
      setShowSuccessMessage(true);
      setErrorMessage("");
      toast.success("Reschedule request submitted successfully! Admin will review your request.");
      setShowRescheduleModal(false);
      // Refresh war room data to show pending request banner
      await fetchWarRoomData();
    } catch (error: any) {
      console.error("Reschedule request error:", error);
      setErrorMessage(error.message || "Failed to submit reschedule request");
    } finally {
      setSubmittingReschedule(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f7f2]">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Back Button */}
        <button
          onClick={() => router.push("/attorney")}
          className="flex items-center gap-2 text-[#0A2342] hover:text-[#16305B] transition-colors font-medium text-sm group"
        >
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </button>

        {/* Pending Reschedule Request Banner */}
        {pendingRescheduleRequest && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ClockIcon className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 mb-1">
                  Reschedule Request Pending Admin Approval
                </h3>
                <p className="text-sm text-amber-800">
                  Your request to reschedule this case to <span className="font-semibold">{formatDateString(pendingRescheduleRequest.NewScheduledDate)}</span> at <span className="font-semibold">{formatTime(pendingRescheduleRequest.NewScheduledTime, pendingRescheduleRequest.NewScheduledDate)}</span> is awaiting admin review.
                </p>
                {pendingRescheduleRequest.AttorneyComments && (
                  <p className="text-xs text-amber-700 mt-2">
                    <span className="font-medium">Your comments:</span> {pendingRescheduleRequest.AttorneyComments}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Header Card */}
        <div className="bg-white rounded-lg shadow border border-[#C6CDD9] overflow-hidden">
          <div className="relative p-5" style={{ backgroundColor: "#16305B" }}>
            <div className="relative flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <BriefcaseIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold text-white">War Room</h1>
                    <p className="text-sm text-white/80 mt-0.5">
                      {caseData.CaseTitle || "Case Management"}
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Case ID: {caseData.Id}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-white/10 rounded-lg text-white font-semibold text-xs">
                    {getTierDisplay(caseData.CaseTier)}
                  </span>
                  {canUpgradeTier(caseData.CaseTier) && isAdminApproved && (
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="px-3 py-1.5 bg-white/90 hover:bg-white text-[#16305B] rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5"
                    >
                      <CreditCardIcon className="w-3.5 h-3.5" />
                      Upgrade Tier
                    </button>
                  )}
                  {/* Reschedule Case button - only show if admin approved and case has schedule */}
                  {isAdminApproved && caseData?.ScheduledDate && caseData?.ScheduledTime && (
                    <button
                      onClick={() => {
                        if (!pendingRescheduleRequest) {
                          console.log('🔍 [Reschedule Modal] Opening with case data:', {
                            ScheduledDate: caseData.ScheduledDate,
                            ScheduledTime: caseData.ScheduledTime,
                            CaseId: caseData.Id,
                            CaseTitle: caseData.CaseTitle,
                          });
                          setShowRescheduleModal(true);
                        }
                      }}
                      disabled={!!pendingRescheduleRequest}
                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 ${
                        pendingRescheduleRequest
                          ? 'bg-gray-400 cursor-not-allowed opacity-60 text-white'
                          : 'bg-amber-500/90 hover:bg-amber-500 text-white'
                      }`}
                      title={pendingRescheduleRequest ? 'You have a pending reschedule request' : 'Request to reschedule this case'}
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {pendingRescheduleRequest ? 'Request Pending' : 'Reschedule Case'}
                    </button>
                  )}
                  {/* Join Trial button removed per UX request; submit will enable join elsewhere */}
                  <button
                    onClick={submitWarRoom}
                    disabled={submittingWarRoom || !isWarRoomStatus || !!pendingRescheduleRequest}
                    className="px-4 py-1.5 bg-white text-[#16305B] rounded-lg font-semibold text-sm hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    title={pendingRescheduleRequest ? 'Cannot submit while reschedule request is pending' : ''}
                  >
                    {submittingWarRoom ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#16305B]/30 border-t-[#16305B]"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-4 h-4" />
                         Submit Case for Trial 
                      </>
                    )}
                  </button>
                </div>
                <span className={`px-3 py-1 rounded text-xs font-medium ${
                  !isAdminApproved
                    ? 'bg-amber-500/20 text-amber-100'
                    : jurorCountMessage.includes('submitted')
                    ? 'bg-green-500/20 text-green-100'
                    : canSubmitWarRoom
                    ? 'bg-green-500/20 text-green-100'
                    : 'bg-white/10 text-white'
                }`}>
                  {jurorCountMessage}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Approval Pending Overlay */}
        {!isAdminApproved && (
          <div className="bg-white rounded-lg shadow border-2 border-amber-400 overflow-hidden">
            <div className="p-8 text-center">
              <div className="inline-flex p-4 bg-amber-100 rounded-full mb-4">
                <ClockIcon className="w-12 h-12 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-[#0A2342] mb-2">
                War Room Locked - Waiting for Admin Approval
              </h3>
              <p className="text-[#455A7C] mb-4 max-w-md mx-auto">
                Your case is currently under review by our admin team. Once approved, you'll be able to access the war room to manage juror applications, upload documents, and prepare for trial.
              </p>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
                caseData.AdminApprovalStatus === 'pending'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <span className="w-2 h-2 bg-current rounded-full animate-pulse"></span>
                Case Status: {caseData.AdminApprovalStatus === 'pending' ? 'Pending Admin Review' : 'Not Approved'}
              </div>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {showSuccessMessage && (
          <div className="bg-white border border-[#C6CDD9] rounded-lg p-4 flex items-center gap-3">
            <div className="p-2 bg-[#16305B]/10 rounded-lg">
              <CheckCircleIcon className="w-5 h-5 text-[#16305B]" />
            </div>
            <div>
              <p className="text-[#0A2342] font-semibold text-sm">War Room Submitted Successfully!</p>
              <p className="text-[#455A7C] text-xs mt-0.5">Redirecting to dashboard...</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="bg-white border border-[#C6CDD9] rounded-lg p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-[#0A2342] font-semibold text-sm">Error</p>
              <p className="text-[#455A7C] text-xs mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Only show war room content if admin has approved */}
        {isAdminApproved && (
          <>
        {/* Case Overview Card */}
        <div className="bg-white rounded-lg shadow border border-[#C6CDD9] overflow-hidden">
          <div className="relative p-5" style={{ backgroundColor: "#16305B" }}>
            <div className="relative flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <DocumentTextIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Case Overview</h2>
                <p className="text-sm text-white/80 mt-0.5">Complete case information and details</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {/* Basic Information */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-1 bg-[#16305B] rounded-full"></div>
                <h3 className="text-base font-semibold text-[#0A2342]">Basic Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <InfoCard icon={DocumentTextIcon} label="Case Type" value={caseData.CaseType || "N/A"} />
                <InfoCard icon={BriefcaseIcon} label="Jurisdiction" value={caseData.CaseJurisdiction || "N/A"} />
                <InfoCard icon={MapPinIcon} label="State" value={caseData.State || "N/A"} />
                <InfoCard icon={MapPinIcon} label="County" value={caseData.County || "N/A"} />
                <InfoCard
                  icon={UserGroupIcon}
                  label="Required Jurors"
                  value={
                    (() => {
                      const jurors: any = caseData.RequiredJurors || 7;
                      // Handle cases where RequiredJurors might be a string like "7,7" or array
                      if (typeof jurors === 'string') {
                        return jurors.split(',')[0].trim();
                      }
                      if (Array.isArray(jurors)) {
                        return jurors[0]?.toString() || '7';
                      }
                      return String(jurors);
                    })()
                  }
                />
                <div className="bg-white rounded-lg p-3 border border-[#C6CDD9] transition-all">
                  <p className="text-xs text-[#455A7C] font-semibold mb-1 uppercase">Status</p>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold uppercase ${
                    caseData.AdminApprovalStatus === 'approved' ? 'bg-green-50 text-green-700' :
                    caseData.AdminApprovalStatus === 'rejected' ? 'bg-red-50 text-red-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    <span className="w-1 h-1 bg-current rounded-full"></span>
                    {caseData.AdminApprovalStatus || "Pending"}
                  </span>
                </div>
              </div>

              {/* Voir Dire Questions - Always display */}
              <div className="mt-4 space-y-3">
                {/* Voir Dire Part 1 */}
                <div className="bg-white rounded-lg p-4 border border-[#C6CDD9]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-[#16305B]/10 rounded">
                      <DocumentTextIcon className="w-4 h-4 text-[#16305B]" />
                    </div>
                    <h4 className="text-xs font-semibold text-[#0A2342] uppercase">Voir Dire Part 1 Questions</h4>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      try {
                        // Handle both string and already-parsed array
                        let questions = caseData.VoirDire1Questions;

                        if (typeof questions === 'string' && questions.trim()) {
                          try {
                            questions = JSON.parse(questions);
                          } catch (e) {
                            console.error('Failed to parse VoirDire1Questions:', e);
                            return <p className="text-sm text-[#455A7C] italic">Error parsing questions</p>;
                          }
                        }

                        if (!questions || (Array.isArray(questions) && questions.length === 0)) {
                          return <p className="text-sm text-[#455A7C] italic">No questions configured for Part 1</p>;
                        }

                        if (!Array.isArray(questions)) {
                          console.log('VoirDire1Questions is not an array:', questions);
                          return <p className="text-sm text-[#455A7C] italic">Invalid question format</p>;
                        }

                        return questions.map((q: any, idx: number) => (
                          <div key={idx} className="bg-[#FAF9F6] rounded p-2 border border-[#C6CDD9]">
                            <div className="flex items-start gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-[#16305B] text-white rounded text-xs font-semibold flex-shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span className="text-xs text-[#455A7C] flex-1">
                                {typeof q === 'string' ? q : q.question || q.text || q.Question || JSON.stringify(q)}
                              </span>
                            </div>
                          </div>
                        ));
                      } catch (error) {
                        console.error('Error rendering VoirDire1Questions:', error);
                        return <p className="text-sm text-red-500 italic">Error displaying questions</p>;
                      }
                    })()}
                  </div>
                </div>

                {/* Voir Dire Part 2 (Custom Questions) */}
                <div className="bg-white rounded-lg p-4 border border-[#C6CDD9]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-[#16305B]/10 rounded">
                      <DocumentTextIcon className="w-4 h-4 text-[#16305B]" />
                    </div>
                    <h4 className="text-xs font-semibold text-[#0A2342] uppercase">Voir Dire Part 2 - Custom Questions</h4>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      try {
                        // Handle both string and already-parsed array
                        let questions = caseData.VoirDire2Questions;

                        if (typeof questions === 'string' && questions.trim()) {
                          try {
                            questions = JSON.parse(questions);
                          } catch (e) {
                            console.error('Failed to parse VoirDire2Questions:', e);
                            return <p className="text-sm text-[#455A7C] italic">Error parsing custom questions</p>;
                          }
                        }

                        if (!questions || (Array.isArray(questions) && questions.length === 0)) {
                          return <p className="text-sm text-[#455A7C] italic">No custom questions configured for Part 2</p>;
                        }

                        if (!Array.isArray(questions)) {
                          console.log('VoirDire2Questions is not an array:', questions);
                          return <p className="text-sm text-[#455A7C] italic">Invalid question format</p>;
                        }

                        return questions.map((q: any, idx: number) => (
                          <div key={idx} className="bg-[#FAF9F6] rounded p-2 border border-[#C6CDD9]">
                            <div className="flex items-start gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-[#16305B] text-white rounded text-xs font-semibold flex-shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span className="text-xs text-[#455A7C] flex-1">
                                {typeof q === 'string' ? q : q.question || q.text || q.Question || JSON.stringify(q)}
                              </span>
                            </div>
                          </div>
                        ));
                      } catch (error) {
                        console.error('Error rendering VoirDire2Questions:', error);
                        return <p className="text-sm text-red-500 italic">Error displaying custom questions</p>;
                      }
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule & Payment */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-1 bg-[#16305B] rounded-full"></div>
                <h3 className="text-base font-semibold text-[#0A2342]">Schedule & Payment</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <InfoCard
                  icon={CalendarIcon}
                  label="Trial Date"
                  value={caseData.ScheduledDate ? formatDateString(caseData.ScheduledDate, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : "Not Scheduled"}
                  variant="blue"
                />
                <InfoCard
                  icon={ClockIcon}
                  label="Trial Time"
                  value={formatTime(caseData.ScheduledTime, caseData.ScheduledDate)}
                  variant="blue"
                />
                <InfoCard
                  icon={CreditCardIcon}
                  label="Payment Method"
                  value={caseData.PaymentMethod || "N/A"}
                  variant="green"
                />
                <InfoCard
                  icon={CreditCardIcon}
                  label="Payment Amount"
                  value={caseData.PaymentAmount ? `$${caseData.PaymentAmount.toFixed(2)}` : "N/A"}
                  variant="green"
                />
              </div>
            </div>

            {/* Case Description */}
            {caseData.CaseDescription && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-6 w-1 bg-[#16305B] rounded-full"></div>
                  <h3 className="text-base font-semibold text-[#0A2342]">Case Description</h3>
                </div>
                <div className="bg-white rounded-lg p-4 border border-[#C6CDD9]">
                  <p className="text-[#455A7C] leading-relaxed text-sm">{caseData.CaseDescription}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Team Members Card */}
        <div className="bg-white rounded-lg shadow border border-[#C6CDD9] overflow-hidden">
          <div className="relative p-5" style={{ backgroundColor: "#16305B" }}>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <UserGroupIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Team Members</h2>
                  <p className="text-sm text-white/80 mt-0.5">
                    {showAddTeam
                      ? `${teamMembers.length + newMembers.filter(m => m.Name || m.Email).length} member${(teamMembers.length + newMembers.filter(m => m.Name || m.Email).length) !== 1 ? 's' : ''} in your team`
                      : `${teamMembers.length} member${teamMembers.length !== 1 ? 's' : ''} in your team`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddTeam(!showAddTeam)}
                disabled={isAddingTeam}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold text-sm transition-all flex items-center gap-1.5"
              >
                <PlusIcon className="w-4 h-4" />
                Add Member
              </button>
            </div>
          </div>

          <div className="p-5">
            {teamMembers.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[#16305B]/10 rounded-full mb-3">
                  <UserGroupIcon className="w-6 h-6 text-[#16305B]" />
                </div>
                <p className="text-[#455A7C] font-semibold text-sm mb-1">No Team Members Yet</p>
                <p className="text-[#455A7C] text-xs">Add team members to collaborate on this case</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamMembers.map((member, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-lg p-4 border border-[#C6CDD9] hover:border-[#16305B] transition-all group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="p-1.5 bg-[#16305B]/10 rounded">
                          <UserIcon className="w-4 h-4 text-[#16305B]" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-[#FAF9F6] rounded text-xs font-semibold text-[#455A7C]">
                            {member.Role}
                          </span>
                          {member.Id && (
                            <button
                              onClick={() => deleteTeamMember(member.Id!, member.Name)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove team member"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-[#0A2342] text-sm">{member.Name}</h4>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-[#455A7C]">
                          <EnvelopeIcon className="w-3 h-3" />
                          <span className="truncate">{member.Email}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Team Form */}
            {showAddTeam && (
              <div className="mt-4 p-4 bg-[#FAF9F6] rounded-lg border border-[#C6CDD9]">
                <div className="space-y-4">
                  {newMembers.map((member, idx) => (
                    <div
                      key={idx}
                      className="relative p-4 bg-white rounded-lg border-2 border-[#16305B]/20 hover:border-[#16305B]/40 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-[#16305B]/10 rounded-lg">
                            <UserIcon className="w-4 h-4 text-[#16305B]" />
                          </div>
                          <span className="font-semibold text-[#0A2342] text-sm">
                            Team Member #{idx + 1}
                          </span>
                        </div>
                        {newMembers.length > 1 && (
                          <button
                            onClick={() => {
                              const updated = newMembers.filter((_, i) => i !== idx);
                              setNewMembers(updated);
                            }}
                            disabled={isAddingTeam}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Remove this member"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={member.Name}
                          onChange={(e) => {
                            const updated = [...newMembers];
                            updated[idx].Name = e.target.value;
                            setNewMembers(updated);
                          }}
                          disabled={isAddingTeam}
                          className="w-full px-3 py-2 border border-[#C6CDD9] rounded-lg focus:ring-2 focus:ring-[#16305B]/20 focus:border-[#16305B] bg-white text-[#0A2342] placeholder:text-gray-500 text-sm disabled:opacity-50"
                        />
                        <input
                          type="text"
                          placeholder="Role (e.g., Lead Attorney, Paralegal)"
                          value={member.Role}
                          onChange={(e) => {
                            const updated = [...newMembers];
                            updated[idx].Role = e.target.value;
                            setNewMembers(updated);
                          }}
                          disabled={isAddingTeam}
                          className="w-full px-3 py-2 border border-[#C6CDD9] rounded-lg focus:ring-2 focus:ring-[#16305B]/20 focus:border-[#16305B] bg-white text-[#0A2342] placeholder:text-gray-500 text-sm disabled:opacity-50"
                        />
                        <input
                          type="email"
                          placeholder="Email Address"
                          value={member.Email}
                          onChange={(e) => {
                            const updated = [...newMembers];
                            updated[idx].Email = e.target.value;
                            setNewMembers(updated);
                          }}
                          disabled={isAddingTeam}
                          className="w-full px-3 py-2 border border-[#C6CDD9] rounded-lg focus:ring-2 focus:ring-[#16305B]/20 focus:border-[#16305B] bg-white text-[#0A2342] placeholder:text-gray-500 text-sm disabled:opacity-50"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setNewMembers([...newMembers, { Name: "", Role: "", Email: "" }])}
                    disabled={isAddingTeam}
                    className="px-3 py-1.5 bg-white text-[#16305B] rounded-lg font-semibold text-sm hover:bg-[#f9f7f2] transition-all disabled:opacity-50 border border-[#16305B]"
                  >
                    Add Another
                  </button>
                  <button
                    onClick={async () => {
                      const validMembers = newMembers.filter(m => m.Name && m.Role && m.Email);
                      if (validMembers.length > 0) {
                        await addTeamMembers(caseId, validMembers);
                      }
                    }}
                    disabled={isAddingTeam}
                    className="flex-1 px-4 py-1.5 bg-[#16305B] text-white rounded-lg font-semibold text-sm hover:bg-[#1e417a] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isAddingTeam ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>Save Team</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddTeam(false);
                      setNewMembers([{ Name: "", Role: "", Email: "" }]);
                    }}
                    disabled={isAddingTeam}
                    className="px-3 py-1.5 bg-[#FAF9F6] text-[#455A7C] rounded-lg font-semibold text-sm hover:bg-[#f0ede6] transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Witness Section */}
        <WitnessSection caseId={caseId} />

        {/* Jury Charge Builder Section */}
        <JuryChargeBuilder
          caseId={parseInt(caseId)}
          isLocked={juryChargeLocked}
          onLockStatusChange={setJuryChargeLocked}
        />

        {/* Documents Card */}
        <div className="bg-white rounded-lg shadow border border-[#C6CDD9] overflow-hidden">
          <div className="relative p-5" style={{ backgroundColor: "#16305B" }}>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <DocumentTextIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Documentation</h2>
                  <p className="text-sm text-white/80 mt-0.5">Case files and evidence</p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(!showUploadModal)}
                disabled={uploadingDocuments}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold text-sm transition-all flex items-center gap-1.5"
              >
                <PlusIcon className="w-4 h-4" />
                Upload Document
              </button>
            </div>
          </div>

          <div className="p-5">
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[#16305B]/10 rounded-full mb-3">
                  <DocumentTextIcon className="w-6 h-6 text-[#16305B]" />
                </div>
                <p className="text-[#455A7C] font-semibold text-sm mb-1">No Documents Yet</p>
                <p className="text-[#455A7C] text-xs">Upload case files and evidence documents</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.Id}
                    className="bg-white rounded-lg p-4 border border-[#C6CDD9] hover:border-[#16305B] transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-1.5 bg-[#16305B]/10 rounded">
                          <DocumentTextIcon className="w-4 h-4 text-[#16305B]" />
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <h4 className="font-semibold text-[#0A2342] text-sm">{doc.FileName}</h4>
                          <p className="text-xs text-[#455A7C]">{doc.Description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={doc.FileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-[#FAF9F6] rounded transition-colors"
                        >
                          <LinkIcon className="w-4 h-4 text-[#16305B]" />
                        </a>
                        <button
                          onClick={() => requestDeleteDocument(doc.Id, doc.FileName)}
                          className="p-1.5 hover:bg-red-50 rounded transition-colors"
                          title="Delete document"
                        >
                          <TrashIcon className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Form */}
            {showUploadModal && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-[#C6CDD9]">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#455A7C] mb-1.5">Select Files</label>
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.mp4,.mpeg,.mov,.avi,.wmv,.webm,.flv,.3gp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files).map(file => ({
                            file,
                            description: "",
                            progress: 0,
                            id: Math.random().toString(36),
                            status: 'pending' as const
                          }));
                          setFilesToUpload([...filesToUpload, ...files]);
                        }
                      }}
                      className="w-full px-3 py-2 border border-[#C6CDD9] rounded-lg focus:ring-1 focus:ring-[#16305B] focus:border-[#16305B] bg-white text-[#0A2342] text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#16305B] file:text-white hover:file:bg-[#1e417a]"
                    />
                  </div>

                  {filesToUpload.map((fileData) => (
                    <div key={fileData.id} className={`p-3 rounded-lg border ${
                      fileData.status === 'uploading' ? 'bg-blue-50 border-blue-200' :
                      fileData.status === 'completed' ? 'bg-green-50 border-green-200' :
                      fileData.status === 'error' ? 'bg-red-50 border-red-200' :
                      'bg-[#FAF9F6] border-[#C6CDD9]'
                    }`}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="font-semibold text-[#0A2342] text-xs flex-1">{fileData.file.name}</p>
                        <div className="flex items-center gap-2">
                          {fileData.status === 'uploading' && (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
                              <button
                                onClick={() => cancelUpload(fileData.id)}
                                className="text-red-600 hover:text-red-700 text-xs font-semibold"
                                title="Cancel upload"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {fileData.status === 'completed' && (
                            <CheckCircleIcon className="w-4 h-4 text-green-600" />
                          )}
                          {fileData.status === 'error' && (
                            <ExclamationCircleIcon className="w-4 h-4 text-red-600" />
                          )}
                          {fileData.status === 'pending' && (
                            <button
                              onClick={() => setFilesToUpload(filesToUpload.filter(f => f.id !== fileData.id))}
                              className="text-[#455A7C] hover:text-red-600 text-xs"
                              title="Remove file"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Add description..."
                        value={fileData.description}
                        onChange={(e) => {
                          setFilesToUpload(filesToUpload.map(f =>
                            f.id === fileData.id ? { ...f, description: e.target.value } : f
                          ));
                        }}
                        disabled={fileData.status === 'uploading' || fileData.status === 'completed'}
                        className="w-full px-2 py-1.5 border border-[#C6CDD9] rounded focus:ring-1 focus:ring-[#16305B] focus:border-[#16305B] text-[#0A2342] placeholder:text-gray-500 text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />

                      {/* Progress Bar */}
                      {fileData.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-blue-600 font-semibold">Uploading...</p>
                            <p className="text-xs text-blue-600 font-semibold">{fileData.progress}%</p>
                          </div>
                          <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full transition-all duration-300 ease-out rounded-full"
                              style={{ width: `${fileData.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {(fileData.file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      )}

                      {fileData.status === 'completed' && (
                        <p className="text-xs text-green-600 mt-2 font-semibold">✓ Upload complete!</p>
                      )}
                      {fileData.status === 'error' && (
                        <p className="text-xs text-red-600 mt-2 font-semibold">✗ Upload failed</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={uploadDocuments}
                    disabled={uploadingDocuments || filesToUpload.length === 0}
                    className="flex-1 px-4 py-1.5 bg-[#16305B] text-white rounded-lg font-semibold text-sm hover:bg-[#1e417a] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {uploadingDocuments ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpTrayIcon className="w-4 h-4" />
                        <span>Upload Files</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setFilesToUpload([]);
                    }}
                    disabled={uploadingDocuments}
                    className="px-3 py-1.5 bg-[#FAF9F6] text-[#455A7C] rounded-lg font-semibold text-sm hover:bg-[#f0ede6] transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Applications Card */}
        <div className="bg-white rounded-lg shadow border border-[#C6CDD9] overflow-hidden">
          <div className="relative p-5" style={{ backgroundColor: "#16305B" }}>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <DocumentTextIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Juror Applications</h2>
                  <p className="text-sm text-white/80 mt-0.5">
                    Review and manage applicant submissions
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="px-2 py-1 bg-white/10 rounded text-white text-xs font-semibold flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  {pendingCount} Pending
                </span>
                <span className="px-2 py-1 bg-white/10 rounded text-white text-xs font-semibold flex items-center gap-1">
                  <CheckCircleIcon className="w-3 h-3" />
                  {approvedCount} Approved
                </span>
                <span className="px-2 py-1 bg-white/10 rounded text-white text-xs font-semibold flex items-center gap-1">
                  <XMarkIcon className="w-3 h-3" />
                  {rejectedCount} Rejected
                </span>
              </div>
            </div>
          </div>

          <div className="p-5">
            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4 pb-3 border-b border-[#C6CDD9]">
              {[
                { key: 'all', label: 'All', count: applications.length },
                { key: 'pending', label: 'Pending', count: pendingCount },
                { key: 'approved', label: 'Approved', count: approvedCount },
                { key: 'rejected', label: 'Rejected', count: rejectedCount }
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setApplicationFilter(filter.key as any)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    applicationFilter === filter.key
                      ? 'bg-[#16305B] text-white'
                      : 'bg-[#FAF9F6] text-[#455A7C] hover:bg-[#f0ede6]'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>

            {/* Applications List */}
            {filteredApplications.length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[#16305B]/10 rounded-full mb-3">
                  <DocumentTextIcon className="w-6 h-6 text-[#16305B]" />
                </div>
                <p className="text-[#455A7C] font-semibold text-sm mb-1">No {applicationFilter !== 'all' ? applicationFilter : ''} Applications</p>
                <p className="text-[#455A7C] text-xs">
                  {applicationFilter === 'all'
                    ? 'Juror applications will appear here once submitted'
                    : `No ${applicationFilter} applications found`}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredApplications.map((app) => (
                  <div
                    key={app.ApplicationId}
                    className="bg-white rounded-lg p-4 border border-[#C6CDD9] hover:border-[#16305B] transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedApplication(app);
                      setShowApplicationModal(true);
                    }}
                  >
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="relative">
                          <div className="w-10 h-10 bg-[#16305B] rounded-lg flex items-center justify-center text-white font-semibold text-base">
                            {app.JurorName.charAt(0).toUpperCase()}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
                            app.Status === "approved" ? "bg-green-600" :
                            app.Status === "rejected" ? "bg-red-500" : "bg-amber-500"
                          }`}>
                            {app.Status === "approved" && <CheckCircleIcon className="w-2.5 h-2.5 text-white" />}
                            {app.Status === "rejected" && <XMarkIcon className="w-2.5 h-2.5 text-white" />}
                            {app.Status === "pending" && <ClockIcon className="w-2.5 h-2.5 text-white" />}
                          </div>
                        </div>

                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-[#0A2342] mb-0.5">
                            {app.JurorName}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-[#455A7C]">
                            <div className="flex items-center gap-1">
                              <MapPinIcon className="w-3 h-3" />
                              <span>{app.County}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <ClockIcon className="w-3 h-3" />
                              <span>{new Date(app.AppliedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                          app.Status === "approved" ? "bg-green-50 text-green-700" :
                          app.Status === "rejected" ? "bg-red-50 text-red-700" :
                          "bg-amber-50 text-amber-700"
                        }`}>
                          {app.Status}
                        </span>

                        <div className="flex items-center gap-1 text-xs font-semibold text-[#16305B]">
                          <span>View</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Application Details Modal */}
        {showApplicationModal && selectedApplication && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(22, 48, 91, 0.5)' }}>
            <div className="bg-white rounded-lg shadow-lg border border-[#C6CDD9] p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="relative mb-5 pb-4 border-b border-[#C6CDD9]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-[#16305B] rounded-lg flex items-center justify-center text-white font-semibold text-lg">
                        {selectedApplication.JurorName.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                        selectedApplication.Status === "approved" ? "bg-green-600" :
                        selectedApplication.Status === "rejected" ? "bg-red-500" : "bg-amber-500"
                      }`}>
                        {selectedApplication.Status === "approved" && <CheckCircleIcon className="w-3 h-3 text-white" />}
                        {selectedApplication.Status === "rejected" && <XMarkIcon className="w-3 h-3 text-white" />}
                        {selectedApplication.Status === "pending" && <ClockIcon className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[#16305B]">Application Details</h2>
                      <p className="text-[#455A7C] text-sm mt-0.5">{selectedApplication.JurorName}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowApplicationModal(false)}
                    className="text-[#455A7C] hover:text-[#0A2342] transition-colors p-1.5 hover:bg-[#FAF9F6] rounded"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Basic Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-[#C6CDD9]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="p-1 bg-[#16305B]/10 rounded">
                        <EnvelopeIcon className="w-3 h-3 text-[#16305B]" />
                      </div>
                      <label className="text-xs font-semibold text-[#455A7C] uppercase">Email</label>
                    </div>
                    <p className="text-[#0A2342] font-semibold text-sm break-all">{selectedApplication.JurorEmail}</p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-[#C6CDD9]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="p-1 bg-[#16305B]/10 rounded">
                        <MapPinIcon className="w-3 h-3 text-[#16305B]" />
                      </div>
                      <label className="text-xs font-semibold text-[#455A7C] uppercase">State</label>
                    </div>
                    <p className="text-[#0A2342] font-semibold text-sm">{(selectedApplication as any).State || 'N/A'}</p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-[#C6CDD9]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="p-1 bg-[#16305B]/10 rounded">
                        <MapPinIcon className="w-3 h-3 text-[#16305B]" />
                      </div>
                      <label className="text-xs font-semibold text-[#455A7C] uppercase">County</label>
                    </div>
                    <p className="text-[#0A2342] font-semibold text-sm">{selectedApplication.County}</p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-[#C6CDD9]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="p-1 bg-[#16305B]/10 rounded">
                        <ClockIcon className="w-3 h-3 text-[#16305B]" />
                      </div>
                      <label className="text-xs font-semibold text-[#455A7C] uppercase">Applied</label>
                    </div>
                    <p className="text-[#0A2342] font-semibold text-sm">{new Date(selectedApplication.AppliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-white rounded-lg p-4 border border-[#C6CDD9]">
                  <label className="text-xs font-semibold text-[#455A7C] uppercase mb-2 block">Application Status</label>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold uppercase ${
                    selectedApplication.Status === "approved" ? "bg-green-50 text-green-700" :
                    selectedApplication.Status === "rejected" ? "bg-red-50 text-red-700" :
                    "bg-amber-50 text-amber-700"
                  }`}>
                    <span className="w-1.5 h-1.5 bg-current rounded-full"></span>
                    {selectedApplication.Status}
                  </span>
                </div>

                {/* Voir Dire Part 1 */}
                <div className="bg-white rounded-lg p-4 border border-[#C6CDD9]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-[#16305B]/10 rounded">
                      <DocumentTextIcon className="w-4 h-4 text-[#16305B]" />
                    </div>
                    <label className="text-xs font-semibold text-[#0A2342] uppercase">
                      Voir Dire Part 1 Responses
                    </label>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const responses = parseVoirDireResponses(selectedApplication.VoirDire1Responses);
                      if (!responses || responses.length === 0) {
                        return <p className="text-[#455A7C] italic text-xs">No responses provided</p>;
                      }
                      return responses.map((item: any, idx: number) => (
                        <div key={idx} className="bg-[#FAF9F6] rounded p-3 border border-[#C6CDD9]">
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 w-5 h-5 bg-[#16305B] text-white rounded flex items-center justify-center font-semibold text-xs">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-[#455A7C] mb-1.5">
                                {typeof item.question === 'string' ? item.question : (typeof item === 'string' ? item : `Question ${idx + 1}`)}
                              </p>
                              <div className="bg-white rounded p-2 border-l-2 border-[#16305B]">
                                <p className="text-xs text-[#0A2342]">
                                  {typeof item === 'string' ? item : (item.answer || 'No answer provided')}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Voir Dire Part 2 */}
                <div className="bg-white rounded-lg p-4 border border-[#C6CDD9]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-[#16305B]/10 rounded">
                      <DocumentTextIcon className="w-4 h-4 text-[#16305B]" />
                    </div>
                    <label className="text-xs font-semibold text-[#0A2342] uppercase">
                      Voir Dire Part 2 Responses
                    </label>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      const responses = parseVoirDireResponses(selectedApplication.VoirDire2Responses);
                      if (!responses || responses.length === 0) {
                        return <p className="text-[#455A7C] italic text-xs">No responses provided</p>;
                      }
                      return responses.map((item: any, idx: number) => (
                        <div key={idx} className="bg-[#FAF9F6] rounded p-3 border border-[#C6CDD9]">
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 w-5 h-5 bg-[#16305B] text-white rounded flex items-center justify-center font-semibold text-xs">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-[#455A7C] mb-1.5">
                                {typeof item.question === 'string' ? item.question : (typeof item === 'string' ? item : `Question ${idx + 1}`)}
                              </p>
                              <div className="bg-white rounded p-2 border-l-2 border-[#16305B]">
                                <p className="text-xs text-[#0A2342]">
                                  {typeof item === 'string' ? item : (item.answer || 'No answer provided')}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedApplication.Status === "pending" && (
                <div className="flex gap-2 mt-5 pt-4 border-t border-[#C6CDD9]">
                  <button
                    className="flex-1 bg-[#16305B] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#1e417a] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-all"
                    onClick={() => updateApplicationStatus(selectedApplication.ApplicationId, "approved")}
                    disabled={updatingStatus !== null}
                  >
                    {updatingStatus === "approved" ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                        <span>Approving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>Approve Application</span>
                      </>
                    )}
                  </button>
                  <button
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-all"
                    onClick={() => updateApplicationStatus(selectedApplication.ApplicationId, "rejected")}
                    disabled={updatingStatus !== null}
                  >
                    {updatingStatus === "rejected" ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                        <span>Rejecting...</span>
                      </>
                    ) : (
                      <>
                        <XMarkIcon className="w-4 h-4" />
                        <span>Reject Application</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
          </>
        )}

        {/* Tier Upgrade Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(22, 48, 91, 0.5)' }}>
            <div className="bg-white rounded-lg shadow-lg max-w-xl w-full mx-4 overflow-hidden border border-[#C6CDD9]">
              <div className="p-5 border-b border-[#C6CDD9]" style={{ backgroundColor: "#16305B" }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Upgrade Case Tier</h2>
                  <button
                    onClick={() => {
                      setShowUpgradeModal(false);
                      setSelectedNewTier(null);
                      setErrorMessage("");
                    }}
                    className="text-white hover:bg-white/10 rounded p-1.5 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                    <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
                    <p className="text-red-800 text-sm font-semibold">{errorMessage}</p>
                  </div>
                )}

                <div>
                  <p className="text-[#455A7C] text-sm mb-2">
                    Current Tier: <strong>{getTierDisplay(caseData.CaseTier)}</strong>
                  </p>
                  <p className="text-xs text-[#455A7C]">
                    Select a tier to upgrade to. Payment will be processed using Stripe Test Mode.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-[#0A2342] text-sm">Select New Tier</h3>
                  {getUpgradeOptions(caseData.CaseTier).map((tierOption) => {
                    const tier = tierOption as 'tier_1' | 'tier_2' | 'tier_3';
                    const info = getTierInfo(tier);
                    const borderColor = selectedNewTier === tier ? 'border-[#16305B]' : 'border-[#C6CDD9]';
                    const bgColor = selectedNewTier === tier ? 'bg-[#16305B]/5' : 'bg-white';

                    return (
                      <button
                        key={tier}
                        onClick={() => setSelectedNewTier(tier)}
                        className={`w-full text-left border ${borderColor} ${bgColor} rounded-lg p-3 hover:border-[#16305B] transition-all`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                info.color === 'green' ? 'bg-[#16305B]/10 text-[#16305B]' : 'bg-[#16305B]/10 text-[#16305B]'
                              }`}>
                                {info.name}
                              </span>
                              <span className="text-lg font-semibold text-[#16305B]">${info.price}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-[#455A7C]">Duration:</span>
                                <span className="ml-1.5 font-semibold text-[#0A2342]">{info.duration}</span>
                              </div>
                              <div>
                                <span className="text-[#455A7C]">Max Claim:</span>
                                <span className="ml-1.5 font-semibold text-[#0A2342]">{info.maxClaim}</span>
                              </div>
                            </div>
                          </div>
                          {selectedNewTier === tier && (
                            <CheckCircleIcon className="w-5 h-5 text-[#16305B]" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="bg-[#FAF9F6] border border-[#C6CDD9] rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <CreditCardIcon className="w-5 h-5 text-[#16305B] mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[#0A2342] mb-1">Stripe Test Mode</p>
                      <p className="text-xs text-[#455A7C]">
                        Use test card: <code className="bg-white px-1.5 py-0.5 rounded font-mono text-xs border border-[#C6CDD9]">4242 4242 4242 4242</code>
                      </p>
                      <p className="text-xs text-[#455A7C] mt-0.5">
                        Any future expiry date and any 3-digit CVV
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-[#C6CDD9]">
                  <button
                    onClick={handleUpgradeTier}
                    disabled={!selectedNewTier || processingPayment}
                    className="flex-1 px-4 py-2 bg-[#16305B] text-white rounded-lg font-semibold text-sm hover:bg-[#1e417a] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                  >
                    {processingPayment ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <CreditCardIcon className="w-4 h-4" />
                        Pay & Upgrade
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowUpgradeModal(false);
                      setSelectedNewTier(null);
                      setErrorMessage("");
                    }}
                    disabled={processingPayment}
                    className="px-4 py-2 bg-[#FAF9F6] text-[#455A7C] rounded-lg font-semibold text-sm hover:bg-[#f0ede6] disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && docToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-[#C6CDD9]">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <ExclamationCircleIcon className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0A2342]">Delete Document</h3>
                </div>

                <p className="text-[#455A7C] mb-2">
                  Are you sure you want to delete this document? This action cannot be undone.
                </p>

                <div className="bg-[#FAF9F6] border border-[#C6CDD9] rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-[#0A2342]">Document:</p>
                  <p className="text-sm text-[#455A7C] mt-1">{docToDelete.name}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={confirmDeleteDocument}
                    disabled={deletingDocument}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingDocument ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <TrashIcon className="w-4 h-4" />
                        <span>Delete</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDocToDelete(null);
                    }}
                    disabled={deletingDocument}
                    className="px-4 py-2 bg-[#FAF9F6] text-[#455A7C] rounded-lg font-semibold text-sm hover:bg-[#f0ede6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reschedule Request Modal */}
        {showRescheduleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[#16305B] text-white p-5 rounded-t-xl z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Request Case Reschedule</h3>
                  <button
                    onClick={() => {
                      setShowRescheduleModal(false);
                      setRescheduleData({
                        newScheduledDate: "",
                        newScheduledTime: "",
                        reason: "",
                        attorneyComments: "",
                      });
                      setErrorMessage("");
                    }}
                    disabled={submittingReschedule}
                    className="p-1 hover:bg-white/20 rounded transition-colors disabled:opacity-50"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {errorMessage && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <ExclamationCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800">{errorMessage}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>Note:</strong> Submitting a reschedule request will send it to the admin for approval.
                      If approved, all accepted jurors will be removed and you'll need to accept new applications with the updated schedule.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#0A2342] mb-2">
                        Current Scheduled Date
                      </label>
                      <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-700">
                        {caseData?.ScheduledDate ? formatDateString(caseData.ScheduledDate) : "N/A"}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0A2342] mb-2">
                        Current Scheduled Time
                      </label>
                      <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-700">
                        {caseData?.ScheduledTime ? formatTime(caseData.ScheduledTime, caseData.ScheduledDate) : "N/A"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#0A2342] mb-2">
                        New Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={rescheduleData.newScheduledDate}
                        onChange={(e) => setRescheduleData({ ...rescheduleData, newScheduledDate: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-2 border border-[#C6CDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16305B] text-sm"
                        disabled={submittingReschedule}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0A2342] mb-2">
                        New Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={rescheduleData.newScheduledTime}
                        onChange={(e) => setRescheduleData({ ...rescheduleData, newScheduledTime: e.target.value })}
                        className="w-full px-4 py-2 border border-[#C6CDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16305B] text-sm"
                        disabled={submittingReschedule}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0A2342] mb-2">
                      Reason for Reschedule
                    </label>
                    <input
                      type="text"
                      value={rescheduleData.reason}
                      onChange={(e) => setRescheduleData({ ...rescheduleData, reason: e.target.value })}
                      placeholder="e.g., Scheduling conflict, witness unavailability"
                      className="w-full px-4 py-2 border border-[#C6CDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16305B] text-sm"
                      disabled={submittingReschedule}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0A2342] mb-2">
                      Additional Comments
                    </label>
                    <textarea
                      value={rescheduleData.attorneyComments}
                      onChange={(e) => setRescheduleData({ ...rescheduleData, attorneyComments: e.target.value })}
                      placeholder="Provide any additional details for the admin..."
                      rows={4}
                      className="w-full px-4 py-2 border border-[#C6CDD9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16305B] text-sm resize-none"
                      disabled={submittingReschedule}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleRescheduleRequest}
                    disabled={submittingReschedule || !rescheduleData.newScheduledDate || !rescheduleData.newScheduledTime}
                    className="flex-1 px-6 py-3 bg-[#16305B] text-white rounded-lg font-semibold text-sm hover:bg-[#0A2342] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingReschedule ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <CalendarIcon className="w-4 h-4" />
                        <span>Submit Reschedule Request</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowRescheduleModal(false);
                      setRescheduleData({
                        newScheduledDate: "",
                        newScheduledTime: "",
                        reason: "",
                        attorneyComments: "",
                      });
                      setErrorMessage("");
                    }}
                    disabled={submittingReschedule}
                    className="px-6 py-3 bg-[#FAF9F6] text-[#455A7C] rounded-lg font-semibold text-sm hover:bg-[#f0ede6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
