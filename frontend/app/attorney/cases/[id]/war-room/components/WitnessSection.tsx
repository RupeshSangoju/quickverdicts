"use client";

import { useState, useEffect } from "react";
import {
  PlusIcon,
  TrashIcon,
  UserIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  UserGroupIcon,
  ScaleIcon
} from "@heroicons/react/24/outline";

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

type Witness = {
  WitnessId?: number;
  name: string;
  side: "Plaintiff" | "Defendant";
  description: string;
};

export default function WitnessSection({ caseId }: { caseId: string }) {
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchWitnesses();
  }, [caseId]);

  const fetchWitnesses = async () => {
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/api/case/${caseId}/witnesses`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.witnesses.length > 0) {
          setWitnesses(
            data.witnesses.map((w: any) => ({
              WitnessId: w.WitnessId,
              name: w.WitnessName,
              side: w.Side,
              description: w.Description || "",
            }))
          );
        }
      }
    } catch (error) {
      console.error("Error fetching witnesses:", error);
    }
  };

  const addWitness = () => {
    setWitnesses([
      ...witnesses,
      { name: "", side: "Plaintiff", description: "" },
    ]);
    setShowAddForm(true);
  };

  const removeWitness = (index: number) => {
    setWitnesses(witnesses.filter((_, i) => i !== index));
  };

  const updateWitness = (index: number, field: keyof Witness, value: string) => {
    const updated = [...witnesses];
    updated[index] = { ...updated[index], [field]: value };
    setWitnesses(updated);
  };

  const saveWitnesses = async () => {
    // Validate
    const hasEmpty = witnesses.some((w) => !w.name.trim());
    if (hasEmpty) {
      setError("Please fill in all witness names before saving");
      return;
    }

    setLoading(true);
    setSaved(false);
    setError("");

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/case/${caseId}/witnesses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ witnesses }),
      });

      if (response.ok) {
        setSaved(true);
        setShowAddForm(false);
        fetchWitnesses();

        // ✅ TRIGGER ADMIN REFRESH: Notify admin dashboard to update witness counts
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('witness-updated', {
            detail: { caseId: caseId }
          }));
          console.log('👤 Dispatched witness-updated event for admin dashboard refresh');
        }

        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await response.json();
        setError(data.message || "Failed to save witnesses");
      }
    } catch (error) {
      console.error("Error saving witnesses:", error);
      setError("Failed to save witnesses");
    } finally {
      setLoading(false);
    }
  };

  const plaintiffWitnesses = witnesses.filter((w) => w.side === "Plaintiff");
  const defendantWitnesses = witnesses.filter((w) => w.side === "Defendant");

  return (
    <div className="bg-white rounded-lg shadow border border-[#C6CDD9] overflow-hidden">
      {/* Header */}
      <div className="relative p-5" style={{ backgroundColor: "#16305B" }}>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <ScaleIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Witnesses</h2>
              <p className="text-sm text-white/80 mt-0.5">
                Credibility evaluation for trial witnesses
              </p>
            </div>
          </div>
          <button
            onClick={addWitness}
            disabled={loading}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold text-sm transition-all flex items-center gap-1.5"
          >
            <PlusIcon className="w-4 h-4" />
            Add Witness
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <ExclamationCircleIcon className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-red-900 font-semibold text-sm">Error</p>
              <p className="text-red-700 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {saved && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-green-900 font-semibold text-sm">Success!</p>
              <p className="text-green-700 text-xs mt-0.5">Witnesses saved successfully</p>
            </div>
          </div>
        )}

        {witnesses.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-[#16305B]/10 rounded-full mb-3">
              <UserGroupIcon className="w-6 h-6 text-[#16305B]" />
            </div>
            <p className="text-[#455A7C] font-semibold text-sm mb-1">No Witnesses Added Yet</p>
            <p className="text-[#455A7C] text-xs">
              Click "Add Witness" to add witnesses for credibility evaluation
            </p>
          </div>
        ) : (
          <>
            {/* Plaintiff Witnesses */}
            {plaintiffWitnesses.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-6 w-1 bg-[#16305B] rounded-full"></div>
                  <h3 className="text-base font-semibold text-[#0A2342]">Plaintiff Witnesses</h3>
                  <span className="px-2 py-0.5 bg-[#FAF9F6] text-[#455A7C] rounded text-xs font-semibold">
                    {plaintiffWitnesses.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {plaintiffWitnesses.map((witness, index) => {
                    const actualIndex = witnesses.indexOf(witness);
                    return (
                      <div
                        key={actualIndex}
                        className="bg-white rounded-lg p-4 border border-[#C6CDD9] hover:border-[#16305B] transition-all"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-[#16305B]/10 rounded">
                                <UserIcon className="w-4 h-4 text-[#16305B]" />
                              </div>
                              <div>
                                <span className="px-2 py-0.5 bg-[#FAF9F6] rounded text-xs font-semibold text-[#455A7C]">
                                  Plaintiff
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => removeWitness(actualIndex)}
                              className="p-1.5 hover:bg-red-50 rounded transition-colors"
                            >
                              <TrashIcon className="w-4 h-4 text-red-600" />
                            </button>
                          </div>

                          {!witness.WitnessId ? (
                            <>
                              <input
                                type="text"
                                value={witness.name}
                                onChange={(e) => updateWitness(actualIndex, "name", e.target.value)}
                                className="w-full px-3 py-2 border border-[#C6CDD9] rounded-lg focus:ring-1 focus:ring-[#16305B] focus:border-[#16305B] bg-white text-[#0A2342] placeholder:text-gray-500 font-semibold text-sm"
                                placeholder="Witness Name *"
                              />
                              <div>
                                <label className="block text-xs font-semibold text-[#455A7C] mb-1.5 uppercase tracking-wide">
                                  Witness Side
                                </label>
                                <select
                                  value={witness.side}
                                  onChange={(e) => updateWitness(actualIndex, "side", e.target.value)}
                                  className="w-full px-3 py-2 border border-[#C6CDD9] rounded-lg focus:ring-1 focus:ring-[#16305B] focus:border-[#16305B] bg-white text-[#0A2342] font-medium text-sm"
                                >
                                  <option value="Plaintiff">Plaintiff Witness</option>
                                  <option value="Defendant">Defendant Witness</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-[#455A7C] mb-1.5 uppercase tracking-wide">
                                  Description / Role
                                </label>
                                <textarea
                                  value={witness.description}
                                  onChange={(e) => updateWitness(actualIndex, "description", e.target.value)}
                                  className="w-full px-3 py-2 border border-[#C6CDD9] rounded-lg focus:ring-1 focus:ring-[#16305B] focus:border-[#16305B] bg-white text-[#0A2342] placeholder:text-gray-500 text-sm"
                                  placeholder="Brief description of witness testimony or role"
                                  rows={3}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <h4 className="font-semibold text-[#0A2342] text-sm">{witness.name}</h4>
                              {witness.description && (
                                <div className="bg-[#FAF9F6] rounded-lg p-3 border-l-2 border-[#16305B]">
                                  <p className="text-sm text-[#455A7C]">{witness.description}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Defendant Witnesses */}
            {defendantWitnesses.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-6 w-1 bg-[#16305B] rounded-full"></div>
                  <h3 className="text-base font-semibold text-[#0A2342]">Defendant Witnesses</h3>
                  <span className="px-2 py-0.5 bg-[#FAF9F6] text-[#455A7C] rounded text-xs font-semibold">
                    {defendantWitnesses.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {defendantWitnesses.map((witness, index) => {
                    const actualIndex = witnesses.indexOf(witness);
                    return (
                      <div
                        key={actualIndex}
                        className="bg-white rounded-lg p-4 border border-[#C6CDD9] hover:border-[#16305B] transition-all"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-[#16305B]/10 rounded">
                                <UserIcon className="w-4 h-4 text-[#16305B]" />
                              </div>
                              <div>
                                <span className="px-2 py-0.5 bg-[#FAF9F6] rounded text-xs font-semibold text-[#455A7C]">
                                  Defendant
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => removeWitness(actualIndex)}
                              className="p-1.5 hover:bg-red-50 rounded transition-colors"
                            >
                              <TrashIcon className="w-4 h-4 text-red-600" />
                            </button>
                          </div>

                          {!witness.WitnessId ? (
                            <>
                              <input
                                type="text"
                                value={witness.name}
                                onChange={(e) => updateWitness(actualIndex, "name", e.target.value)}
                                className="w-full px-3 py-2 border border-[#C6CDD9] rounded-lg focus:ring-1 focus:ring-[#16305B] focus:border-[#16305B] bg-white text-[#0A2342] placeholder:text-gray-500 font-semibold text-sm"
                                placeholder="Witness Name *"
                              />
                              <div>
                                <label className="block text-xs font-semibold text-[#455A7C] mb-1.5 uppercase tracking-wide">
                                  Witness Side
                                </label>
                                <select
                                  value={witness.side}
                                  onChange={(e) => updateWitness(actualIndex, "side", e.target.value)}
                                  className="w-full px-3 py-2 border border-[#C6CDD9] rounded-lg focus:ring-1 focus:ring-[#16305B] focus:border-[#16305B] bg-white text-[#0A2342] font-medium text-sm"
                                >
                                  <option value="Plaintiff">Plaintiff Witness</option>
                                  <option value="Defendant">Defendant Witness</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-[#455A7C] mb-1.5 uppercase tracking-wide">
                                  Description / Role
                                </label>
                                <textarea
                                  value={witness.description}
                                  onChange={(e) => updateWitness(actualIndex, "description", e.target.value)}
                                  className="w-full px-3 py-2 border border-[#C6CDD9] rounded-lg focus:ring-1 focus:ring-[#16305B] focus:border-[#16305B] bg-white text-[#0A2342] placeholder:text-gray-500 text-sm"
                                  placeholder="Brief description of witness testimony or role"
                                  rows={3}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <h4 className="font-semibold text-[#0A2342] text-sm">{witness.name}</h4>
                              {witness.description && (
                                <div className="bg-[#FAF9F6] rounded-lg p-3 border-l-2 border-[#16305B]">
                                  <p className="text-sm text-[#455A7C]">{witness.description}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save Button */}
            {!witnesses.every(w => w.WitnessId) && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#C6CDD9]">
                <p className="text-xs text-[#455A7C] font-semibold">
                  {witnesses.filter(w => !w.WitnessId).length} unsaved witness{witnesses.filter(w => !w.WitnessId).length !== 1 ? 'es' : ''}
                </p>
                <button
                  onClick={saveWitnesses}
                  disabled={loading || witnesses.length === 0}
                  className="px-4 py-2 bg-[#16305B] text-white rounded-lg font-semibold text-sm hover:bg-[#1e417a] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>Save All Witnesses</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
