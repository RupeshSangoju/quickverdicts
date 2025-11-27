"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

export default function TrialSetupPage() {
  const { id } = useParams();
  const router = useRouter();
  const caseId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<{
    cameras: MediaDeviceInfo[];
    microphones: MediaDeviceInfo[];
    speakers: MediaDeviceInfo[];
  }>({ cameras: [], microphones: [], speakers: [] });
  
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  // Get available devices
  useEffect(() => {
    async function getDevices() {
      try {
        // Request permissions first
        const tempStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        // Get all devices
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        
        const cameras = allDevices.filter(d => d.kind === "videoinput");
        const microphones = allDevices.filter(d => d.kind === "audioinput");
        const speakers = allDevices.filter(d => d.kind === "audiooutput");
        
        setDevices({ cameras, microphones, speakers });
        
        // Set defaults
        if (cameras.length > 0) setSelectedCamera(cameras[0].deviceId);
        if (microphones.length > 0) setSelectedMicrophone(microphones[0].deviceId);
        if (speakers.length > 0) setSelectedSpeaker(speakers[0].deviceId);
        
        setStream(tempStream);
        setLoading(false);
      } catch (error) {
        console.error("Error accessing media devices:", error);
        alert("Could not access camera/microphone. Please grant permissions.");
        setLoading(false);
      }
    }
    
    getDevices();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Update video preview when camera changes
  useEffect(() => {
    async function updateCamera() {
      if (!selectedCamera) return;
      
      try {
        // Stop previous stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        // Get new stream
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: selectedCamera },
          audio: { deviceId: selectedMicrophone }
        });
        
        setStream(newStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (error) {
        console.error("Error switching camera:", error);
      }
    }
    
    if (selectedCamera) {
      updateCamera();
    }
  }, [selectedCamera, selectedMicrophone]);

  // Apply video to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = async () => {
    setIsVideoOff(!isVideoOff);
    
    if (!isVideoOff) {
      // Turning off - stop video track
      if (stream) {
        stream.getVideoTracks().forEach(track => track.stop());
      }
    } else {
      // Turning on - restart video track
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: selectedCamera },
          audio: false // Don't restart audio, keep existing
        });
        
        // Replace only video track
        const videoTrack = newStream.getVideoTracks()[0];
        const audioTracks = stream?.getAudioTracks() || [];
        
        const combinedStream = new MediaStream([videoTrack, ...audioTracks]);
        setStream(combinedStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = combinedStream;
        }
      } catch (error) {
        console.error("Error restarting video:", error);
      }
    }
  };

  const handleStartCall = () => {
    // Set connecting state to disable button and show loading
    setIsConnecting(true);
    
    // Keep the stream alive and pass to conference page
    router.push(`/attorney/cases/${caseId}/trial/conference`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#16305B]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-60 bg-[#16305B] text-white flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
              <span className="text-[#16305B] font-bold text-xl">Q</span>
            </div>
            <span className="font-bold text-lg">QUICK VERDICTS</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-60 flex items-center justify-center min-h-screen p-8">
        <div className="max-w-5xl w-full">
          <div className="grid grid-cols-2 gap-8">
            {/* Left: Video Preview */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-[#16305B] mb-6">Start a call</h2>
              
              <div className="mb-6">
                <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ height: "320px" }}>
                  {isVideoOff ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <div className="w-24 h-24 bg-gray-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-3xl font-bold">
                          {/* First letter of user name */}
                          A
                        </span>
                      </div>
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  {/* Controls overlay */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
                    <button
                      onClick={toggleMute}
                      disabled={isConnecting}
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isMuted ? "bg-red-600" : "bg-gray-700"
                      } text-white hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isMuted ? "🔇" : "🎤"}
                    </button>
                    <button
                      onClick={toggleVideo}
                      disabled={isConnecting}
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isVideoOff ? "bg-red-600" : "bg-gray-700"
                      } text-white hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isVideoOff ? "📹" : "📷"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="text-sm text-gray-600 hover:text-gray-800">Mute</button>
                  <span className="text-gray-400">|</span>
                  <button className="text-sm text-gray-600 hover:text-gray-800">Turn off</button>
                </div>
              </div>
            </div>

            {/* Right: Device Settings */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-[#16305B] mb-6">Device Settings</h3>
              
              <div className="space-y-6">
                {/* Camera Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📹 Camera
                  </label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    disabled={isConnecting}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {devices.cameras.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || "Camera"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Microphone Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🎤 Sound
                  </label>
                  <select
                    value={selectedMicrophone}
                    onChange={(e) => setSelectedMicrophone(e.target.value)}
                    disabled={isConnecting}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {devices.microphones.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || "Microphone"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Speaker Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔊 Speakers
                  </label>
                  <select
                    value={selectedSpeaker}
                    onChange={(e) => setSelectedSpeaker(e.target.value)}
                    disabled={isConnecting}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {devices.speakers.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || "Speakers"}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleStartCall}
                  disabled={isConnecting}
                  className="w-full mt-8 py-3 bg-[#0066CC] text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isConnecting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      <span>Connecting to call...</span>
                    </>
                  ) : (
                    <>
                      <span>📹</span>
                      <span>Start call</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}