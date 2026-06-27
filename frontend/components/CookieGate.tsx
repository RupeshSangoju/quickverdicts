"use client";

import React, { useState, useEffect } from "react";

interface CookieGateProps {
  children: React.ReactNode;
}

export default function CookieGate({ children }: CookieGateProps) {
  const [isAccepted, setIsAccepted] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Check if user has accepted cookies
    const cookieAccepted = localStorage.getItem("cookiePolicy");
    const cookieExists = document.cookie.includes("cookiePolicy=accepted");

    if (cookieAccepted || cookieExists) {
      setIsAccepted(true);
    }

    setIsHydrated(true);
  }, []);

  // Don't render children until we've checked cookie status
  if (!isHydrated) {
    return <>{children}</>;
  }

  // If cookies accepted, render normally
  if (isAccepted) {
    return <>{children}</>;
  }

  // If cookies not accepted, block interaction
  return (
    <div className="relative">
      {children}
      {/* Overlay to block interaction */}
      <div className="fixed inset-0 bg-black/30 z-40 pointer-events-auto" />
    </div>
  );
}
