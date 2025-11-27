"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  ArrowLeft,
  Filter,
  Clock,
  AlertCircle,
  Info,
  CheckCircle2,
  FileText,
  Users,
  Scale,
  RefreshCw
} from "lucide-react";
import toast from "react-hot-toast";
import { getToken as getAuthToken, getUser, isAdmin } from "@/lib/apiClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Notification = {
  NotificationId: number;
  UserId: number;
  UserType: string;
  CaseId: number | null;
  Type: string;
  Title: string;
  Message: string;
  IsRead: boolean;
  ReadAt: string | null;
  CreatedAt: string;
  CaseTitle?: string;
  CaseType?: string;
  County?: string;
};

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication on mount
    const user = getUser();
    if (!isAdmin(user)) {
      console.warn("⚠️ Admin notifications: User is not admin, redirecting to login");
      router.push("/admin/login");
      return;
    }
    fetchNotifications();
  }, [filter]);

  function createAuthHeaders(token: string) {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async function fetchNotifications() {
    const token = getAuthToken();
    const user = getUser();

    // Double-check authentication
    if (!token || !isAdmin(user)) {
      console.warn("⚠️ Admin notifications: No token or not admin, redirecting to login");
      router.push("/admin/login");
      return;
    }

    setLoading(true);
    try {
      // ✅ Use correct backend endpoint (API_BASE already includes /api)
      const url = filter === "unread"
        ? `${API_BASE}/notifications?unreadOnly=true`
        : `${API_BASE}/notifications`;

      const response = await fetch(url, {
        headers: createAuthHeaders(token),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch notifications:", response.status, errorText);
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();
      if (data.success) {
        let filteredNotifications = data.notifications || [];

        // Apply read/unread filter
        if (filter === "read") {
          filteredNotifications = filteredNotifications.filter((n: Notification) => n.IsRead);
        }

        setNotifications(filteredNotifications);
      } else {
        toast.error("Failed to load notifications");
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Error loading notifications");
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId: number) {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(
        `${API_BASE}/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: createAuthHeaders(token),
        }
      );

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.NotificationId === notificationId
              ? { ...n, IsRead: true, ReadAt: new Date().toISOString() }
              : n
          )
        );
        toast.success("Marked as read");
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast.error("Failed to mark as read");
    }
  }

  async function markAllAsRead() {
    const token = getAuthToken();
    if (!token) return;

    try {
      // ✅ Use correct backend endpoint (API_BASE already includes /api)
      const response = await fetch(`${API_BASE}/notifications/read-all`, {
        method: "PUT",
        headers: createAuthHeaders(token),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, IsRead: true, ReadAt: new Date().toISOString() }))
        );
        toast.success("All notifications marked as read");
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to mark all as read");
    }
  }

  async function deleteNotification(notificationId: number) {
    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(
        `${API_BASE}/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: createAuthHeaders(token),
        }
      );

      if (response.ok) {
        setNotifications((prev) =>
          prev.filter((n) => n.NotificationId !== notificationId)
        );
        toast.success("Notification deleted");
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Failed to delete notification");
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case "war_room_ready":
      case "case_approved":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "trial_starting":
      case "trial_started":
        return <Scale className="h-5 w-5 text-blue-600" />;
      case "case_submitted":
        return <FileText className="h-5 w-5 text-indigo-600" />;
      case "application_received":
      case "application_approved":
        return <Users className="h-5 w-5 text-purple-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  const unreadCount = notifications.filter((n) => !n.IsRead).length;
  const displayedNotifications = selectedType
    ? notifications.filter((n) => n.Type === selectedType)
    : notifications;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/admin/dashboard")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to dashboard"
              >
                <ArrowLeft className="h-6 w-6 text-gray-700" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <Bell className="h-8 w-8 text-blue-600" />
                  Notifications
                </h1>
                <p className="text-gray-600 mt-1">
                  {unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                    : "All caught up!"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchNotifications}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors"
                title="Refresh notifications"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark all as read
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-600" />
              <span className="font-semibold text-gray-700">Filter:</span>
              <div className="flex gap-2 ml-2">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter("unread")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "unread"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  onClick={() => setFilter("read")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "read"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Read
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading notifications...</p>
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <BellOff className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {filter === "unread" ? "No unread notifications" : "No notifications"}
            </h3>
            <p className="text-gray-500">
              {filter === "unread"
                ? "You're all caught up!"
                : "Notifications will appear here when actions occur"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedNotifications.map((notification) => (
              <div
                key={notification.NotificationId}
                className={`bg-white rounded-xl shadow-sm border transition-all hover:shadow-md ${
                  notification.IsRead
                    ? "border-gray-200"
                    : "border-blue-300 bg-blue-50/50"
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className={`p-3 rounded-xl ${
                          notification.IsRead ? "bg-gray-100" : "bg-blue-100"
                        }`}
                      >
                        {getNotificationIcon(notification.Type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 text-lg">
                            {notification.Title}
                          </h3>
                          {!notification.IsRead && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-3 leading-relaxed">
                          {notification.Message}
                        </p>
                        {notification.CaseTitle && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <FileText className="h-4 w-4" />
                            <span className="font-medium">{notification.CaseTitle}</span>
                            {notification.CaseType && (
                              <>
                                <span className="text-gray-400">•</span>
                                <span>{notification.CaseType}</span>
                              </>
                            )}
                            {notification.County && (
                              <>
                                <span className="text-gray-400">•</span>
                                <span>{notification.County}</span>
                              </>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="h-4 w-4" />
                          <span>{formatTimeAgo(notification.CreatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.IsRead && (
                        <button
                          onClick={() => markAsRead(notification.NotificationId)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check className="h-5 w-5 text-blue-600" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.NotificationId)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete notification"
                      >
                        <Trash2 className="h-5 w-5 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
