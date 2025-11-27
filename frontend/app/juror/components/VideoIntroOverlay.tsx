"use client";

import { useRef, useState, useEffect } from "react";
import { X, Play, Pause } from "lucide-react";

interface VideoIntroOverlayProps {
  open: boolean;
  onClose: () => void;
  onNext: () => void;
  sidebarCollapsed?: boolean;
}

export default function VideoIntroOverlay({ open, onClose, onNext, sidebarCollapsed = false }: VideoIntroOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showThumbnail, setShowThumbnail] = useState(true);

  const sidebarWidth = sidebarCollapsed ? 80 : 256;

  // Prevent seeking by user and update time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let lastValidTime = 0;

    const handleTimeUpdate = () => {
      if (!video.seeking) {
        lastValidTime = video.currentTime;
      }
      setCurrentTime(video.currentTime);
    };

    const handleSeeking = () => {
      // If user tries to seek forward, reset to last valid time
      if (video.currentTime > lastValidTime) {
        video.currentTime = lastValidTime;
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleCanPlay = () => {
      if (video.duration) {
        setDuration(video.duration);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('durationchange', handleLoadedMetadata);

    // Force initial duration check
    if (video.duration && !isNaN(video.duration)) {
      setDuration(video.duration);
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('durationchange', handleLoadedMetadata);
    };
  }, [showThumbnail]);

  // Prevent clicking on progress bar to seek
  useEffect(() => {
    const progressBar = progressBarRef.current;
    if (!progressBar) return;

    const preventSeek = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    progressBar.addEventListener('click', preventSeek);
    progressBar.addEventListener('mousedown', preventSeek);

    return () => {
      progressBar.removeEventListener('click', preventSeek);
      progressBar.removeEventListener('mousedown', preventSeek);
    };
  }, []);

  const handlePlayClick = () => {
    setShowThumbnail(false);
    setTimeout(() => {
      videoRef.current?.play();
    }, 100);
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!open) return null;

  // Calculate progress percentage (cannot be seeked by user)
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Main Overlay */}
      <div
        className="fixed inset-y-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center transition-all duration-500 ease-in-out"
        style={{ 
          left: sidebarWidth, 
          width: `calc(100vw - ${sidebarWidth}px)` 
        }}
      >
        <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full mx-8 flex flex-col"
          style={{ maxWidth: '1000px', maxHeight: 'calc(100vh - 4rem)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gradient-to-r from-[#0C2D57] to-[#132c54] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Introduction to Quick Verdicts</h2>
                <p className="text-xs text-blue-100">Required onboarding video</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          {/* Video Section - Scrollable if needed */}
          <div className="flex-1 overflow-y-auto">
            {/* Video Player Area */}
            <div className="relative aspect-video bg-black">
              {/* Thumbnail (hidden when video plays) */}
              {showThumbnail && (
                <div className="absolute inset-0 group cursor-pointer" onClick={handlePlayClick}>
                  <img
                    src="/introduction_video.png"
                    alt="Introduction Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/40 group-hover:via-black/30 group-hover:to-black/50 transition-all duration-300" />
                  
                  {/* Large Play Button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-300">
                      <Play className="w-10 h-10 text-[#0C2D57] ml-1" />
                    </div>
                  </div>

                  {/* Duration Badge */}
                  <div className="absolute bottom-3 right-3 bg-black/80 px-2.5 py-1 rounded-lg">
                    <span className="text-white text-xs font-medium">~5 minutes</span>
                  </div>
                </div>
              )}

              {/* Video Element */}
              <video
                ref={videoRef}
                src="/introduction_demo_video.mp4"
                className="w-full h-full object-contain"
                preload="metadata"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setVideoEnded(true);
                  setIsPlaying(false);
                }}
                onTimeUpdate={(e) => {
                  const video = e.currentTarget;
                  setCurrentTime(video.currentTime);
                }}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  setDuration(video.duration);
                }}
                disablePictureInPicture
                controlsList="nodownload noremoteplayback nofullscreen noplaybackrate"
                style={{ display: showThumbnail ? 'none' : 'block' }}
              />

              {/* Custom Controls Overlay (only visible when video is playing) */}
              {!showThumbnail && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                  {/* Progress Bar - Visual only, not interactive */}
                  <div className="mb-3" ref={progressBarRef}>
                    <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden cursor-not-allowed">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-white/90 mt-1.5 font-medium">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Play/Pause Button */}
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={togglePlayPause}
                      className="w-12 h-12 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition-all shadow-lg"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 text-[#0C2D57]" />
                      ) : (
                        <Play className="w-5 h-5 text-[#0C2D57] ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* No skip warning */}
                  <div className="mt-2 text-center">
                    <p className="text-white/70 text-xs flex items-center justify-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Seeking is disabled - You must watch the entire video
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="p-5 bg-gray-50">
              <h3 className="text-base font-semibold text-[#0C2D57] mb-2">Welcome to Quick Verdicts</h3>
              <p className="text-gray-700 text-sm leading-relaxed mb-3">
                Watch this short introduction video to learn how Quick Verdicts works. You'll see a mock trial demonstration and understand how you'll participate as a juror.
              </p>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-yellow-800">Important: Video must be watched completely</p>
                    <p className="text-xs text-yellow-700 mt-0.5">You cannot skip or fast-forward. This ensures you understand the platform before taking the quiz.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Button Overlay - Appears after video ends */}
      {videoEnded && (
        <div
          className="fixed bottom-6 right-6 z-50"
          style={{ 
            right: '1.5rem'
          }}
        >
          <button
            onClick={onNext}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl shadow-2xl hover:from-green-600 hover:to-green-700 transform hover:scale-105 transition-all duration-300 flex items-center gap-2"
          >
            <span>Continue to Quiz</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}