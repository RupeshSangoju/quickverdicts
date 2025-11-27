"use client";

import { useState } from "react";
import { X, AlertCircle } from "lucide-react";

const BLUE = "#0A2342";

interface TimeSlot {
  date: string;
  time: string;
}

interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseTitle: string;
  blockedSlot: {
    date: string;
    time: string;
  };
  onSubmit: (alternateSlots: TimeSlot[]) => void | Promise<void>;
}

export default function ConflictModal({
  isOpen,
  onClose,
  caseTitle,
  blockedSlot,
  onSubmit,
}: ConflictModalProps) {
  const [alternateSlots, setAlternateSlots] = useState<TimeSlot[]>([
    { date: "", time: "" },
    { date: "", time: "" },
    { date: "", time: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>(["", "", ""]);

  if (!isOpen) return null;

  const handleSlotChange = (index: number, field: "date" | "time", value: string) => {
    const newSlots = [...alternateSlots];
    newSlots[index][field] = value;
    setAlternateSlots(newSlots);

    // Clear error for this slot
    const newErrors = [...errors];
    newErrors[index] = "";
    setErrors(newErrors);
  };

  const validateSlots = (): boolean => {
    const newErrors = ["", "", ""];
    let isValid = true;

    alternateSlots.forEach((slot, index) => {
      if (!slot.date || !slot.time) {
        newErrors[index] = "Both date and time are required";
        isValid = false;
      } else {
        // Validate date is in the future
        const slotDateTime = new Date(`${slot.date}T${slot.time}`);
        const now = new Date();
        if (slotDateTime <= now) {
          newErrors[index] = "Time slot must be in the future";
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateSlots()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(alternateSlots);
      // Reset form on success
      setAlternateSlots([
        { date: "", time: "" },
        { date: "", time: "" },
        { date: "", time: "" },
      ]);
      setErrors(["", "", ""]);
    } catch (error) {
      console.error("Error submitting alternate slots:", error);
      alert("Failed to submit alternate slots. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                Time Slot Conflict
              </h2>
            </div>
            <p className="text-sm text-gray-600">
              {caseTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Conflict Message */}
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-semibold text-red-900">
                  Selected time slot is already booked
                </h3>
                <div className="mt-2 text-sm text-red-800">
                  <p className="line-through font-medium">
                    {formatDate(blockedSlot.date)} at {blockedSlot.time}
                  </p>
                  <p className="mt-1 text-xs text-red-700">
                    This time slot cannot be approved because it is already occupied by another case.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Please provide 3 alternate time slots
            </h3>
            <p className="text-sm text-gray-600">
              The attorney will select one of these alternate slots to reschedule their case.
            </p>
          </div>

          {/* Alternate Slots Form */}
          <div className="space-y-4">
            {alternateSlots.map((slot, index) => (
              <div
                key={index}
                className="border border-gray-300 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Alternate Slot {index + 1}
                  </h4>
                  {errors[index] && (
                    <span className="text-xs text-red-600 font-medium">
                      {errors[index]}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={slot.date}
                      onChange={(e) =>
                        handleSlotChange(index, "date", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={slot.time}
                      onChange={(e) =>
                        handleSlotChange(index, "time", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isSubmitting}
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
              "Send to Attorney for Reschedule"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
