"use client";

import { useEffect, useState } from "react";
import { BellIcon, CheckCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    // Reset to page 1 when filter changes
    setCurrentPage(1);
    fetchNotifications(1);
  }, [filter]);

  useEffect(() => {
    fetchNotifications(currentPage);
  }, [currentPage]);

  const fetchNotifications = async (page: number) => {
    setLoading(true);
    try {
      const token = getToken();
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const unreadParam = filter === "unread" ? "&unreadOnly=true" : "";
      const res = await fetch(`${API_BASE}/api/notifications?limit=${ITEMS_PER_PAGE}&offset=${offset}${unreadParam}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        setHasMore(data.pagination?.hasMore || false);

        // Estimate total pages based on whether there are more results
        if (data.pagination?.hasMore) {
          setTotalPages(page + 1); // At least one more page
        } else {
          setTotalPages(page); // This is the last page
        }
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const deleteNotification = async (notificationId: number) => {
    try {
      const token = getToken();
      await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      setNotifications(prev => prev.filter(n => n.NotificationId !== notificationId));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const toggleNotificationSelection = (notificationId: number) => {
    setSelectedNotifications((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedNotifications.size === notifications.length && notifications.length > 0) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(notifications.map((n) => n.NotificationId)));
    }
  };

  const deleteSelectedNotifications = async () => {
    if (selectedNotifications.size === 0) {
      return;
    }

    const token = getToken();
    if (!token) return;

    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedNotifications).map(
        (notificationId) =>
          fetch(`${API_BASE}/api/notifications/${notificationId}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${token}`,
            },
          })
      );

      const results = await Promise.all(deletePromises);
      const successCount = results.filter((r) => r.ok).length;

      if (successCount > 0) {
        setNotifications((prev) =>
          prev.filter((n) => !selectedNotifications.has(n.NotificationId))
        );
        setSelectedNotifications(new Set());
      }

      if (successCount < results.length) {
        console.error(`Failed to delete ${results.length - successCount} notifications`);
      }
    } catch (error) {
      console.error("Error deleting notifications:", error);
    } finally {
      setIsDeleting(false);
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
            {selectedNotifications.size > 0 && (
              <button
                onClick={deleteSelectedNotifications}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <TrashIcon className="w-4 h-4" />
                    Delete ({selectedNotifications.size})
                  </>
                )}
              </button>
            )}
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
            <>
              {notifications.length > 0 && (
                <div className="p-4 border-b bg-gray-50 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={
                      selectedNotifications.size === notifications.length &&
                      notifications.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="h-5 w-5 rounded border-gray-300 text-[#0C2D57] focus:ring-[#0C2D57] cursor-pointer"
                    title="Select all notifications"
                  />
                  <span className="text-sm text-gray-700 font-medium">
                    {selectedNotifications.size > 0
                      ? `${selectedNotifications.size} selected`
                      : "Select all"}
                  </span>
                </div>
              )}
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.NotificationId}
                    className={`p-4 hover:bg-gray-50 transition ${
                      !notification.IsRead ? "bg-blue-50" : ""
                    } ${
                      selectedNotifications.has(notification.NotificationId)
                        ? "ring-2 ring-[#0C2D57] ring-inset"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedNotifications.has(notification.NotificationId)}
                          onChange={() => toggleNotificationSelection(notification.NotificationId)}
                          className="mt-1 h-5 w-5 rounded border-gray-300 text-[#0C2D57] focus:ring-[#0C2D57] cursor-pointer flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => !notification.IsRead && markAsRead(notification.NotificationId)}
                        >
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
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatDate(notification.CreatedAt)}
                        </span>
                        <div className="flex items-center gap-2">
                          {notification.IsRead && (
                            <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.NotificationId);
                            }}
                            className="p-1 hover:bg-red-100 rounded transition"
                            title="Delete notification"
                          >
                            <TrashIcon className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="p-4 border-t bg-gray-50">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    <div className="flex items-center gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => goToPage(page)}
                          className={`px-3 py-2 rounded transition ${
                            currentPage === page
                              ? "bg-[#0C2D57] text-white font-semibold"
                              : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={goToNextPage}
                      disabled={!hasMore}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>

                  <p className="text-center text-sm text-gray-600 mt-3">
                    Page {currentPage} of {totalPages} · Showing {notifications.length} notifications
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}