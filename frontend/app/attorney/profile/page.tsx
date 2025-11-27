"use client";

import { useState } from "react";
import AttorneySidebar from "../components/AttorneySidebar";
import AttorneyProfileSection from "../components/AttorneyProfileSection";

export default function AttorneyProfilePage() {
  const [selectedSection, setSelectedSection] = useState<
    "home" | "cases" | "calendar" | "profile" | "notifications"
  >("home");

  return (
    <div className="min-h-screen flex bg-[#F7F6F3] font-sans">
      <AttorneySidebar
        selectedSection={selectedSection}
        onSectionChange={setSelectedSection}
      />
      <AttorneyProfileSection onBack={() => setSelectedSection("home")} />
    </div>
  );
}
