"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { getToken } from "@/lib/apiClient";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  CallClient,
  VideoStreamRenderer,
  LocalVideoStream,
} from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import {
  UserIcon,
  FileText,
  Download,
  Video,
  Mic,
  MicOff,
  AlertTriangle,
  Ban,
  VolumeX,
  Users,
  Shield,
  Activity,
  Clock,
  PlayCircle,
  StopCircle,
  Eye,
  FileWarning,
  ChevronDown,
  ChevronUp
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, "")
  : "http://localhost:4000";

type Witness = {
  WitnessId: number;
  WitnessName: string;
  Side: string;
  Description: string;
};

type JuryQuestion = {
  QuestionId: number;
  QuestionText: string;
  QuestionType: string;
  Options: string[];
};

type Participant = {
  identifier: { communicationUserId: string };
  displayName: string;
  isMuted?: boolean;
  videoStreams: any[];
};

type Incident = {
  IncidentId: number;
  ParticipantName?: string;
  IncidentType: string;
  Description: string;
  ActionTaken?: string;
  Severity: string;
  ReportedAt: string;
  ReportedByName?: string;
};

export default function AdminTrialMonitor() {
  const { id } = useParams();
  const caseId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const [call, setCall] = useState<any>(null);
  const [callState, setCallState] = useState("Initializing...");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [featuredParticipant, setFeaturedParticipant] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [displayName, setDisplayName] = useState("Admin");
  const [renderTrigger, setRenderTrigger] = useState(0);
  const [meetingId, setMeetingId] = useState<number | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);

  // Tab & Modal state
  const [activeTab, setActiveTab] = useState<"video" | "witnesses" | "questions" | "incidents">("video");
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showParticipantPanel, setShowParticipantPanel] = useState(true);
  
  // Incident state
  const [incidentData, setIncidentData] = useState({
    participantId: null as number | null,
    incidentType: "disruptive",
    description: "",
    actionTaken: "",
    severity: "medium"
  });
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentStats, setIncidentStats] = useState({
    TotalIncidents: 0,
    CriticalIncidents: 0,
    HighIncidents: 0,
    DisruptiveIncidents: 0,
    ResolvedIncidents: 0
  });

  // Case data state
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [juryQuestions, setJuryQuestions] = useState<JuryQuestion[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Jury charge verdict status
  const [verdictStatus, setVerdictStatus] = useState<{
    totalJurors: number;
    submitted: number;
    pending: number;
    jurors: Array<{
      jurorId: number;
      name: string;
      email: string;
      status: 'submitted' | 'pending';
      submittedAt: string | null;
    }>;
  } | null>(null);
  const [verdictStatusLoading, setVerdictStatusLoading] = useState(false);

  const featuredVideoRef = useRef<HTMLDivElement>(null);
  const localThumbnailRef = useRef<HTMLDivElement>(null);
  const localVideoStream = useRef<any>(null);
  const localRenderer = useRef<any>(null);
  const localThumbnailRenderer = useRef<any>(null);
  const remoteVideoRefs = useRef<Map<string, any>>(new Map());
  const hasInitialized = useRef(false);

  // WebSocket connection for real-time verdict updates
  const { isConnected: wsConnected, on: wsOn, off: wsOff, emit: wsEmit } = useWebSocket();

  // Fetch verdict status function - defined early to avoid hoisting issues
  const fetchVerdictStatus = useCallback(async () => {
    setVerdictStatusLoading(true);
    try {
      console.log(`🔍 Fetching verdict status for case ${caseId}...`);
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/verdicts/status/${caseId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn(`❌ Failed to fetch verdict status: ${response.status}`);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("❌ Verdict status response is not JSON");
        return;
      }

      const result = await response.json();
      console.log(`✅ Verdict status fetched:`, result);
      // API returns { success: true, data: status }
      const statusData = result.data || result;
      console.log(`📊 Setting verdict status:`, {
        totalJurors: statusData.totalJurors,
        submitted: statusData.submitted,
        pending: statusData.pending
      });
      setVerdictStatus(statusData);
    } catch (err) {
      console.error("❌ Error fetching verdict status:", err);
    } finally {
      setVerdictStatusLoading(false);
    }
  }, [caseId]);

  // Recording timer effect
  useEffect(() => {
    if (!isRecording || !recordingStartTime) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - recordingStartTime.getTime()) / 1000);
      setRecordingDuration(diff);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    initializeCall();
    fetchCaseData();
    fetchVerdictStatus();
    checkRecordingStatus();

    return () => {
      if (call) {
        call.hangUp().catch((e: any) => console.error("Hangup error:", e));
      }
      if (localRenderer.current) localRenderer.current.dispose();
      if (localThumbnailRenderer.current) localThumbnailRenderer.current.dispose();
      remoteVideoRefs.current.forEach((r) => r.renderer?.dispose());
    };
  }, []);

  // WebSocket - Join verdict monitoring room and listen for updates
  useEffect(() => {
    console.log('🔄 WebSocket useEffect triggered:', { wsConnected, caseId, caseIdType: typeof caseId });

    if (!wsConnected) {
      console.log('❌ WebSocket not connected yet');
      return;
    }

    if (!caseId) {
      console.log('❌ No case ID available');
      return;
    }

    console.log(`✅ ✅ ✅ WebSocket IS CONNECTED! Now joining verdict monitoring room for case ${caseId}`);
    console.log(`📡 Emitting: join_verdict_monitoring with caseId: ${caseId}`);
    wsEmit('join_verdict_monitoring', caseId);

    // Listen for verdict submission events
    const handleVerdictSubmitted = (data: any) => {
      console.log('🎉 🎉 🎉 VERDICT SUBMITTED EVENT RECEIVED!', data);
      toast.success(`${data.jurorName} submitted their verdict!`, {
        duration: 5000,
        icon: '✅'
      });
      // Refresh verdict status
      console.log('🔄 Refreshing verdict status after submission...');
      fetchVerdictStatus();
    };

    // Listen for verdict status updates
    const handleVerdictStatusUpdate = (data: any) => {
      console.log('📊 📊 📊 VERDICT STATUS UPDATE RECEIVED:', {
        totalJurors: data.totalJurors,
        submitted: data.submitted,
        pending: data.pending,
        fullData: data
      });
      setVerdictStatus(data);
    };

    // Listen for pong response
    const handlePong = (data: any) => {
      console.log('🏓 Pong received from WebSocket:', data);
    };

    console.log('👂 Setting up WebSocket event listeners for verdict:submitted and verdict:status_update');
    wsOn('verdict:submitted', handleVerdictSubmitted);
    wsOn('verdict:status_update', handleVerdictStatusUpdate);
    wsOn('pong', handlePong);

    // Test ping
    console.log('📡 Sending test ping to WebSocket...');
    wsEmit('ping', {});

    return () => {
      console.log('🧹 Cleaning up WebSocket event listeners for case', caseId);
      wsOff('verdict:submitted', handleVerdictSubmitted);
      wsOff('verdict:status_update', handleVerdictStatusUpdate);
      wsOff('pong', handlePong);
    };
  }, [wsConnected, caseId, wsEmit, wsOn, wsOff, fetchVerdictStatus]);

  useEffect(() => {
    if (!meetingId) return;

    const interval = setInterval(() => {
      checkRecordingStatus();
      if (activeTab === "incidents") {
        fetchIncidents();
      }
      if (activeTab === "questions") {
        fetchVerdictStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [meetingId, activeTab]);

  useEffect(() => {
    renderLocalVideo();
  }, [featuredParticipant, renderTrigger]);

  async function renderLocalVideo() {
    if (!localVideoStream.current) return;

    try {
      if (featuredParticipant === "local" && featuredVideoRef.current) {
        if (localRenderer.current) localRenderer.current.dispose();
        localRenderer.current = new VideoStreamRenderer(localVideoStream.current);
        const view = await localRenderer.current.createView();
        featuredVideoRef.current.innerHTML = "";
        featuredVideoRef.current.appendChild(view.target);
      } else if (localThumbnailRef.current) {
        if (localThumbnailRenderer.current) localThumbnailRenderer.current.dispose();
        localThumbnailRenderer.current = new VideoStreamRenderer(localVideoStream.current);
        const thumbnailView = await localThumbnailRenderer.current.createView();
        localThumbnailRef.current.innerHTML = "";
        localThumbnailRef.current.appendChild(thumbnailView.target);
      }
    } catch (err) {
      console.error("Local video render error:", err);
    }
  }

  async function renderRemoteVideo(stream: any, participant: any, userId: string) {
    try {
      console.log(`🎬 Rendering video for ${participant.displayName}`);

      const existingRef = remoteVideoRefs.current.get(userId);
      if (existingRef && existingRef.renderer) {
        console.log(`♻️ Disposing old renderer for ${userId}`);
        existingRef.renderer.dispose();
      }

      const renderer = new VideoStreamRenderer(stream);
      const view = await renderer.createView();

      remoteVideoRefs.current.set(userId, {
        renderer,
        view,
        participant,
        streamType: 'Video',
        videoOff: false
      });

      console.log(`✅ Video rendered successfully for ${participant.displayName}`);
      setRenderTrigger(prev => prev + 1);
    } catch (err) {
      console.error(`❌ Error rendering video for ${participant.displayName}:`, err);
    }
  }

  const checkRecordingStatus = async () => {
    if (!meetingId) return;
    
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/trials/${meetingId}/recording/status`
      );
      const data = await response.json();
      
      if (data.success) {
        setIsRecording(data.isRecording);
        if (data.recording) {
          setRecordingId(data.recording.RecordingId);
          if (!recordingStartTime && data.recording.StartedAt) {
            setRecordingStartTime(new Date(data.recording.StartedAt));
          }
        } else {
          setRecordingStartTime(null);
          setRecordingDuration(0);
        }
      }
    } catch (error) {
      console.error("Error checking recording status:", error);
    }
  };

  const fetchCaseData = async () => {
    setDataLoading(true);
    try {
      const [witnessRes, questionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/case/cases/${caseId}/witnesses`),
        fetch(`${API_BASE}/api/case/cases/${caseId}/jury-charge`)
      ]);

      if (witnessRes.ok) {
        const witnessData = await witnessRes.json();
        setWitnesses(witnessData.witnesses || []);
      }

      if (questionsRes.ok) {
        const questionsData = await questionsRes.json();
        setJuryQuestions(questionsData.questions || []);
      }
    } catch (err) {
      console.error("Error fetching case data:", err);
    } finally {
      setDataLoading(false);
    }
  };

  const downloadVerdicts = async () => {
    try {
      console.log(`📥 [AdminTrialMonitor] Downloading verdicts for case ${caseId}...`);
      const token = getToken();

      if (!token) {
        console.error('❌ [AdminTrialMonitor] No auth token found');
        toast.error('Authentication required. Please log in again.', { duration: 4000 });
        return;
      }

      console.log(`📥 [AdminTrialMonitor] Calling API: ${API_BASE}/api/verdicts/case/${caseId}`);
      const response = await fetch(`${API_BASE}/api/verdicts/case/${caseId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log(`📥 [AdminTrialMonitor] Response status: ${response.status}`);
      console.log(`📥 [AdminTrialMonitor] Response headers:`, {
        contentType: response.headers.get("content-type"),
        status: response.status,
        statusText: response.statusText
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [AdminTrialMonitor] API error response:`, errorText);

        let errorMessage = "Failed to fetch verdicts";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (e) {
          // Not JSON, use text as is
          errorMessage = errorText || errorMessage;
        }

        console.error(`❌ [AdminTrialMonitor] Error: ${errorMessage}`);
        toast.error(errorMessage, { duration: 5000 });
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text();
        console.error("❌ [AdminTrialMonitor] Non-JSON response:", textResponse);
        toast.error("Invalid response format from server", { duration: 4000 });
        return;
      }

      const result = await response.json();
      console.log(`📥 [AdminTrialMonitor] API result:`, result);

      // API returns { success: true, count: X, data: verdicts }
      const verdicts = result.data || result.verdicts || [];
      console.log(`📥 [AdminTrialMonitor] Verdicts array:`, {
        count: verdicts.length,
        firstVerdict: verdicts[0] || null
      });

      if (verdicts.length === 0) {
        console.warn('⚠️  [AdminTrialMonitor] No verdicts found');
        toast.error('No verdicts have been submitted yet for this case', { duration: 5000 });
        return;
      }

      // Convert to JSON and download
      const blob = new Blob([JSON.stringify(verdicts, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verdicts-case-${caseId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log(`✅ [AdminTrialMonitor] Successfully downloaded ${verdicts.length} verdict(s)`);
      toast.success(`Downloaded ${verdicts.length} verdict(s) successfully!`, { duration: 4000 });
    } catch (error) {
      console.error('❌ [AdminTrialMonitor] Unexpected error:', error);
      
      // Type guard: check if error is an Error instance
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
      
      const errorStack = error instanceof Error 
        ? error.stack 
        : undefined;
      
      // Only log stack if it exists
      if (errorStack) {
        console.error('❌ [AdminTrialMonitor] Error stack:', errorStack);
      }
      
      toast.error(`Failed to download verdicts: ${errorMessage}`, { duration: 5000 });
    }
  };

  const fetchIncidents = async () => {
    if (!meetingId) return;
    
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/trials/${meetingId}/incidents`
      );
      const data = await response.json();
      
      if (data.success) {
        setIncidents(data.incidents || []);
        setIncidentStats(data.stats || {
          TotalIncidents: 0,
          CriticalIncidents: 0,
          HighIncidents: 0,
          DisruptiveIncidents: 0,
          ResolvedIncidents: 0
        });
      }
    } catch (error) {
      console.error("Error fetching incidents:", error);
    }
  };

  async function initializeCall() {
    try {
      setCallState("Getting permissions...");

      const response = await fetch(`${API_BASE}/api/trial/admin-join/${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) throw new Error("Failed to join trial");
      const data = await response.json();
      setDisplayName(data.displayName);
      setMeetingId(data.meetingId || null);

      setCallState("Initializing devices...");

      const callClient = new CallClient();
      const tokenCredential = new AzureCommunicationTokenCredential(data.token);
      const deviceManager = await callClient.getDeviceManager();
      await deviceManager.askDevicePermission({ video: true, audio: true });

      const cameras = await deviceManager.getCameras();
      if (cameras.length > 0) {
        localVideoStream.current = new LocalVideoStream(cameras[0]);
      }

      setCallState("Connecting to trial...");

      const agent = await callClient.createCallAgent(tokenCredential, {
        displayName: data.displayName,
      });

      const roomCall = agent.join(
        { roomId: data.roomId },
        {
          videoOptions: localVideoStream.current && !isVideoOff
            ? { localVideoStreams: [localVideoStream.current] }
            : undefined,
        }
      );

      await roomCall.mute();
      setCall(roomCall);

      roomCall.on("stateChanged", async () => {
        setCallState(roomCall.state);
        if (roomCall.state === "Connected") {
          setIsMuted(roomCall.isMuted);
        }
      });

      roomCall.on("isMutedChanged", () => {
        setIsMuted(roomCall.isMuted);
      });

      roomCall.on("remoteParticipantsUpdated", async (e: any) => {
        for (const participant of e.added) {
          const userId = participant.identifier.communicationUserId;

          participant.on("videoStreamsUpdated", async (ev: any) => {
            console.log(`🔄 Video streams updated for ${participant.displayName}`);

            for (const stream of ev.removed) {
              const streamKey = stream.mediaStreamType === 'ScreenSharing'
                ? `${userId}-screen`
                : userId;

              const ref = remoteVideoRefs.current.get(streamKey);
              if (ref && ref.renderer) {
                ref.renderer.dispose();
              }

              remoteVideoRefs.current.set(streamKey, {
                renderer: null,
                view: null,
                participant,
                streamType: stream.mediaStreamType,
                videoOff: true
              });

              if (stream.mediaStreamType === 'ScreenSharing' && featuredParticipant === streamKey) {
                setFeaturedParticipant("local");
              }

              setRenderTrigger(prev => prev + 1);
            }

            for (const stream of ev.added) {
              if (stream.mediaStreamType === 'Video') {
                if (stream.isAvailable) {
                  await renderRemoteVideo(stream, participant, userId);
                  if (!featuredParticipant || featuredParticipant === "local") {
                    setFeaturedParticipant(userId);
                  }
                } else {
                  stream.on("isAvailableChanged", async () => {
                    if (stream.isAvailable) {
                      await renderRemoteVideo(stream, participant, userId);
                    }
                  });
                }
              } else if (stream.mediaStreamType === 'ScreenSharing') {
                if (stream.isAvailable) {
                  try {
                    const renderer = new VideoStreamRenderer(stream);
                    const view = await renderer.createView();
                    const streamKey = `${userId}-screen`;

                    remoteVideoRefs.current.set(streamKey, {
                      renderer,
                      view,
                      participant,
                      streamType: stream.mediaStreamType,
                      videoOff: false
                    });

                    setFeaturedParticipant(streamKey);
                    setRenderTrigger(prev => prev + 1);
                  } catch (err) {
                    console.error("Remote screen share error:", err);
                  }
                }
              }
            }

            setParticipants(
              Array.from(roomCall.remoteParticipants).map((p: any) => ({
                identifier: { communicationUserId: p.identifier.communicationUserId || '' },
                displayName: p.displayName || '',
                isMuted: p.isMuted,
                videoStreams: p.videoStreams || []
              }))
            );
          });

          // Process existing streams immediately
          for (const stream of participant.videoStreams) {
            if (stream.mediaStreamType === 'Video') {
              if (stream.isAvailable) {
                await renderRemoteVideo(stream, participant, userId);
                if (!featuredParticipant || featuredParticipant === "local") {
                  setFeaturedParticipant(userId);
                }
              } else {
                stream.on("isAvailableChanged", async () => {
                  if (stream.isAvailable) {
                    await renderRemoteVideo(stream, participant, userId);
                  }
                });
              }
            } else if (stream.mediaStreamType === 'ScreenSharing' && stream.isAvailable) {
              try {
                const renderer = new VideoStreamRenderer(stream);
                const view = await renderer.createView();
                const streamKey = `${userId}-screen`;

                remoteVideoRefs.current.set(streamKey, {
                  renderer,
                  view,
                  participant,
                  streamType: stream.mediaStreamType,
                  videoOff: false
                });

                setFeaturedParticipant(streamKey);
                setRenderTrigger(prev => prev + 1);
              } catch (err) {
                console.error("Remote video error:", err);
              }
            }
          }
        }

        for (const participant of e.removed) {
          const userId = participant.identifier.communicationUserId;
          const ref = remoteVideoRefs.current.get(userId);
          const screenRef = remoteVideoRefs.current.get(`${userId}-screen`);

          if (ref && ref.renderer) {
            ref.renderer.dispose();
            remoteVideoRefs.current.delete(userId);
          }
          if (screenRef && screenRef.renderer) {
            screenRef.renderer.dispose();
            remoteVideoRefs.current.delete(`${userId}-screen`);
          }

          if (featuredParticipant === userId || featuredParticipant === `${userId}-screen`) {
            setFeaturedParticipant("local");
          }
        }

        setParticipants(
          Array.from(roomCall.remoteParticipants).map((p: any) => ({
            identifier: { communicationUserId: p.identifier.communicationUserId || '' },
            displayName: p.displayName || '',
            isMuted: p.isMuted,
            videoStreams: p.videoStreams || []
          }))
        );
      });

      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to join trial");
      setLoading(false);
    }
  }

  const handleStartRecording = async () => {
    if (!meetingId) return;
    
    if (!confirm("Start recording this trial session?")) return;
    
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/trials/${meetingId}/recording/start`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setIsRecording(true);
        setRecordingId(data.recordingId);
        setRecordingStartTime(new Date());
        toast.success("Recording started successfully!", { duration: 4000 });
      } else {
        const error = await response.json();
        toast.error(`Failed to start recording: ${error.message}`, { duration: 5000 });
      }
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Error starting recording", { duration: 5000 });
    }
  };

  const handleStopRecording = async () => {
    if (!meetingId) return;
    
    if (!confirm("Stop recording? The recording will be saved.")) return;
    
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/trials/${meetingId}/recording/stop`,
        { method: "POST" }
      );
      
      if (response.ok) {
        setIsRecording(false);
        setRecordingStartTime(null);
        setRecordingDuration(0);
        toast.success("Recording stopped and saved successfully!", { duration: 4000 });
      } else {
        const error = await response.json();
        toast.error(`Failed to stop recording: ${error.message}`, { duration: 5000 });
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      toast.error("Error stopping recording", { duration: 5000 });
    }
  };

  const handleMuteParticipant = async (participant: Participant) => {
    if (!meetingId) return;
    
    if (!confirm(`Mute ${participant.displayName}?`)) return;
    
    const participantId = 1; // This should come from your participant mapping
    
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/trials/${meetingId}/participants/${participantId}/mute`,
        { method: "POST" }
      );
      
      if (response.ok) {
        toast.success(`${participant.displayName} has been muted`, { duration: 3000 });
      } else {
        toast.error(`Failed to mute participant`, { duration: 4000 });
      }
    } catch (error) {
      console.error("Error muting participant:", error);
      toast.error("Error muting participant", { duration: 4000 });
    }
  };

  const handleRemoveParticipant = async (participant: Participant) => {
    if (!meetingId) return;
    
    const reason = prompt(`⚠️ Remove ${participant.displayName} from trial?\n\nProvide reason (required):`);
    if (!reason || !reason.trim()) return;
    
    const participantId = 1; // This should come from your participant mapping
    
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/trials/${meetingId}/participants/${participantId}/remove`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() })
        }
      );
      
      if (response.ok) {
        toast.success(`${participant.displayName} has been removed from the trial`, { duration: 4000 });
      } else {
        toast.error(`Failed to remove participant`, { duration: 4000 });
      }
    } catch (error) {
      console.error("Error removing participant:", error);
      toast.error("Error removing participant", { duration: 4000 });
    }
  };

  const handleReportIncident = async () => {
    if (!meetingId || !incidentData.description.trim()) {
      toast.error("Please provide an incident description", { duration: 4000 });
      return;
    }
    
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/trials/${meetingId}/incidents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(incidentData)
        }
      );
      
      if (response.ok) {
        toast.success("Incident reported successfully", { duration: 4000 });
        setShowIncidentModal(false);
        setIncidentData({
          participantId: null,
          incidentType: "disruptive",
          description: "",
          actionTaken: "",
          severity: "medium"
        });
        fetchIncidents();
        setActiveTab("incidents");
      } else {
        toast.error("Failed to report incident", { duration: 4000 });
      }
    } catch (error) {
      console.error("Error reporting incident:", error);
      toast.error("Error reporting incident", { duration: 4000 });
    }
  };

  const toggleMute = async () => {
    if (!call) return;
    try {
      if (call.isMuted) {
        await call.unmute();
      } else {
        await call.mute();
      }
    } catch (err) {
      console.error("Toggle mute error:", err);
    }
  };

  const toggleVideo = async () => {
    if (!call || !localVideoStream.current) return;
    try {
      if (isVideoOff) {
        await call.startVideo(localVideoStream.current);
        setIsVideoOff(false);
      } else {
        await call.stopVideo(localVideoStream.current);
        setIsVideoOff(true);
      }
    } catch (err) {
      console.error("Toggle video error:", err);
    }
  };

  const leaveCall = async () => {
    if (!confirm("Leave monitoring session?")) return;
    if (call) await call.hangUp();
    window.close();
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadWitnesses = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/case/cases/${caseId}/witnesses/export/text`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `witnesses-case-${caseId}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading witnesses:', error);
      toast.error('Failed to download witnesses', { duration: 4000 });
    }
  };

  const downloadJuryQuestions = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/case/cases/${caseId}/jury-charge/export/text`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jury-charge-case-${caseId}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading jury questions:', error);
      toast.error('Failed to download jury questions', { duration: 4000 });
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "#FAF9F6" }}>
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 mx-auto mb-6" style={{ borderTopColor: "#0A2342", borderBottomColor: "#0A2342" }}></div>
            <Shield className="h-10 w-10 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ color: "#0A2342" }} />
          </div>
          <p className="text-xl font-semibold" style={{ color: "#0A2342" }}>{callState}</p>
          <p className="text-gray-600 text-sm mt-2">Securing admin connection...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "#FAF9F6" }}>
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md border border-gray-200">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="h-12 w-12 text-red-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-4 text-center">Failed to Join Trial</h2>
          <p className="text-gray-700 mb-6 text-center">{error}</p>
          <button
            onClick={() => window.close()}
            className="w-full py-3 text-white rounded-lg font-semibold shadow-lg hover:opacity-90"
            style={{ backgroundColor: "#0A2342" }}
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-800 px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-lg">Admin Monitor</span>
                <span className="px-2 py-0.5 bg-purple-900/50 text-purple-200 text-xs font-bold rounded-full backdrop-blur-sm">
                  Case #{caseId}
                </span>
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full flex items-center gap-1 ${
                  wsConnected ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></span>
                  {wsConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              <span className="text-purple-200 text-xs flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Observer Mode • Full Control
              </span>
            </div>
          </div>
          
          {isRecording && (
            <div className="flex items-center gap-3 px-4 py-2 bg-red-600 text-white rounded-full shadow-xl animate-pulse">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <div>
                <span className="text-sm font-bold">REC</span>
                <span className="text-xs ml-2 opacity-90">{formatDuration(recordingDuration)}</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-white text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Connection
            </div>
            <span className={`text-xs font-medium ${
              callState === "Connected" ? "text-green-300" : "text-yellow-300"
            }`}>
              {callState}
            </span>
          </div>
          
          <div className="h-10 w-px bg-white/20"></div>
          
          <div className="text-right">
            <div className="text-white text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants
            </div>
            <span className="text-purple-200 text-xs font-medium">
              {participants.length} Active
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced Tab Bar */}
      <div className="bg-gray-800 px-6 py-2 flex gap-2 flex-shrink-0 border-b border-gray-700 shadow-lg">
        <button
          onClick={() => setActiveTab("video")}
          className={`px-5 py-2.5 rounded-t-lg font-semibold transition-all flex items-center gap-2 ${
            activeTab === "video"
              ? "bg-gray-900 text-white shadow-lg border-t-2 border-purple-500"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          <Video className="h-4 w-4" />
          Video Conference
        </button>
        <button
          onClick={() => setActiveTab("witnesses")}
          className={`px-5 py-2.5 rounded-t-lg font-semibold transition-all flex items-center gap-2 ${
            activeTab === "witnesses"
              ? "bg-gray-900 text-white shadow-lg border-t-2 border-purple-500"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          <UserIcon className="h-4 w-4" />
          Witnesses
          <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full font-bold">
            {witnesses.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("questions")}
          className={`px-5 py-2.5 rounded-t-lg font-semibold transition-all flex items-center gap-2 ${
            activeTab === "questions"
              ? "bg-gray-900 text-white shadow-lg border-t-2 border-purple-500"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          <FileText className="h-4 w-4" />
          Jury Charge
          <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full font-bold">
            {juryQuestions.length}
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab("incidents");
            fetchIncidents();
          }}
          className={`px-5 py-2.5 rounded-t-lg font-semibold transition-all flex items-center gap-2 ${
            activeTab === "incidents"
              ? "bg-gray-900 text-white shadow-lg border-t-2 border-purple-500"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Incidents
          {incidents.length > 0 && (
            <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full font-bold animate-pulse">
              {incidents.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "video" && (
          <div className="h-full p-6 flex gap-4">
            {/* Video Area */}
            <div className="flex-1 flex flex-col">
              {/* Featured Video */}
              <div className="flex-1 flex items-center justify-center bg-black rounded-xl relative overflow-hidden shadow-2xl mb-4">
                <div className="w-full h-full relative">
                  {(() => {
                    const featuredVideo = featuredParticipant && featuredParticipant !== "local"
                      ? remoteVideoRefs.current.get(featuredParticipant)
                      : null;

                    if (featuredVideo) {
                      return (
                        <>
                          {featuredVideo.view && !featuredVideo.videoOff ? (
                            <div
                              ref={(el) => {
                                if (el && featuredVideo.view) {
                                  el.innerHTML = "";
                                  el.appendChild(featuredVideo.view.target);
                                }
                              }}
                              className="w-full h-full [&>div]:!w-full [&>div]:!h-full [&_video]:object-contain"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                              <div className="text-center">
                                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center mb-4 shadow-2xl">
                                  <Video className="h-20 w-20 text-white opacity-50" />
                                </div>
                                <p className="text-gray-400 text-lg font-semibold">{featuredVideo.participant?.displayName || "Participant"}</p>
                                <p className="text-gray-500 text-sm mt-2">Camera Off</p>
                              </div>
                            </div>
                          )}
                          {featuredVideo.streamType === 'ScreenSharing' && (
                            <div className="absolute top-4 left-4 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg">
                              📺 {featuredVideo.participant?.displayName}'s Screen
                            </div>
                          )}
                          <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm font-semibold backdrop-blur-sm">
                            {featuredVideo.participant?.displayName || "Participant"}
                          </div>
                        </>
                      );
                    } else if (featuredParticipant === "local") {
                      return (
                        <>
                          <div
                            ref={featuredVideoRef}
                            className="w-full h-full [&>div]:!w-full [&>div]:!h-full [&_video]:object-contain"
                          />
                          {isVideoOff && (
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                              <div className="text-center">
                                <div className="w-32 h-32 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center shadow-xl mx-auto mb-4">
                                  <Shield className="h-16 w-16 text-white" />
                                </div>
                                <p className="text-gray-400 text-lg font-semibold">Admin Observer</p>
                                <p className="text-gray-500 text-sm mt-2">Camera Off</p>
                              </div>
                            </div>
                          )}
                          <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm font-semibold backdrop-blur-sm">
                            {displayName} (You)
                          </div>
                        </>
                      );
                    } else {
                      return (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                          <div className="text-center">
                            <div className="w-32 h-32 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center shadow-xl mx-auto mb-4">
                              <Shield className="h-16 w-16 text-white" />
                            </div>
                            <p className="text-gray-400 text-lg font-semibold">Admin Observer Mode</p>
                            <p className="text-gray-500 text-sm mt-2">Monitoring {participants.length} participants</p>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-3 overflow-x-auto pb-2">
                {/* Local Thumbnail */}
                <button
                  onClick={() => setFeaturedParticipant("local")}
                  className={`flex-shrink-0 text-center transition-all ${
                    featuredParticipant === "local" ? "opacity-100 ring-4 ring-purple-500" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="w-32 h-24 bg-black rounded-lg overflow-hidden mb-2 relative shadow-lg">
                    {!isVideoOff && featuredParticipant !== "local" && (
                      <div
                        ref={localThumbnailRef}
                        className="w-full h-full [&_video]:object-cover"
                      />
                    )}
                    {isVideoOff && (
                      <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                        <Shield className="h-8 w-8 text-gray-600" />
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-white">{displayName} (You)</div>
                </button>

                {/* Remote Participant Thumbnails */}
                {participants
                  .filter((p) => {
                    const userId = p.identifier.communicationUserId;
                    return userId && userId !== featuredParticipant && !featuredParticipant?.includes(`${userId}-screen`);
                  })
                  .map((p: Participant) => {
                    const userId = p.identifier.communicationUserId;
                    const videoRef = remoteVideoRefs.current.get(userId);
                    const screenRef = remoteVideoRefs.current.get(`${userId}-screen`);

                    return (
                      <div key={userId} className="flex gap-3">
                        {/* Regular Video Thumbnail */}
                        <button
                          onClick={() => setFeaturedParticipant(userId)}
                          className={`flex-shrink-0 text-center transition-all ${
                            featuredParticipant === userId ? "opacity-100 ring-4 ring-purple-500" : "opacity-70 hover:opacity-100"
                          }`}
                        >
                          <div className="w-32 h-24 bg-black rounded-lg overflow-hidden mb-2 relative shadow-lg">
                            {videoRef?.view && !videoRef?.videoOff ? (
                              <div
                                ref={(el) => {
                                  if (el && videoRef.view && featuredParticipant !== userId) {
                                    el.innerHTML = "";
                                    el.appendChild(videoRef.view.target);
                                  }
                                }}
                                className="w-full h-full [&_video]:object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                                <UserIcon className="h-8 w-8 text-gray-600" />
                              </div>
                            )}
                            {p.isMuted && (
                              <div className="absolute top-2 right-2 bg-red-600 rounded-full p-1">
                                <MicOff className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="text-sm font-medium text-white">{p.displayName || "Participant"}</div>
                        </button>

                        {/* Screen Share Thumbnail */}
                        {screenRef && (
                          <button
                            onClick={() => setFeaturedParticipant(`${userId}-screen`)}
                            className={`flex-shrink-0 text-center transition-all ${
                              featuredParticipant === `${userId}-screen` ? "opacity-100 ring-4 ring-purple-500" : "opacity-70 hover:opacity-100"
                            }`}
                          >
                            <div className="w-32 h-24 bg-black rounded-lg overflow-hidden mb-2 relative shadow-lg">
                              {screenRef.view && !screenRef.videoOff ? (
                                <div
                                  ref={(el) => {
                                    if (el && screenRef.view && featuredParticipant !== `${userId}-screen`) {
                                      el.innerHTML = "";
                                      el.appendChild(screenRef.view.target);
                                    }
                                  }}
                                  className="w-full h-full [&_video]:object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                                  <Eye className="h-8 w-8 text-gray-600" />
                                </div>
                              )}
                              <div className="absolute top-2 left-2 bg-purple-600 text-white px-2 py-0.5 rounded text-xs font-bold">
                                📺 Screen
                              </div>
                            </div>
                            <div className="text-sm font-medium text-white">{p.displayName}'s Screen</div>
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Participants Panel */}
            {showParticipantPanel && (
              <div className="w-96 bg-gray-800 rounded-xl p-5 flex flex-col shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-400" />
                    Participants ({participants.length})
                  </h3>
                  <button
                    onClick={() => setShowParticipantPanel(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3">
                  {participants.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="h-16 w-16 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No participants yet</p>
                      <p className="text-sm mt-1">Waiting for users to join...</p>
                    </div>
                  ) : (
                    participants.map((p: Participant) => (
                      <div
                        key={p.identifier.communicationUserId}
                        className="bg-gray-700 rounded-xl p-4 hover:bg-gray-600 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                              <span className="text-white font-bold text-lg">
                                {p.displayName?.charAt(0)?.toUpperCase() || "P"}
                              </span>
                            </div>
                            <div>
                              <span className="text-white font-semibold block">{p.displayName || "Participant"}</span>
                              <div className="flex items-center gap-2 mt-1">
                                {p.isMuted ? (
                                  <span className="flex items-center gap-1 text-red-400 text-xs">
                                    <MicOff className="h-3 w-3" />
                                    Muted
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-green-400 text-xs">
                                    <Mic className="h-3 w-3" />
                                    Active
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleMuteParticipant(p)}
                            className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center justify-center gap-2 font-medium text-sm transition-all"
                            title="Mute participant"
                          >
                            <VolumeX className="h-4 w-4" />
                            Mute
                          </button>
                          <button
                            onClick={() => handleRemoveParticipant(p)}
                            className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 font-medium text-sm transition-all"
                            title="Remove participant"
                          >
                            <Ban className="h-4 w-4" />
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {!showParticipantPanel && (
              <button
                onClick={() => setShowParticipantPanel(true)}
                className="absolute right-6 top-24 px-4 py-3 bg-purple-600 text-white rounded-l-xl shadow-xl hover:bg-purple-700 transition-all"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {activeTab === "witnesses" && (
          <div className="h-full overflow-y-auto p-6 bg-gray-800">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  <UserIcon className="h-8 w-8 text-purple-400" />
                  Trial Witnesses
                </h2>
                <button
                  onClick={downloadWitnesses}
                  className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold flex items-center gap-2 shadow-lg"
                >
                  <Download className="h-5 w-5" />
                  Export
                </button>
              </div>

              {dataLoading ? (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading witnesses...</p>
                </div>
              ) : witnesses.length === 0 ? (
                <div className="text-center py-16 bg-gray-700 rounded-xl">
                  <UserIcon className="h-20 w-20 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-xl font-semibold">No witnesses added</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {witnesses.map((witness) => (
                    <div key={witness.WitnessId} className="bg-gray-700 rounded-xl p-6 hover:shadow-xl transition-all border-l-4 border-purple-500">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-white text-xl">{witness.WitnessName}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          witness.Side === "Plaintiff" 
                            ? "bg-blue-500 text-white" 
                            : "bg-red-500 text-white"
                        }`}>
                          {witness.Side}
                        </span>
                      </div>
                      {witness.Description && (
                        <p className="text-gray-300 text-sm leading-relaxed">{witness.Description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "questions" && (
          <div className="h-full overflow-y-auto p-6 bg-gray-800">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  <FileText className="h-8 w-8 text-green-400" />
                  Jury Charge Questions
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={downloadVerdicts}
                    className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold flex items-center gap-2 shadow-lg"
                    disabled={!verdictStatus || verdictStatus.submitted === 0}
                  >
                    <Download className="h-5 w-5" />
                    Download Verdicts
                  </button>
                  <button
                    onClick={downloadJuryQuestions}
                    className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center gap-2 shadow-lg"
                  >
                    <Download className="h-5 w-5" />
                    Export Questions
                  </button>
                </div>
              </div>

              {/* Jury Charge Completion Status */}
              <div className="mb-6 bg-gray-700 rounded-xl p-6 border-l-4 border-blue-500">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="h-6 w-6 text-blue-400" />
                  Jury Charge Completion Status
                </h3>

                {verdictStatusLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  </div>
                ) : verdictStatus ? (
                  <div>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-800 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-blue-400">{verdictStatus.totalJurors}</div>
                        <div className="text-sm text-gray-400 mt-1">Total Jurors</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-green-400">{verdictStatus.submitted}</div>
                        <div className="text-sm text-gray-400 mt-1">Completed</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-yellow-400">{verdictStatus.pending}</div>
                        <div className="text-sm text-gray-400 mt-1">Pending</div>
                      </div>
                    </div>

                    {/* Juror List */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Juror Details</h4>
                      {verdictStatus.jurors.map((juror) => (
                        <div
                          key={juror.jurorId}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            juror.status === 'submitted' ? 'bg-green-900/30 border-l-4 border-green-500' : 'bg-yellow-900/30 border-l-4 border-yellow-500'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              juror.status === 'submitted' ? 'bg-green-600' : 'bg-yellow-600'
                            }`}>
                              <UserIcon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <div className="font-semibold text-white">{juror.name}</div>
                              <div className="text-xs text-gray-400">ID: {juror.jurorId}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {juror.status === 'submitted' ? (
                              <>
                                <div className="text-right">
                                  <div className="text-xs text-gray-400">Submitted at</div>
                                  <div className="text-sm text-green-400 font-medium">
                                    {juror.submittedAt ? new Date(juror.submittedAt).toLocaleString() : 'N/A'}
                                  </div>
                                </div>
                                <div className="px-3 py-1 bg-green-600 text-white rounded-full text-xs font-bold">
                                  ✓ Completed
                                </div>
                              </>
                            ) : (
                              <div className="px-3 py-1 bg-yellow-600 text-white rounded-full text-xs font-bold">
                                ⏳ Pending
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-4">
                    No jury charge status available. Release the jury charge to see completion status.
                  </div>
                )}
              </div>

              {dataLoading ? (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-500 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading questions...</p>
                </div>
              ) : juryQuestions.length === 0 ? (
                <div className="text-center py-16 bg-gray-700 rounded-xl">
                  <FileText className="h-20 w-20 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-xl font-semibold">No jury questions added</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {juryQuestions.map((question, index) => (
                    <div key={question.QuestionId} className="bg-gray-700 rounded-xl p-6 hover:shadow-xl transition-all border-l-4 border-green-500">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-lg">Q{index + 1}</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-semibold text-lg mb-3">{question.QuestionText}</p>
                          <span className="inline-block px-3 py-1 bg-green-900 text-green-200 rounded-full text-xs font-bold mb-3">
                            {question.QuestionType}
                          </span>
                          {question.QuestionType === "Multiple Choice" && question.Options && question.Options.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {question.Options.map((option, optIndex) => (
                                <div key={optIndex} className="flex items-center gap-2 text-gray-300 text-sm">
                                  <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-bold">
                                    {String.fromCharCode(65 + optIndex)}
                                  </div>
                                  {option}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "incidents" && (
          <div className="h-full overflow-y-auto p-6 bg-gray-800">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-yellow-400" />
                  Trial Incidents
                </h2>
                <button
                  onClick={() => setShowIncidentModal(true)}
                  className="px-5 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold flex items-center gap-2 shadow-xl"
                >
                  <FileWarning className="h-5 w-5" />
                  Report New Incident
                </button>
              </div>

              {/* Incident Stats */}
              {incidentStats.TotalIncidents > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <p className="text-gray-400 text-sm">Total</p>
                    <p className="text-white text-2xl font-bold">{incidentStats.TotalIncidents}</p>
                  </div>
                  <div className="bg-red-900/30 rounded-lg p-4">
                    <p className="text-red-300 text-sm">Critical</p>
                    <p className="text-red-400 text-2xl font-bold">{incidentStats.CriticalIncidents}</p>
                  </div>
                  <div className="bg-orange-900/30 rounded-lg p-4">
                    <p className="text-orange-300 text-sm">High</p>
                    <p className="text-orange-400 text-2xl font-bold">{incidentStats.HighIncidents}</p>
                  </div>
                  <div className="bg-yellow-900/30 rounded-lg p-4">
                    <p className="text-yellow-300 text-sm">Disruptive</p>
                    <p className="text-yellow-400 text-2xl font-bold">{incidentStats.DisruptiveIncidents}</p>
                  </div>
                  <div className="bg-green-900/30 rounded-lg p-4">
                    <p className="text-green-300 text-sm">Resolved</p>
                    <p className="text-green-400 text-2xl font-bold">{incidentStats.ResolvedIncidents}</p>
                  </div>
                </div>
              )}

              {incidents.length === 0 ? (
                <div className="text-center py-16 bg-gray-700 rounded-xl">
                  <AlertTriangle className="h-20 w-20 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-xl font-semibold">No incidents reported</p>
                  <p className="text-gray-500 text-sm mt-2">Incidents will appear here when reported</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {incidents.map((incident) => (
                    <div 
                      key={incident.IncidentId} 
                      className={`rounded-xl p-6 shadow-xl border-l-4 transition-all hover:shadow-2xl ${
                        incident.Severity === "critical" ? "bg-red-900/40 border-red-500" :
                        incident.Severity === "high" ? "bg-orange-900/40 border-orange-500" :
                        incident.Severity === "medium" ? "bg-yellow-900/40 border-yellow-500" :
                        "bg-blue-900/40 border-blue-500"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${
                            incident.Severity === "critical" ? "bg-red-600 text-white" :
                            incident.Severity === "high" ? "bg-orange-600 text-white" :
                            incident.Severity === "medium" ? "bg-yellow-600 text-white" :
                            "bg-blue-600 text-white"
                          }`}>
                            {incident.Severity?.toUpperCase()}
                          </span>
                          <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-xs font-semibold">
                            {incident.IncidentType}
                          </span>
                          {incident.ParticipantName && (
                            <span className="text-gray-400 text-sm">
                              <strong>•</strong> {incident.ParticipantName}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <Clock className="h-4 w-4" />
                            {new Date(incident.ReportedAt).toLocaleString()}
                          </div>
                          {incident.ReportedByName && (
                            <p className="text-gray-500 text-xs mt-1">by {incident.ReportedByName}</p>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-white font-medium mb-3 text-lg">{incident.Description}</p>
                      
                      {incident.ActionTaken && (
                        <div className="mt-3 p-3 bg-green-900/30 rounded-lg border-l-2 border-green-500">
                          <p className="text-green-300 text-sm">
                            <strong className="text-green-400">Action Taken:</strong> {incident.ActionTaken}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Control Bar */}
      <div className="bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-800 px-6 py-4 flex items-center justify-center gap-4 flex-shrink-0 shadow-2xl">
        <button
          onClick={toggleMute}
          className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg ${
            isMuted 
              ? "bg-red-600 hover:bg-red-700 text-white" 
              : "bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
          }`}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          {isMuted ? "Unmute" : "Mute"}
        </button>
        
        <button
          onClick={toggleVideo}
          className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg ${
            isVideoOff 
              ? "bg-red-600 hover:bg-red-700 text-white" 
              : "bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
          }`}
        >
          <Video className="h-5 w-5" />
          {isVideoOff ? "Start Video" : "Stop Video"}
        </button>

        <div className="h-8 w-px bg-white/30 mx-2"></div>

        <button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          className={`px-8 py-3 rounded-xl font-bold flex items-center gap-3 transition-all shadow-xl ${
            isRecording 
              ? "bg-red-600 hover:bg-red-700 animate-pulse" 
              : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
          } text-white`}
        >
          {isRecording ? (
            <>
              <StopCircle className="h-5 w-5" />
              Stop Recording
              <span className="text-xs opacity-90">({formatDuration(recordingDuration)})</span>
            </>
          ) : (
            <>
              <PlayCircle className="h-5 w-5" />
              Start Recording
            </>
          )}
        </button>

        <div className="h-8 w-px bg-white/30 mx-2"></div>

        <button
          onClick={() => setShowIncidentModal(true)}
          className="px-6 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white font-semibold flex items-center gap-2 shadow-xl transition-all"
        >
          <FileWarning className="h-5 w-5" />
          Report Incident
        </button>
        
        <button
          onClick={leaveCall}
          className="px-8 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-xl transition-all flex items-center gap-2"
        >
          <Ban className="h-5 w-5" />
          Leave Monitoring
        </button>
      </div>

      {/* Enhanced Incident Modal */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-2xl border-2 border-red-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-3xl font-bold text-white">Report Incident</h3>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-white font-semibold mb-2">Incident Type *</label>
                <select
                  value={incidentData.incidentType}
                  onChange={(e) => setIncidentData({...incidentData, incidentType: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border-2 border-gray-600 focus:border-red-500 focus:outline-none"
                >
                  <option value="disruptive">Disruptive Behavior</option>
                  <option value="inappropriate">Inappropriate Content</option>
                  <option value="technical">Technical Issue</option>
                  <option value="connection">Connection Problem</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Severity Level *</label>
                <select
                  value={incidentData.severity}
                  onChange={(e) => setIncidentData({...incidentData, severity: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border-2 border-gray-600 focus:border-red-500 focus:outline-none"
                >
                  <option value="low">Low - Minor issue</option>
                  <option value="medium">Medium - Moderate concern</option>
                  <option value="high">High - Serious issue</option>
                  <option value="critical">Critical - Immediate attention required</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Description *</label>
                <textarea
                  value={incidentData.description}
                  onChange={(e) => setIncidentData({...incidentData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg h-32 border-2 border-gray-600 focus:border-red-500 focus:outline-none resize-none"
                  placeholder="Describe the incident in detail..."
                />
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Action Taken (Optional)</label>
                <textarea
                  value={incidentData.actionTaken}
                  onChange={(e) => setIncidentData({...incidentData, actionTaken: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg h-24 border-2 border-gray-600 focus:border-red-500 focus:outline-none resize-none"
                  placeholder="Describe any immediate action you took..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowIncidentModal(false)}
                  className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReportIncident}
                  disabled={!incidentData.description.trim()}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl"
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}