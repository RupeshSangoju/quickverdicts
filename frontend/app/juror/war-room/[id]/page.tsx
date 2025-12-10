"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, EyeIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { getToken, getUser } from "@/lib/apiClient";
import { formatDateString } from "@/lib/dateUtils";
import JurorVerdictForm from "../../cases/[id]/components/JurorVerdictForm";
import { useWebSocket } from "@/hooks/useWebSocket";
import toast from "react-hot-toast";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

type CaseData = {
  CaseId: number;
  CaseTitle: string;
  CaseDescription: string;
  PlaintiffGroups: string;
  DefendantGroups: string;
  ScheduledDate: string;
  ScheduledTime: string;
  County: string;
  CaseType: string;
};

type Document = {
  Id: number;
  FileName: string;
  Description: string;
  FileUrl: string;
};

type Witness = {
  WitnessId: number;
  WitnessName: string;
  Side: string;
  Description: string;
};

type TeamMember = {
  Name: string;
  Role: string;
  Email: string;
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

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export default function JurorWarRoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const caseId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const { socket, isConnected, joinRoom, on, off } = useWebSocket();

  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [juryChargeReleased, setJuryChargeReleased] = useState(false);
  const [juryChargeLoading, setJuryChargeLoading] = useState(true);
  const [jurorId, setJurorId] = useState<number | null>(null);

  // Get jurorId from localStorage
  useEffect(() => {
    const user = getUser();
    if (user?.type === 'juror' && user?.id) {
      setJurorId(user.id);
    }
  }, []);

  // Fetch jury charge status
  useEffect(() => {
    if (!caseId) return;

    const checkJuryChargeStatus = async () => {
      try {
        setJuryChargeLoading(true);
        const token = getToken();
        const response = await fetch(`${API_BASE}/api/jury-charge/status/${caseId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.warn(`Jury charge status check failed: ${response.status}`);
          setJuryChargeReleased(false);
          return;
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.warn("Jury charge status response is not JSON");
          setJuryChargeReleased(false);
          return;
        }

        const data = await response.json();
        // isLocked means the jury charge has been released to jurors
        setJuryChargeReleased(data.isLocked || false);
      } catch (err) {
        console.error("Error checking jury charge status:", err);
        setJuryChargeReleased(false);
      } finally {
        setJuryChargeLoading(false);
      }
    };

    checkJuryChargeStatus();
  }, [caseId]);

  useEffect(() => {
    if (!caseId) return;

    const fetchWarRoomData = async () => {
      try {
        const token = getToken();
        const headers = {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        };

        // Fetch case details
        const caseRes = await fetch(`${API_BASE}/api/case/cases/${caseId}`, { headers });

        if (!caseRes.ok) {
          throw new Error(`Failed to fetch case details (${caseRes.status})`);
        }

        const caseContentType = caseRes.headers.get("content-type");
        if (!caseContentType || !caseContentType.includes("application/json")) {
          throw new Error("Case details response is not JSON");
        }

        const caseJson = await caseRes.json();
        setCaseData(caseJson.case || caseJson);

        // Fetch documents
        const docsRes = await fetch(`${API_BASE}/api/case/cases/${caseId}/documents`, { headers });
        if (docsRes.ok) {
          const docsContentType = docsRes.headers.get("content-type");
          if (docsContentType && docsContentType.includes("application/json")) {
            const docsJson = await docsRes.json();
            setDocuments(Array.isArray(docsJson) ? docsJson : (docsJson?.documents || []));
          } else {
            console.warn("Documents response is not JSON, skipping");
            setDocuments([]);
          }
        } else {
          console.warn(`Documents fetch failed: ${docsRes.status}`);
          setDocuments([]);
        }

        // Fetch witnesses
        const witnessesRes = await fetch(`${API_BASE}/api/case/cases/${caseId}/witnesses`, { headers });
        if (witnessesRes.ok) {
          const witnessesContentType = witnessesRes.headers.get("content-type");
          if (witnessesContentType && witnessesContentType.includes("application/json")) {
            const witnessesJson = await witnessesRes.json();
            setWitnesses(Array.isArray(witnessesJson) ? witnessesJson : (witnessesJson?.witnesses || []));
          } else {
            console.warn("Witnesses response is not JSON, skipping");
            setWitnesses([]);
          }
        } else {
          console.warn(`Witnesses fetch failed: ${witnessesRes.status}`);
          setWitnesses([]);
        }

        // Fetch team members
        const teamRes = await fetch(`${API_BASE}/api/case/cases/${caseId}/team`, { headers });
        if (teamRes.ok) {
          const teamContentType = teamRes.headers.get("content-type");
          if (teamContentType && teamContentType.includes("application/json")) {
            const teamJson = await teamRes.json();
            setTeamMembers(Array.isArray(teamJson) ? teamJson : (teamJson?.team || []));
          } else {
            console.warn("Team response is not JSON, skipping");
            setTeamMembers([]);
          }
        } else {
          console.warn(`Team fetch failed: ${teamRes.status}`);
          setTeamMembers([]);
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching war room data:", err);
        setError(err.message || "Failed to load war room");
        setLoading(false);
      }
    };

    fetchWarRoomData();
  }, [caseId]);

  // WebSocket listener for jury charge release
  useEffect(() => {
    if (!isConnected || !socket || !caseId) return;

    try {
      // Join the case room to receive notifications
      if (typeof joinRoom === 'function') {
        joinRoom(`case_${caseId}`);
      }

      const handleJuryChargeReleased = (data: any) => {
        if (data.caseId === parseInt(caseId)) {
          console.log('🔔 Jury charge has been released!');
          setJuryChargeReleased(true);
          // Show toast notification to the user
          toast.success('The jury charge has been released and is now available for you to complete!', {
            duration: 5000,
            position: 'top-center',
          });
        }
      };

      if (typeof on === 'function') {
        on('jury_charge:released', handleJuryChargeReleased);
      }

      return () => {
        if (typeof off === 'function') {
          off('jury_charge:released', handleJuryChargeReleased);
        }
      };
    } catch (error) {
      console.error('WebSocket setup error:', error);
      // Continue without WebSocket functionality
    }
  }, [isConnected, socket, caseId, joinRoom, on, off]);

  const handleViewDocument = (doc: Document) => {
    setViewingDoc(doc);
  };

  const renderDocumentViewer = () => {
    if (!viewingDoc) return null;

    const ext = getFileExtension(viewingDoc.FileName);
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
    const isPdf = ext === 'pdf';

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h3 className="text-lg font-semibold text-[#16305B]">{viewingDoc.FileName}</h3>
              <p className="text-sm text-gray-600 italic">{viewingDoc.Description}</p>
            </div>
            <button
              onClick={() => setViewingDoc(null)}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <XMarkIcon className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {isImage ? (
              <img 
                src={viewingDoc.FileUrl} 
                alt={viewingDoc.FileName}
                className="max-w-full h-auto mx-auto"
                onError={(e) => {
                  e.currentTarget.src = '';
                  e.currentTarget.alt = 'Failed to load image';
                }}
              />
            ) : isPdf ? (
              <iframe
                src={viewingDoc.FileUrl}
                className="w-full h-[70vh] border-0"
                title={viewingDoc.FileName}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">Preview not available for this file type (.{ext})</p>
                <p className="text-sm text-gray-500">This file can only be viewed in a separate window</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-[#C6CDD9] border-t-[#16305B] rounded-full animate-spin"></div>
          <p className="mt-4 text-base font-semibold text-[#16305B]">Loading War Room...</p>
          <p className="mt-1 text-sm text-[#455A7C]">Please wait while we fetch your case details</p>
        </div>
      </main>
    );
  }

  if (error || !caseData) {
    return (
      <main className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-[#455A7C] mb-4">{error || "Case not found"}</p>
          <button
            onClick={() => router.push("/juror")}
            className="bg-[#16305B] text-white px-6 py-2 rounded font-semibold hover:bg-[#0A2342] transition"
          >
            Back to Dashboard
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

  return (
    <main className="min-h-screen bg-[#FAF9F6] py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.push("/juror")}
          className="flex items-center gap-2 text-[#0A2342] hover:text-[#16305B] transition-colors font-medium text-sm group mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow border border-[#C6CDD9] p-6 mb-6">
          <h1 className="text-3xl font-bold text-[#0A2342] mb-2">{caseName}</h1>
          <p className="text-[#455A7C] mb-4">Case #{caseData.CaseId}</p>

          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <span className="font-semibold text-[#0A2342]">Trial Date:</span>
              <p className="text-[#455A7C]">{trialDate}</p>
            </div>
            <div>
              <span className="font-semibold text-[#0A2342]">Time:</span>
              <p className="text-[#455A7C]">{caseData.ScheduledTime}</p>
            </div>
            <div>
              <span className="font-semibold text-[#0A2342]">Location:</span>
              <p className="text-[#455A7C]">{caseData.County}, {caseData.CaseType}</p>
            </div>
          </div>

          {caseData.CaseDescription && (
            <div>
              <span className="font-semibold text-[#0A2342]">Case Description:</span>
              <p className="text-[#455A7C] mt-1">{caseData.CaseDescription}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow border border-[#C6CDD9] p-6 mb-6">
          <h2 className="text-xl font-bold text-[#0A2342] mb-4">Legal Team</h2>
          {teamMembers.length === 0 ? (
            <p className="text-[#455A7C]">No team members listed</p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((member, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 bg-[#FAF9F6] rounded border border-[#C6CDD9]/30">
                  <div className="flex-1">
                    <p className="font-semibold text-[#0A2342]">{member.Name}</p>
                    <p className="text-sm text-[#455A7C]">{member.Role}</p>
                  </div>
                  <p className="text-sm text-[#455A7C]">{member.Email}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow border border-[#C6CDD9] p-6 mb-6">
          <h2 className="text-xl font-bold text-[#0A2342] mb-4">Witnesses</h2>
          {witnesses.length === 0 ? (
            <p className="text-[#455A7C]">No witnesses listed</p>
          ) : (
            <div className="space-y-4">
              {/* Plaintiff Witnesses */}
              {witnesses.filter(w => w.Side === 'Plaintiff').length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-[#0A2342] mb-3 flex items-center gap-2">
                    <span className="inline-block w-1 h-5 bg-[#16305B] rounded-full"></span>
                    Plaintiff Witnesses
                    <span className="px-2 py-0.5 bg-[#FAF9F6] text-[#455A7C] rounded text-xs font-semibold">
                      {witnesses.filter(w => w.Side === 'Plaintiff').length}
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {witnesses.filter(w => w.Side === 'Plaintiff').map((witness) => (
                      <div key={witness.WitnessId} className="p-4 bg-[#FAF9F6] rounded-lg border border-[#C6CDD9]/30">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 p-2 bg-[#16305B]/10 rounded">
                            <svg className="w-5 h-5 text-[#16305B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#0A2342] mb-1">{witness.WitnessName}</p>
                            <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold mb-2">
                              Plaintiff
                            </span>
                            {witness.Description && (
                              <p className="text-sm text-[#455A7C] mt-2">{witness.Description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Defendant Witnesses */}
              {witnesses.filter(w => w.Side === 'Defendant').length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-[#0A2342] mb-3 flex items-center gap-2">
                    <span className="inline-block w-1 h-5 bg-[#16305B] rounded-full"></span>
                    Defendant Witnesses
                    <span className="px-2 py-0.5 bg-[#FAF9F6] text-[#455A7C] rounded text-xs font-semibold">
                      {witnesses.filter(w => w.Side === 'Defendant').length}
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {witnesses.filter(w => w.Side === 'Defendant').map((witness) => (
                      <div key={witness.WitnessId} className="p-4 bg-[#FAF9F6] rounded-lg border border-[#C6CDD9]/30">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 p-2 bg-[#16305B]/10 rounded">
                            <svg className="w-5 h-5 text-[#16305B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[#0A2342] mb-1">{witness.WitnessName}</p>
                            <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold mb-2">
                              Defendant
                            </span>
                            {witness.Description && (
                              <p className="text-sm text-[#455A7C] mt-2">{witness.Description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow border border-[#C6CDD9] p-6">
          <h2 className="text-xl font-bold text-[#0A2342] mb-4">Case Documents</h2>
          <p className="text-sm text-[#455A7C] mb-4">View-only access to case materials</p>
          {documents.length === 0 ? (
            <p className="text-[#455A7C]">No documents available</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.Id} className="flex items-center justify-between p-3 bg-[#FAF9F6] rounded border border-[#C6CDD9]/30 hover:border-[#C6CDD9] transition">
                  <div className="flex-1">
                    <p className="font-medium text-[#0A2342]">{doc.FileName}</p>
                    <p className="text-sm text-[#455A7C] italic">{doc.Description}</p>
                  </div>
                  <button
                    onClick={() => handleViewDocument(doc)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#16305B] text-white rounded hover:bg-[#0A2342] transition"
                  >
                    <EyeIcon className="w-5 h-5" />
                    <span>View</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This is a read-only view. You can view documents in your browser, but cannot make any changes to case materials. Please review all materials before the trial date.
          </p>
        </div>

        {/* Jury Charge Section */}
        <div className="mt-6 bg-white rounded-lg shadow border border-[#C6CDD9] p-6">
          <h2 className="text-xl font-bold text-[#0A2342] mb-4">Jury Charge - Verdict Form</h2>
          {juryChargeLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#16305B]/30 border-t-[#16305B]"></div>
              <span className="ml-3 text-[#455A7C]">Checking jury charge status...</span>
            </div>
          ) : juryChargeReleased && jurorId ? (
            <JurorVerdictForm caseId={parseInt(caseId)} jurorId={jurorId} />
          ) : (
            <div className="bg-[#FAF9F6] border border-[#C6CDD9] rounded-lg p-8 text-center">
              <p className="text-[#0A2342] font-medium">
                The jury charge has not been released yet. Please check back later.
              </p>
              <p className="text-sm text-[#455A7C] mt-2">
                You will be notified when the jury charge is available for you to complete.
              </p>
            </div>
          )}
        </div>
      </div>

      {renderDocumentViewer()}
    </main>
  );
}