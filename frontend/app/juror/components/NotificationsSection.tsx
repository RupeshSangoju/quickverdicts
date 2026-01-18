"use client";

import { useEffect, useState } from "react";
import { BellIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { getToken } from "@/lib/apiClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

type Notification = {
  NotificationId: number;
  Title: string;
  Message: string;
  Type: string;
  IsRead: boolean;
  CreatedAt: string;
  CaseTitle?: string;
  CaseId?: number;
};

export default function NotificationsSection() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const unreadParam = filter === "unread" ? "?unreadOnly=true" : "";
      const res = await fetch(`${API_BASE}/api/notifications${unreadParam}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      const token = getToken();
      await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      setNotifications(prev => 
        prev.map(n => n.NotificationId === notificationId ? { ...n, IsRead: true } : n)
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = getToken();
      await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const unreadCount = notifications.filter(n => !n.IsRead).length;

  return (
    <div className="flex-1 w-full p-8 bg-[#FAF9F6] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0C2D57]">Notifications</h1>
            <p className="text-sm text-gray-600 mt-1">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded text-sm font-medium transition ${
                  filter === "all"
                    ? "bg-[#0C2D57] text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-4 py-2 rounded text-sm font-medium transition ${
                  filter === "unread"
                    ? "bg-[#0C2D57] text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Unread
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-white text-[#0C2D57] rounded text-sm font-medium hover:bg-gray-50 transition"
              >
                Mark All Read
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded shadow">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0C2D57]"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <BellIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No notifications to display</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.NotificationId}
                  className={`p-4 hover:bg-gray-50 transition cursor-pointer ${
                    !notification.IsRead ? "bg-blue-50" : ""
                  }`}
                  onClick={() => !notification.IsRead && markAsRead(notification.NotificationId)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#0C2D57]">
                          {notification.Title}
                        </h3>
                        {!notification.IsRead && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm mb-2">
                        {notification.Message}
                      </p>
                      {notification.CaseTitle && (
                        <p className="text-xs text-gray-500">
                          Related to: <span className="font-medium">{notification.CaseTitle}</span>
                          {notification.CaseId && <span className="text-gray-400 ml-1">(Case ID: {notification.CaseId})</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(notification.CreatedAt)}
                      </span>
                      {notification.IsRead && (
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}