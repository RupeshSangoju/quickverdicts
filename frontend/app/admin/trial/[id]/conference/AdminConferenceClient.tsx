"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { io, Socket } from "socket.io-client";
import {
  CallClient,
  VideoStreamRenderer,
  LocalVideoStream,
} from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import { ChatClient } from "@azure/communication-chat";
import RecordRTC, { RecordRTCPromisesHandler } from "recordrtc";
import { getToken } from "@/lib/apiClient";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Phone,
  Circle,
  Download,
  StopCircle,
  AlertCircle,
  MoreVertical,
  Pin,
  Volume2,
  UserX,
  FileText,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, "")
  : "http://localhost:4000";

export default function AdminConferenceClient() {
  const { id } = useParams();
  const router = useRouter();
  const caseId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  // Call states
  const [call, setCall] = useState<any>(null);
  const [callState, setCallState] = useState("Initializing...");
  const [participants, setParticipants] = useState<any[]>([]);
  const [featuredParticipant, setFeaturedParticipant] = useState<string>("local");
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Control states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [displayName, setDisplayName] = useState("Admin");
  const [renderTrigger, setRenderTrigger] = useState(0);

  // Track video, speaking, and mute states
  const [participantVideoStates, setParticipantVideoStates] = useState<Map<string, boolean>>(new Map());
  const [participantSpeakingStates, setParticipantSpeakingStates] = useState<Map<string, boolean>>(new Map());
  const [participantMuteStates, setParticipantMuteStates] = useState<Map<string, boolean>>(new Map());
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  // Hover menu states
  const [hoveredParticipant, setHoveredParticipant] = useState<string | null>(null);
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<RecordRTCPromisesHandler | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingAudioSourcesRef = useRef<MediaStreamAudioSourceNode[]>([]);
  const captureFrameIdRef = useRef<number | null>(null);

  // Chat states
  const [chatClient, setChatClient] = useState<any>(null);
  const [chatThread, setChatThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [showChatNotification, setShowChatNotification] = useState(false);
  const [latestMessage, setLatestMessage] = useState<any>(null);

  // Panel states
  const [showChatPanel, setShowChatPanel] = useState(false);

  // Jury Charge states
  const [showJuryChargePanel, setShowJuryChargePanel] = useState(false);
  const [juryChargeQuestions, setJuryChargeQuestions] = useState<any[]>([]);
  const [loadingJuryCharge, setLoadingJuryCharge] = useState(false);
  const [juryChargeLocked, setJuryChargeLocked] = useState(false);
  const [releasingJuryCharge, setReleasingJuryCharge] = useState(false);

  // Documents states
  const [showDocumentsPanel, setShowDocumentsPanel] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  // Participant join times
  const [participantJoinTimes, setParticipantJoinTimes] = useState<Map<string, Date>>(new Map());

  // Refs
  const featuredVideoRef = useRef<HTMLDivElement>(null);
  const localVideoStream = useRef<any>(null);
  const screenShareStream = useRef<any>(null);
  const screenShareRenderer = useRef<any>(null);
  const remoteVideoRefs = useRef<Map<string, any>>(new Map());
  const participantVideoRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const trackListenersRef = useRef<Map<string, { track: MediaStreamTrack; mute: () => void; unmute: () => void }>>(new Map());
  const hasInitialized = useRef(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = useRef<string>("");
  const callRef = useRef<any>(null);
  const callAgentRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const deviceManagerRef = useRef<any>(null);

  // Cleanup on page close/refresh
  useEffect(() => {
    const handleBeforeUnload = async () => {
      console.log("Page closing/refreshing - cleaning up call...");
      try {
        stopRecording();
        if (callRef.current) {
          await callRef.current.hangUp({ forEveryone: false });
        }
        if (callAgentRef.current) {
          await callAgentRef.current.dispose();
        }
      } catch (e) {
        console.error("Cleanup error:", e);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      stopRecording();
      if (callRef.current) {
        callRef.current.hangUp({ forEveryone: false }).catch((e: any) => console.error("Hangup error:", e));
      }
      remoteVideoRefs.current.forEach((r) => r.renderer?.dispose());

      // Clean up any remaining track listeners we attached
      try {
        trackListenersRef.current.forEach((entry, id) => {
          try {
            entry.track.removeEventListener('mute', entry.mute);
            entry.track.removeEventListener('unmute', entry.unmute);
          } catch (e) {
            // ignore
          }
        });
      } catch (e) {
        // ignore
      }
      trackListenersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    initializeCall();
  }, []);

  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Recording duration timer
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  // Helper function to extract user ID from CommunicationIdentifierKind
  const getUserId = (identifier: any): string => {
    if (identifier.communicationUserId) {
      return identifier.communicationUserId;
    }
    if (identifier.phoneNumber) {
      return identifier.phoneNumber;
    }
    if (identifier.id) {
      return identifier.id;
    }
    return identifier.rawId || 'unknown';
  };

  // Auto-switch to active speaker (unless pinned)
  useEffect(() => {
    if (!pinnedParticipant && activeSpeaker && activeSpeaker !== featuredParticipant) {
      console.log(`🔊 Auto-switching to active speaker: ${activeSpeaker}`);
      setFeaturedParticipant(activeSpeaker);
    }
  }, [activeSpeaker, pinnedParticipant]);

  // Clean helper to dispose video renderer
  function disposeVideoRenderer(participantId: string) {
    const ref = remoteVideoRefs.current.get(participantId);
    if (ref?.renderer) {
      try {
        ref.renderer.dispose();
      } catch (e) {
        console.warn(`Dispose warning for ${participantId}:`, e);
      }
      remoteVideoRefs.current.delete(participantId);
    }
  }
  // Clear participant video and show avatar (thumbnail-protection)
  function clearParticipantVideo(participantId: string) {
    console.log(`🧹 [THUMBNAIL FIX] Clearing ${participantId}`);

    // ── 1. Get thumbnail container ──
    const container = participantVideoRefs.current.get(participantId);
    if (container) {
      // Stop any playing tracks (kills frozen video)
      try {
        const video = container.querySelector('video') as HTMLVideoElement | null;
        if (video?.srcObject instanceof MediaStream) {
          video.srcObject.getTracks().forEach(t => {
            try { t.stop(); } catch {}
          });
          video.srcObject = null;
          video.load();
        }
      } catch (e) {}

      // ── Nuclear DOM removal ──
      container.innerHTML = '';
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      // Force browser reflow + repaint
      container.style.visibility = 'hidden';
      container.offsetHeight;
      container.style.visibility = 'visible';
    }

    // ── 2. Renderer cleanup ──
    const ref = remoteVideoRefs.current.get(participantId);
    if (ref?.renderer) {
      try {
        ref.renderer.dispose();
        console.log(` → Disposed thumbnail renderer for ${participantId}`);
      } catch (e) {}
      remoteVideoRefs.current.delete(participantId);
    }

    // ── 3. If this was featured → clear featured too (safety) ──
    if (featuredParticipant === participantId && featuredVideoRef.current) {
      featuredVideoRef.current.innerHTML = '';
    }

    // ── 4. Force React + browser update (very important for thumbnails) ──
    setRenderTrigger(prev => prev + 1);
    setTimeout(() => {
      setRenderTrigger(prev => prev + 1);
      // Extra reflow trick — works wonders on thumbnails
      if (container) {
        const parent = container.parentElement;
        if (parent) {
          parent.style.display = 'none';
          parent.offsetHeight;
          parent.style.display = '';
        }
      }
    }, 30);

    console.log(` → Cleared thumbnail for ${participantId}`);
  }

  // Render participant video in thumbnail
  async function renderParticipantVideoInThumbnail(participantId: string) {
    try {
      const container = participantVideoRefs.current.get(participantId);
      if (!container) return;

      // Clear existing content
      containerElement.innerHTML = "";



      // Check if this is local participant
      if (participantId === "local") {
        if (!isVideoOff && localVideoStream.current) {
          const renderer = new VideoStreamRenderer(localVideoStream.current);
          const view = await renderer.createView({ scalingMode: 'Crop' });
          container.appendChild(view.target);
          console.log("✅ Local thumbnail rendered");
        }
      } 
      // ── Remote participant ──
      else {
        const participant = participants.find((p: any) => getUserId(p.identifier) === participantId);
        if (participant?.videoStreams) {
          const videoStream = participant.videoStreams.find((s: any) => s.mediaStreamType === "Video");
          if (videoStream && videoStream.isAvailable) {
            // ✅ FIX: Dispose old renderer BEFORE creating new one
            console.log(`[THUMBNAIL] Checking for old renderer for ${participantId}...`);
            const existing = remoteVideoRefs.current.get(participantId);
            if (existing?.renderer) {
              try {
                existing.renderer.dispose();
                console.log(`[THUMBNAIL] → Disposed old renderer before new render for ${participantId}`);
              } catch (e) {
                console.warn(`[THUMBNAIL] Warning disposing old renderer:`, e);
              }
              remoteVideoRefs.current.delete(participantId);
            }

            // Remote camera is ON - render it
            const renderer = new VideoStreamRenderer(videoStream);
            const view = await renderer.createView({ scalingMode: 'Crop' });
            containerElement.appendChild(view.target);

            // ✅ CRITICAL FIX: Store the renderer so clearParticipantVideo can dispose it later!
            remoteVideoRefs.current.set(participantId, { renderer, stream: videoStream });
            console.log(`✅ Rendered remote video in thumbnail for ${participantId}`);
            console.log(`   → STORED REMOTE THUMBNAIL renderer for ${participantId} (THIS SHOULD FIX STUCK FRAME)`);
          }
        }
      }
    } catch (err) {
      console.error(`Thumbnail render failed for ${participantId}:`, err);
    }
  }

  // === WebSocket: join case room on connect and listen for camera state ===
  useEffect(() => {
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      socketRef.current = io(API_BASE, {
        path: "/socket.io",
        auth: { token: getToken() },
        transports: ["websocket", "polling"],
      });

      socketRef.current.on("connect", () => {
        console.log("✅ [Admin Socket] Connected! ID:", socketRef.current.id);
        const numericCaseId = parseInt(caseId as string);
        socketRef.current.emit("join_case", numericCaseId);
        console.log(`📍 [Admin Socket] Emitted join_case for case ${numericCaseId}`);
      });

      socketRef.current.on("joined_case", (data: any) => {
        console.log("✅ [Admin Socket] Successfully joined case room:", data);
      });

      socketRef.current.on("camera:state", (data: any) => {
        try {
          const { userId, isVideoOn } = data || {};
          if (!userId || userId === currentUserId.current) return;

          console.log(`[ADMIN RECEIVED] ${userId} → camera ${isVideoOn ? 'ON' : 'OFF'}`);

          setParticipantVideoStates(prev => {
            const updated = new Map(prev);
            updated.set(userId, isVideoOn);
            return updated;
          });

          if (!isVideoOn) {
            clearParticipantVideo(userId);
            // Optional: force thumbnail re-check (shows avatar)
            setTimeout(() => {
              const thumb = participantVideoRefs.current.get(userId);
              if (thumb) thumb.innerHTML = '';
            }, 100);
          } else {
            renderParticipantVideoInThumbnail(userId).catch(() => {});
          }

          // Always refresh if featured
          if (featuredParticipant === userId) {
            setRenderTrigger(prev => prev + 1);
          }
        } catch (e) {
          console.error("camera:state handler error:", e);
        }
      });

      return () => {
        try {
          socketRef.current?.off("connect");
          socketRef.current?.off("joined_case");
          socketRef.current?.off("camera:state");
          socketRef.current?.disconnect();
          socketRef.current = null;
        } catch (e) {
          // ignore
        }
      };
    } catch (e) {
      console.warn("Admin socket init error:", e);
    }
  }, [caseId, featuredParticipant]);

  async function renderFeaturedVideo() {
    if (!featuredVideoRef.current) return;

    try {
      featuredVideoRef.current.innerHTML = "";

      if (featuredParticipant === "screenshare" && screenShareStream.current) {
        // Local screenshare
        if (screenShareRenderer.current) {
          screenShareRenderer.current.dispose();
        }
        screenShareRenderer.current = new VideoStreamRenderer(screenShareStream.current);
        const view = await screenShareRenderer.current.createView();
        featuredVideoRef.current.appendChild(view.target);
        console.log("✅ Featured: Local screenshare");
      } else if (featuredParticipant && featuredParticipant.startsWith("screenshare-")) {
        // Remote screenshare
        const remoteRef = remoteVideoRefs.current.get(featuredParticipant);
        if (remoteRef?.stream && remoteRef.stream.isAvailable) {
          const renderer = new VideoStreamRenderer(remoteRef.stream);
          const view = await renderer.createView();
          featuredVideoRef.current.appendChild(view.target);
          console.log(`✅ Featured: Remote screenshare ${featuredParticipant}`);
        }
      } else if (featuredParticipant === "local") {
        // Local participant in main view
        if (!isVideoOff && localVideoStream.current) {
          const renderer = new VideoStreamRenderer(localVideoStream.current);
          const view = await renderer.createView();
          featuredVideoRef.current.appendChild(view.target);
          console.log("✅ Featured: Local video ON");
        } else {
          console.log("📹 Featured: Local video OFF - showing avatar");
        }
      } else if (featuredParticipant && featuredParticipant !== "screenshare") {
        // Remote participant in main view
        const participant = participants.find((p: any) => getUserId(p.identifier) === featuredParticipant);
        if (participant && participant.videoStreams) {
          const videoStream = participant.videoStreams.find((s: any) => s.mediaStreamType === "Video");
          if (videoStream && videoStream.isAvailable) {
            const renderer = new VideoStreamRenderer(videoStream);
            const view = await renderer.createView();
            featuredVideoRef.current.appendChild(view.target);
            console.log(`✅ Featured: Remote video ON for ${featuredParticipant}`);
          } else {
            console.log(`📹 Featured: Remote video OFF for ${featuredParticipant} - showing avatar`);
          }
        }
      }
    } catch (err) {
      console.error("Featured video render error:", err);
    }
  }

  useEffect(() => {
    renderFeaturedVideo();
  }, [featuredParticipant, renderTrigger, isVideoOff]);

  // ✅ FIX: Immediately clear video containers when camera is turned off
  useEffect(() => {
    participantVideoStates.forEach((isVideoOn, participantId) => {
      if (!isVideoOn) {
        const containerElement = participantVideoRefs.current.get(participantId);
        if (containerElement) {
          containerElement.innerHTML = "";
          console.log(`🧹 Cleared video container for ${participantId} (camera off)`);
        }
      }
    });
  }, [participantVideoStates]);

  // Render all participant thumbnails when participants or camera states change
  useEffect(() => {
    // Render local participant thumbnail
    renderParticipantVideoInThumbnail("local");

    // Render remote participant thumbnails
    participants.forEach((p: any) => {
      const userId = getUserId(p.identifier);
      renderParticipantVideoInThumbnail(userId);
    });
  }, [participants, isVideoOff, participantVideoStates]);

  // Set default featured participant to avoid black screen
  useEffect(() => {
    if (!featuredParticipant || featuredParticipant === "") {
      if (participants.length > 0) {
        const firstParticipant = participants[0];
        const userId = getUserId(firstParticipant.identifier);
        setFeaturedParticipant(userId);
        console.log(`🎯 Set default featured participant: ${userId}`);
      } else {
        setFeaturedParticipant("local");
        console.log("🎯 Set default featured participant: local");
      }
    }
  }, [participants.length, featuredParticipant]);

  async function initializeChat(token: string, userId: string, threadId: string, endpoint: string) {
    try {
      const tokenCredential = new AzureCommunicationTokenCredential(token);
      const client = new ChatClient(endpoint, tokenCredential);

      setChatClient(client);
      const thread = client.getChatThreadClient(threadId);
      setChatThread(thread);
      currentUserId.current = userId;

      await client.startRealtimeNotifications();

      client.on("chatMessageReceived", (e: any) => {
        if (getUserId(e.sender) !== currentUserId.current) {
          const newMsg = {
            id: e.id,
            content: e.message,
            sender: e.senderDisplayName || "Unknown",
            senderId: getUserId(e.sender),
            timestamp: new Date(e.createdOn),
          };

          setMessages(prev => [...prev, newMsg]);

          if (!showChatPanel) {
            setUnreadCount(prev => prev + 1);
            setLatestMessage(newMsg);
            setShowChatNotification(true);
            setTimeout(() => setShowChatNotification(false), 5000);
          }
        }
      });

      // Load message history
      try {
        const messagesIterator = thread.listMessages({ maxPageSize: 50 });
        const loadedMessages: any[] = [];

        for await (const message of messagesIterator) {
          if (message.type === "text") {
            loadedMessages.push({
              id: message.id,
              content: message.content?.message || "",
              sender: message.senderDisplayName || "Unknown",
              senderId: message.sender ? getUserId(message.sender) : "",
              timestamp: new Date(message.createdOn),
            });
          }
        }

        loadedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        setMessages(loadedMessages);
      } catch (historyErr) {
        console.log("No message history yet");
      }

    } catch (err) {
      console.error("Chat initialization error:", err);
    }
  }

  async function initializeCall() {
    try {
      setCallState("Getting admin permissions...");
      const token = getToken();

      const response = await fetch(`${API_BASE}/api/trial/admin-join/${caseId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to join trial as admin");
      const data = await response.json();
      setDisplayName(data.displayName || "Admin");

      // Initialize chat
      if (data.chatThreadId && data.endpointUrl) {
        await initializeChat(data.token, data.userId, data.chatThreadId, data.endpointUrl);
      }

      setCallState("Initializing devices...");

      const callClient = new CallClient();
      const tokenCredential = new AzureCommunicationTokenCredential(data.token);
      const deviceManager = await callClient.getDeviceManager();
      deviceManagerRef.current = deviceManager;
      await deviceManager.askDevicePermission({ video: true, audio: true });

      const cameras = await deviceManager.getCameras();
      if (cameras.length > 0) {
        localVideoStream.current = new LocalVideoStream(cameras[0]);
      }

      setCallState("Connecting to trial...");

      const agent = await callClient.createCallAgent(tokenCredential, {
        displayName: data.displayName || "Admin Monitor",
      });

      callAgentRef.current = agent;

      const roomCall = agent.join(
        { roomId: data.roomId },
        {
          videoOptions: localVideoStream.current
            ? { localVideoStreams: [localVideoStream.current] }
            : undefined,
        }
      );

      setCall(roomCall);
      callRef.current = roomCall;
      setParticipantJoinTimes(prev => new Map(prev).set("local", new Date()));

      roomCall.on("stateChanged", async () => {
        setCallState(roomCall.state);
        if (roomCall.state === "Connected") {
          setIsMuted(roomCall.isMuted);
          setRenderTrigger(prev => prev + 1);
        }
      });

      // Local video streams updated (screenshare)
      roomCall.on("localVideoStreamsUpdated", (e: any) => {
        e.added.forEach(async (stream: any) => {
          if (stream.mediaStreamType === "ScreenSharing") {
            screenShareStream.current = stream;
            setFeaturedParticipant("screenshare");
            setRenderTrigger(prev => prev + 1);
          }
        });

        e.removed.forEach((stream: any) => {
          if (stream.mediaStreamType === "ScreenSharing") {
            if (featuredVideoRef.current) {
              featuredVideoRef.current.innerHTML = "";
            }
            if (screenShareRenderer.current) {
              screenShareRenderer.current.dispose();
              screenShareRenderer.current = null;
            }
            screenShareStream.current = null;
            setIsScreenSharing(false);
            setFeaturedParticipant("local");
            setTimeout(() => setRenderTrigger(prev => prev + 1), 50);
          }
        });
      });

      // Remote participants updated
      roomCall.on("remoteParticipantsUpdated", (e: any) => {
        e.added.forEach((participant: any) => {
          const userId = getUserId(participant.identifier);
          setParticipantJoinTimes(prev => new Map(prev).set(userId, new Date()));

          // Subscribe to speaking state changes
          participant.on("isSpeakingChanged", () => {
            setParticipantSpeakingStates(prev => {
              const updated = new Map(prev);
              updated.set(userId, participant.isSpeaking);
              return updated;
            });

            if (participant.isSpeaking) {
              setActiveSpeaker(userId);
            }
          });

          // ✅ FIX: Track mute state using ACS SDK
          // Set initial mute state
          setParticipantMuteStates(prev => {
            const updated = new Map(prev);
            updated.set(userId, participant.isMuted);
            return updated;
          });

          // Listen for mute state changes
          participant.on("isMutedChanged", () => {
            console.log(`🔇 ${userId} mute state: ${participant.isMuted ? 'MUTED' : 'UNMUTED'}`);
            setParticipantMuteStates(prev => {
              const updated = new Map(prev);
              updated.set(userId, participant.isMuted);
              return updated;
            });
          });

          // Subscribe to video streams
          participant.on("videoStreamsUpdated", (streamEvent: any) => {
            streamEvent.added.forEach(async (stream: any) => {
              if (stream.mediaStreamType === "Video") {
                // Update state immediately
                setParticipantVideoStates(prev => {
                  const updated = new Map(prev);
                  updated.set(userId, stream.isAvailable);
                  return updated;
                });

                // Fast camera detection using MediaStreamTrack events
                if (stream.isAvailable) {
                  const mediaStream = stream.source?.getMediaStream?.();
                  const videoTrack = mediaStream?.getVideoTracks()?.[0];

                  if (videoTrack) {
                    const onMute = () => {
                      console.log(`[track.mute] ${userId} → camera treated as OFF`);
                      try { toast("Camera off detected quickly", { duration: 1500, icon: "📹" }); } catch (e) {}
                      setParticipantVideoStates(prev => {
                        const updated = new Map(prev);
                        updated.set(userId, false);
                        return updated;
                      });
                      clearParticipantVideo(userId);
                      if (featuredParticipant === userId) setRenderTrigger(prev => prev + 1);
                    };

                    const onUnmute = () => {
                      console.log(`[track.unmute] ${userId} → camera likely back ON`);
                      try { toast("Camera back on detected", { duration: 1500, icon: "📹" }); } catch (e) {}
                      setParticipantVideoStates(prev => {
                        const updated = new Map(prev);
                        updated.set(userId, true);
                        return updated;
                      });
                      renderParticipantVideoInThumbnail(userId).catch(err => console.warn(err));
                      if (featuredParticipant === userId) setRenderTrigger(prev => prev + 1);
                    };

                    try {
                      videoTrack.addEventListener('mute', onMute);
                      videoTrack.addEventListener('unmute', onUnmute);
                    } catch (err) {
                      console.warn(`Failed to attach track listeners for ${userId}:`, err);
                    }

                    if (videoTrack.muted) onMute();

                    trackListenersRef.current.set(userId, {
                      track: videoTrack,
                      mute: onMute,
                      unmute: onUnmute,
                    });
                  }
                }

                // Always keep the fallback isAvailableChanged handler
                stream.on("isAvailableChanged", async () => {
                  console.log(`[fallback isAvailable] ${userId} → ${stream.isAvailable ? 'ON' : 'OFF'}`);
                  setParticipantVideoStates(prev => {
                    const updated = new Map(prev);
                    updated.set(userId, stream.isAvailable);
                    return updated;
                  });

                  if (!stream.isAvailable) {
                    clearParticipantVideo(userId);
                  } else {
                    await renderParticipantVideoInThumbnail(userId);
                  }
                });
              } else if (stream.mediaStreamType === "ScreenSharing") {
                // Remote participant started screensharing
                console.log(`📺 Remote screenshare started by ${userId}, isAvailable: ${stream.isAvailable}`);
                const screenshareKey = `screenshare-${userId}`;

                // Store the screenshare stream
                remoteVideoRefs.current.set(screenshareKey, {
                  stream,
                  renderer: null,
                  view: null,
                  streamType: 'ScreenSharing',
                  disposed: false
                });

                if (stream.isAvailable) {
                  // Stream is available, show it immediately
                  console.log(`✅ Screenshare is available, showing immediately`);
                  setFeaturedParticipant(screenshareKey);
                  setPinnedParticipant(screenshareKey);
                  setRenderTrigger(prev => prev + 1);
                } else {
                  // Wait for stream to become available
                  console.log(`⏳ Screenshare not yet available, waiting...`);
                  stream.on("isAvailableChanged", async () => {
                    console.log(`📺 Screenshare availability changed: ${stream.isAvailable}`);
                    if (stream.isAvailable) {
                      setFeaturedParticipant(screenshareKey);
                      setPinnedParticipant(screenshareKey);
                      setRenderTrigger(prev => prev + 1);
                    } else {
                      // Screenshare stopped
                      if (featuredParticipant === screenshareKey) {
                        setFeaturedParticipant("local");
                        setPinnedParticipant(null);
                      }
                      setRenderTrigger(prev => prev + 1);
                    }
                  });
                }
              }
            });

            streamEvent.removed.forEach((stream: any) => {
              if (stream.mediaStreamType === "Video") {
                // Video stream removed - clear and show avatar
                clearParticipantVideo(userId);
                setParticipantVideoStates(prev => {
                  const updated = new Map(prev);
                  updated.set(userId, false);
                  return updated;
                });

                // Remove any attached track listeners for this participant
                try {
                  const entry = trackListenersRef.current.get(userId);
                  if (entry) {
                    try {
                      entry.track.removeEventListener('mute', entry.mute);
                      entry.track.removeEventListener('unmute', entry.unmute);
                    } catch (e) {}
                    trackListenersRef.current.delete(userId);
                  }
                } catch (e) {}
              } else if (stream.mediaStreamType === "ScreenSharing") {
                const key = `screenshare-${userId}`;
                const ref = remoteVideoRefs.current.get(key);
                if (ref) {
                  ref.renderer?.dispose();
                  remoteVideoRefs.current.delete(key);
                }
                if (featuredVideoRef.current) {
                  featuredVideoRef.current.innerHTML = "";
                }
                setFeaturedParticipant("local");
                setRenderTrigger(prev => prev + 1);
              }
            });
          });

          // Process existing streams
          participant.videoStreams.forEach(async (stream: any) => {
            if (stream.mediaStreamType === "Video") {
              // Set initial video state
              setParticipantVideoStates(prev => {
                const updated = new Map(prev);
                updated.set(userId, stream.isAvailable);
                return updated;
              });

              if (stream.isAvailable) {
                await renderParticipantVideoInThumbnail(userId);
              }
            } else if (stream.mediaStreamType === "ScreenSharing") {
              // Process existing screenshare when participant joins late
              console.log(`📺 Existing screenshare detected from ${userId}, isAvailable: ${stream.isAvailable}`);
              const screenshareKey = `screenshare-${userId}`;

              // Store the screenshare stream
              remoteVideoRefs.current.set(screenshareKey, {
                stream,
                renderer: null,
                view: null,
                streamType: 'ScreenSharing',
                disposed: false
              });

              if (stream.isAvailable) {
                // Stream is available, show it immediately
                console.log(`✅ Existing screenshare is available, showing immediately`);
                setFeaturedParticipant(screenshareKey);
                setPinnedParticipant(screenshareKey);
                setRenderTrigger(prev => prev + 1);
              } else {
                // Wait for stream to become available
                console.log(`⏳ Existing screenshare not yet available, waiting...`);
                stream.on("isAvailableChanged", async () => {
                  console.log(`📺 Existing screenshare availability changed: ${stream.isAvailable}`);
                  if (stream.isAvailable) {
                    setFeaturedParticipant(screenshareKey);
                    setPinnedParticipant(screenshareKey);
                    setRenderTrigger(prev => prev + 1);
                  }
                });
              }
            }
          });
        });

        e.removed.forEach((participant: any) => {
          const userId = getUserId(participant.identifier);
          const ref = remoteVideoRefs.current.get(userId);
          if (ref && ref.renderer) {
            ref.renderer.dispose();
            remoteVideoRefs.current.delete(userId);
          }
          setParticipantJoinTimes(prev => {
            const updated = new Map(prev);
            updated.delete(userId);
            return updated;
          });
        });

        setParticipants([...roomCall.remoteParticipants]);
      });

      roomCall.on("isMutedChanged", () => {
        setIsMuted(roomCall.isMuted);
      });

      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to join trial");
      setLoading(false);
    }
  }

  const sendMessage = async () => {
    if (!chatThread || !newMessage.trim()) return;

    try {
      await chatThread.sendMessage({ content: newMessage });

      const msg = {
        id: Date.now().toString(),
        content: newMessage,
        sender: displayName,
        senderId: currentUserId.current,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, msg]);
      setNewMessage("");
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  const toggleChatPanel = () => {
    setShowChatPanel(!showChatPanel);
    if (!showChatPanel) {
      setUnreadCount(0);
      setShowChatNotification(false);
    }
  };

  const loadJuryCharge = async () => {
    try {
      setLoadingJuryCharge(true);
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/jury-charge/questions/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setJuryChargeQuestions(data.questions || []);

        // Check if already released
        const lockResponse = await fetch(`${API_BASE}/api/jury-charge/check-locked/${caseId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (lockResponse.ok) {
          const lockData = await lockResponse.json();
          setJuryChargeLocked(lockData.isLocked || false);
        }
      }
    } catch (err) {
      console.error("Error loading jury charge:", err);
    } finally {
      setLoadingJuryCharge(false);
    }
  };

  const toggleJuryChargePanel = () => {
    if (!showJuryChargePanel) {
      loadJuryCharge();
      setShowDocumentsPanel(false); // Close documents panel when opening jury charge
    }
    setShowJuryChargePanel(!showJuryChargePanel);
  };

  const releaseJuryCharge = async () => {
    if (!confirm(`Release ${juryChargeQuestions.length} questions to jurors?\n\nThis will lock the jury charge and make it available to all jurors.`)) {
      return;
    }

    try {
      setReleasingJuryCharge(true);
      const token = getToken();
      console.log('🚀 Releasing jury charge for case:', caseId);

      const response = await fetch(`${API_BASE}/api/jury-charge/release/${caseId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Release response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Release successful:', data);
        setJuryChargeLocked(true);
        toast.success("Jury charge released to jurors successfully!", { duration: 4000 });
      } else {
        const errorData = await response.json();
        console.error('❌ Release failed:', errorData);
        throw new Error(errorData.message || "Failed to release jury charge");
      }
    } catch (err) {
      console.error("Error releasing jury charge:", err);
      toast.error(err instanceof Error ? err.message : "Failed to release jury charge", { duration: 4000 });
    } finally {
      setReleasingJuryCharge(false);
    }
  };

  const downloadVerdicts = async () => {
    try {
      console.log(`📥 [AdminConference] Downloading verdicts for case ${caseId}...`);
      const token = getToken();

      if (!token) {
        toast.error('Authentication required', { duration: 4000 });
        return;
      }

      // FIXED: Use the correct endpoint that reads from Verdicts table
      const response = await fetch(`${API_BASE}/api/verdicts/case/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log(`📥 [AdminConference] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [AdminConference] Error response:`, errorText);
        throw new Error('Failed to fetch verdicts');
      }

      const data = await response.json();
      console.log(`📥 [AdminConference] Data received:`, data);

      // API returns { success: true, count: X, data: verdicts }
      const verdicts = data.data || data.verdicts || [];
      console.log(`📥 [AdminConference] Verdicts count: ${verdicts.length}`);

      if (verdicts.length === 0) {
        toast.error('No verdicts have been submitted yet', { duration: 5000 });
        return;
      }

      // Get jury charge questions to match with responses
      console.log(`📋 [AdminConference] Fetching questions for case ${caseId}...`);
      const questionsResponse = await fetch(`${API_BASE}/api/jury-charge/questions/${caseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log(`📋 [AdminConference] Questions response status: ${questionsResponse.status}`);

      let questions: any[] = [];
      if (questionsResponse.ok) {
        const questionsData = await questionsResponse.json();
        console.log(`📋 [AdminConference] Questions data received:`, questionsData);

        questions = (questionsData.questions || []).sort((a: any, b: any) =>
          (a.OrderIndex || 0) - (b.OrderIndex || 0)
        );

        console.log(`📋 [AdminConference] Found ${questions.length} questions`);
        if (questions.length > 0) {
          console.log(`📋 [AdminConference] First question:`, questions[0]);
        }
      } else {
        const errorText = await questionsResponse.text();
        console.error(`❌ [AdminConference] Failed to fetch questions:`, errorText);
        toast.error('Warning: Could not fetch questions for CSV headers', { duration: 5000 });
      }

      // Build CSV with questions as columns
      const csvRows: string[] = [];

      // Header row: Juror Name, Juror Email, Submitted At, [Question 1], [Question 2], ...
      const headers = ['Juror Name', 'Juror Email', 'Submitted At'];
      questions.forEach((q: any) => {
        headers.push(q.QuestionText || `Question ${q.QuestionId}`);
      });

      console.log(`📋 [AdminConference] CSV Headers (${headers.length} total):`, headers);
      csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

      // Data rows: one row per juror
      verdicts.forEach((verdict: any, idx: number) => {
        const jurorName = verdict.JurorName || `Juror #${verdict.JurorId}`;
        const jurorEmail = verdict.JurorEmail || 'Unknown';
        const submittedAt = verdict.SubmittedAt ? new Date(verdict.SubmittedAt).toLocaleString() : '';
        const responses = verdict.Responses || {};

        if (idx === 0) {
          // Log first verdict's responses for debugging
          console.log(`📋 [AdminConference] Sample verdict responses:`, {
            jurorName,
            responsesKeys: Object.keys(responses),
            responsesCount: Object.keys(responses).length
          });
        }

        const row = [
          `"${jurorName.replace(/"/g, '""')}"`,
          `"${jurorEmail.replace(/"/g, '""')}"`,
          `"${submittedAt}"`
        ];

        // Add response for each question in order
        questions.forEach((q: any) => {
          const questionId = String(q.QuestionId);
          const response = responses[questionId];
          const responseValue = response !== undefined && response !== null
            ? (typeof response === 'object' ? JSON.stringify(response) : String(response))
            : '';
          row.push(`"${responseValue.replace(/"/g, '""')}"`);
        });

        csvRows.push(row.join(','));
      });

      // Download CSV
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `case-${caseId}-verdicts-${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log(`✅ [AdminConference] Downloaded ${verdicts.length} verdict(s) with ${questions.length} questions as columns`);
      toast.success(`Downloaded ${verdicts.length} verdict(s) - each juror in one row!`, { duration: 4000 });
    } catch (err) {
      console.error('❌ [AdminConference] Error downloading verdicts:', err);
      toast.error('Failed to download verdicts', { duration: 4000 });
    }
  };

  const endMeetForAll = async () => {
    if (!confirm('End the trial for everyone?\n\nThis will disconnect all participants and move the case to View Results state.')) {
      return;
    }

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/trial/end/${caseId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Trial ended successfully', { duration: 4000 });
        // Hang up call first
        if (callRef.current) {
          try {
            await callRef.current.hangUp({ forEveryone: true });
          } catch (hangupError) {
            console.log('Hangup completed:', hangupError);
          }
        }
        if (chatClient) {
          try {
            await chatClient.stopRealtimeNotifications();
          } catch (chatError) {
            console.log('Chat cleanup completed:', chatError);
          }
        }
        // Redirect to admin dashboard
        router.push('/admin');
      } else {
        throw new Error('Failed to end trial');
      }
    } catch (err) {
      console.error('Error ending trial:', err);
      toast.error('Failed to end trial', { duration: 4000 });
    }
  };

  const loadDocuments = async () => {
    try {
      setLoadingDocuments(true);
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/war-room/cases/${caseId}/war-room/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Error loading documents:", err);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const toggleDocumentsPanel = () => {
    if (!showDocumentsPanel) {
      loadDocuments();
      setShowJuryChargePanel(false); // Close jury charge panel when opening documents
    }
    setShowDocumentsPanel(!showDocumentsPanel);
  };

  const toggleMute = async () => {
    const currentCall = callRef.current;
    if (!currentCall) {
      console.error("No active call found");
      return;
    }
    try {
      console.log(`🎤 Toggling mute. Current state: ${currentCall.isMuted ? 'MUTED' : 'UNMUTED'}`);
      if (currentCall.isMuted) {
        await currentCall.unmute();
        setIsMuted(false);
        console.log("✅ Unmuted successfully");
      } else {
        await currentCall.mute();
        setIsMuted(true);
        console.log("✅ Muted successfully");
      }
    } catch (err) {
      console.error("❌ Toggle mute error:", err);
    }
  };

  const toggleVideo = async () => {
    const currentCall = callRef.current;
    if (!currentCall) {
      console.error("[Admin] No active call found");
      toast.error("No active call");
      return;
    }

    try {
      console.log(`📹 [Admin Toggle] Current: ${isVideoOff ? 'OFF' : 'ON'}`);

      if (isVideoOff) {
        // === Turning ON ===
        if (!deviceManagerRef.current) {
          toast.error("No device manager");
          return;
        }

        const cameras = await deviceManagerRef.current.getCameras();
        if (cameras.length === 0) {
          toast.error("No cameras found");
          return;
        }

        // Fresh stream
        localVideoStream.current = new LocalVideoStream(cameras[0]);
        await currentCall.startVideo(localVideoStream.current);
        setIsVideoOff(false);
        console.log("✅ [Admin] Camera ON");

        // Broadcast ON
        if (socketRef.current?.connected) {
          console.log("[Admin] Emitting camera:state ON");
          socketRef.current.emit("camera:state", {
            caseId: parseInt(caseId),
            userId: currentUserId.current || "admin-local",
            isVideoOn: true
          });
        }
      } else {
        // === Turning OFF ===
        console.log("🛑 [Admin] Stopping camera...");

        // Stop ACS stream (ignore errors but log)
        try {
          if (localVideoStream.current) {
            await currentCall.stopVideo(localVideoStream.current);
            console.log("✅ [Admin] stopVideo OK");
          }
        } catch (e) {
          console.warn("[Admin] stopVideo failed:", e);
        }

        // Clear local containers aggressively
        if (featuredParticipant === "local" && featuredVideoRef.current) {
          featuredVideoRef.current.innerHTML = "";
        }
        const localContainer = participantVideoRefs.current.get("local");
        if (localContainer) {
          localContainer.innerHTML = "";
        }

        localVideoStream.current = null;
        setIsVideoOff(true);
        setRenderTrigger(prev => prev + 1);

        // If own local was featured → switch away
        if (featuredParticipant === "local") {
          if (!pinnedParticipant) {
            const activeHasVideo = activeSpeaker && participantVideoStates.get(activeSpeaker);
            if (activeHasVideo) setFeaturedParticipant(activeSpeaker as string);
            else {
              const replacement = participants.find((p: any) => participantVideoStates.get(getUserId(p.identifier)));
              if (replacement) setFeaturedParticipant(getUserId(replacement.identifier));
              else setFeaturedParticipant("local");
            }
          } else {
            setRenderTrigger(prev => prev + 1);
          }
        }
        console.log("✅ [Admin] Camera OFF - local cleared");

        // Broadcast OFF (critical!)
        if (socketRef.current?.connected) {
          console.log("[Admin] Emitting camera:state OFF");
          socketRef.current.emit("camera:state", {
            caseId: parseInt(caseId),
            userId: currentUserId.current || "admin-local",
            isVideoOn: false
          });
        } else {
          console.warn("[Admin] Socket not connected - cannot broadcast OFF");
        }
      }
    } catch (err) {
      console.error("[Admin] Toggle error:", err);
      toast.error("Camera toggle failed");
    }
  };

  const toggleScreenShare = async () => {
    if (!call) return;

    try {
      if (isScreenSharing) {
        await call.stopScreenSharing();
        setIsScreenSharing(false);
      } else {
        await call.startScreenSharing();
        setIsScreenSharing(true);
      }
    } catch (err: any) {
      console.error("Screen share error:", err);
      setIsScreenSharing(false);
      toast.error("Screen sharing failed. Please try again.", { duration: 4000 });
    }
  };

  // RecordRTC handles codec conversion internally - no need for manual conversion

  const startRecording = async () => {
    try {
      if (!call) {
        toast.error("Call not active", { duration: 3000 });
        return;
      }

      console.log("🎥 Starting recording with ALL participants audio...");

      // ✅ CRITICAL FIX: Show instructions to ensure admin captures tab audio
      const userConfirmed = window.confirm(
        "🎬 RECORDING SETUP - READ CAREFULLY!\n\n" +
        "To record ALL participants' voices:\n\n" +
        "1️⃣ In the next dialog, select 'Chrome Tab' (or 'Browser Tab')\n" +
        "2️⃣ Select THIS current tab where the trial is running\n" +
        "3️⃣ MUST CHECK ☑️ 'Share tab audio' checkbox at the bottom!\n\n" +
        "⚠️ If you don't check 'Share tab audio', only YOUR voice will be recorded!\n\n" +
        "✅ Ready? Click OK to start..."
      );

      if (!userConfirmed) {
        console.log("❌ Recording cancelled by admin");
        return;
      }

      // ✅ FIX: Request browser TAB with audio to capture the call's audio output
      // This is the ONLY way to capture all remote participants' audio in the browser
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "browser",  // ✅ Changed to 'browser' to prefer tab selection
        },
        audio: {
          echoCancellation: false,  // Don't process - we want raw call audio
          noiseSuppression: false,
          autoGainControl: false,
        },
        preferCurrentTab: true  // ✅ Suggest current tab
      } as any);

      const screenVideoTrack = screenStream.getVideoTracks()[0];
      const screenAudioTracks = screenStream.getAudioTracks();
      console.log(`✅ Screen capture started: ${screenVideoTrack.label}`);
      console.log(`🎤 Screen audio tracks captured: ${screenAudioTracks.length}`);

      // ✅ CRITICAL: Check if tab audio was captured
      if (screenAudioTracks.length === 0) {
        toast.error(
          "❌ NO AUDIO CAPTURED! You forgot to check 'Share tab audio'!\n\nOnly screen video will be recorded. Stop and restart recording to capture audio.",
          { duration: 10000 }
        );
        console.error("❌ RECORDING ISSUE: No audio tracks found - tab audio was not shared!");
      } else {
        console.log(`✅ SUCCESS: Tab audio captured! All participants will be audible in recording.`);
        toast.success(
          "✅ Recording started with audio! All participants' voices will be captured.",
          { duration: 4000 }
        );
      }

      // Handle when user stops screen sharing from browser UI
      screenVideoTrack.addEventListener('ended', () => {
        console.log("⚠️ Screen sharing stopped by user");
        stopRecording();
        toast("Screen recording stopped - screen sharing ended", { duration: 4000, icon: 'ℹ️' });
      });

      // Create audio context for mixing audio
      const audioContext = new AudioContext();
      recordingAudioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();

      // Clear previous audio sources
      recordingAudioSourcesRef.current = [];

      // ✅ CRITICAL FIX: When capturing tab audio, we get ALL call audio (all participants mixed)
      // Tab audio includes: admin's voice + all remote participants' voices + system sounds
      // We DON'T need to extract individual participant streams!

      if (screenAudioTracks.length > 0) {
        console.log("✅ Using tab audio - this contains ALL participants' voices mixed together!");
        console.log(`📊 Tab audio info:`, {
          trackCount: screenAudioTracks.length,
          trackLabel: screenAudioTracks[0].label,
          trackId: screenAudioTracks[0].id,
          participantsInCall: participants.length
        });
      }

      // ✅ Check for muted participants and warn
      const mutedParticipants: string[] = [];
      participants.forEach((p: any) => {
        const userId = getUserId(p.identifier);
        if (participantMuteStates.get(userId) === true) {
          mutedParticipants.push(p.displayName || userId);
        }
      });

      if (mutedParticipants.length > 0) {
        console.warn(`🔇 ${mutedParticipants.length} participant(s) currently MUTED:`, mutedParticipants.join(', '));
        toast(`🔇 Note: ${mutedParticipants.length} participant(s) currently muted. They won't be audible until they unmute.`, {
          duration: 6000,
          icon: '🔇'
        });
      }

      // ✅ FIX: Use tab audio directly - it already has all participants mixed!
      // No need for AudioContext mixing since the browser already mixes all call audio
      const combinedTracks = [screenVideoTrack, ...screenAudioTracks];
      const combinedStream = new MediaStream(combinedTracks);
      console.log(`🎬 Recording stream: ${combinedTracks.length} tracks (1 video + ${screenAudioTracks.length} audio with ALL participants)`);

      // Store stream reference for cleanup later
      recordingStreamRef.current = combinedStream;

      // ✅ Using RecordRTC for better codec handling and cross-browser compatibility
      // RecordRTC automatically selects the best available codecs and handles conversion
      console.log('🎬 Initializing RecordRTC for reliable recording...');

      const recorder = new RecordRTCPromisesHandler(combinedStream, {
        type: 'video',
        mimeType: 'video/webm',  // RecordRTC will handle codec selection
        recorderType: RecordRTC.MediaStreamRecorder,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
        timeSlice: 1000,  // Get data every second
        ondataavailable: (blob: Blob) => {
          console.log(`📦 Recording chunk: ${blob.size} bytes`);
        },
      });

      await recorder.startRecording();
      mediaRecorderRef.current = recorder;
      console.log('✅ RecordRTC recording started with automatic codec selection');
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      const startTime = Date.now();
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      console.log("✅ Recording started successfully with tab audio (all participants included)!");
    } catch (err) {
      console.error("❌ Recording start error:", err);
      toast.error("Failed to start recording: " + (err as Error).message, { duration: 5000 });
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log("🛑 Stopping RecordRTC recording...");

      try {
        await mediaRecorderRef.current.stopRecording();
        const blob = await mediaRecorderRef.current.getBlob();

        console.log(`💾 Final blob size: ${blob.size} bytes (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`📼 Recording MIME type: ${blob.type}`);

        // Set file extension based on blob type
        const fileExtension = blob.type.includes('mp4') ? 'mp4' : 'webm';
        (blob as any).fileExtension = fileExtension;

        setRecordingBlob(blob);
        toast.success('Recording saved successfully!', { duration: 3000 });

        // Clean up stream tracks
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
          recordingStreamRef.current = null;
        }

        // Destroy recorder
        await mediaRecorderRef.current.destroy();
        mediaRecorderRef.current = null;

      } catch (error) {
        console.error('❌ Error stopping recording:', error);
        toast.error('Failed to save recording', { duration: 4000 });
      }

      setIsRecording(false);

      // Clear duration timer
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      // Extra safety: clean track listeners when stopping recording
      try {
        trackListenersRef.current.forEach((listener, userId) => {
          try {
            listener.track.removeEventListener('mute', listener.mute);
            listener.track.removeEventListener('unmute', listener.unmute);
            console.log(`Recording stopped → cleaned track listeners for ${userId}`);
          } catch (err) {}
        });
      } catch (err) {}
      trackListenersRef.current.clear();
    }
  };

  const downloadRecording = () => {
    if (!recordingBlob) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const durationStr = `${Math.floor(recordingDuration / 60)}m${recordingDuration % 60}s`;

    console.log("💾 Downloading recorded video...");
    console.log(`   Size: ${(recordingBlob.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Duration: ${durationStr}`);

    // Determine best file extension from blob metadata
    const rawExt = (recordingBlob as any)?.fileExtension || '';
    const type = recordingBlob.type || '';
    let ext = rawExt || (type ? type.split('/')[1]?.split(';')[0] : 'webm');

    // Normalize some common MIME-derived extensions
    if (!ext) ext = 'webm';
    if (ext === 'x-matroska') ext = 'webm';
    if (ext.includes('mp4') || type.includes('mp4')) ext = 'mp4';
    if (ext.includes('webm')) ext = 'webm';

    const filename = `trial-recording-${caseId}-${durationStr}-${timestamp}.${ext}`;

    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show helpful message about WebM playback compatibility
    if (ext === 'webm') {
      const hasOpus = type.includes('opus');
      if (hasOpus) {
        toast(
          'Warning: This recording uses Opus audio codec which may not play in all browsers. If you experience playback issues, use the conversion endpoint (/api/recordings/convert) to convert to MP4 with AAC audio for universal compatibility.',
          { duration: 12000 }
        );
      } else {
        const isMac = typeof navigator !== 'undefined' && /mac|darwin/i.test(navigator.platform || '');
        if (isMac) {
          toast(
            'Note: macOS QuickTime does not play .webm files natively. Use VLC or a modern browser for playback.',
            { duration: 8000 }
          );
        } else {
          toast.success('Recording downloaded successfully! WebM format should play in most modern browsers.', { duration: 4000 });
        }
      }
    } else {
      toast.success('Recording downloaded successfully!', { duration: 4000 });
    }

    // Reset state
    setRecordingBlob(null);
    setRecordingDuration(0);
  };

  const leaveCall = async () => {
    try {
      stopRecording();
      if (call) await call.hangUp();
      if (chatClient) await chatClient.stopRealtimeNotifications();
      toast.success("You have left the trial successfully", { duration: 3000 });
      router.push("/admin/dashboard");
    } catch (error) {
      console.log("Leave call completed with cleanup:", error);
      router.push("/admin/dashboard");
    }
  };

  const handlePinParticipant = (participantId: string) => {
    if (pinnedParticipant === participantId) {
      setPinnedParticipant(null);
    } else {
      setPinnedParticipant(participantId);
      setFeaturedParticipant(participantId);
    }
    setShowMenuFor(null);
  };

  const handleMuteParticipant = async (participantId: string) => {
    // Admin mute functionality (would need backend support)
    console.log("Mute participant:", participantId);
    setShowMenuFor(null);
  };

  const handleKickParticipant = async (participantId: string) => {
    // Admin kick functionality (would need backend support)
    console.log("Kick participant:", participantId);
    setShowMenuFor(null);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string): string => {
    const colors = [
      "from-blue-500 to-blue-600",
      "from-green-500 to-green-600",
      "from-purple-500 to-purple-600",
      "from-pink-500 to-pink-600",
      "from-indigo-500 to-indigo-600",
      "from-orange-500 to-orange-600",
      "from-teal-500 to-teal-600",
      "from-cyan-500 to-cyan-600",
    ];
    const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "#f0ebe0" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 mx-auto mb-6" style={{ borderTopColor: "#0A2342", borderBottomColor: "#0A2342" }}></div>
          <p className="text-xl font-semibold" style={{ color: "#0A2342" }}>{callState}</p>
          <p className="text-gray-600 mt-2">Admin Monitor Mode</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "#f0ebe0" }}>
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md border border-gray-200">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Failed to Join Trial</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="w-full py-3 text-white rounded-xl font-semibold transition hover:opacity-90"
              style={{ backgroundColor: "#0A2342" }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ FIX: Only show screen share participants when they're ACTIVELY sharing
  const screenShareParticipants = participants
    .filter((p: any) => {
      const userId = getUserId(p.identifier);
      const screenshareKey = `screenshare-${userId}`;
      const screenshareRef = remoteVideoRefs.current.get(screenshareKey);
      // ✅ Only show if screenshare exists AND is available
      return screenshareRef && screenshareRef.stream && screenshareRef.stream.isAvailable;
    })
    .map((p: any) => {
      const userId = getUserId(p.identifier);
      return {
        id: `screenshare-${userId}`,
        displayName: `${p.displayName}'s Screen`,
        isLocal: false,
        isScreenShare: true,
        joinTime: participantJoinTimes.get(userId),
        role: "Screen Share"
      };
    });

  // Add local screen share if active
  if (isScreenSharing && screenShareStream.current) {
    screenShareParticipants.unshift({
      id: "screenshare",
      displayName: "Your Screen",
      isLocal: true,
      isScreenShare: true,
      joinTime: new Date(),
      role: "Screen Share"
    });
  }

  const allParticipants = [
    {
      id: "local",
      displayName: displayName,
      isLocal: true,
      joinTime: participantJoinTimes.get("local"),
      role: "Admin"
    },
    ...participants.map((p: any) => ({
      id: getUserId(p.identifier),
      displayName: p.displayName || "Participant",
      isLocal: false,
      participant: p,
      joinTime: participantJoinTimes.get(getUserId(p.identifier)),
      role: p.displayName?.includes("Attorney") ? "Attorney" : "Juror"
    })),
    ...screenShareParticipants
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#f0ebe0" }}>
      {/* Container with chat support */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content Area - More space for video when panels open */}
        <div className={`flex flex-col transition-all duration-300 ${
          showChatPanel || showJuryChargePanel || showDocumentsPanel ? 'w-4/5' : 'w-4/5 mx-auto'
        }`}>
          {/* Header */}
          <div className="px-6 py-3 flex items-center justify-between shadow-lg" style={{ backgroundColor: "#16305B" }}>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white font-semibold">Admin Monitoring Mode</span>
              <span className="text-white/80 text-sm">• Case #{caseId}</span>
            </div>
            {isRecording && (
              <div className="flex items-center gap-2 bg-red-500/20 px-4 py-2 rounded-lg">
                <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" />
                <span className="text-white font-mono font-semibold">{formatDuration(recordingDuration)}</span>
              </div>
            )}
          </div>

          {/* Middle Section - Featured Video + Vertical Participants Sidebar */}
          <div className="flex-1 flex gap-3 p-4 overflow-hidden">
        {/* Featured Video (Large Left Section) */}
        <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-2xl relative">
          <div
            ref={featuredVideoRef}
            className="w-full h-full [&>div]:!w-full [&>div]:!h-full [&_video]:object-contain"
          />
          {/* Show avatar when camera is off */}
          {featuredParticipant === "local" && isVideoOff && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <div className="text-center">
                <div className={`w-40 h-40 rounded-full bg-gradient-to-br ${getAvatarColor(displayName)} flex items-center justify-center mb-4 shadow-2xl`}>
                  <span className="text-white text-6xl font-bold">
                    {getInitials(displayName)}
                  </span>
                </div>
                <p className="text-white text-2xl font-semibold">{displayName}</p>
                <p className="text-gray-400 text-sm mt-2">Camera is off</p>
              </div>
            </div>
          )}
          {featuredParticipant !== "local" && !featuredParticipant?.startsWith("screenshare") && participantVideoStates.get(featuredParticipant) !== true && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <div className="text-center">
                <div className={`w-40 h-40 rounded-full bg-gradient-to-br ${getAvatarColor(allParticipants.find(p => p.id === featuredParticipant)?.displayName || "User")} flex items-center justify-center mb-4 shadow-2xl`}>
                  <span className="text-white text-6xl font-bold">
                    {getInitials(allParticipants.find(p => p.id === featuredParticipant)?.displayName || "User")}
                  </span>
                </div>
                <p className="text-white text-2xl font-semibold">
                  {allParticipants.find(p => p.id === featuredParticipant)?.displayName || "Participant"}
                </p>
                <p className="text-gray-400 text-sm mt-2">Camera is off</p>
              </div>
            </div>
          )}
        </div>

        {/* Vertical Participants Sidebar (Right) */}
        <div className="w-80 rounded-xl p-4 shadow-lg overflow-y-auto" style={{ backgroundColor: "#f9f7f2", border: "1px solid #C6CDD9" }}>
          <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide" style={{ color: "#0A2342" }}>Participants ({allParticipants.length})</h3>
          <div className="flex flex-col gap-3">
            {allParticipants.map((participant: any) => {
              const isScreenShare = participant.isScreenShare || false;
              // Determine if video should show
              const isVideoOn = isScreenShare
                ? true
                : (participant.isLocal
                  ? !isVideoOff  // Use local state
                  : participantVideoStates.get(participant.id) === true);  // Use remote state
              const isSpeaking = participantSpeakingStates.get(participant.id) || false;
              const isPinned = pinnedParticipant === participant.id;

              return (
                <div
                  key={participant.id}
                  className="relative"
                  onMouseEnter={() => setHoveredParticipant(participant.id)}
                  onMouseLeave={() => {
                    setHoveredParticipant(null);
                    setShowMenuFor(null);
                  }}
                >
                  <button
                    onClick={() => {
                      setFeaturedParticipant(participant.id);
                      if (pinnedParticipant) setPinnedParticipant(null);
                    }}
                    className="relative w-full h-44 bg-black rounded-lg overflow-hidden transition-all"
                    style={{
                      border: featuredParticipant === participant.id ? '4px solid #16305B' :
                              isScreenShare ? '4px solid #16305B' :
                              isSpeaking ? '4px solid #22c55e' :
                              '2px solid #C6CDD9'
                    }}
                  >
                    {isScreenShare ? (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#16305B" }}>
                        <div className="text-center">
                          <Monitor className="w-16 h-16 mx-auto mb-2" style={{ color: "#ffffff" }} />
                          <p className="text-white text-sm font-semibold">{participant.displayName}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Video container - cleared by useEffect when camera turns off */}
                        <div
                          ref={(el) => participantVideoRefs.current.set(participant.id, el)}
                          className="w-full h-full [&_video]:object-cover"
                          style={{ display: isVideoOn ? 'block' : 'none' }}
                        />
                        {/* ✅ Show avatar when camera is OFF */}
                        {!isVideoOn && (
                          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getAvatarColor(participant.displayName)} flex items-center justify-center shadow-lg`}>
                              <span className="text-white text-3xl font-bold">
                                {getInitials(participant.displayName)}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white font-semibold">
                      {participant.displayName}
                    </div>

                    <div className="px-2 py-0.5 rounded text-xs text-white font-semibold absolute top-2 left-2" style={{ backgroundColor: "#16305B" }}>
                      {isScreenShare ? 'SCREEN' : participant.role.toUpperCase()}
                    </div>

                    {isPinned && (
                      <div className="absolute top-2 right-2 bg-yellow-500 p-1 rounded-full">
                        <Pin className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {isSpeaking && !isScreenShare && (
                      <div className="absolute bottom-2 right-2 bg-green-500 p-1.5 rounded-full animate-pulse">
                        <Volume2 className="w-4 h-4 text-white" />
                      </div>
                    )}

                    {/* ✅ FIX: Show mute indicator based on ACS SDK mute state */}
                    {(() => {
                      // Check if this is the local participant (use local isMuted state)
                      if (participant.isLocal) {
                        if (!isMuted || isScreenShare) return null;
                        return (
                          <div className="absolute bottom-2 right-10 bg-red-600 p-1.5 rounded-full shadow-lg">
                            <MicOff className="w-4 h-4 text-white" />
                          </div>
                        );
                      }

                      // For remote participants, use tracked mute state from ACS SDK
                      const isParticipantMuted = participantMuteStates.get(participant.id) === true;
                      if (!isParticipantMuted || isScreenShare) return null;

                      return (
                        <div className="absolute bottom-2 right-10 bg-red-600 p-1.5 rounded-full shadow-lg">
                          <MicOff className="w-4 h-4 text-white" />
                        </div>
                      );
                    })()}
                  </button>

                  {/* Three-dot menu - Admin has PIN, MUTE, and KICK options */}
                  {(hoveredParticipant === participant.id || showMenuFor === participant.id) && !participant.isLocal && (
                    <div className="absolute top-3 right-3 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenuFor(showMenuFor === participant.id ? null : participant.id);
                        }}
                        className="bg-black/70 hover:bg-black p-1.5 rounded-full transition"
                      >
                        <MoreVertical className="w-4 h-4 text-white" />
                      </button>

                      {showMenuFor === participant.id && (
                        <div className="absolute top-9 right-0 bg-gray-800 rounded-lg shadow-xl p-2 min-w-[120px] border border-gray-700">
                          <button
                            onClick={() => handlePinParticipant(participant.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded text-white text-sm"
                          >
                            <Pin className="w-4 h-4" />
                            {isPinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button
                            onClick={() => handleMuteParticipant(participant.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded text-white text-sm"
                          >
                            <MicOff className="w-4 h-4" />
                            Mute
                          </button>
                          <button
                            onClick={() => handleKickParticipant(participant.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded text-red-400 text-sm"
                          >
                            <UserX className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="px-6 py-3 flex items-center justify-between shadow-lg" style={{ backgroundColor: "#f9f7f2", borderTop: "1px solid #C6CDD9" }}>
          <div className="flex items-center gap-3">
            <button onClick={toggleMute} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title={isMuted ? "Unmute" : "Mute"}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: isMuted ? "#dc2626" : "#5B9BD5" }}>
                {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
              </div>
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {isMuted ? "Unmute" : "Mute"}
              </span>
            </button>

            <button onClick={toggleVideo} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: isVideoOff ? "#dc2626" : "#5B9BD5" }}>
                {isVideoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
              </div>
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
              </span>
            </button>

            <button onClick={toggleScreenShare} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: isScreenSharing ? "#FDB71A" : "#5B9BD5" }}>
                {isScreenSharing ? <MonitorOff className="w-6 h-6 text-white" /> : <Monitor className="w-6 h-6 text-white" />}
              </div>
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {isScreenSharing ? "Stop Sharing" : "Share Screen"}
              </span>
            </button>
          </div>

          {/* Recording Controls */}
          <div className="flex items-center gap-3">
            {!isRecording ? (
              <button onClick={startRecording} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title="Start Recording">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#FDB71A" }}>
                  <Circle className="w-6 h-6 fill-current text-white" />
                </div>
                <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Start Recording
                </span>
              </button>
            ) : (
              <button onClick={stopRecording} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title="Stop Recording">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#5B9BD5" }}>
                  <StopCircle className="w-6 h-6 text-white" />
                </div>
                <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Stop Recording
                </span>
              </button>
            )}
            {recordingBlob && !isRecording && (
              <button onClick={downloadRecording} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title="Download Recording">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#5B9BD5" }}>
                  <Download className="w-6 h-6 text-white" />
                </div>
                <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  Download Recording
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={toggleChatPanel} className="relative flex flex-col items-center gap-1 hover:scale-110 transition-transform group" title="Chat">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: showChatPanel ? "#5B9BD5" : "#FDB71A" }}>
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </div>
              )}
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Chat
              </span>
            </button>

            <button onClick={toggleJuryChargePanel} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title="Jury Charge Questions">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: showJuryChargePanel ? "#5B9BD5" : "#FDB71A" }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#ffffff" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Jury Charge
              </span>
            </button>

            <button onClick={toggleDocumentsPanel} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title="Case Documents">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: showDocumentsPanel ? "#5B9BD5" : "#FDB71A" }}>
                <FileText className="w-6 h-6 text-white" />
              </div>
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Documents
              </span>
            </button>

            <button onClick={downloadVerdicts} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title="Download Verdicts">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#5B9BD5" }}>
                <Download className="w-6 h-6 text-white" />
              </div>
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Download Verdicts
              </span>
            </button>

            <button onClick={endMeetForAll} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title="End Meeting for All">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-600 hover:bg-red-700">
                <StopCircle className="w-6 h-6 text-white" />
              </div>
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                End Meeting
              </span>
            </button>

            <button onClick={leaveCall} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title="Leave Call">
              <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center">
                <Phone className="w-6 h-6 text-white transform rotate-135" />
              </div>
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Leave Call
              </span>
            </button>
          </div>
        </div>
      </div>

    {/* Chat Panel - slides in from right, takes 20% width */}
    {showChatPanel && (
      <div className="w-1/5 flex flex-col shadow-2xl" style={{ backgroundColor: "#ffffff", borderLeft: "1px solid #C6CDD9" }}>
          <div className="p-5 flex items-center justify-between" style={{ backgroundColor: "#16305B", borderBottom: "1px solid #C6CDD9" }}>
            <div>
              <h3 className="text-lg font-bold text-white">Chat</h3>
              <p className="text-sm text-white opacity-80">{messages.length} messages</p>
            </div>
            <button onClick={toggleChatPanel} className="text-white hover:text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center mt-10" style={{ color: "#455A7C" }}>
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No messages yet</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderId === currentUserId.current ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[85%] rounded-2xl p-3 shadow-lg" style={{
                    backgroundColor: msg.senderId === currentUserId.current ? '#16305B' : '#f9f7f2',
                    color: msg.senderId === currentUserId.current ? '#ffffff' : '#0A2342'
                  }}>
                    {msg.senderId !== currentUserId.current && (
                      <div className="text-xs font-semibold mb-1 opacity-75">{msg.sender}</div>
                    )}
                    <div className="text-sm break-words">{msg.content}</div>
                    <div className="text-xs opacity-60 mt-1">{formatTime(msg.timestamp)}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={chatMessagesEndRef} />
          </div>

          <div className="p-4" style={{ borderTop: "1px solid #C6CDD9", backgroundColor: "#f9f7f2" }}>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2"
                style={{ borderColor: "#C6CDD9", backgroundColor: "#ffffff", color: "#0A2342" }}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="px-5 py-3 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg font-semibold"
                style={{ backgroundColor: "#16305B" }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jury Charge Panel */}
      {showJuryChargePanel && (
        <div className="w-1/5 flex flex-col shadow-2xl" style={{ backgroundColor: "#ffffff", borderLeft: "1px solid #C6CDD9" }}>
          <div className="p-5 flex items-center justify-between" style={{ backgroundColor: "#16305B", borderBottom: "1px solid #C6CDD9" }}>
            <div>
              <h3 className="text-lg font-bold text-white">Jury Charge Questions</h3>
              <p className="text-sm text-white opacity-80">{juryChargeQuestions.length} questions</p>
            </div>
            <button onClick={toggleJuryChargePanel} className="text-white hover:text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingJuryCharge ? (
              <div className="text-center mt-10" style={{ color: "#455A7C" }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-2"></div>
                Loading questions...
              </div>
            ) : juryChargeQuestions.length === 0 ? (
              <div className="text-center mt-10" style={{ color: "#455A7C" }}>
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="font-semibold">No jury charge questions yet</p>
                <p className="text-sm mt-2">Questions will appear here once created</p>
              </div>
            ) : (
              juryChargeQuestions.map((question, index) => (
                <div key={question.QuestionId} className="rounded-lg p-4" style={{ backgroundColor: "#f9f7f2", border: "1px solid #C6CDD9" }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: "#16305B" }}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold mb-2" style={{ color: "#0A2342" }}>{question.QuestionText}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded" style={{ backgroundColor: "#16305B", color: "#ffffff" }}>{question.QuestionType}</span>
                        {question.IsRequired && (
                          <span className="px-2 py-1 bg-red-600 text-white rounded">Required</span>
                        )}
                      </div>

                      {question.QuestionType === "Multiple Choice" && question.Options && (
                        <div className="mt-3 space-y-1">
                          {(Array.isArray(question.Options) ? question.Options : JSON.parse(question.Options || '[]')).map((opt: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-sm" style={{ color: "#455A7C" }}>
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#16305B", color: "#ffffff" }}>
                                {String.fromCharCode(65 + idx)}
                              </div>
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {!juryChargeLocked && juryChargeQuestions.length > 0 && (
            <div className="p-4 border-t border-purple-700">
              <button
                onClick={releaseJuryCharge}
                disabled={releasingJuryCharge}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
              >
                {releasingJuryCharge ? "Releasing..." : "📢 Release to Jurors"}
              </button>
            </div>
          )}

          {juryChargeLocked && (
            <div className="p-4 border-t border-purple-700">
              <div className="flex items-center justify-center gap-2 px-4 py-3 bg-green-900/30 rounded-lg border border-green-600">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-400 font-bold">Released to Jurors</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents Panel */}
      {showDocumentsPanel && (
        <div className="w-1/5 flex flex-col shadow-2xl" style={{ backgroundColor: "#ffffff", borderLeft: "1px solid #C6CDD9" }}>
          <div className="p-5 flex items-center justify-between" style={{ backgroundColor: "#16305B", borderBottom: "1px solid #C6CDD9" }}>
            <div>
              <h3 className="text-lg font-bold text-white">Case Documents</h3>
              <p className="text-sm text-white opacity-80">{documents.length} files</p>
            </div>
            <button onClick={toggleDocumentsPanel} className="text-white hover:text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingDocuments ? (
              <div className="text-center mt-10" style={{ color: "#455A7C" }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-2"></div>
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center mt-10" style={{ color: "#455A7C" }}>
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="font-semibold">No documents uploaded</p>
                <p className="text-sm mt-2">Documents will appear here once uploaded</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.DocumentId} className="rounded-lg p-4 transition" style={{ backgroundColor: "#f9f7f2", border: "1px solid #C6CDD9" }}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#16305B" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ color: "#0A2342" }}>{doc.FileName}</p>
                      {doc.Description && (
                        <p className="text-sm mt-1" style={{ color: "#455A7C" }}>{doc.Description}</p>
                      )}
                      <p className="text-xs mt-1" style={{ color: "#455A7C" }}>
                        Uploaded: {new Date(doc.UploadedAt).toLocaleDateString()}
                      </p>
                      <a
                        href={doc.FileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 px-3 py-1 text-white rounded text-xs font-semibold transition"
                        style={{ backgroundColor: "#16305B" }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Chat Notification */}
      {showChatNotification && latestMessage && !showChatPanel && (
        <div
          onClick={toggleChatPanel}
          className="fixed bottom-24 right-6 w-96 rounded-2xl shadow-2xl p-4 cursor-pointer hover:shadow-3xl transition-all"
          style={{ backgroundColor: "#16305B", border: "1px solid #C6CDD9" }}
        >
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(latestMessage.sender)} flex items-center justify-center`}>
              <span className="text-white font-bold text-lg">
                {getInitials(latestMessage.sender)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white text-sm">{latestMessage.sender}</div>
              <div className="text-sm text-white/90 truncate">{latestMessage.content}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowChatNotification(false);
              }}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}