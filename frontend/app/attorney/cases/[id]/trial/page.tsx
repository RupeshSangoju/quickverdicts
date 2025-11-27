"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

const API_BASE = process.env.NEXT_PUBLIC_API_URL 
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}

export default function TrialBestPracticesPage() {
  const { id } = useParams();
  const router = useRouter();
  const caseId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  
  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (caseId) {
      const token = getCookie("token");
      fetch(`${API_BASE}/api/case/cases/${caseId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })
        .then(res => res.json())
        .then(data => {
          setCaseData(data.case || data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch case:", err);
          setLoading(false);
        });
    }
  }, [caseId]);

  const handleContinue = () => {
    if (agreed) {
      router.push(`/attorney/cases/${caseId}/trial/setup`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#16305B]"></div>
      </div>
    );
  }

  const caseName = caseData?.CaseTitle || "Case";

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-60 bg-[#16305B] text-white flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
              <span className="text-[#16305B] font-bold text-xl">Q</span>
            </div>
            <span className="font-bold text-lg">QUICK VERDICTS</span>
          </div>
          
          <div className="mt-8">
            <h3 className="font-bold text-lg mb-2">{caseName}</h3>
            <p className="text-sm text-gray-300">You are now joining the live trial</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-60 p-8">
        <button
          onClick={() => router.push("/attorney")}
          className="flex items-center text-[#16305B] hover:underline mb-6 font-medium"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          Back
        </button>

        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-[#16305B] mb-6">
            Virtual Courtroom Best Practices
          </h1>

          <p className="text-gray-700 mb-6">Please read the following:</p>

          <div className="space-y-6 mb-8">
            <div>
              <h3 className="font-bold text-[#16305B] mb-2">1. Be On Time</h3>
              <ul className="list-disc ml-6 text-gray-700">
                <li>Log in at least 10 minutes early. Technical issues happen—better to be safe than sorry.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#16305B] mb-2">2. Dress Appropriately</h3>
              <ul className="list-disc ml-6 text-gray-700">
                <li>This is still court. Business or business casual attire is expected, just as if you were attending in person.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#16305B] mb-2">3. Mute Unless Speaking</h3>
              <ul className="list-disc ml-6 text-gray-700">
                <li>Keep your microphone muted until you're asked to speak. This helps prevent background noise and distractions.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#16305B] mb-2">4. Use Your Full Name</h3>
              <ul className="list-disc ml-6 text-gray-700">
                <li>Your display name should match your legal name. It helps the court identify all participants properly.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#16305B] mb-2">5. Stay Professional On Camera</h3>
              <ul className="list-disc ml-6 text-gray-700">
                <li>Sit still, stay engaged, and avoid multitasking. Eating, smoking, or walking around is not allowed during proceedings.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#16305B] mb-2">6. No Recording Allowed</h3>
              <ul className="list-disc ml-6 text-gray-700">
                <li>Do not record, screenshot, or broadcast the session. It's prohibited by law and may result in penalties.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#16305B] mb-2">7. Keep Your Tech Ready</h3>
              <ul className="list-disc ml-6 text-gray-700">
                <li>Ensure your device is charged, your internet is stable, and your camera and mic are functional.</li>
              </ul>
            </div>
          </div>

          <p className="text-gray-700 mb-6">
            By clicking "I agree" you agree to adhere to these terms.
          </p>

          <div className="flex items-center mb-6">
            <input
              type="checkbox"
              id="agree"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-5 h-5 text-[#16305B] border-gray-300 rounded focus:ring-[#16305B]"
            />
            <label htmlFor="agree" className="ml-3 text-gray-900 font-medium">
              I agree
            </label>
          </div>

          <button
            onClick={handleContinue}
            disabled={!agreed}
            className={`w-full py-3 rounded-lg font-semibold text-lg transition ${
              agreed
                ? "bg-[#16305B] text-white hover:bg-[#1e417a]"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}