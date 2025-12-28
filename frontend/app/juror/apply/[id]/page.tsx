"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  BanknotesIcon,
  CheckCircleIcon,
  BuildingOfficeIcon
} from "@heroicons/react/24/outline";
import { getToken } from "@/lib/apiClient";
import { formatDateString } from "@/lib/dateUtils";
import toast from "react-hot-toast";

const API_BASE = process.env.NEXT_PUBLIC_API_URL 
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

type CaseDetails = {
  CaseId: number;
  CaseTitle: string;
  CaseDescription: string;
  CaseType: string;
  County: string;
  ScheduledDate: string;
  ScheduledTime: string;
  PaymentAmount: number;
  PlaintiffGroups: string;
  DefendantGroups: string;
  VoirDire1Questions: string;
  LawFirmName: string;
  AttorneyName: string;
};

type VoirDirePart2 = {
  Id: number;
  Question: string;
  Response: string;
};

function getCaseName(plaintiffGroups: string, defendantGroups: string) {
  try {
    const plaintiffs = JSON.parse(plaintiffGroups);
    const defendants = JSON.parse(defendantGroups);
    const plaintiffName = plaintiffs[0]?.plaintiffs?.[0]?.name || "Plaintiff";
    const defendantName = defendants[0]?.defendants?.[0]?.name || "Defendant";
    return `${plaintiffName} v. ${defendantName}`;
  } catch {
    return "Case";
  }
}

// Timezone conversion functions
function applyOffsetToUtcTime(utcTime: string, dateString: string, timezoneOffset: string, offsetMinutesMap:number) {
  const offsetMinutes = offsetMinutesMap * 2;
  if (offsetMinutes === null) throw new Error('Invalid timezoneOffset');

  // Build a UTC instant (number of ms since epoch)
  const utcMs = Date.parse(`${dateString}T${utcTime}Z`);
  if (isNaN(utcMs)) throw new Error('Invalid UTC date/time');

  // If timezoneOffset includes '+' subtract offsetMinutes, if '-' add it
  const signChar = timezoneOffset.includes('+') ? '+' : timezoneOffset.includes('-') ? '-' : '+';
  const resultMs = signChar === '+'
    ? utcMs - offsetMinutes * 60_000
    : utcMs + Math.abs(offsetMinutes) * 60_000;

  const resultDate = new Date(resultMs);
  return {
    date: resultDate,
    "12HoursTime": resultDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
    "24HoursTime" : resultDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false })
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
  try {
    if (!timeString) return "";

    const systemTz = getSystemTimezoneInfo();
    let zoneMap  = '';

    // use the formatOffset returned from getSystemTimezoneInfo and ensure offsetMinutes is numeric
    zoneMap = systemTz.formatOffset ? systemTz.formatOffset : "";
    const offsetMinutes = typeof systemTz.offsetMinutes === 'number' ? systemTz.offsetMinutes : 0;

    const dataSystemmap = applyOffsetToUtcTime(timeString, scheduledDate, zoneMap, offsetMinutes);
    return dataSystemmap["24HoursTime"];
  } catch {
    return timeString;
  }
}

export default function JurorApplyPage() {
  const { id } = useParams();
  const caseId = id;
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [voirDire1Questions, setVoirDire1Questions] = useState<string[]>([]);
  const [voirDire2Questions, setVoirDire2Questions] = useState<VoirDirePart2[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (caseId) {
      fetchAllData();
    }
  }, [caseId]);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = getToken();

      // Fetch case details
      const caseResponse = await fetch(`${API_BASE}/api/case/cases/${caseId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!caseResponse.ok) {
        throw new Error("Failed to fetch case details");
      }

      const caseData = await caseResponse.json();
      const caseInfo = caseData.case || caseData;
      setCaseData(caseInfo);

      console.log("📋 Full case data:", caseInfo);

      // ✅ FIXED: Parse VoirDire1Questions (Part 1 - Standard Questions)
      try {
        const vd1Questions = caseInfo.VoirDire1Questions;
        if (Array.isArray(vd1Questions)) {
          setVoirDire1Questions(vd1Questions);
        } else if (typeof vd1Questions === 'string') {
          const parsed = JSON.parse(vd1Questions || "[]");
          setVoirDire1Questions(Array.isArray(parsed) ? parsed : []);
        } else {
          setVoirDire1Questions([]);
        }
        console.log("✅ Part 1 questions loaded:", vd1Questions);
      } catch (err) {
        console.error("Error parsing voir dire part 1:", err);
        setVoirDire1Questions([]);
      }

      // ✅ FIXED: Parse VoirDire2Questions (Part 2 - Custom Questions)
      // These are stored in the Cases table, NOT in WarRoomVoirDire table
      try {
        const vd2Questions = caseInfo.VoirDire2Questions;
        console.log("📋 Raw VoirDire2Questions:", vd2Questions, "Type:", typeof vd2Questions);

        if (Array.isArray(vd2Questions)) {
          // Already an array - map to expected format
          const formatted = vd2Questions.map((q: any, idx: number) => ({
            Id: idx,
            Question: typeof q === 'string' ? q : (q.question || q.Question || ''),
            Response: ''
          }));
          setVoirDire2Questions(formatted);
          console.log("✅ Part 2 questions loaded (array):", formatted);
        } else if (typeof vd2Questions === 'string') {
          // JSON string - parse it
          const parsed = JSON.parse(vd2Questions || "[]");
          const formatted = (Array.isArray(parsed) ? parsed : []).map((q: any, idx: number) => ({
            Id: idx,
            Question: typeof q === 'string' ? q : (q.question || q.Question || ''),
            Response: ''
          }));
          setVoirDire2Questions(formatted);
          console.log("✅ Part 2 questions loaded (parsed):", formatted);
        } else {
          setVoirDire2Questions([]);
          console.log("⚠️ No Part 2 questions found");
        }
      } catch (err) {
        console.error("Error parsing voir dire part 2:", err);
        setVoirDire2Questions([]);
      }

    } catch (error: any) {
      console.error("Error fetching case data:", error);
      setError(error.message || "Failed to load case details");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionIndex: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalQuestions = voirDire1Questions.length + voirDire2Questions.length;
    const answeredQuestions = Object.keys(answers).length;

    if (answeredQuestions < totalQuestions) {
      toast.error("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const token = getToken();

      // Format responses as arrays (backend expects voirDire1Responses and voirDire2Responses)
      const voirDire1Responses = voirDire1Questions.map((q, i) => ({
        question: q,
        answer: answers[`vd1-${i}`] || ""
      }));

      const voirDire2Responses = voirDire2Questions.map((q, i) => ({
        question: q.Question,
        answer: answers[`vd2-${i}`] || ""
      }));

      console.log("📤 Submitting application:", {
        caseId,
        voirDire1Count: voirDire1Responses.length,
        voirDire2Count: voirDire2Responses.length
      });

      // ✅ FIXED: Correct endpoint is /api/juror/applications (not /apply)
      const response = await fetch(`${API_BASE}/api/juror/applications`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          caseId: parseInt(caseId as string),
          voirDire1Responses,
          voirDire2Responses
        })
      });

      const responseData = await response.json();
      console.log("📥 Application response:", responseData);

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || "Failed to submit application");
      }

      toast.success("Application submitted successfully!");
      router.push("/juror");
    } catch (error: any) {
      console.error("Error submitting application:", error);
      toast.error(error.message || "Failed to submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#FAF9F6] to-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-[#0C2D57]"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-[#0C2D57] rounded-full opacity-20 animate-pulse"></div>
            </div>
          </div>
          <span className="mt-6 text-lg text-[#0C2D57] font-semibold animate-pulse">Loading case details...</span>
        </div>
      </main>
    );
  }

  if (error || !caseData) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#FAF9F6] to-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border border-red-100">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error || "Case not found"}</p>
          <button
            onClick={() => router.push("/juror")}
            className="bg-[#0C2D57] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#0a2347] transition-all shadow-md hover:shadow-lg"
          >
            Back to Job Board
          </button>
        </div>
      </main>
    );
  }

  const caseName = getCaseName(caseData.PlaintiffGroups, caseData.DefendantGroups);
  const trialDate = formatDateString(caseData.ScheduledDate, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const totalQuestions = voirDire1Questions.length + voirDire2Questions.length;
  const answeredQuestions = Object.keys(answers).length;
  const progress = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FAF9F6] to-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header with Back Button */}
        <button
          onClick={() => router.push("/juror")}
          className="group flex items-center text-[#0C2D57] hover:text-[#0a2347] mb-6 font-semibold transition-all"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Job Board</span>
        </button>

        {/* Case Info Card - NO LONGER STICKY */}
        <div className="bg-gradient-to-r from-[#0C2D57] to-[#1a4d8f] rounded-2xl shadow-2xl p-6 mb-8 text-white">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold text-green-200 uppercase tracking-wide">Open for Application</span>
              </div>
              <h1 className="text-3xl font-bold mb-2">{caseName}</h1>
              <div className="flex items-center gap-2 text-blue-100">
                <BuildingOfficeIcon className="w-5 h-5" />
                <p className="font-medium">{caseData.LawFirmName}</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20">
              <div className="text-center">
                <p className="text-xs text-blue-200 mb-1">Compensation</p>
                <p className="text-2xl font-bold text-green-300">${caseData.PaymentAmount}</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-blue-200">Trial Date</p>
                <p className="font-semibold text-sm">{trialDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-blue-200">Time</p>
                <p className="font-semibold text-sm">{formatTime(caseData.ScheduledTime, caseData.ScheduledDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <MapPinIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-blue-200">Location</p>
                <p className="font-semibold text-sm">{caseData.County}</p>
              </div>
            </div>
          </div>

          {caseData.CaseDescription && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-sm text-blue-100 leading-relaxed">{caseData.CaseDescription}</p>
            </div>
          )}
        </div>

        {/* Progress Bar - NOW STICKY! */}
        <div className="bg-white rounded-xl shadow-lg p-5 mb-6 sticky top-4 z-10 border-2 border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#0C2D57] to-[#1a4d8f] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-bold text-gray-900">Application Progress</span>
                <p className="text-xs text-gray-600">Answer all questions to submit</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-[#0C2D57]">{answeredQuestions}</span>
              <span className="text-gray-400 font-medium">/</span>
              <span className="text-lg font-semibold text-gray-600">{totalQuestions}</span>
            </div>
          </div>
          <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#0C2D57] via-blue-600 to-[#1a4d8f] rounded-full transition-all duration-500 ease-out shadow-md"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-gray-700 drop-shadow-sm">{Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        {/* Application Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-[#0C2D57] to-[#1a4d8f] rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#0C2D57]">Voir Dire Questionnaire</h2>
                <p className="text-sm text-gray-600">Please answer all questions honestly to help the attorney evaluate your eligibility</p>
              </div>
            </div>

            {/* Part 1 Questions */}
            {voirDire1Questions.length > 0 && (
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-500 text-white rounded-full font-bold text-lg shadow-md">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0C2D57]">Standard Qualification Questions</h3>
                    <p className="text-sm text-gray-600">General questions to assess your eligibility as a juror</p>
                  </div>
                </div>
                <div className="space-y-5">
                  {voirDire1Questions.map((question, index) => (
                    <div 
                      key={`vd1-${index}`} 
                      className={`group p-5 rounded-xl border-2 transition-all ${
                        answers[`vd1-${index}`] 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-gray-200 hover:border-blue-300 bg-white hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <label className="block text-gray-800 font-semibold mb-4 leading-relaxed text-base">
                            {question}
                          </label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-3 cursor-pointer group/radio">
                              <div className="relative">
                                <input
                                  type="radio"
                                  name={`vd1-${index}`}
                                  value="Yes"
                                  checked={answers[`vd1-${index}`] === "Yes"}
                                  onChange={(e) => handleAnswerChange(`vd1-${index}`, e.target.value)}
                                  required
                                  className="w-5 h-5 text-[#0C2D57] border-2 border-gray-300 focus:ring-2 focus:ring-[#0C2D57] focus:ring-offset-2 cursor-pointer"
                                />
                              </div>
                              <span className="text-gray-700 font-medium group-hover/radio:text-[#0C2D57] transition-colors">Yes</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group/radio">
                              <div className="relative">
                                <input
                                  type="radio"
                                  name={`vd1-${index}`}
                                  value="No"
                                  checked={answers[`vd1-${index}`] === "No"}
                                  onChange={(e) => handleAnswerChange(`vd1-${index}`, e.target.value)}
                                  required
                                  className="w-5 h-5 text-[#0C2D57] border-2 border-gray-300 focus:ring-2 focus:ring-[#0C2D57] focus:ring-offset-2 cursor-pointer"
                                />
                              </div>
                              <span className="text-gray-700 font-medium group-hover/radio:text-[#0C2D57] transition-colors">No</span>
                            </label>
                          </div>
                        </div>
                        {answers[`vd1-${index}`] && (
                          <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Part 2 Questions */}
            {voirDire2Questions.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center w-10 h-10 bg-purple-500 text-white rounded-full font-bold text-lg shadow-md">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0C2D57]">Case-Specific Questions</h3>
                    <p className="text-sm text-gray-600">Questions specific to this particular case</p>
                  </div>
                </div>
                <div className="space-y-5">
                  {voirDire2Questions.map((item, index) => (
                    <div 
                      key={`vd2-${index}`} 
                      className={`group p-5 rounded-xl border-2 transition-all ${
                        answers[`vd2-${index}`] 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-gray-200 hover:border-purple-300 bg-white hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-sm">
                          {voirDire1Questions.length + index + 1}
                        </div>
                        <div className="flex-1">
                          <label className="block text-gray-800 font-semibold mb-4 leading-relaxed text-base">
                            {item.Question}
                          </label>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-3 cursor-pointer group/radio">
                              <div className="relative">
                                <input
                                  type="radio"
                                  name={`vd2-${index}`}
                                  value="Yes"
                                  checked={answers[`vd2-${index}`] === "Yes"}
                                  onChange={(e) => handleAnswerChange(`vd2-${index}`, e.target.value)}
                                  required
                                  className="w-5 h-5 text-[#0C2D57] border-2 border-gray-300 focus:ring-2 focus:ring-[#0C2D57] focus:ring-offset-2 cursor-pointer"
                                />
                              </div>
                              <span className="text-gray-700 font-medium group-hover/radio:text-[#0C2D57] transition-colors">Yes</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group/radio">
                              <div className="relative">
                                <input
                                  type="radio"
                                  name={`vd2-${index}`}
                                  value="No"
                                  checked={answers[`vd2-${index}`] === "No"}
                                  onChange={(e) => handleAnswerChange(`vd2-${index}`, e.target.value)}
                                  required
                                  className="w-5 h-5 text-[#0C2D57] border-2 border-gray-300 focus:ring-2 focus:ring-[#0C2D57] focus:ring-offset-2 cursor-pointer"
                                />
                              </div>
                              <span className="text-gray-700 font-medium group-hover/radio:text-[#0C2D57] transition-colors">No</span>
                            </label>
                          </div>
                        </div>
                        {answers[`vd2-${index}`] && (
                          <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {voirDire1Questions.length === 0 && voirDire2Questions.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No voir dire questions available for this case.</p>
              </div>
            )}
          </div>

          {/* Submit Section */}
          <div className="bg-gradient-to-r from-white to-gray-50 rounded-2xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-lg">Ready to submit?</p>
                  <p className="text-sm text-gray-600">Review your answers before submitting your application</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/juror")}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-gradient-to-r from-[#0C2D57] to-[#1a4d8f] text-white rounded-lg font-bold hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={submitting || progress < 100}
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Application</span>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
            {progress < 100 && (
              <p className="text-sm text-amber-600 mt-3 font-medium">⚠️ Please answer all questions before submitting</p>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}