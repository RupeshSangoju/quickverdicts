"use client";
import { useState, useEffect } from "react";
import JurorSidebar from "./components/JurorSidebar";
import JurorMainSection from "./components/JurorMainSection";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { useWebSocket } from "@/hooks/useWebSocket";
import { logout } from "@/lib/apiClient";
import toast from "react-hot-toast";

type Section = "home" | "profile" | "notifications" | "jobs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  if (!token) {
    throw new Error('Authentication token not found');
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

export default function JurorDashboard() {
  useProtectedRoute({ requiredUserType: 'juror' });

  const { on, off } = useWebSocket();

  // Forced logout when admin deletes or declines this account
  useEffect(() => {
    const handleAccountDeleted = (data: any) => {
      toast.error(data?.message || "Your account has been removed by the administrator.", { duration: 5000 });
      setTimeout(() => logout("/login/juror"), 1500);
    };
    on("account_deleted", handleAccountDeleted);
    return () => off("account_deleted", handleAccountDeleted);
  }, [on, off]);

  const [selectedSection, setSelectedSection] = useState<Section>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ Poll verification status to unlock sections when admin verifies
  useEffect(() => {
    const checkVerificationStatus = async () => {
      try {
        const response = await fetchWithAuth(`${API_BASE}/api/juror/profile`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data?.juror) {
          const jurorData = data.data.juror;

          // Get current user from localStorage
          const storedUser = localStorage.getItem("jurorUser");
          let currentUser = storedUser ? JSON.parse(storedUser) : null;

          // ✅ FIXED: Backend returns camelCase (isVerified, not IsVerified)
          const verified = jurorData.isVerified || false;
          const verificationStatus = jurorData.verificationStatus || 'pending';
          const introCompleted = jurorData.introVideoCompleted || false;
          const quizCompleted = jurorData.jurorQuizCompleted || false;

          console.log("📦 Backend data received:", {
            isVerified: jurorData.isVerified,
            verificationStatus: jurorData.verificationStatus,
            introVideoCompleted: jurorData.introVideoCompleted,
            jurorQuizCompleted: jurorData.jurorQuizCompleted
          });

          // Check if verification status changed
          const statusChanged = currentUser && (
            currentUser.isVerified !== verified ||
            currentUser.verificationStatus !== verificationStatus
          );

          // ✅ FIXED: Always trust backend as source of truth
          // Backend database is the authoritative source for all completion status
          // Update localStorage to match backend values exactly
          const updatedUser = {
            jurorId: jurorData.JurorId || jurorData.id,
            email: jurorData.Email || jurorData.email,
            firstName: jurorData.FirstName || jurorData.firstName,
            lastName: jurorData.LastName || jurorData.lastName,
            isVerified: verified,
            verificationStatus: verificationStatus,
            introVideoCompleted: introCompleted,
            jurorQuizCompleted: quizCompleted,
            onboardingCompleted: introCompleted && quizCompleted
          };

          localStorage.setItem("jurorUser", JSON.stringify(updatedUser));

          console.log("✅ Juror data updated:", {
            verified,
            intro: introCompleted,
            quiz: quizCompleted
          });

          if (statusChanged) {
            console.log("✅ Juror verification status updated:", {
              verified: verified,
              status: verificationStatus
            });

            // Dispatch event for sidebar to update (if needed)
            window.dispatchEvent(new CustomEvent('verificationStatusChanged', {
              detail: { isVerified: verified, verificationStatus: verificationStatus }
            }));
          }
        }
      } catch (error: any) {
        if (error.message !== 'Authentication expired') {
          console.error("Failed to check verification status:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Check immediately on mount
    checkVerificationStatus();

    // Check every 30 seconds
    const interval = setInterval(checkVerificationStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <JurorSidebar
        selectedSection={selectedSection}
        onSectionChange={setSelectedSection}
        onCollapsedChange={setSidebarCollapsed}
      />
      <JurorMainSection selectedSection={selectedSection} sidebarCollapsed={sidebarCollapsed} />
    </div>
  );
}
