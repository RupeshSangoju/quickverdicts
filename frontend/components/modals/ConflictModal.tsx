"use client";

import { useState } from "react";
import { X, AlertCircle, Calendar } from "lucide-react";

const BLUE = "#0A2342";

interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseTitle: string;
  blockedSlot: {
    date: string;
    time: string;
  };
  onSubmit: () => void | Promise<void>;
}

export default function ConflictModal({
  isOpen,
  onClose,
  caseTitle,
  blockedSlot,
  onSubmit,
}: ConflictModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit();
    } catch (error) {
      console.error("Error sending reschedule request:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Time Slot Conflict</h2>
              <p className="text-sm text-gray-500">{caseTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Conflict info */}
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
            <p className="text-sm font-semibold text-red-900 mb-1">Selected time slot is already booked</p>
            <p className="text-sm text-red-800 line-through font-medium">
              {formatDate(blockedSlot.date)} at {blockedSlot.time}
            </p>
            <p className="text-xs text-red-700 mt-1">
              This slot cannot be approved as it conflicts with another case.
            </p>
          </div>

          {/* Explanation */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">Attorney will choose a new date</p>
              <p className="text-sm text-blue-700">
                Sending this request will notify the attorney that their current slot is unavailable.
                The attorney can then propose any date they prefer, and you will see their request in
                the <strong>Reschedule Requests</strong> section for approval.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            style={{ backgroundColor: BLUE }}
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                Sending...
              </>
            ) : (
              "Request Reschedule from Attorney"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
