"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  ArrowLeftIcon,
  UserIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/outline";
import { formatDateString, formatTime as formatTimeUtil } from "@/lib/dateUtils";

const BLUE = "#0A2342";
const BG = "#FAF9F6";
const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, "")
  : "http://localhost:4000";

type RescheduleRequest = {
  RequestId: number;
  CaseId: number;
  AttorneyId: number;
  NewScheduledDate: string;
  NewScheduledTime: string;
  OriginalScheduledDate: string;
  OriginalScheduledTime: string;
  CurrentScheduledDate: string;
  CurrentScheduledTime: string;
  Reason: string | null;
  AttorneyComments: string | null;
  Status: "pending" | "approved" | "rejected";
  CaseTitle: string;
  CaseDescription: string | null;
  County: string;
  State: string;
  CaseType: string;
  AttorneyName: string;
  AttorneyEmail: string;
  LawFirmName: string | null;
  ApprovedJurors: number;
  CreatedAt: string;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("token");
  } catch (error) {
    console.error("Error reading token from localStorage:", error);
    return null;
  }
}

export default function AdminRescheduleRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RescheduleRequest | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [adminComments, setAdminComments] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchRescheduleRequests();
  }, []);

  const fetchRescheduleRequests = async () => {
    try {
      const token = getToken();
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const response = await fetch(`${API_BASE}/api/admin/reschedule-requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      } else if (response.status === 401 || response.status === 403) {
        router.push("/admin/login");
      }
    } catch (error) {
      console.error("Error fetching reschedule requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setActionLoading(true);
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/admin/reschedule-requests/${selectedRequest.RequestId}/approve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ adminComments }),
        }
      );

      if (response.ok) {
        alert("Reschedule request approved successfully!");
        setShowApproveModal(false);
        setSelectedRequest(null);
        setAdminComments("");
        fetchRescheduleRequests();
      } else {
        const error = await response.json();
        alert(`Failed to approve request: ${error.message}`);
      }
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Failed to approve reschedule request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    if (!adminComments || adminComments.trim().length === 0) {
      alert("Please provide a reason for rejection");
      return;
    }

    setActionLoading(true);
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/admin/reschedule-requests/${selectedRequest.RequestId}/reject`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ adminComments }),
        }
      );

      if (response.ok) {
        alert("Reschedule request rejected successfully!");
        setShowRejectModal(false);
        setSelectedRequest(null);
        setAdminComments("");
        fetchRescheduleRequests();
      } else {
        const error = await response.json();
        alert(`Failed to reject request: ${error.message}`);
      }
    } catch (error) {
      console.error("Error rejecting request:", error);
      alert("Failed to reject reschedule request");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatDateString(dateStr, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "N/A";
    // Remove milliseconds and show raw time value (e.g., "18:00:00.0000000" -> "18:00")
    const cleanTime = timeStr.split('.')[0];
    const [hours, minutes] = cleanTime.split(':');
    return `${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <main className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: BG }}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: BLUE }}></div>
          <p className="text-lg font-medium" style={{ color: BLUE }}>
            Loading reschedule requests...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full" style={{ backgroundColor: BG }}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.push("/admin/dashboard")}
                className="flex items-center gap-2 text-[#0A2342] hover:text-[#16305B] transition-colors font-medium text-sm group mb-2"
              >
                <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>Back to Dashboard</span>
              </button>
              <h1 className="text-3xl font-bold" style={{ color: BLUE }}>
                Attorney Reschedule Requests
              </h1>
              <p className="text-gray-600 mt-1">
                Review and manage case reschedule requests from attorneys
              </p>
            </div>
            <div className="bg-blue-100 px-4 py-2 rounded-lg">
              <p className="text-sm font-semibold text-blue-800">
                {requests.length} Pending Request{requests.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {requests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Pending Requests</h2>
            <p className="text-gray-600">All reschedule requests have been processed!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {requests.map((request) => (
              <div
                key={request.RequestId}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Request Header */}
                <div className="p-6 border-b border-gray-200 bg-amber-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <ExclamationCircleIcon className="h-6 w-6 text-amber-600" />
                        <h3 className="text-xl font-semibold text-gray-900">{request.CaseTitle}</h3>
                        <span className="px-3 py-1 bg-amber-200 text-amber-800 text-sm font-medium rounded-full">
                          Reschedule Request
                        </span>
                      </div>

                      <div className="ml-9 space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-700">
                          <UserIcon className="h-4 w-4" />
                          <span className="font-medium">Attorney:</span>
                          <span>
                            {request.AttorneyName} ({request.AttorneyEmail})
                          </span>
                          {request.LawFirmName && (
                            <>
                              <span>•</span>
                              <span>{request.LawFirmName}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <BriefcaseIcon className="h-4 w-4" />
                          <span className="font-medium">Case:</span>
                          <span>
                            {request.CaseType} - {request.County}, {request.State}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <UserIcon className="h-4 w-4" />
                          <span className="font-medium">Approved Jurors:</span>
                          <span className="font-semibold text-red-600">{request.ApprovedJurors}</span>
                          <span className="text-xs text-gray-500">(all applications will be deleted)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Request Details */}
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    {/* Original Schedule */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Current Schedule</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-700">
                          <CalendarIcon className="h-4 w-4" />
                          <span className="line-through text-red-600">
                            {formatDate(request.CurrentScheduledDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <ClockIcon className="h-4 w-4" />
                          <span className="line-through text-red-600">
                            {formatTime(request.CurrentScheduledTime)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* New Schedule */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Requested New Schedule</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-700">
                          <CalendarIcon className="h-4 w-4 text-green-600" />
                          <span className="font-semibold text-green-600">
                            {formatDate(request.NewScheduledDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <ClockIcon className="h-4 w-4 text-green-600" />
                          <span className="font-semibold text-green-600">
                            {formatTime(request.NewScheduledTime)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reason and Comments */}
                  {(request.Reason || request.AttorneyComments) && (
                    <div className="space-y-3 mb-6">
                      {request.Reason && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Reason:</p>
                          <p className="text-sm text-gray-600 mt-1">{request.Reason}</p>
                        </div>
                      )}
                      {request.AttorneyComments && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Additional Comments:</p>
                          <p className="text-sm text-gray-600 mt-1">{request.AttorneyComments}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowApproveModal(true);
                      }}
                      className="flex-1 py-3 px-6 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                      Approve & Reschedule
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowRejectModal(true);
                      }}
                      className="flex-1 py-3 px-6 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <XMarkIcon className="h-5 w-5" />
                      Reject Request
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="bg-green-600 text-white p-5 rounded-t-xl">
              <h3 className="text-xl font-bold">Approve Reschedule Request</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-2">
                    <strong>Warning:</strong> Approving this request will:
                  </p>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>Update the case schedule to the new date/time</li>
                    <li>
                      Delete ALL juror applications (approved, pending, rejected) for this case
                    </li>
                    <li>Notify the attorney and all affected jurors</li>
                    <li>Return the case to the job board for new applications</li>
                  </ul>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Admin Comments (Optional)
                </label>
                <textarea
                  value={adminComments}
                  onChange={(e) => setAdminComments(e.target.value)}
                  placeholder="Add any comments for the attorney..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  disabled={actionLoading}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                      <span>Approving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-5 w-5" />
                      <span>Confirm Approval</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowApproveModal(false);
                    setSelectedRequest(null);
                    setAdminComments("");
                  }}
                  disabled={actionLoading}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="bg-red-600 text-white p-5 rounded-t-xl">
              <h3 className="text-xl font-bold">Reject Reschedule Request</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  Please provide a clear reason for rejecting this reschedule request. The attorney will
                  receive a notification with your comments.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={adminComments}
                  onChange={(e) => setAdminComments(e.target.value)}
                  placeholder="Explain why this request cannot be approved..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  disabled={actionLoading}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !adminComments.trim()}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <>
                      <XMarkIcon className="h-5 w-5" />
                      <span>Confirm Rejection</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedRequest(null);
                    setAdminComments("");
                  }}
                  disabled={actionLoading}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
