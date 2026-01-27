"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, GripVertical, Save, X, AlertCircle, Lock } from "lucide-react";
import toast from "react-hot-toast";

// API Base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : '';

// ============================================
// TYPES
// ============================================

interface JuryChargeQuestion {
  QuestionId: number;
  CaseId: number;
  QuestionText: string;
  QuestionType: "Multiple Choice" | "Yes/No" | "Text Response" | "Numeric Response";
  Options: string[] | string; // Can be array from backend or string from form
  OrderIndex: number;
  IsRequired: boolean;
  MinValue?: number;
  MaxValue?: number;
}

interface JuryChargeBuilderProps {
  caseId: number;
  isLocked: boolean;
  onLockStatusChange?: (isLocked: boolean) => void;
}

// ============================================
// JURY CHARGE BUILDER COMPONENT
// ============================================

export default function JuryChargeBuilder({
  caseId,
  isLocked: initialLockStatus,
  onLockStatusChange,
}: JuryChargeBuilderProps) {
  const [questions, setQuestions] = useState<JuryChargeQuestion[]>([]);
  const [isLocked, setIsLocked] = useState(initialLockStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // State for adding multiple questions at once
  const [newQuestions, setNewQuestions] = useState<Array<{
    QuestionText: string;
    QuestionType: JuryChargeQuestion["QuestionType"];
    Options: string;
    IsRequired: boolean;
    MinValue?: number;
    MaxValue?: number;
  }>>([]);

  // Form state for editing existing question
  const [formData, setFormData] = useState({
    QuestionText: "",
    QuestionType: "Multiple Choice" as JuryChargeQuestion["QuestionType"],
    Options: "",
    IsRequired: true,
    MinValue: undefined as number | undefined,
    MaxValue: undefined as number | undefined,
  });

  // ============================================
  // LOAD QUESTIONS
  // ============================================

  useEffect(() => {
    loadQuestions();
    checkLockStatus();
  }, [caseId]);

  async function loadQuestions() {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/jury-charge/questions/${caseId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load questions");
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

  async function checkLockStatus() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/jury-charge/status/${caseId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const locked = data.isLocked || false;
        setIsLocked(locked);
        if (onLockStatusChange) {
          onLockStatusChange(locked);
        }
      }
    } catch (err) {
      console.error("Error checking lock status:", err);
    }
  }

  // ============================================
  // ADD QUESTIONS (Multiple at Once)
  // ============================================

  function handleAddAnother() {
    setNewQuestions([...newQuestions, {
      QuestionText: "",
      QuestionType: "Multiple Choice",
      Options: "",
      IsRequired: true,
      MinValue: undefined,
      MaxValue: undefined,
    }]);
  }

  function handleRemoveQuestion(index: number) {
    setNewQuestions(newQuestions.filter((_, i) => i !== index));
  }

  function updateNewQuestion(index: number, field: string, value: any) {
    const updated = [...newQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setNewQuestions(updated);
  }

  async function handleSaveAllQuestions() {
    // Validate at least one question has text
    const validQuestions = newQuestions.filter(q => q.QuestionText.trim());

    if (validQuestions.length === 0) {
      toast.error("Please add at least one question with text");
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      let successCount = 0;
      let failCount = 0;

      // Add each question one by one
      for (const question of validQuestions) {
        try {
          // Convert options string to array for Multiple Choice
          let optionsArray = null;
          if (question.QuestionType === "Multiple Choice" && question.Options) {
            optionsArray = question.Options.split("\n").map(o => o.trim()).filter(Boolean);
          }

          const payload = {
            caseId,
            questionText: question.QuestionText.trim(),
            questionType: question.QuestionType,
            options: optionsArray,
            isRequired: question.IsRequired,
            minValue: question.MinValue,
            maxValue: question.MaxValue,
          };

          const response = await fetch(`${API_BASE}/api/jury-charge/questions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            const errorMsg = errorData.message || errorData.error || 'Unknown error';
            console.error(`Failed to add question: ${question.QuestionText}`, errorMsg);
            toast.error(`Failed to add question: ${errorMsg}`);
          }
        } catch (err) {
          failCount++;
          console.error(`Error adding question: ${question.QuestionText}`, err);
        }
      }

      // Reload questions
      await loadQuestions();

      // Show results and reset
      if (successCount > 0) {
        toast.success(`Successfully added ${successCount} question(s)${failCount > 0 ? `. Failed: ${failCount}` : ''}`);
        setNewQuestions([]);
        setShowAddForm(false);
      } else {
        toast.error("Failed to add questions. Please try again.");
      }
    } catch (err) {
      console.error("Error saving questions:", err);
      toast.error("Failed to save questions. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ============================================
  // UPDATE QUESTION
  // ============================================

  async function handleUpdateQuestion(questionId: number) {
    if (!formData.QuestionText.trim()) {
      alert("Question text is required");
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("token");

      // Convert options string to array for Multiple Choice
      let optionsArray = null;
      if (formData.QuestionType === "Multiple Choice" && formData.Options) {
        optionsArray = formData.Options.split("\n").map(o => o.trim()).filter(Boolean);
      }

      const payload = {
        questionText: formData.QuestionText,
        questionType: formData.QuestionType,
        options: optionsArray,
        isRequired: formData.IsRequired,
        minValue: formData.MinValue,
        maxValue: formData.MaxValue,
      };

      const response = await fetch(`${API_BASE}/api/jury-charge/questions/${questionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update question");
      }

      // Reload questions
      await loadQuestions();

      // Reset editing state
      setEditingId(null);
      resetForm();
    } catch (err) {
      console.error("Error updating question:", err);
      alert(err instanceof Error ? err.message : "Failed to update question");
    } finally {
      setSaving(false);
    }
  }

  // ============================================
  // DELETE QUESTION
  // ============================================

  async function handleDeleteQuestion(questionId: number) {
    if (!confirm("Are you sure you want to delete this question?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE}/api/jury-charge/questions/${questionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete question");
      }

      // Reload questions
      await loadQuestions();
    } catch (err) {
      console.error("Error deleting question:", err);
      alert(err instanceof Error ? err.message : "Failed to delete question");
    }
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  function resetForm() {
    setFormData({
      QuestionText: "",
      QuestionType: "Multiple Choice",
      Options: "",
      IsRequired: true,
      MinValue: undefined,
      MaxValue: undefined,
    });
  }

  function startEdit(question: JuryChargeQuestion) {
    setEditingId(question.QuestionId);

    // Convert Options array to newline-separated string for editing
    let optionsString = "";
    if (question.Options) {
      if (Array.isArray(question.Options)) {
        optionsString = question.Options.join("\n");
      } else {
        optionsString = question.Options;
      }
    }

    setFormData({
      QuestionText: question.QuestionText,
      QuestionType: question.QuestionType,
      Options: optionsString,
      IsRequired: question.IsRequired,
      MinValue: question.MinValue,
      MaxValue: question.MaxValue,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    resetForm();
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

  return (
    <div className="bg-white rounded-lg shadow border border-[#C6CDD9] overflow-hidden">
      {/* Header */}
      <div className="relative p-5" style={{ backgroundColor: "#16305B" }}>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Jury Charge Builder</h2>
              <p className="text-sm text-white/80 mt-0.5">
                {isLocked ? (
                  <span className="flex items-center">
                    <Lock className="w-3 h-3 mr-1" />
                    Locked - Released to jurors (cannot edit)
                  </span>
                ) : (
                  "Build custom Instructions and Questions for Jurors."
                )}
              </p>
            </div>
          </div>

          {!isLocked && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (showAddForm) {
                    setShowAddForm(false);
                    setNewQuestions([]);
                  } else {
                    setShowAddForm(true);
                    setNewQuestions([{
                      QuestionText: "",
                      QuestionType: "Multiple Choice",
                      Options: "",
                      IsRequired: true,
                      MinValue: undefined,
                      MaxValue: undefined,
                    }]);
                  }
                }}
                disabled={isLocked}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Questions
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-5 space-y-6">

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Add Multiple Questions Form */}
      {showAddForm && !isLocked && (
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 border-2 border-blue-300 rounded-2xl p-6 space-y-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-gray-900">Add Jury Charge Questions</h3>
              <p className="text-sm text-gray-700 font-medium mt-1">
                Add one or multiple questions. Click "Add Another" to add more questions, then "Save All" when done.
              </p>
            </div>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewQuestions([]);
              }}
              className="p-2 hover:bg-blue-100 rounded-lg transition"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Questions List */}
          <div className="space-y-5">
            {newQuestions.map((question, index) => (
              <div key={index} className="bg-white rounded-xl p-5 border-2 border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-bold">
                    Question {index + 1}
                  </span>
                  {newQuestions.length > 1 && (
                    <button
                      onClick={() => handleRemoveQuestion(index)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Question Text */}
                <div className="space-y-2 mb-4">
                  <label className="block text-sm font-bold text-gray-900">
                    Question Text <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    value={question.QuestionText}
                    onChange={(e) => updateNewQuestion(index, "QuestionText", e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium text-base"
                    rows={2}
                    placeholder="Enter your question here..."
                  />
                </div>

                {/* Question Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Question Type
                    </label>
                    <select
                      value={question.QuestionType}
                      onChange={(e) => updateNewQuestion(index, "QuestionType", e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                    >
                      <option value="Multiple Choice">Multiple Choice</option>
                      <option value="Yes/No">Yes/No</option>
                      <option value="Text Response">Text Response</option>
                      <option value="Numeric Response">Numeric Response</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={question.IsRequired}
                        onChange={(e) => updateNewQuestion(index, "IsRequired", e.target.checked)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-bold text-gray-900">Required Question</span>
                    </label>
                  </div>
                </div>

                {/* Options for Multiple Choice */}
                {question.QuestionType === "Multiple Choice" && (
                  <div className="mt-4">
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      Answer Options (one per line)
                    </label>
                    <textarea
                      value={question.Options}
                      onChange={(e) => updateNewQuestion(index, "Options", e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                      rows={3}
                      placeholder="Option A&#10;Option B&#10;Option C"
                    />
                  </div>
                )}

                {/* Min/Max for Numeric */}
                {question.QuestionType === "Numeric Response" && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Min Value</label>
                      <input
                        type="number"
                        value={question.MinValue || ""}
                        onChange={(e) => updateNewQuestion(index, "MinValue", e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                        placeholder="Minimum"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Max Value</label>
                      <input
                        type="number"
                        value={question.MaxValue || ""}
                        onChange={(e) => updateNewQuestion(index, "MaxValue", e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                        placeholder="Maximum"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t-2 border-blue-200">
            <button
              onClick={handleAddAnother}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-blue-600 text-blue-700 rounded-xl font-bold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              <Plus className="w-5 h-5" />
              Add Another Question
            </button>

            <button
              onClick={handleSaveAllQuestions}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save All Questions ({newQuestions.length})
                </>
              )}
            </button>

            <button
              onClick={() => {
                setShowAddForm(false);
                setNewQuestions([]);
              }}
              disabled={saving}
              className="px-5 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-gray-800 text-lg font-semibold">No questions yet</p>
            <p className="text-gray-600 text-sm mt-2">
              Click "Add Question" or "Bulk Add Questions" to create your jury charge questions
            </p>
          </div>
        ) : (
          questions.map((question, index) => (
            <QuestionCard
              key={question.QuestionId}
              question={question}
              index={index}
              isEditing={editingId === question.QuestionId}
              isLocked={isLocked}
              formData={formData}
              setFormData={setFormData}
              onEdit={() => startEdit(question)}
              onSave={() => handleUpdateQuestion(question.QuestionId)}
              onCancel={cancelEdit}
              onDelete={() => handleDeleteQuestion(question.QuestionId)}
              saving={saving}
            />
          ))
        )}
      </div>

      {/* Footer Info */}
      {questions.length > 0 && !isLocked && (
        <div className="bg-[#FAF9F6] border border-[#C6CDD9] rounded-lg p-4">
          <p className="text-sm text-[#0A2342] font-semibold">
            Total Questions: {questions.length}
          </p>
          <p className="text-xs text-[#455A7C] mt-1.5">
            💡 Tip: You can continue editing questions until the admin releases them to jurors.
            Once released, all questions become locked and cannot be modified.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}

// ============================================
// QUESTION FORM COMPONENT
// ============================================

interface QuestionFormProps {
  formData: any;
  setFormData: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  title: string;
}

function QuestionForm({
  formData,
  setFormData,
  onSave,
  onCancel,
  saving,
  title,
}: QuestionFormProps) {
  const questionTypes: JuryChargeQuestion["QuestionType"][] = [
    "Multiple Choice",
    "Yes/No",
    "Text Response",
    "Numeric Response",
  ];

  return (
    <div className="bg-white border-2 border-blue-300 rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

      {/* Question Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Question Text <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.QuestionText}
          onChange={(e) =>
            setFormData({ ...formData, QuestionText: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Enter your question here..."
        />
      </div>

      {/* Question Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Question Type
        </label>
        <select
          value={formData.QuestionType}
          onChange={(e) =>
            setFormData({
              ...formData,
              QuestionType: e.target.value as JuryChargeQuestion["QuestionType"],
            })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {questionTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Options (for Multiple Choice) */}
      {formData.QuestionType === "Multiple Choice" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Options (one per line)
          </label>
          <textarea
            value={formData.Options}
            onChange={(e) => setFormData({ ...formData, Options: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            placeholder="Option 1&#10;Option 2&#10;Option 3"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter each option on a new line
          </p>
        </div>
      )}

      {/* Min/Max Values (for Numeric Response) */}
      {formData.QuestionType === "Numeric Response" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Value (optional)
            </label>
            <input
              type="number"
              value={formData.MinValue || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  MinValue: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Min"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Value (optional)
            </label>
            <input
              type="number"
              value={formData.MaxValue || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  MaxValue: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Max"
            />
          </div>
        </div>
      )}

      {/* Is Required */}
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={formData.IsRequired}
          onChange={(e) =>
            setFormData({ ...formData, IsRequired: e.target.checked })
          }
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label className="ml-2 text-sm text-gray-700">
          This question is required
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Question"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================
// QUESTION CARD COMPONENT
// ============================================

interface QuestionCardProps {
  question: JuryChargeQuestion;
  index: number;
  isEditing: boolean;
  isLocked: boolean;
  formData: any;
  setFormData: (data: any) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  saving: boolean;
}

function QuestionCard({
  question,
  index,
  isEditing,
  isLocked,
  formData,
  setFormData,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  saving,
}: QuestionCardProps) {
  if (isEditing) {
    return (
      <QuestionForm
        formData={formData}
        setFormData={setFormData}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
        title={`Edit Question #${index + 1}`}
      />
    );
  }

  // Handle Options as either array (from backend) or string (from form)
  const options = question.Options
    ? Array.isArray(question.Options)
      ? question.Options
      : question.Options.split("\n").filter(Boolean)
    : [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-blue-600">
              Question #{index + 1}
            </span>
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
              {question.QuestionType}
            </span>
            {question.IsRequired && (
              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                Required
              </span>
            )}
            {isLocked && (
              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            )}
          </div>

          <p className="text-gray-900 font-medium">{question.QuestionText}</p>

          {/* Show options for Multiple Choice */}
          {question.QuestionType === "Multiple Choice" && options.length > 0 && (
            <ul className="mt-3 space-y-1">
              {options.map((option, idx) => (
                <li key={idx} className="text-sm text-gray-800 font-medium flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {option}
                </li>
              ))}
            </ul>
          )}

          {/* Show min/max for Numeric Response */}
          {question.QuestionType === "Numeric Response" && (
            <div className="mt-2 text-sm text-gray-800 font-medium">
              {question.MinValue !== undefined && (
                <span>Min: {question.MinValue}</span>
              )}
              {question.MinValue !== undefined && question.MaxValue !== undefined && (
                <span className="mx-2">•</span>
              )}
              {question.MaxValue !== undefined && (
                <span>Max: {question.MaxValue}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isLocked && (
          <div className="flex gap-2 ml-4">
            <button
              onClick={onEdit}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
