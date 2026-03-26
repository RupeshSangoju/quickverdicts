"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CallClient,
  VideoStreamRenderer,
  LocalVideoStream,
} from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import { ChatClient } from "@azure/communication-chat";
import { getToken } from "@/lib/apiClient";
import toast from "react-hot-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Phone,
  AlertCircle,
  MoreVertical,
  Pin,
  Volume2,
  FileText,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, "")
  : "http://localhost:4000";

export default function TrialConferenceClient() {
  const { id } = useParams();
  const router = useRouter();
  const caseId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const { on, off } = useWebSocket();

  const [call, setCall] = useState<any>(null);
  const [callState, setCallState] = useState("Initializing...");
  const [participants, setParticipants] = useState<any[]>([]);
  const [featuredParticipant, setFeaturedParticipant] = useState<string>("local");
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [displayName, setDisplayName] = useState("You");
  const [renderTrigger, setRenderTrigger] = useState(0);

  // Track video, speaking, and mute states
  const [participantVideoStates, setParticipantVideoStates] = useState<Map<string, boolean>>(new Map());
  const [participantSpeakingStates, setParticipantSpeakingStates] = useState<Map<string, boolean>>(new Map());
  const [participantMuteStates, setParticipantMuteStates] = useState<Map<string, boolean>>(new Map());
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  // Hover menu states
  const [hoveredParticipant, setHoveredParticipant] = useState<string | null>(null);
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null);

  // Chat states
  const [chatClient, setChatClient] = useState<any>(null);
  const [chatThread, setChatThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [showChatNotification, setShowChatNotification] = useState(false);
  const [latestMessage, setLatestMessage] = useState<any>(null);

  const [showChatPanel, setShowChatPanel] = useState(false);
  const [participantJoinTimes, setParticipantJoinTimes] = useState<Map<string, Date>>(new Map());

  // Jury Charge states
  const [showJuryChargePanel, setShowJuryChargePanel] = useState(false);
  const [juryChargeQuestions, setJuryChargeQuestions] = useState<any[]>([]);
  const [loadingJuryCharge, setLoadingJuryCharge] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [showAddQuestionForm, setShowAddQuestionForm] = useState(false);
  const [newQuestionData, setNewQuestionData] = useState<any>({
    QuestionText: '',
    QuestionType: 'Multiple Choice',
    Options: '',
    IsRequired: true,
  });

  // Case Files states
  const [showCaseFilesPanel, setShowCaseFilesPanel] = useState(false);
  const [caseFiles, setCaseFiles] = useState<any[]>([]);
  const [loadingCaseFiles, setLoadingCaseFiles] = useState(false);

  const featuredVideoRef = useRef<HTMLDivElement>(null);
  const localVideoStream = useRef<any>(null);
  const screenShareStream = useRef<any>(null);
  const screenShareRenderer = useRef<any>(null);
  const remoteVideoRefs = useRef<Map<string, any>>(new Map());
  const participantVideoRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const thumbnailRenderers = useRef<Map<string, VideoStreamRenderer>>(new Map()); // key = participantId or "local"
  const featuredRenderer = useRef<VideoStreamRenderer | null>(null);
  const debouncedRenderTrigger = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialized = useRef(false);
  const initInvocationId = useRef(0);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserId = useRef<string>("");
  const callRef = useRef<any>(null);
  const callAgentRef = useRef<any>(null);

  useEffect(() => {
    const handleBeforeUnload = async () => {
      console.log("Page closing/refreshing - cleaning up call...");
      try {
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
      if (callRef.current) {
        callRef.current.hangUp({ forEveryone: false }).catch((e: any) => console.error("Hangup error:", e));
      }
      remoteVideoRefs.current.forEach((r) => r.renderer?.dispose());
    };
  }, []);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    const controller = new AbortController();
    const myId = ++initInvocationId.current;
    initializeCall(myId, controller.signal);
    return () => {
      hasInitialized.current = false;
      ++initInvocationId.current;
      controller.abort(); // cancel the in-flight fetch so the backend gets exactly one request
    };
  }, []);

  // When the admin triggers nuclear room recovery, the old room is deleted.
  // Reload so we re-fetch a fresh token pointing to the new room.
  useEffect(() => {
    const handleRoomRecreated = (data: any) => {
      console.log("[ATTORNEY] room_recreated received:", data.newRoomId, "— reloading to rejoin");
      toast.error("Trial room was reset — reconnecting...", { duration: 3000 });
      setTimeout(() => window.location.reload(), 2000);
    };
    on("room_recreated", handleRoomRecreated);
    return () => off("room_recreated", handleRoomRecreated);
  }, [on, off]);

  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

  const triggerReRender = () => {
    if (debouncedRenderTrigger.current) {
      clearTimeout(debouncedRenderTrigger.current);
    }
    debouncedRenderTrigger.current = setTimeout(() => {
      setRenderTrigger(prev => prev + 1);
      debouncedRenderTrigger.current = null;
    }, 100); // 100ms debounce to prevent render loops
  };

  // Unmount cleanup: dispose active renderers to avoid frozen frames
  useEffect(() => {
    return () => {
      console.log("TrialConferenceClient unmount – cleaning renderers");
      try {
        thumbnailRenderers.current.forEach(r => r?.dispose());
      } catch (e) {
        console.warn("Error disposing thumbnail renderers on unmount:", e);
      }
      thumbnailRenderers.current.clear();
      try { featuredRenderer.current?.dispose(); } catch (_) {}
      featuredRenderer.current = null;
      try { screenShareRenderer.current?.dispose(); } catch (_) {}
      screenShareRenderer.current = null;
    };
  }, []);

  // Clear participant video and show avatar
  function clearParticipantVideo(participantId: string) {
    console.log(`Clearing video for ${participantId} → showing avatar`);
    
    const container = participantVideoRefs.current.get(participantId);
    if (container) {
      container.innerHTML = "";
    }
    
    // Safe dispose thumbnail
    const thumbRenderer = thumbnailRenderers.current.get(participantId);
    if (thumbRenderer) {
      try {
        // dispose may be synchronous in some SDK versions
        thumbRenderer.dispose();
      } catch (e: any) {
        if (!e?.message?.includes?.("already disposed")) {
          console.warn("Thumbnail dispose warning:", e);
        }
      }
      thumbnailRenderers.current.delete(participantId);
    }

    // If featured → clean featured view
    if (featuredParticipant === participantId) {
      if (featuredRenderer.current) {
        try {
          featuredRenderer.current.dispose();
        } catch (e: any) {
          if (!e?.message?.includes?.("already disposed")) {
            console.warn("Featured dispose warning:", e);
          }
        }
        featuredRenderer.current = null;
      }
      if (featuredVideoRef.current) {
        featuredVideoRef.current.innerHTML = "";
      }
      triggerReRender();
    }
  }

  // Render participant video in thumbnail
  async function renderParticipantVideoInThumbnail(participantId: string) {
    const container = participantVideoRefs.current.get(participantId);
    if (!container) return;

    // Clean first
    container.innerHTML = "";
    const existing = thumbnailRenderers.current.get(participantId);
    if (existing) {
      try {
        existing.dispose();
      } catch (e) {
        // swallow dispose errors for already-disposed or transient states
      }
      thumbnailRenderers.current.delete(participantId);
    }

    try {
      if (participantId === "local") {
        if (isVideoOff || !localVideoStream.current) return;
        const renderer = new VideoStreamRenderer(localVideoStream.current);
        thumbnailRenderers.current.set("local", renderer);
        const view = await renderer.createView({ scalingMode: 'Crop' });
        container.appendChild(view.target);
      } else {
        const participant = participants.find((p: any) => getUserId(p.identifier) === participantId);
        if (!participant) return;
        const stream = participant.videoStreams?.find((s: any) => s.mediaStreamType === "Video");
        if (!stream?.isAvailable) return;

        const renderer = new VideoStreamRenderer(stream);
        thumbnailRenderers.current.set(participantId, renderer);
        const view = await renderer.createView({ scalingMode: 'Crop' });
        container.appendChild(view.target);
      }
    } catch (err) {
      console.error("Thumbnail render failed:", err);
    }
  }

  async function renderFeaturedVideo() {
    if (!featuredVideoRef.current) return;
    // Clean old
    featuredVideoRef.current.innerHTML = "";
    if (featuredRenderer.current) {
        try {
            featuredRenderer.current.dispose();
        } catch {}
      featuredRenderer.current = null;
    }

    try {
      if (featuredParticipant === "screenshare" && screenShareStream.current) {
        const renderer = new VideoStreamRenderer(screenShareStream.current);
        featuredRenderer.current = renderer;
        const view = await renderer.createView();
        featuredVideoRef.current.appendChild(view.target);
      } else if (featuredParticipant?.startsWith("screenshare-")) {
        const ref = remoteVideoRefs.current.get(featuredParticipant);
        if (ref?.stream?.isAvailable) {
          const renderer = new VideoStreamRenderer(ref.stream);
          featuredRenderer.current = renderer;
          const view = await renderer.createView();
          featuredVideoRef.current.appendChild(view.target);
        }
      } else if (featuredParticipant === "local") {
        if (!isVideoOff && localVideoStream.current) {
          const renderer = new VideoStreamRenderer(localVideoStream.current);
          featuredRenderer.current = renderer;
          const view = await renderer.createView();
          featuredVideoRef.current.appendChild(view.target);
        }
      } else {
        const participant = participants.find((p: any) => getUserId(p.identifier) === featuredParticipant);
        if (participant) {
          const stream = participant.videoStreams?.find((s: any) => s.mediaStreamType === "Video");
          if (stream?.isAvailable) {
            const renderer = new VideoStreamRenderer(stream);
            featuredRenderer.current = renderer;
            const view = await renderer.createView();
            featuredVideoRef.current.appendChild(view.target);
          }
        }
      }
    } catch (err) {
      console.error("Featured render failed:", err);
    }
  }

  useEffect(() => {
    renderFeaturedVideo();
  }, [featuredParticipant, renderTrigger, isVideoOff]);

  // Reliable fallback polling for remote video state changes
  // This mimics what admin probably does internally or through better timing
  useEffect(() => {
    if (!call || call.state !== "Connected" || participants.length === 0) return;

    console.log("[ATTORNEY VIDEO POLL] Started – checking remote cameras every 1.5s");

    const pollInterval = setInterval(async () => {
      let hasAnyChange = false;

      for (const p of participants) {
        const userId = getUserId(p.identifier);
        if (userId === "local") continue;

        const videoStream = p.videoStreams?.find((s: any) => s.mediaStreamType === "Video");
        const nowAvailable = !!videoStream?.isAvailable;

        const wasAvailable = participantVideoStates.get(userId);

        if (wasAvailable !== nowAvailable) {
          console.log(
            `%c[POLLER FIXED] Juror ${userId} cam toggled → ${nowAvailable ? 'ON 🟢' : 'OFF 🔴'} at ${new Date().toISOString()}`,
            "background:#0a0; color:white; padding:6px; font-weight:bold"
          );

          setParticipantVideoStates(prev => {
            const updated = new Map(prev);
            updated.set(userId, nowAvailable);
            return updated;
          });

          hasAnyChange = true;

          if (nowAvailable) {
            await renderParticipantVideoInThumbnail(userId);
            // If this juror is featured → refresh big view too
            if (featuredParticipant === userId) {
              await renderFeaturedVideo();
            }
          } else {
            clearParticipantVideo(userId);
          }
        }
      }

      if (hasAnyChange) {
        triggerReRender();
      }
    }, 1500); // 1.5 seconds – fast enough for "immediate" feel, low overhead

    return () => {
      clearInterval(pollInterval);
      console.log("[ATTORNEY VIDEO POLL] Stopped");
    };
  }, [call?.state, participants, featuredParticipant, participantVideoStates]);

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
    // Always show local video when joining
    if (featuredParticipant === "" || !featuredParticipant) {
      setFeaturedParticipant("local");
      console.log("🎯 Set default featured participant: local");
    }
  }, []);

  // Auto-switch to first remote participant when they join
  useEffect(() => {
    if (participants.length > 0 && featuredParticipant === "local") {
      const firstParticipant = participants[0];
      const userId = getUserId(firstParticipant.identifier);
      // Check if they have video available
      const hasVideo = participantVideoStates.get(userId);
      if (hasVideo !== false) {
        setFeaturedParticipant(userId);
        console.log(`🎯 Auto-switched to first participant: ${userId}`);
      }
    }
  }, [participants.length]);

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
        const senderId = getUserId(e.sender);
        if (senderId !== currentUserId.current) {
          const newMsg = {
            id: e.id,
            content: e.message,
            sender: e.senderDisplayName || "Unknown",
            senderId: senderId,
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

  async function initializeCall(invocationId: number, signal: AbortSignal) {
    console.log("[ATTORNEY INIT] initializeCall() starting, caseId =", caseId, "id =", invocationId);
    try {
      setCallState("Getting permissions...");
      const token = getToken();

      // Debounce: React StrictMode fires cleanup immediately after first mount.
      // Wait 100ms — if the abort signal fires before then, bail out without hitting the backend.
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 100);
        signal.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); });
      });
      if (signal.aborted || invocationId !== initInvocationId.current) {
        console.log("[ATTORNEY INIT] aborted during debounce, bailing out");
        return;
      }

      const response = await fetch(`${API_BASE}/api/trial/join/${caseId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal,
      });

      if (invocationId !== initInvocationId.current) {
        console.log("[ATTORNEY INIT] stale invocation", invocationId, "— bailing out");
        return;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Failed to join trial (${response.status}): ${body}`);
      }
      const data = await response.json();
      console.log("[ATTORNEY INIT] trial-join succeeded, roomId =", data.roomId);
      setDisplayName(data.displayName);
      console.log("[ATTORNEY INIT] chatThreadId =", data.chatThreadId, "endpointUrl =", !!data.endpointUrl);

      if (data.chatThreadId && data.endpointUrl) {
        console.log("[ATTORNEY INIT] starting initializeChat...");
        await initializeChat(data.token, data.userId, data.chatThreadId, data.endpointUrl);
        console.log("[ATTORNEY INIT] initializeChat done");
      } else {
        console.log("[ATTORNEY INIT] skipping chat init");
      }

      setCallState("Initializing devices...");
      console.log("[ATTORNEY INIT] creating CallClient...");

      const callClient = new CallClient();
      const tokenCredential = new AzureCommunicationTokenCredential(data.token);
      console.log("[ATTORNEY INIT] getDeviceManager...");
      const deviceManager = await callClient.getDeviceManager();
      console.log("[ATTORNEY INIT] askDevicePermission...");
      await deviceManager.askDevicePermission({ video: true, audio: true });
      console.log("[ATTORNEY INIT] device permission done");

      const cameras = await deviceManager.getCameras();
      if (cameras.length > 0) {
        localVideoStream.current = new LocalVideoStream(cameras[0]);
      }

      setCallState("Connecting to trial...");
      console.log("[ATTORNEY INIT] createCallAgent...");

      const agent = await callClient.createCallAgent(tokenCredential, {
        displayName: data.displayName,
      });
      console.log("[ATTORNEY INIT] CallAgent created, joining room...");

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
          triggerReRender();
        }
      });

      roomCall.on("localVideoStreamsUpdated", (e: any) => {
        e.added.forEach(async (stream: any) => {
            if (stream.mediaStreamType === "ScreenSharing") {
            screenShareStream.current = stream;
            setIsScreenSharing(true);
            setFeaturedParticipant("screenshare");
            triggerReRender();
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
            setTimeout(() => triggerReRender(), 50);
          }
        });
      });

      roomCall.on("remoteParticipantsUpdated", (e: any) => {
        e.added.forEach((participant: any) => {
          const userId = getUserId(participant.identifier);
          setParticipantJoinTimes(prev => new Map(prev).set(userId, new Date()));

          // Track speaking state
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

          participant.on("videoStreamsUpdated", (streamEvent: any) => {
            console.log(
              `%c[ATTORNEY] videoStreamsUpdated FIRED for ${userId} at ${new Date().toISOString()}`,
              "background:#444; color:#ff0; padding:4px; font-weight:bold"
            );

            streamEvent.added.forEach(async (stream: any) => {
              if (stream.mediaStreamType === "Video") {
                console.log(
                  `%c[ATTORNEY] Processing Video stream for ${userId} — current isAvailable: ${stream.isAvailable} — ${new Date().toISOString()}`,
                  "background:#000; color:#0f8; padding:4px"
                );

                setParticipantVideoStates(prev => new Map(prev).set(userId, stream.isAvailable));

                if (stream.isAvailable) {
                  await renderParticipantVideoInThumbnail(userId);
                  if (featuredParticipant === userId) {
                    await renderFeaturedVideo();
                  }
                }

                // Detach old if exists (prevents duplicates)
                if (stream["_availabilityListener"]) {
                  console.log(`[ATTORNEY] Removing old listener for ${userId}`);
                  // ACS doesn't have built-in off() → flag prevents duplicate handling
                }

                console.log(`[ATTORNEY] Attaching isAvailableChanged listener to stream of ${userId}`);
                // Attach fresh every time
                stream["_availabilityListener"] = true;

                stream.on("isAvailableChanged", async () => {
                  console.log(
                    `%c[ATTORNEY CAMERA EVENT FIRED] ${new Date().toISOString()} — ${userId} camera now ${stream.isAvailable ? 'ON 🟢' : 'OFF 🔴'}`,
                    "background:#000; color:#ff0; font-weight:bold; padding:8px; border:2px solid #ff0;"
                  );

                  setParticipantVideoStates(prev => new Map(prev).set(userId, stream.isAvailable));

                  if (stream.isAvailable) {
                    await renderParticipantVideoInThumbnail(userId);
                    if (featuredParticipant === userId) {
                      await renderFeaturedVideo();
                    }
                  } else {
                    clearParticipantVideo(userId);
                  }
                });

                // One-time survival check to detect if listener dies
                setTimeout(() => {
                  console.log(`[ATTORNEY SURVIVAL CHECK] Listener for ${userId} still alive? ${new Date().toISOString()}`);
                }, 10000);
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
                          triggerReRender();
                        } else {
                          // Wait for stream to become available
                          console.log(`⏳ Screenshare not yet available, waiting...`);
                          stream.on("isAvailableChanged", async () => {
                            console.log(`📺 Screenshare availability changed: ${stream.isAvailable}`);
                            if (stream.isAvailable) {
                              setFeaturedParticipant(screenshareKey);
                              setPinnedParticipant(screenshareKey);
                              triggerReRender();
                            } else {
                              // Screenshare stopped — featuredParticipant is stale here, don't guard with it
                              if (featuredVideoRef.current) {
                                featuredVideoRef.current.innerHTML = "";
                              }
                              if (featuredRenderer.current) {
                                try { featuredRenderer.current.dispose(); } catch (_) {}
                                featuredRenderer.current = null;
                              }
                              const ref = remoteVideoRefs.current.get(screenshareKey);
                              if (ref) {
                                try { ref.renderer?.dispose(); } catch (_) {}
                                try { ref.renderer = null; } catch(_) {}
                                try { ref.disposed = true; } catch(_) {}
                              }
                              // Pick best available participant (use live ACS list — not stale React state)
                              const liveParticipants = roomCall.remoteParticipants;
                              let nextFeatured = "local";
                              for (const p of liveParticipants) {
                                const uid = getUserId(p.identifier);
                                if (uid === userId) continue;
                                const vs = p.videoStreams?.find((s: any) => s.mediaStreamType === 'Video');
                                if (vs?.isAvailable) { nextFeatured = uid; break; }
                              }
                              if (nextFeatured === "local") {
                                for (const p of liveParticipants) {
                                  const uid = getUserId(p.identifier);
                                  if (uid !== userId) { nextFeatured = uid; break; }
                                }
                              }
                              console.log(`🎯 [ATTORNEY] Switching spotlight to: ${nextFeatured}`);
                              setPinnedParticipant(null);
                              setFeaturedParticipant(nextFeatured);
                              setTimeout(() => renderFeaturedVideo(), 50);
                              triggerReRender();
                            }
                          });
                        }
              }
            });

            streamEvent.removed.forEach((stream: any) => {
              if (stream.mediaStreamType === "Video") {
                // Video stream removed - clear and show avatar
                clearParticipantVideo(userId);
                setParticipantVideoStates(prev => new Map(prev).set(userId, false));
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
                triggerReRender();
              }
            });
          });

          participant.videoStreams.forEach(async (stream: any) => {
            if (stream.mediaStreamType === "Video") {
              // Set initial video state
              setParticipantVideoStates(prev => {
                const updated = new Map(prev);
                updated.set(userId, stream.isAvailable);
                return updated;
              });
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
                  triggerReRender();
                } else {
                  // Wait for stream to become available
                  console.log(`⏳ Existing screenshare not yet available, waiting...`);
                  stream.on("isAvailableChanged", async () => {
                    console.log(`📺 Existing screenshare availability changed: ${stream.isAvailable}`);
                    if (stream.isAvailable) {
                      setFeaturedParticipant(screenshareKey);
                      setPinnedParticipant(screenshareKey);
                      triggerReRender();
                    } else {
                      // Existing screenshare stopped — same stale-closure fix
                      if (featuredVideoRef.current) {
                        featuredVideoRef.current.innerHTML = "";
                      }
                      if (featuredRenderer.current) {
                        try { featuredRenderer.current.dispose(); } catch (_) {}
                        featuredRenderer.current = null;
                      }
                      const ref = remoteVideoRefs.current.get(screenshareKey);
                      if (ref) {
                        try { ref.renderer?.dispose(); } catch (_) {}
                        try { ref.renderer = null; } catch(_) {}
                        try { ref.disposed = true; } catch(_) {}
                      }
                      const liveParticipants = roomCall.remoteParticipants;
                      let nextFeatured = "local";
                      for (const p of liveParticipants) {
                        const uid = getUserId(p.identifier);
                        if (uid === userId) continue;
                        const vs = p.videoStreams?.find((s: any) => s.mediaStreamType === 'Video');
                        if (vs?.isAvailable) { nextFeatured = uid; break; }
                      }
                      if (nextFeatured === "local") {
                        for (const p of liveParticipants) {
                          const uid = getUserId(p.identifier);
                          if (uid !== userId) { nextFeatured = uid; break; }
                        }
                      }
                      console.log(`🎯 [ATTORNEY] Switching spotlight to: ${nextFeatured}`);
                      setPinnedParticipant(null);
                      setFeaturedParticipant(nextFeatured);
                      setTimeout(() => renderFeaturedVideo(), 50);
                      triggerReRender();
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
        console.log(
  `%c[ATTORNEY DASHBOARD CHECK] ${new Date().toISOString()} — Remote participants in call: ${roomCall.remoteParticipants.length}`,
  "background:#006; color:white; padding:8px; font-size:14px; font-weight:bold"
);

roomCall.remoteParticipants.forEach((p: any) => {
  const uid = getUserId(p.identifier);
  const hasVideo = p.videoStreams?.some((s: any) => s.mediaStreamType === "Video" && s.isAvailable) ?? false;
  console.log(
    `  → Participant: ${uid} | Name: ${p.displayName || 'Unknown'} | Video active: ${hasVideo ? 'YES 🟢' : 'NO 🔴'} | Streams count: ${p.videoStreams?.length || 0} | Speaking: ${p.isSpeaking ? 'YES' : 'NO'}`
  );
});
      });

      roomCall.on("isMutedChanged", () => {
        setIsMuted(roomCall.isMuted);
      });

      setLoading(false);
      console.log("[ATTORNEY INIT CHECK] Call connected — checking participants immediately");
// Reuse the same logging block as above
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // StrictMode cancelled first mount — ignore
      if (invocationId !== initInvocationId.current) return; // stale — ignore
      console.error("[ATTORNEY INIT] initializeCall failed:", err);
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
      setShowCaseFilesPanel(false);
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
      setShowCaseFilesPanel(false);
    }
    setShowJuryChargePanel(!showJuryChargePanel);
  };

  const loadCaseFiles = async () => {
    try {
      setLoadingCaseFiles(true);
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/war-room/cases/${caseId}/war-room/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCaseFiles(data.documents || []);
      }
    } catch (err) {
      console.error("Error loading case files:", err);
    } finally {
      setLoadingCaseFiles(false);
    }
  };

  const toggleCaseFilesPanel = () => {
    if (!showCaseFilesPanel) {
      loadCaseFiles();
      setShowChatPanel(false);
      setShowJuryChargePanel(false);
    }
    setShowCaseFilesPanel(!showCaseFilesPanel);
  };

  const startEditingQuestion = (question: any) => {
    setEditingQuestionId(question.QuestionId);
    setEditFormData({
      QuestionText: question.QuestionText,
      QuestionType: question.QuestionType,
      Options: Array.isArray(question.Options)
        ? question.Options.join('\n')
        : (question.Options ? JSON.parse(question.Options).join('\n') : ''),
      IsRequired: question.IsRequired,
      MinValue: question.MinValue,
      MaxValue: question.MaxValue
    });
  };

  const cancelEditing = () => {
    setEditingQuestionId(null);
    setEditFormData({});
  };

  const saveQuestion = async (questionId: number) => {
    try {
      setSavingQuestion(true);
      const token = getToken();

      const payload: any = {
        questionText: editFormData.QuestionText,
        questionType: editFormData.QuestionType,
        isRequired: editFormData.IsRequired,
      };

      if (editFormData.QuestionType === 'Multiple Choice') {
        payload.options = editFormData.Options.split('\n').map((o: string) => o.trim()).filter(Boolean);
      } else if (editFormData.QuestionType === 'Rating Scale') {
        payload.minValue = editFormData.MinValue;
        payload.maxValue = editFormData.MaxValue;
      }

      const response = await fetch(`${API_BASE}/api/jury-charge/questions/${questionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await loadJuryCharge();
        setEditingQuestionId(null);
        setEditFormData({});
      } else {
        alert('Failed to save question');
      }
    } catch (err) {
      console.error('Error saving question:', err);
      alert('Error saving question');
    } finally {
      setSavingQuestion(false);
    }
  };

  const deleteQuestion = async (questionId: number) => {
    if (!confirm('Delete this question?')) return;

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/jury-charge/questions/${questionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await loadJuryCharge();
      } else {
        alert('Failed to delete question');
      }
    } catch (err) {
      console.error('Error deleting question:', err);
      alert('Error deleting question');
    }
  };

  const addNewQuestion = async () => {
    try {
      setSavingQuestion(true);
      const token = getToken();

      const payload: any = {
        caseId: parseInt(caseId),
        questionText: newQuestionData.QuestionText,
        questionType: newQuestionData.QuestionType,
        isRequired: newQuestionData.IsRequired,
      };

      if (newQuestionData.QuestionType === 'Multiple Choice') {
        payload.options = newQuestionData.Options.split('\n').map((o: string) => o.trim()).filter(Boolean);
      }

      const response = await fetch(`${API_BASE}/api/jury-charge/questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await loadJuryCharge();
        setShowAddQuestionForm(false);
        setNewQuestionData({
          QuestionText: '',
          QuestionType: 'Multiple Choice',
          Options: '',
          IsRequired: true,
        });
      } else {
        const errData = await response.json().catch(() => null);
        alert(errData?.message || errData?.error || 'Failed to add question');
      }
    } catch (err) {
      console.error('Error adding question:', err);
      alert('Error adding question');
    } finally {
      setSavingQuestion(false);
    }
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
      console.error("No active call found");
      toast.error("Unable to toggle camera. Please try again.");
      return;
    }
    if (!localVideoStream.current) {
      console.error("No video stream available");
      toast.error("Camera is not available");
      return;
    }
    try {
      console.log(`📹 Toggling video. Current state: ${isVideoOff ? 'OFF' : 'ON'}`);
      if (isVideoOff) {
        // Turn camera ON
        await currentCall.startVideo(localVideoStream.current);
        setIsVideoOff(false);
        console.log("✅ Camera turned ON");
      } else {
        // Turn camera OFF
        await currentCall.stopVideo(localVideoStream.current);
        setIsVideoOff(true);
        console.log("✅ Camera turned OFF");
      }
    } catch (err) {
      console.error("❌ Toggle video error:", err);
      toast.error("Failed to toggle camera. Please try again.");
    }
  };

  const toggleScreenShare = async () => {
    if (!call) return;

    try {
      if (isScreenSharing) {
        await call.stopScreenSharing();
        // State will be updated by localVideoStreamsUpdated event handler
      } else {
        await call.startScreenSharing();
        // State will be updated by localVideoStreamsUpdated event handler
      }
    } catch (err: any) {
      console.error("Screen share error:", err);
      setIsScreenSharing(false);
      alert("Screen sharing failed. Please try again.");
    }
  };

  const leaveCall = async () => {
    try {
      if (call) await call.hangUp();
      if (chatClient) await chatClient.stopRealtimeNotifications();
      toast.success("You have left the trial successfully", { duration: 3000 });
      router.push("/attorney");
    } catch (error) {
      console.log("Leave call completed with cleanup:", error);
      router.push("/attorney");
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

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
          <p className="text-gray-600 mt-2">Attorney Trial Conference</p>
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
              onClick={() => router.push("/attorney")}
              className="w-full py-3 text-white rounded-xl font-semibold transition hover:opacity-90"
              style={{ backgroundColor: "#0A2342" }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  };

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
      role: "Attorney"
    },
    ...participants.map((p: any) => {
      const userId = getUserId(p.identifier);
      return {
        id: userId,
        displayName: p.displayName || "Participant",
        isLocal: false,
        participant: p,
        joinTime: participantJoinTimes.get(userId),
        role: p.displayName?.toLowerCase().includes("admin") ? "Admin" :
              p.displayName?.toLowerCase().includes("juror") ? "Juror" : "Participant"
      };
    }),
    ...screenShareParticipants
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#f0ebe0" }}>
      {/* Container with chat support */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content Area - More space for video when panels open */}
        <div className={`flex flex-col transition-all duration-300 ${
          showChatPanel || showJuryChargePanel || showCaseFilesPanel ? 'w-4/5' : 'w-4/5 mx-auto'
        }`}>
          {/* Header */}
          <div className="px-6 py-3 flex items-center justify-between shadow-lg" style={{ backgroundColor: "#16305B" }}>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white font-semibold">Trial Conference</span>
              <span className="text-white/80 text-sm">• Case #{caseId}</span>
            </div>
          </div>

          {/* Middle Section - Featured Video + Vertical Participants Sidebar */}
          <div className="flex-1 flex gap-3 p-4 overflow-hidden">
        {/* Featured Video (Large Left Section) */}
        <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-2xl relative">
          <div
            ref={featuredVideoRef}
            className="w-full h-full [&>div]:!w-full [&>div]:!h-full [&_video]:object-contain"
          />
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
                        {/* ✅ FIX: Always create ref for video container, but show/hide based on camera state */}
                        <div
                          ref={(el) => {
                            participantVideoRefs.current.set(participant.id, el);
                            // ✅ Clear container when camera is off to remove frozen frames
                            if (el && !isVideoOn) {
                              el.innerHTML = "";
                            }
                          }}
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

                  {/* Three-dot menu - Attorney only has PIN option */}
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

            <button onClick={toggleCaseFilesPanel} className="flex flex-col items-center gap-1 hover:scale-110 transition-transform group relative" title="Case Files">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: showCaseFilesPanel ? "#5B9BD5" : "#FDB71A" }}>
                <FileText className="w-6 h-6 text-white" />
              </div>
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Case Files
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
          <div className="p-5" style={{ backgroundColor: "#16305B", borderBottom: "1px solid #C6CDD9" }}>
            <div className="flex items-center justify-between mb-3">
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
            <button
              onClick={() => setShowAddQuestionForm(!showAddQuestionForm)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg font-semibold transition"
              style={{ backgroundColor: "#16a34a" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Question
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {showAddQuestionForm && (
              <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: "#f9f7f2", border: "2px solid #16305B" }}>
                <h4 className="font-bold flex items-center gap-2" style={{ color: "#0A2342" }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Question
                </h4>

                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455A7C" }}>Question Text</label>
                  <textarea
                    value={newQuestionData.QuestionText}
                    onChange={(e) => setNewQuestionData({...newQuestionData, QuestionText: e.target.value})}
                    className="w-full px-3 py-2 rounded border focus:outline-none focus:border-2"
                    style={{ backgroundColor: "#ffffff", color: "#0A2342", borderColor: "#C6CDD9" }}
                    rows={2}
                    placeholder="Enter your question..."
                  />
                </div>

                <div>
                  <label className="block text-xs mb-1" style={{ color: "#455A7C" }}>Question Type</label>
                  <select
                    value={newQuestionData.QuestionType}
                    onChange={(e) => setNewQuestionData({...newQuestionData, QuestionType: e.target.value})}
                    className="w-full px-3 py-2 rounded border focus:outline-none focus:border-2"
                    style={{ backgroundColor: "#ffffff", color: "#0A2342", borderColor: "#C6CDD9" }}
                  >
                    <option value="Multiple Choice">Multiple Choice</option>
                    <option value="Text Response">Text Response</option>
                    <option value="Yes/No">Yes/No</option>
                  </select>
                </div>

                {newQuestionData.QuestionType === "Multiple Choice" && (
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#455A7C" }}>Options (one per line)</label>
                    <textarea
                      value={newQuestionData.Options}
                      onChange={(e) => setNewQuestionData({...newQuestionData, Options: e.target.value})}
                      className="w-full px-3 py-2 rounded border focus:outline-none focus:border-2"
                      style={{ backgroundColor: "#ffffff", color: "#0A2342", borderColor: "#C6CDD9" }}
                      rows={4}
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newQuestionData.IsRequired}
                    onChange={(e) => setNewQuestionData({...newQuestionData, IsRequired: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label className="text-xs" style={{ color: "#455A7C" }}>Required</label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={addNewQuestion}
                    disabled={savingQuestion || !newQuestionData.QuestionText.trim()}
                    className="flex-1 px-3 py-2 text-white rounded font-semibold disabled:opacity-50"
                    style={{ backgroundColor: "#16a34a" }}
                  >
                    {savingQuestion ? 'Adding...' : 'Add Question'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddQuestionForm(false);
                      setNewQuestionData({
                        QuestionText: '',
                        QuestionType: 'Multiple Choice',
                        Options: '',
                        IsRequired: true,
                      });
                    }}
                    className="flex-1 px-3 py-2 text-white rounded font-semibold"
                    style={{ backgroundColor: "#455A7C" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

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
                  {editingQuestionId === question.QuestionId ? (
                    // Edit Mode
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs mb-1" style={{ color: "#455A7C" }}>Question Text</label>
                        <textarea
                          value={editFormData.QuestionText}
                          onChange={(e) => setEditFormData({...editFormData, QuestionText: e.target.value})}
                          className="w-full px-3 py-2 rounded border focus:outline-none focus:border-2"
                          style={{ backgroundColor: "#ffffff", color: "#0A2342", borderColor: "#C6CDD9" }}
                          rows={2}
                        />
                      </div>

                      {editFormData.QuestionType === "Multiple Choice" && (
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "#455A7C" }}>Options (one per line)</label>
                          <textarea
                            value={editFormData.Options}
                            onChange={(e) => setEditFormData({...editFormData, Options: e.target.value})}
                            className="w-full px-3 py-2 rounded border focus:outline-none focus:border-2"
                            style={{ backgroundColor: "#ffffff", color: "#0A2342", borderColor: "#C6CDD9" }}
                            rows={4}
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editFormData.IsRequired}
                          onChange={(e) => setEditFormData({...editFormData, IsRequired: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <label className="text-xs" style={{ color: "#455A7C" }}>Required</label>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => saveQuestion(question.QuestionId)}
                          disabled={savingQuestion}
                          className="flex-1 px-3 py-2 text-white rounded font-semibold disabled:opacity-50"
                          style={{ backgroundColor: "#16a34a" }}
                        >
                          {savingQuestion ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="flex-1 px-3 py-2 text-white rounded font-semibold"
                          style={{ backgroundColor: "#455A7C" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: "#16305B" }}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold mb-2" style={{ color: "#0A2342" }}>{question.QuestionText}</p>
                        <div className="flex items-center gap-2 text-xs mb-2">
                          <span className="px-2 py-1 rounded" style={{ backgroundColor: "#16305B", color: "#ffffff" }}>{question.QuestionType}</span>
                          {question.IsRequired && (
                            <span className="px-2 py-1 bg-red-600 text-white rounded">Required</span>
                          )}
                        </div>

                        {question.QuestionType === "Multiple Choice" && question.Options && (
                          <div className="mt-3 space-y-1 mb-3">
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

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => startEditingQuestion(question)}
                            className="px-3 py-1 text-white rounded text-xs font-semibold"
                            style={{ backgroundColor: "#16305B" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteQuestion(question.QuestionId)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Case Files Panel */}
      {showCaseFilesPanel && (
        <div className="w-1/5 flex flex-col shadow-2xl" style={{ backgroundColor: "#ffffff", borderLeft: "1px solid #C6CDD9" }}>
          <div className="p-5 flex items-center justify-between" style={{ backgroundColor: "#16305B", borderBottom: "1px solid #C6CDD9" }}>
            <div>
              <h3 className="text-lg font-bold text-white">Case Files</h3>
              <p className="text-sm text-white opacity-80">{caseFiles.length} files</p>
            </div>
            <button onClick={toggleCaseFilesPanel} className="text-white hover:text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loadingCaseFiles ? (
              <div className="text-center mt-10" style={{ color: "#455A7C" }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
                Loading files...
              </div>
            ) : caseFiles.length === 0 ? (
              <div className="text-center mt-10" style={{ color: "#455A7C" }}>
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="font-semibold">No case files</p>
                <p className="text-sm mt-2">No filing documents attached to this case</p>
              </div>
            ) : (
              caseFiles.map((doc) => (
                <div key={doc.Id} className="rounded-lg p-4 transition" style={{ backgroundColor: "#f9f7f2", border: "1px solid #C6CDD9" }}>
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
                      {doc.Type && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs font-medium px-2 py-0.5 rounded capitalize" style={{ backgroundColor: "#16305B20", color: "#16305B" }}>
                            {doc.Type}
                          </span>
                        </div>
                      )}
                      <p className="text-xs mt-1" style={{ color: "#455A7C" }}>
                        {new Date(doc.UploadedAt).toLocaleDateString()}
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
