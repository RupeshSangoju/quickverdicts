"use client";

import { useParams, useRouter } from "next/navigation";

export default function JurorBestPracticesPage() {
  const { id } = useParams();
  const router = useRouter();
  const caseId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const handleJoinTrial = () => {
    router.push(`/juror/trial/${caseId}/conference`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-[#0C2D57] mb-6">Virtual Trial Best Practices</h1>
        
        <div className="space-y-6 mb-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Technical Setup</h3>
            <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
              <li>Position your camera at eye level</li>
              <li>Ensure good lighting - face a window or light source</li>
              <li>Test your microphone and speakers before joining</li>
              <li>Close unnecessary browser tabs and applications</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">During the Trial</h3>
            <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
              <li>Keep your camera on at all times unless instructed otherwise</li>
              <li>Mute your microphone when not speaking</li>
              <li>Pay attention and take notes as needed</li>
              <li>Avoid side conversations or distractions</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Jury Deliberation</h3>
            <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
              <li>Listen respectfully to other jurors' opinions</li>
              <li>Base your decision only on presented evidence</li>
              <li>Ask questions if clarification is needed</li>
              <li>Maintain confidentiality of deliberations</li>
            </ul>
          </div>
        </div>

        <button
          onClick={handleJoinTrial}
          className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
        >
          Join Trial Now
        </button>
      </div>
    </div>
  );
}