"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Send, Save, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { getToken } from "@/lib/apiClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// ============================================
// TYPES
// ============================================

interface JuryChargeQuestion {
  QuestionId: number;
  QuestionText: string;
  QuestionType: "Multiple Choice" | "Yes/No" | "Text Response" | "Numeric Response";
  Options: string[] | string; // Can be array from backend or string
  IsRequired: boolean;
  MinValue?: number;
  MaxValue?: number;
}

interface JurorVerdictFormProps {
  caseId: number;
  jurorId: number;
}

// ============================================
// JUROR VERDICT FORM COMPONENT
// ============================================

export default function JurorVerdictForm({ caseId, jurorId }: JurorVerdictFormProps) {
  const [questions, setQuestions] = useState<JuryChargeQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  // ============================================
  // LOAD QUESTIONS
  // ============================================

  useEffect(() => {
    loadQuestions();
    checkSubmissionStatus();
  }, [caseId, jurorId]);

  async function loadQuestions() {
    try {
      setLoading(true);
      setError(null);

      const token = getToken();
      const response = await fetch(`${API_BASE}/jury-charge/juror/${caseId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn(`Failed to load jury charge questions: ${response.status}`);
        throw new Error("Failed to load questions. Please try again later.");
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("Jury charge questions response is not JSON");
        throw new Error("Failed to load questions. Please try again later.");
      }

      const data = await response.json();
      setQuestions(data.questions || []);
    } catch (err) {
      console.error("Error loading questions:", err);
      setError(err instanceof Error ? err.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }

  async function checkSubmissionStatus() {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/verdicts/check/${caseId}/${jurorId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn(`Failed to check submission status: ${response.status}`);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("Submission status response is not JSON");
        return;
      }

      const data = await response.json();
      if (data.hasSubmitted && data.verdict) {
        setHasSubmitted(true);
        setSubmittedAt(data.verdict.SubmittedAt);
        setResponses(data.verdict.Responses || {});
      }
    } catch (err) {
      console.error("Error checking submission status:", err);
    }
  }

  // ============================================
  // HANDLERS
  // ============================================

  function handleResponseChange(questionId: number, value: string) {
    setResponses((prev) => ({
      ...prev,
      [questionId.toString()]: value,
    }));
  }

  async function handleSaveDraft() {
    try {
      setSaving(true);
      const token = getToken();

      const response = await fetch(`${API_BASE}/verdicts/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          caseId,
          jurorId,
          responses,
        }),
      });

      if (!response.ok) {
        console.warn(`Failed to save draft: ${response.status}`);
        throw new Error("Failed to save draft. Please try again.");
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        await response.json(); // Consume response if JSON
      }

      toast.success("Draft saved successfully! You can continue later.", {
        duration: 4000,
      });
    } catch (err) {
      console.error("Error saving draft:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save draft", {
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    // Validate all required questions are answered
    const unanswered = questions.filter(
      (q) => q.IsRequired && !responses[q.QuestionId.toString()]?.trim()
    );

    if (unanswered.length > 0) {
      const questionList = unanswered
        .map((q, i) => `${i + 1}. ${q.QuestionText}`)
        .join("\n");
      toast.error(`Please answer all required questions:\n\n${questionList}`, {
        duration: 6000,
      });
      return;
    }

    // Use custom confirmation - since confirm() is blocking, we'll just warn user
    const userConfirmed = window.confirm(
      "Are you sure you want to submit your verdict?\n\nYou will NOT be able to change your answers after submission."
    );

    if (!userConfirmed) {
      return;
    }

    try {
      setSubmitting(true);
      const token = getToken();

      const response = await fetch(`${API_BASE}/verdicts/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          caseId,
          jurorId,
          responses,
        }),
      });

      if (!response.ok) {
        console.warn(`Failed to submit verdict: ${response.status}`);

        // Try to get error message from response
        const contentType = response.headers.get("content-type");
        let errorMessage = "Failed to submit verdict. Please try again.";

        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            console.error("Error parsing error response:", e);
          }
        }

        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        await response.json(); // Consume response if JSON
      }

      setHasSubmitted(true);
      setSubmittedAt(new Date().toISOString());

      toast.success(
        "Verdict submitted successfully! Thank you for your service. You will be notified when results are available.",
        {
          duration: 6000,
          position: "top-center",
        }
      );
    } catch (err) {
      console.error("Error submitting verdict:", err);
      toast.error(err instanceof Error ? err.message : "Failed to submit verdict", {
        duration: 4000,
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading jury charge questions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-900">Error</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <button
              onClick={loadQuestions}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8">
        <div className="flex flex-col items-center text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mb-4" />
          <h2 className="text-2xl font-bold text-green-900 mb-2">
            Verdict Submitted Successfully
          </h2>
          <p className="text-green-700 mb-4">
            Thank you for your service as a juror in this case.
          </p>
          {submittedAt && (
            <p className="text-sm text-green-600">
              Submitted on {new Date(submittedAt).toLocaleString()}
            </p>
          )}
          <div className="mt-6 bg-white rounded-lg p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">What Happens Next?</h3>
            <ul className="text-left text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Your responses have been securely recorded</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>The admin will review all juror submissions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Once all jurors have submitted, results will be published</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>You will receive a notification when results are available</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Your Responses:</h4>
            <div className="text-left space-y-3">
              {questions.map((question) => (
                <div key={question.QuestionId} className="bg-white rounded p-3">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {question.QuestionText}
                  </p>
                  <p className="text-sm text-gray-700">
                    {responses[question.QuestionId.toString()] || "(No answer)"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Questions Available</h3>
        <p className="text-gray-700">
          The jury charge has not been released yet. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-blue-900 mb-2">Jury Charge - Verdict Form</h2>
        <p className="text-blue-700">
          Please answer all questions carefully. Your responses will be recorded and cannot be
          changed after submission.
        </p>
        <p className="text-sm text-blue-600 mt-2">
          <strong>{questions.filter((q) => q.IsRequired).length}</strong> required questions •{" "}
          <strong>{questions.filter((q) => !q.IsRequired).length}</strong> optional questions
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, index) => (
          <div key={question.QuestionId} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="mb-4">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-sm font-semibold text-blue-600">
                  Question {index + 1}
                </span>
                {question.IsRequired && (
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                    Required
                  </span>
                )}
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                  {question.QuestionType}
                </span>
              </div>
              <p className="text-lg font-medium text-gray-900">{question.QuestionText}</p>
            </div>

            <QuestionInput
              question={question}
              value={responses[question.QuestionId.toString()] || ""}
              onChange={(value) => handleResponseChange(question.QuestionId, value)}
            />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-end sticky bottom-4 bg-white p-4 rounded-lg border border-gray-200 shadow-lg">
        <button
          onClick={handleSaveDraft}
          disabled={saving || submitting}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
        >
          <Send className="w-4 h-4" />
          {submitting ? "Submitting..." : "Submit Verdict"}
        </button>
      </div>
    </div>
  );
}

// ============================================
// QUESTION INPUT COMPONENT
// ============================================

interface QuestionInputProps {
  question: JuryChargeQuestion;
  value: string;
  onChange: (value: string) => void;
}

function QuestionInput({ question, value, onChange }: QuestionInputProps) {
  if (question.QuestionType === "Yes/No") {
    return (
      <div className="space-y-2">
        {["Yes", "No"].map((option) => (
          <label key={option} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name={`question-${question.QuestionId}`}
              value={option}
              checked={value === option}
              onChange={(e) => onChange(e.target.value)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="text-gray-900">{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.QuestionType === "Multiple Choice") {
    // Handle Options as either array (from backend) or string
    const options = question.Options
      ? Array.isArray(question.Options)
        ? question.Options
        : question.Options.split("\n").filter(Boolean)
      : [];
    return (
      <div className="space-y-2">
        {options.map((option, idx) => (
          <label key={idx} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name={`question-${question.QuestionId}`}
              value={option}
              checked={value === option}
              onChange={(e) => onChange(e.target.value)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="text-gray-900">{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.QuestionType === "Numeric Response") {
    return (
      <div>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={question.MinValue}
          max={question.MaxValue}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={`Enter a number${
            question.MinValue !== undefined || question.MaxValue !== undefined
              ? ` (${question.MinValue !== undefined ? `Min: ${question.MinValue}` : ""}${
                  question.MinValue !== undefined && question.MaxValue !== undefined ? ", " : ""
                }${question.MaxValue !== undefined ? `Max: ${question.MaxValue}` : ""})`
              : ""
          }`}
        />
        {(question.MinValue !== undefined || question.MaxValue !== undefined) && (
          <p className="text-xs text-gray-700 mt-1 font-medium">
            {question.MinValue !== undefined && `Minimum: ${question.MinValue}`}
            {question.MinValue !== undefined && question.MaxValue !== undefined && " • "}
            {question.MaxValue !== undefined && `Maximum: ${question.MaxValue}`}
          </p>
        )}
      </div>
    );
  }

  if (question.QuestionType === "Text Response") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        rows={4}
        placeholder="Enter your response here..."
      />
    );
  }

  return null;
}
