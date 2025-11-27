"use client";

import React from "react";

interface LogoutOverlayProps {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export default function LogoutOverlay({ open, onClose, onSignOut }: LogoutOverlayProps) {
  if (!open) return null;

  const handleSignOut = () => {
    // Clear signup draft data for both attorney and juror
    try {
      localStorage.removeItem('attorneySignupDraft');
      localStorage.removeItem('jurorSignupDraft');
    } catch (error) {
      console.warn('Failed to clear signup drafts:', error);
    }
    
    // Call the original signOut handler
    onSignOut();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-white rounded-xl shadow-xl p-8 min-w-[340px] max-w-[95vw] relative">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl"
          onClick={onClose}
          aria-label="Close sign out dialog"
        >
          &times;
        </button>
        <h2 className="text-2xl font-bold mb-2 text-gray-800">Sign out</h2>
        <p className="mb-6 text-gray-700">Are you sure you want to sign out?</p>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2 rounded bg-[#0C2D57] text-white font-semibold hover:bg-[#0a2342]"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
} 