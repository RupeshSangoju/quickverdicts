"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { CallClient, VideoStreamRenderer, LocalVideoStream } from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import { ChatClient } from "@azure/communication-chat";
import { getToken } from "@/lib/apiClient";
import toast from "react-hot-toast";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MessageSquare,
  Phone,
  AlertCircle,
  MoreVertical,
  Pin,
  Volume2,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

export default function JurorConferenceClient() {
  const { id } = useParams();
  const router = useRouter();
  const caseId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const [call, setCall] = useState<any>(null);
  const [callState, setCallState] = useState("Initializing...");
  const [participants, setParticipants] = useState<any[]>([]);
  const [featuredParticipant, setFeaturedParticipant] = useState<string>("local");
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [displayName, setDisplayName] = useState("You");
  const [renderTrigger, setRenderTrigger] = useState(0);

  const [participantVideoStates, setParticipantVideoStates] = useState<Map<string, boolean>>(new Map());
  const [participantSpeakingStates, setParticipantSpeakingStates] = useState<Map<string, boolean>>(new Map());
  const [participantMuteStates, setParticipantMuteStates] = useState<Map<string, boolean>>(new Map());
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  const [hoveredParticipant, setHoveredParticipant] = useState<string | null>(null);
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null);

  const [chatClient, setChatClient] = useState<any>(null);
  const [chatThread, setChatThread] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [showChatNotification, setShowChatNotification] = useState(false);
  const [latestMessage, setLatestMessage] = useState<any>(null);

  const [showChatPanel, setShowChatPanel] = useState(false);
  const [participantJoinTimes, setParticipantJoinTimes] = useState<Map<string, Date>>(new Map());

  const featuredVideoRef = useRef<HTMLDivElement>(null);
  const localVideoStream = useRef<any>(null);
  const remoteVideoRefs = useRef<Map<string, any>>(new Map());
  const participantVideoRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const hasInitialized = useRef(false);
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
    initializeCall();
  }, []);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  // Clear participant video and show avatar
  function clearParticipantVideo(participantId: string) {
    console.log(`🧹 Clearing video for ${participantId} - will show avatar`);

    // Clear container to remove frozen frame
    const containerElement = participantVideoRefs.current.get(participantId);
    if (containerElement) {
      containerElement.innerHTML = "";
    }

    // Dispose renderer
    disposeVideoRenderer(participantId);

    // Force re-render if this participant is featured
    if (featuredParticipant === participantId) {
      setRenderTrigger(prev => prev + 1);
    }
  }

  // Render participant video in thumbnail
  async function renderParticipantVideoInThumbnail(participantId: string) {
    try {
      const containerElement = participantVideoRefs.current.get(participantId);
      if (!containerElement) return;

      // Clear existing content
      containerElement.innerHTML = "";

      // Check if this is local participant
      if (participantId === "local") {
        if (!isVideoOff && localVideoStream.current) {
          // Local camera is ON - render it
          const renderer = new VideoStreamRenderer(localVideoStream.current);
          const view = await renderer.createView({ scalingMode: 'Crop' });
          containerElement.appendChild(view.target);
          console.log("✅ Rendered local video in thumbnail");
        }
        // If camera is OFF, container stays empty (avatar will show via CSS)
      } else {
        // Remote participant
        const participant = participants.find((p: any) => getUserId(p.identifier) === participantId);
        if (participant && participant.videoStreams) {
          const videoStream = participant.videoStreams.find((s: any) => s.mediaStreamType === "Video");
          if (videoStream && videoStream.isAvailable) {
            // Remote camera is ON - render it
            const renderer = new VideoStreamRenderer(videoStream);
            const view = await renderer.createView({ scalingMode: 'Crop' });
            containerElement.appendChild(view.target);
            console.log(`✅ Rendered remote video in thumbnail for ${participantId}`);
          }
        }
        // If no video or camera OFF, container stays empty (avatar will show via CSS)
      }
    } catch (err) {
      console.error(`Error rendering thumbnail for ${participantId}:`, err);
    }
  }

  async function renderFeaturedVideo() {
    if (!featuredVideoRef.current) return;

    try {
      featuredVideoRef.current.innerHTML = "";

      if (featuredParticipant && featuredParticipant.startsWith("screenshare-")) {
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
          }
        }
      });

      console.log("Chat initialized successfully!");
    } catch (err) {
      console.error("Chat initialization error:", err);
    }
  }

  async function initializeCall() {
    try {
      setCallState("Getting permissions...");
      const token = getToken();

      const response = await fetch(`${API_BASE}/api/trial/juror-join/${caseId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) throw new Error("Not authorized to join this trial");
      const data = await response.json();
      setDisplayName(data.displayName);

      if (data.chatThreadId && data.endpointUrl) {
        await initializeChat(data.token, data.userId, data.chatThreadId, data.endpointUrl);
      }

      setCallState("Setting up video...");
      const tokenCredential = new AzureCommunicationTokenCredential(data.token);
      const callClient = new CallClient();
      const deviceManager = await callClient.getDeviceManager();

      const cameras = await deviceManager.getCameras();
      if (cameras.length > 0) {
        localVideoStream.current = new LocalVideoStream(cameras[0]);
      }

      setCallState("Connecting to trial...");

      const agent = await callClient.createCallAgent(tokenCredential, {
        displayName: data.displayName,
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

      roomCall.on('remoteParticipantsUpdated', async (e: any) => {
        e.added.forEach((participant: any) => {
          const userId = getUserId(participant.identifier);
          setParticipantJoinTimes(prev => new Map(prev).set(userId, new Date()));

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

          participant.on('videoStreamsUpdated', async (streamEvent: any) => {
            streamEvent.added.forEach(async (stream: any) => {
              if (stream.mediaStreamType === 'Video') {
                // Update state immediately
                setParticipantVideoStates(prev => {
                  const updated = new Map(prev);
                  updated.set(userId, stream.isAvailable);
                  return updated;
                });

                // Listen for camera toggle events
                stream.on('isAvailableChanged', async () => {
                  console.log(`📹 ${userId} camera ${stream.isAvailable ? 'ON' : 'OFF'}`);

                  // Update state
                  setParticipantVideoStates(prev => {
                    const updated = new Map(prev);
                    updated.set(userId, stream.isAvailable);
                    return updated;
                  });
                });
              } else if (stream.mediaStreamType === 'ScreenSharing') {
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
              if (stream.mediaStreamType === 'Video') {
                // Video stream removed
                setParticipantVideoStates(prev => {
                  const updated = new Map(prev);
                  updated.set(userId, false);
                  return updated;
                });
              } else if (stream.mediaStreamType === 'ScreenSharing') {
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
        // Turn camera ON
        await call.startVideo(localVideoStream.current);
        setIsVideoOff(false);
        console.log("📹 Camera turned ON");
      } else {
        // Turn camera OFF
        await call.stopVideo(localVideoStream.current);
        setIsVideoOff(true);
        console.log("📹 Camera turned OFF");
      }
    } catch (err) {
      console.error("Toggle video error:", err);
    }
  };

  const leaveCall = async () => {
    try {
      if (call) await call.hangUp();
      if (chatClient) await chatClient.stopRealtimeNotifications();
      toast.success("You have left the trial successfully", { duration: 3000 });
      router.push("/juror");
    } catch (error) {
      console.log("Leave call completed with cleanup:", error);
      router.push("/juror");
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

  function formatTime(date: Date): string {
    if (!date) return "Unknown";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

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
          <p className="text-gray-600 mt-2">Juror Trial Conference</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Unable to Join Trial</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push("/juror")}
              className="w-full py-3 text-white rounded-xl font-semibold transition hover:opacity-90"
              style={{ backgroundColor: "#0A2342" }}
            >
              Return to Dashboard
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

  const allParticipants = [
    {
      id: "local",
      displayName: displayName,
      isLocal: true,
      joinTime: participantJoinTimes.get("local"),
      role: "Juror"
    },
    ...participants.map((p: any) => ({
      id: getUserId(p.identifier),
      displayName: p.displayName || "Participant",
      isLocal: false,
      participant: p,
      joinTime: participantJoinTimes.get(getUserId(p.identifier)),
      role: p.displayName?.toLowerCase().includes("admin") ? "Admin" :
            p.displayName?.toLowerCase().includes("attorney") ? "Attorney" : "Participant"
    })),
    ...screenShareParticipants
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#f0ebe0" }}>
      {/* Container with chat support */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content Area - More space for video when chat open */}
        <div className={`flex flex-col transition-all duration-300 ${
          showChatPanel ? 'w-4/5' : 'w-4/5 mx-auto'
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

                  {/* Three-dot menu - Juror only has PIN option */}
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

      {/* Control Bar - Jurors don't have screen share */}
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
                disabled={!chatThread}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || !chatThread}
                className="px-5 py-3 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg font-semibold"
                style={{ backgroundColor: "#16305B" }}
              >
                Send
              </button>
            </div>
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
