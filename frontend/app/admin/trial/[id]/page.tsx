"use client";

import dynamic from 'next/dynamic';

const AdminTrialMonitor = dynamic(
  () => import('./AdminTrialMonitorComponent'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading admin monitor...</p>
        </div>
      </div>
    )
  }
);

export default function AdminTrialPage() {
  return <AdminTrialMonitor />;
}