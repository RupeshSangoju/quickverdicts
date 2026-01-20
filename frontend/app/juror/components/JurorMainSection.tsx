"use client";

import HomeSection from "./HomeSection";
import ProfileSection from "./ProfileSection";
import NotificationsSection from "./NotificationsSection";
import JobBoardSection from "./JobBoardSection";

type Section = "home" | "profile" | "notifications" | "jobs";

export default function JurorMainSection({ selectedSection, sidebarCollapsed }: { selectedSection: Section; sidebarCollapsed: boolean }) {
  let content;
  switch (selectedSection) {
    case "profile":
      content = <ProfileSection />;
      break;
    case "notifications":
      content = <NotificationsSection />;
      break;
    case "jobs":
      content = <JobBoardSection />;
      break;
    case "home":
    default:
      content = <HomeSection sidebarCollapsed={sidebarCollapsed} />;
  }

  return (
    <main className="flex-1 overflow-y-auto">
      {content}
    </main>
  );
}
