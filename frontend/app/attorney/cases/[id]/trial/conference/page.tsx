"use client";

import dynamic from 'next/dynamic';

const TrialConference = dynamic(() => import('./TrialConferenceClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
        <p className="text-white text-lg">Loading...</p>
      </div>
    </div>
  )
});

export default function ConferencePage() {
  return <TrialConference />;
}