"use client";

import { useEffect, useState } from "react";
import { BellIcon, CheckCircleIcon, Trash2Icon, XCircleIcon } from "lucide-react";
import { ArrowLeft, RefreshCw } from "lucide-react";
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
};

interface AttorneyNotificationsSectionProps {
  onBack: () => void;
}

export default function AttorneyNotificationsSection({ onBack }: AttorneyNotificationsSectionProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const fetchNotifications = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const token = getToken();

      if (!token) {
        throw new Error("Authentication token not found. Please login again.");
      }

      // ✅ CORRECT: Use query param for filtering
      const unreadParam = filter === "unread" ? "?unreadOnly=true" : "";
      const res = await fetch(`${API_BASE}/api/notifications${unreadParam}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please login again.");
        }
        throw new Error(`Failed to fetch notifications: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success) {
        setNotifications(data.notifications || []);
      } else {
        throw new Error(data.message || "Failed to fetch notifications");
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setError(err instanceof Error ? err.message : "Failed to load notifications");
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      const token = getToken();

      if (!token) {
        throw new Error("Authentication token not found. Please login again.");
      }

      const res = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });

      if (!res.ok) {
        throw new Error("Failed to mark as read");
      }
      
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

      if (!token) {
        throw new Error("Authentication token not found. Please login again.");
      }

      const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });

      if (!res.ok) {
        throw new Error("Failed to mark all as read");
      }
      
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      const token = getToken();

      if (!token) {
        throw new Error("Authentication token not found. Please login again.");
      }

      const res = await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });

      if (!res.ok) {
        throw new Error("Failed to delete notification");
      }
      
      setNotifications(prev => prev.filter(n => n.NotificationId !== notificationId));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleRefresh = () => {
    fetchNotifications(true);
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'application_approved':
      case 'case_approved':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'application_rejected':
      case 'case_rejected':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <BellIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.IsRead).length;

  return (
    <main className="flex-1 px-10 py-8 bg-[#F7F6F3] transition-all duration-300 ease-in-out">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#16305B] hover:text-[#1e417a] transition-colors group"
            aria-label="Go back to home"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold">Back</span>
          </button>
          <div className="h-8 w-px bg-gray-300" />
          <div>
            <h1 className="text-3xl font-bold text-[#16305B]">Notifications</h1>
            <p className="text-sm text-gray-600 mt-1">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2.5 border-2 border-[#16305B] text-[#16305B] rounded-lg flex items-center gap-2 hover:bg-[#16305B] hover:text-white transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                filter === "all"
                  ? "bg-[#16305B] text-white shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                filter === "unread"
                  ? "bg-[#16305B] text-white shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
              }`}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2.5 bg-white text-[#16305B] border-2 border-[#16305B] rounded-lg text-sm font-semibold hover:bg-[#16305B] hover:text-white transition-all"
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <XCircleIcon className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">{error}</p>
            <button
              onClick={() => fetchNotifications()}
              className="text-sm text-red-600 hover:text-red-800 underline mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#16305B] mb-4"></div>
            <p className="text-gray-600 font-medium">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <BellIcon className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Notifications</h3>
            <p className="text-gray-600">
              {filter === "unread" 
                ? "You're all caught up! No unread notifications." 
                : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifications.map((notification) => (
              <div
                key={notification.NotificationId}
                className={`p-5 hover:bg-gray-50 transition-colors ${
                  !notification.IsRead ? "bg-blue-50 border-l-4 border-blue-500" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.Type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-semibold text-[#16305B] flex items-center gap-2">
                        {notification.Title}
                        {!notification.IsRead && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                      </h3>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(notification.CreatedAt)}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm mb-2">
                      {notification.Message}
                    </p>
                    {notification.CaseTitle && (
                      <p className="text-xs text-gray-500 mb-3">
                        Related to: <span className="font-medium text-[#16305B]">{notification.CaseTitle}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      {!notification.IsRead && (
                        <button
                          onClick={() => markAsRead(notification.NotificationId)}
                          className="text-xs text-[#16305B] hover:underline font-medium flex items-center gap-1"
                        >
                          <CheckCircleIcon className="w-3 h-3" />
                          Mark as Read
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.NotificationId)}
                        className="text-xs text-red-600 hover:underline font-medium flex items-center gap-1"
                      >
                        <Trash2Icon className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}