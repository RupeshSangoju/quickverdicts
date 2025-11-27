"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, AlertCircle, CheckCircle2, MessageSquare } from "lucide-react";
import { getToken } from "@/lib/apiClient";
import { formatDateString, formatTime as formatTimeUtil } from "@/lib/dateUtils";

const BLUE = "#0A2342";
const BG = "#FAF9F6";
const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

type RescheduleRequest = {
  CaseId: number;
  CaseTitle: string;
  CaseDescription: string;
  OriginalScheduledDate: string;
  OriginalScheduledTime: string;
  AlternateSlots: TimeSlot[];
  RescheduleRequestedAt: string;
  AdminName?: string;
};

type TimeSlot = {
  date: string;
  time: string;
};

export default function RescheduleRequestsPage() {
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RescheduleRequest | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchRescheduleRequests();
  }, []);

  const fetchRescheduleRequests = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/attorney/reschedule-requests`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.rescheduleRequests || []);
      }
    } catch (error) {
      console.error("Error fetching reschedule requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptSlot = async (caseId: number, slot: TimeSlot) => {
    setActionLoading(true);
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/attorney/cases/${caseId}/confirm-reschedule`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ selectedSlot: slot })
        }
      );

      if (response.ok) {
        alert("Case rescheduled successfully! Moving to War Room.");
        fetchRescheduleRequests();
        setSelectedRequest(null);
        setSelectedSlot(null);
      } else {
        const error = await response.json();
        if (error.code === "SLOT_UNAVAILABLE") {
          alert(`${error.message} Please select another slot.`);
        } else {
          alert(`Failed to confirm reschedule: ${error.message}`);
        }
      }
    } catch (error) {
      console.error("Error confirming reschedule:", error);
      alert("Failed to confirm reschedule");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatDateString(dateStr, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeStr: string) => {
    return formatTimeUtil(timeStr);
  };

  if (loading) {
    return (
      <main className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: BG }}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: BLUE }}></div>
          <p className="text-lg font-medium" style={{ color: BLUE }}>Loading reschedule requests...</p>
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
              <h1 className="text-3xl font-bold" style={{ color: BLUE }}>Reschedule Requests</h1>
              <p className="text-gray-600 mt-1">Review and respond to case reschedule requests from admin</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {requests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Pending Reschedule Requests</h2>
            <p className="text-gray-600">All your cases are scheduled and approved!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {requests.map((request) => {
              // AlternateSlots should already be parsed from the backend
              const alternateSlots: TimeSlot[] = Array.isArray(request.AlternateSlots)
                ? request.AlternateSlots
                : [];

              const isExpanded = selectedRequest?.CaseId === request.CaseId;

              return (
                <div
                  key={request.CaseId}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                >
                  {/* Request Header */}
                  <div className="p-6 border-b border-gray-200 bg-yellow-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <AlertCircle className="h-6 w-6 text-yellow-600" />
                          <h3 className="text-xl font-semibold text-gray-900">{request.CaseTitle}</h3>
                          <span className="px-3 py-1 bg-yellow-200 text-yellow-800 text-sm font-medium rounded-full">
                            Needs Rescheduling
                          </span>
                        </div>
                        <div className="ml-9 space-y-1 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="font-medium">Original Schedule (Blocked):</span>
                            <span className="line-through text-red-600">{formatDate(request.OriginalScheduledDate)} at {formatTime(request.OriginalScheduledTime)}</span>
                          </div>
                          {request.CaseDescription && (
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 mt-0.5" />
                              <div>
                                <span className="font-medium">Description:</span>
                                <p className="text-gray-600">{request.CaseDescription}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedRequest(isExpanded ? null : request)}
                        className="px-4 py-2 rounded-lg font-medium transition-colors"
                        style={{ 
                          backgroundColor: isExpanded ? BG : BLUE,
                          color: isExpanded ? BLUE : "white"
                        }}
                      >
                        {isExpanded ? "Collapse" : "View Options"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">
                        Select an Alternative Time Slot
                      </h4>

                      {alternateSlots.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <p>No alternate slots available.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          {alternateSlots.map((slot, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedSlot(slot)}
                              className={`p-4 border-2 rounded-lg text-left transition-all ${
                                selectedSlot?.date === slot.date && selectedSlot?.time === slot.time
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-5 w-5 text-blue-600" />
                                <span className="font-medium text-gray-900">
                                  {formatDate(slot.date)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 ml-7">
                                <Clock className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-700">{formatTime(slot.time)}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => selectedSlot && handleAcceptSlot(request.CaseId, selectedSlot)}
                          disabled={!selectedSlot || actionLoading}
                          className="py-3 px-8 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                        >
                          {actionLoading ? (
                            <>
                              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-5 w-5" />
                              Confirm Reschedule
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}