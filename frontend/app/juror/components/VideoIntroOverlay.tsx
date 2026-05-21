"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronRight } from "lucide-react";

// Seconds the juror must spend on the Sway before Continue unlocks.
const REQUIRED_SECONDS = 90;

interface VideoIntroOverlayProps {
  open: boolean;
  onClose: () => void;
  onNext: () => void;
  sidebarCollapsed?: boolean;
}

export default function VideoIntroOverlay({
  open,
  onClose,
  onNext,
  sidebarCollapsed = false,
}: VideoIntroOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState(REQUIRED_SECONDS);
  const [canContinue, setCanContinue] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lock background scroll while overlay is open
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Reset and start timer each time the overlay opens
  useEffect(() => {
    if (!open) return;

    setSecondsLeft(REQUIRED_SECONDS);
    setCanContinue(false);

    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          setCanContinue(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    // Listen for any postMessage Sway may emit on completion
    const handleMessage = (e: MessageEvent) => {
      if (
        typeof e.data === "object" &&
        e.data !== null &&
        (e.data.type === "sway:end" || e.data.event === "slideEnd" || e.data.completed)
      ) {
        clearInterval(intervalRef.current!);
        setCanContinue(true);
        setSecondsLeft(0);
      }
    };
    window.addEventListener("message", handleMessage);

    return () => {
      clearInterval(intervalRef.current!);
      window.removeEventListener("message", handleMessage);
    };
  }, [open]);

  if (!open) return null;

  const sidebarWidth = sidebarCollapsed ? 80 : 256;
  const progress = Math.round(((REQUIRED_SECONDS - secondsLeft) / REQUIRED_SECONDS) * 100);

  return (
    <div
      className="fixed inset-y-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center transition-all duration-500 ease-in-out"
      style={{ left: sidebarWidth, width: `calc(100vw - ${sidebarWidth}px)` }}
    >
      <div
        className="relative bg-white w-full mx-6 flex flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ maxWidth: "920px", maxHeight: "calc(100vh - 3rem)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#0C2D57] to-[#132c54] flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Introduction to Quick Verdicts</h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Scroll through the entire presentation to unlock the Continue button
            </p>
          </div>
          <button
            className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sway embed */}
        <div className="flex-1 overflow-hidden min-h-0">
          <iframe
            src="https://sway.cloud.microsoft/s/M7ZlONwhbNHR9ohq/embed"
            width="100%"
            height="100%"
            frameBorder="0"
            marginHeight={0}
            marginWidth={0}
            sandbox="allow-forms allow-modals allow-orientation-lock allow-popups allow-same-origin allow-scripts"
            scrolling="no"
            allowFullScreen
            style={{
              border: "none",
              display: "block",
              width: "100%",
              height: "100%",
              minHeight: "420px",
            }}
          />
        </div>

        {/* Footer — progress + continue */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-500">
                Scroll horizontally through all slides to continue
              </span>
              {canContinue ? (
                <span className="text-green-600 font-semibold">✓ Presentation complete</span>
              ) : (
                <span className="text-[#0C2D57] font-medium tabular-nums">
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")} remaining
                </span>
              )}
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${progress}%`,
                  background: canContinue
                    ? "linear-gradient(90deg,#16a34a,#22c55e)"
                    : "linear-gradient(90deg,#0C2D57,#1a4d8f)",
                }}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              disabled={!canContinue}
              onClick={onNext}
              className={`inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-base transition-all ${
                canContinue
                  ? "bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg hover:scale-105 cursor-pointer"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {canContinue ? (
                <>
                  Continue to Job Board
                  <ChevronRight className="w-5 h-5" />
                </>
              ) : (
                "Scroll through all slides to continue"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
