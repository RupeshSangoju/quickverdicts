"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL 
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}

type Notification = {
  NotificationId: number;
  Title: string;
  Message: string;
  CreatedAt: string;
};

interface NotificationPreviewProps {
  isHovered: boolean;
}

export default function NotificationPreview({ isHovered }: NotificationPreviewProps) {
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null);

  useEffect(() => {
    if (isHovered) {
      fetchLatest();
    }
  }, [isHovered]);

  const fetchLatest = async () => {
    try {
      const token = getCookie("token");
      if (!token) return;
      
      const res = await fetch(`${API_BASE}/api/notifications?unreadOnly=true`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.notifications.length > 0) {
        setLatestNotification(data.notifications[0]);
      }
    } catch (error) {
      console.error("Failed to fetch latest notification:", error);
    }
  };

  if (!isHovered || !latestNotification) return null;

  return (
    <div className="absolute left-full ml-2 top-0 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-3">
      <div className="text-xs font-semibold text-gray-800 mb-1">
        {latestNotification.Title}
      </div>
      <div className="text-xs text-gray-600 line-clamp-2">
        {latestNotification.Message}
      </div>
      <div className="text-xs text-gray-400 mt-2">
        Click to view all
      </div>
    </div>
  );
}