"use client";

import { useState, useEffect } from "react";
import AttorneySidebar from "./components/AttorneySidebar";
import AttorneyMainSection from "./components/AttorneyMainSection";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { getToken, logout } from "@/lib/apiClient";
import { useWebSocket } from "@/hooks/useWebSocket";
import toast from "react-hot-toast";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

type Section = "home" | "profile" | "notifications" | "cases" | "calendar";

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = getToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Helper for authenticated fetch
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const headers = getAuthHeaders();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Token expired or invalid - use centralized logout
    logout();
    throw new Error('Authentication expired');
  }

  return response;
};

export default function AttorneyDashboard() {
  useProtectedRoute({ requiredUserType: 'attorney' });

  const { on, off } = useWebSocket();

  // Forced logout when admin deletes or declines this account
  useEffect(() => {
    const handleAccountDeleted = (data: any) => {
      toast.error(data?.message || "Your account has been removed by the administrator.", { duration: 5000 });
      setTimeout(() => logout("/login/attorney"), 1500);
    };
    on("account_deleted", handleAccountDeleted);
    return () => off("account_deleted", handleAccountDeleted);
  }, [on, off]);

  const [selectedSection, setSelectedSection] = useState<Section>("home");
  const [verificationStatusChanged, setVerificationStatusChanged] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Listen for in-page navigation events (e.g. Home "View all" -> Cases)
  useEffect(() => {
    const handler = (e: Event) => {
      setSelectedSection("cases");
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('navigate-to-cases', handler as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('navigate-to-cases', handler as EventListener);
      }
    };
  }, []);

  // Fetch and sync verification status
  useEffect(() => {
    const checkVerificationStatus = async () => {
      try {
        // Only check if we have a token
        const token = getToken();
        if (!token) {
          console.log('No auth token found');
          return;
        }

        const response = await fetchWithAuth(`${API_BASE}/api/attorney/profile`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data?.attorney) {
          const attorneyData = data.data.attorney;

          // Get current user from localStorage
          const storedUser = localStorage.getItem("attorneyUser");
          let currentUser = storedUser ? JSON.parse(storedUser) : null;

          // Map backend field names to frontend
          const verified = attorneyData.IsVerified || attorneyData.verified || false;
          const verificationStatus = attorneyData.VerificationStatus || attorneyData.verificationStatus || 'pending';

          // Check if verification status changed
          const statusChanged = currentUser && (
            currentUser.isVerified !== verified ||
            currentUser.verificationStatus !== verificationStatus
          );

          // Update localStorage with fresh data from backend
          const updatedUser = {
            attorneyId: attorneyData.AttorneyId || attorneyData.id,
            email: attorneyData.Email || attorneyData.email,
            firstName: attorneyData.FirstName || attorneyData.firstName,
            lastName: attorneyData.LastName || attorneyData.lastName,
            lawFirmName: attorneyData.LawFirmEntityName || attorneyData.LawFirmName || attorneyData.lawFirmName,
            phoneNumber: attorneyData.PhoneNumber || attorneyData.phoneNumber,
            isVerified: verified,
            verificationStatus: verificationStatus,
          };

          localStorage.setItem("attorneyUser", JSON.stringify(updatedUser));

          if (statusChanged) {
            // Trigger re-render by incrementing state
            setVerificationStatusChanged(prev => prev + 1);

            console.log("✅ Verification status updated:", {
              verified: verified,
              status: verificationStatus
            });

            // Dispatch event for sidebar to update
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

  // Show loading state briefly on mount
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#F7F6F3] font-sans overflow-hidden">
      <AttorneySidebar
        selectedSection={selectedSection}
        onSectionChange={(section: Section) => setSelectedSection(section)}
        key={verificationStatusChanged} // Force re-render when verification changes
      />
      <AttorneyMainSection
        selectedSection={selectedSection}
        onSectionChange={(section: Section) => setSelectedSection(section)}
      />
    </div>
  );
}