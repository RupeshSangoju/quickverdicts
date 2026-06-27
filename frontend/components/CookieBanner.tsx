"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import Link from "next/link";

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const cookieAccepted = localStorage.getItem("cookiePolicy");

    // Also check for cookie
    const cookieExists = document.cookie.includes("cookiePolicy=accepted");

    if (!cookieAccepted && !cookieExists) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, []);

  const handleAccept = () => {
    // Save to both localStorage and cookies
    localStorage.setItem("cookiePolicy", "accepted");

    // Set cookie that expires in 1 year
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    document.cookie = `cookiePolicy=accepted; expires=${expirationDate.toUTCString()}; path=/; SameSite=Lax`;

    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-gray-100 shadow-2xl z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm">
            By using this website, you accept our cookie policy. Please refer to our{" "}
            <a
              href="https://documents83y89129y.blob.core.windows.net/new/QV%20Privacy%20Policy.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Privacy Policy
            </a>
            {" "}and{" "}
            <a
              href="https://documents83y89129y.blob.core.windows.net/new/QV%20Terms%20and%20Conditions.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Terms of Use
            </a>
            {" "}for the latest updates.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleAccept}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            Accept
          </button>

        </div>
      </div>
    </div>
  );
}
