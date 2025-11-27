"use client";

import AttorneyHomeSection from "./AttorneyHomeSection";
import AttorneyProfileSection from "./AttorneyProfileSection";
import AttorneyNotificationsSection from "./AttorneyNotificationsSection";
import AttorneyCasesSection from "./AttorneyCasesSection";
import AttorneyCalendarSection from "./AttorneyCalendarSection";

type Section = "home" | "profile" | "notifications" | "cases" | "calendar";

interface AttorneyMainSectionProps {
  selectedSection: Section;
  onSectionChange: (section: Section) => void;
}

export default function AttorneyMainSection({ selectedSection, onSectionChange }: AttorneyMainSectionProps) {
  const handleBack = () => {
    onSectionChange("home");
  };

  let content;
  switch (selectedSection) {
    case "profile":
      content = <AttorneyProfileSection onBack={handleBack} />;
      break;
    case "notifications":
      content = <AttorneyNotificationsSection onBack={handleBack} />;
      break;
    case "cases":
      content = <AttorneyCasesSection onBack={handleBack} />;
      break;
    case "calendar":
      content = <AttorneyCalendarSection onBack={handleBack} />;
      break;
    case "home":
    default:
      content = <AttorneyHomeSection />;
  }

  return (
    <main className="flex-1 overflow-y-auto">
      {content}
    </main>
  );
}