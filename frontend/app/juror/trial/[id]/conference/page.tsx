"use client";

import dynamic from "next/dynamic";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";

const JurorConferenceClient = dynamic(() => import("./JurorConferenceClient"), {
  ssr: false,
});

export default function JurorConferencePage() {
  useProtectedRoute({ requiredUserType: 'juror' });
  return <JurorConferenceClient />;
}