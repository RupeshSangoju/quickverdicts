"use client";

import { useState } from "react";
import { X } from "lucide-react";

const quizQuestions = [
  {
    question: "Quick Verdict simulates real jury trials using actual people as mock jurors.",
    options: ["True", "False"],
    answer: "True",
    explanation: "Quick Verdict collects feedback from real participants to simulate how a jury might respond to a case."
  },
  {
    question: "Which of these are required at all times while in the court room?",
    options: [
      "Camera enabled for the full duration of the trial",
      "Business casual attire",
      "A stable internet connection",
      "All of the above"
    ],
    answer: "All of the above",
    explanation: "All of these are required for participation in a Quick Verdict trial."
  },
  {
    question: "What is the main purpose of Quick Verdict?",
    options: [
      "Provide legal representation",
      "File court documents",
      "Help test case strategies with mock jurors",
      "Offer free legal advice"
    ],
    answer: "Help test case strategies with mock jurors",
    explanation: "Quick Verdict helps attorneys test case strategies with feedback from mock jurors."
  },
  {
    question: "You weren't selected for a case. What should you do next?",
    options: [
      "Close the app and ignore future invites",
      "Stay available and check back regularly for new cases",
      "Contact support and demand to be selected",
      "Create a new account to increase your chances"
    ],
    answer: "Stay available and check back regularly for new cases",
    explanation: "Stay available and check back for new opportunities."
  },
  {
    question: "What should you do after finishing a Quick Verdict case?",
    options: [
      "Close the tab and leave",
      "Wait for your results to be posted online",
      "Complete the witness believability form, confirm payment, and leave feedback",
      "Restart the case"
    ],
    answer: "Complete the witness believability form, confirm payment, and leave feedback",
    explanation: "You must complete all post-case steps before leaving."
  },
  {
    question: "If you're selected for a case but can no longer attend, it's okay to ignore the session.",
    options: ["True", "False"],
    answer: "False",
    explanation: "You should always notify the team if you cannot attend."
  },
  {
    question: "What does the randomly selected foreperson do in a Quick Verdict session?",
    options: [
      "Decides the outcome of the case",
      "Asks the attorneys questions",
      "Helps guide discussion and keeps things organized",
      "Shares legal advice with the group"
    ],
    answer: "Helps guide discussion and keeps things organized",
    explanation: "The foreperson helps guide the group and keeps things on track."
  },
  {
    question: "Quick Verdict uses a timer during the trial session to help keep the discussion focused and on track.",
    options: ["True", "False"],
    answer: "True",
    explanation: "A timer is used to keep the session focused and on schedule."
  }
];

export default function JurorQuizOverlay({ open, onClose, onFinish, sidebarCollapsed = false }: { open: boolean; onClose: () => void; onFinish: () => void; sidebarCollapsed?: boolean; }) {
  const [step, setStep] = useState<'quiz'|'correct'|'incorrect'|'finished'>("quiz");
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const q = quizQuestions[current];
  const isLast = current === quizQuestions.length - 1;

  // Sidebar width calculation with smooth transition
  const sidebarWidth = sidebarCollapsed ? 80 : 256;

  return (
    <div
      className="fixed inset-y-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center transition-all duration-500 ease-in-out"
      style={{ 
        left: sidebarWidth, 
        width: `calc(100vw - ${sidebarWidth}px)` 
      }}
    >
      <div className="relative bg-white w-full mx-8 flex flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ maxWidth: '900px', maxHeight: 'calc(100vh - 4rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#0C2D57] to-[#132c54] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Juror Qualification Quiz</h2>
              <p className="text-xs text-blue-100">Required to access job board</p>
            </div>
          </div>
          <button 
            className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg" 
            onClick={onClose} 
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-8">
            {step === "quiz" && (
              <>
                {/* Progress Indicator */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#0C2D57]">
                      Question {current + 1} of {quizQuestions.length}
                    </span>
                    <span className="text-sm text-gray-500">
                      {Math.round(((current) / quizQuestions.length) * 100)}% Complete
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#0C2D57] to-[#1a4d8f] transition-all duration-300"
                      style={{ width: `${((current) / quizQuestions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Question */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-[#0C2D57] leading-relaxed">
                    {q.question}
                  </h3>
                </div>

                {/* Options */}
                <div className="space-y-3 mb-8">
                  {q.options.map(opt => (
                    <button
                      key={opt}
                      className={`w-full flex items-center gap-4 px-5 py-4 border-2 rounded-xl text-left transition-all ${
                        selected === opt 
                          ? 'border-[#0C2D57] bg-[#0C2D57]/5 shadow-md' 
                          : 'border-gray-200 bg-white hover:border-[#0C2D57]/50 hover:bg-gray-50'
                      } ${submitted ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                      onClick={() => !submitted && setSelected(opt)}
                      disabled={submitted}
                    >
                      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected === opt 
                          ? 'border-[#0C2D57] bg-[#0C2D57]' 
                          : 'border-gray-300'
                      }`}>
                        {selected === opt && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      <span className="text-base font-medium text-[#0C2D57]">{opt}</span>
                    </button>
                  ))}
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-4">
                  <button
                    className={`px-8 py-3 rounded-xl font-semibold text-base transition-all ${
                      selected && !submitted
                        ? 'bg-gradient-to-r from-[#0C2D57] to-[#1a4d8f] text-white hover:shadow-lg transform hover:scale-105' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    disabled={!selected || submitted}
                    onClick={() => {
                      setSubmitted(true);
                      setTimeout(() => {
                        if (selected === q.answer) setStep('correct');
                        else setStep('incorrect');
                        setSubmitted(false);
                      }, 150);
                    }}
                  >
                    Submit Answer
                  </button>
                </div>
              </>
            )}

            {step === "correct" && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-[#0C2D57] mb-3">Correct!</h3>
                <p className="text-center text-gray-600 text-base leading-relaxed mb-8 max-w-lg px-4">
                  {q.explanation}
                </p>
                <button
                  className="px-8 py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-[#0C2D57] to-[#1a4d8f] text-white hover:shadow-lg transform hover:scale-105 transition-all"
                  onClick={() => {
                    if (isLast) setStep('finished');
                    else {
                      setCurrent(c => c + 1);
                      setSelected(null);
                      setStep('quiz');
                    }
                  }}
                >
                  {isLast ? 'Complete Quiz' : 'Next Question →'}
                </button>
              </div>
            )}

            {step === "incorrect" && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-[#0C2D57] mb-3">Not Quite</h3>
                <p className="text-center text-gray-600 text-base leading-relaxed mb-8 max-w-lg px-4">
                  {q.explanation}
                </p>
                <button
                  className="px-8 py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-[#0C2D57] to-[#1a4d8f] text-white hover:shadow-lg transform hover:scale-105 transition-all"
                  onClick={() => {
                    setSelected(null);
                    setStep('quiz');
                  }}
                >
                  Try Again
                </button>
              </div>
            )}

            {step === "finished" && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-20 h-20 bg-[#0C2D57] rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-[#0C2D57] mb-3">Quiz Complete! 🎉</h3>
                <p className="text-center text-gray-600 text-base leading-relaxed mb-2 max-w-lg px-4">
                  Congratulations! You've successfully completed the qualification quiz.
                </p>
                <p className="text-center text-[#0C2D57] font-semibold text-base mb-8">
                  You can now apply for cases in your county.
                </p>
                <button
                  className="px-8 py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg transform hover:scale-105 transition-all flex items-center gap-2"
                  onClick={onFinish}
                >
                  <span>Go to Job Board</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}