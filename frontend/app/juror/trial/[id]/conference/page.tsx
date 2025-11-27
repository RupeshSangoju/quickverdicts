"use client";

import dynamic from "next/dynamic";

const JurorConferenceClient = dynamic(() => import("./JurorConferenceClient"), {
  ssr: false,
});

export default function JurorConferencePage() {
  return <JurorConferenceClient />;
}