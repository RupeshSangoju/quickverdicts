"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function JurorTrialSetupPage() {
  const { id } = useParams();
  const router = useRouter();
  const caseId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const [caseInfo, setCaseInfo] = useState<any>(null);

  useEffect(() => {
    // Optional: Fetch case details if needed
  }, []);

  const handleContinue = () => {
    router.push(`/juror/trial/${caseId}/best-practices`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-[#0C2D57] mb-6">Trial Setup</h1>
        
        <div className="space-y-4 mb-8">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Before You Join</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Ensure you're in a quiet, private location</li>
              <li>• Check your camera and microphone are working</li>
              <li>• Have a stable internet connection</li>
              <li>• Review the case materials in the War Room</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">Professional Conduct</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Dress professionally</li>
              <li>• Remain attentive throughout the trial</li>
              <li>• Avoid distractions</li>
              <li>• Follow all judicial instructions</li>
            </ul>
          </div>
        </div>

        <button
          onClick={handleContinue}
          className="w-full py-3 bg-[#0C2D57] text-white rounded-lg font-semibold hover:bg-blue-900"
        >
          Continue to Best Practices
        </button>
      </div>
    </div>
  );
}