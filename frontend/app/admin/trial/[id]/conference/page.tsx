"use client";

import dynamic from 'next/dynamic';

const AdminConferenceClient = dynamic(
  () => import('./AdminConferenceClient'),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-[#0A2342] mx-auto mb-6"></div>
          <p className="text-[#0A2342] text-xl font-semibold">Loading Admin Monitor...</p>
          <p className="text-[#455A7C] mt-2">Initializing conference controls</p>
        </div>
      </div>
    )
  }
);

export default function AdminConferencePage() {
  return <AdminConferenceClient />;
}
