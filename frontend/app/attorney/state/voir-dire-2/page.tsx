// ===== VOIR DIRE PART 2 PAGE =====
// app/attorney/state/voir-dire-2/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import Stepper from "../../components/Stepper";
import FormContainer from "../../components/FormContainer";
import { Trash2 } from "lucide-react";

type QuestionType = "yesno" | "text";

type VoirDireQuestion = {
  question: string;
  type: QuestionType;
};

export default function VoirDirePart2() {
  useProtectedRoute({ requiredUserType: 'attorney' });
  const [questions, setQuestions] = useState<VoirDireQuestion[]>([{ question: "", type: "yesno" }]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("voirDire2Questions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          // Handle legacy string array format
          if (typeof parsed[0] === 'string') {
            setQuestions(parsed.map((q: string) => ({ question: q, type: "yesno" as QuestionType })));
          } else {
            setQuestions(parsed);
          }
        }
      } catch (e) {
        // Keep default
      }
    }
    setLoaded(true);
  }, []);

  // Auto-save as user types
  useEffect(() => {
    if (loaded) {
      localStorage.setItem("voirDire2Questions", JSON.stringify(questions));
    }
  }, [questions, loaded]);

  const handleChange = (idx: number, field: "question" | "type", value: string) => {
    const newQuestions = [...questions];
    if (field === "question") {
      newQuestions[idx].question = value;
    } else {
      newQuestions[idx].type = value as QuestionType;
    }
    setQuestions(newQuestions);
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: "", type: "yesno" }]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length === 1) {
      // Don't allow removing the last question, just clear it
      const newQuestions = [{ question: "", type: "yesno" as QuestionType }];
      setQuestions(newQuestions);
      setValidationErrors([]);
    } else {
      const newQuestions = questions.filter((_, i) => i !== idx);
      setQuestions(newQuestions);
      // Also remove corresponding validation error
      const newErrors = validationErrors.filter((_, i) => i !== idx);
      setValidationErrors(newErrors);
    }
  };

  const validate = () => {
    const errors = questions.map(q => q.question.trim() ? "" : "Required");
    setValidationErrors(errors);
    return errors.every(e => !e);
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    const validQuestions = questions.filter(q => q.question.trim());
    localStorage.setItem("voirDire2Questions", JSON.stringify(validQuestions));
    await new Promise(resolve => setTimeout(resolve, 300));
    router.push("/attorney/state/payment-details");
  };

  return (
    <div className="min-h-screen flex bg-[#faf8f3] font-sans">
      <aside className="hidden lg:flex flex-col w-[265px]">
        <div className="flex-1 text-white bg-[#16305B] relative">
          <div className="absolute top-15 left-0 w-full">
            <Image
              src="/logo_sidebar_signup.png"
              alt="Quick Verdicts Logo"
              width={300}
              height={120}
              className="w-full object-cover"
              priority
            />
          </div>
          <div className="px-8 py-8 mt-30">
            <h2 className="text-3xl font-medium mb-4">New Case</h2>
            <div className="text-sm leading-relaxed text-blue-100 space-y-3">
              <p>Fill in Voir Dire disqualifier questions.</p>
              <p>Choose between "Yes/No" or "Text Response" for each question.</p>
            </div>
          </div>
        </div>
      </aside>
      <section className="flex-1 flex flex-col min-h-screen bg-[#faf8f3] px-0 md:px-0 mb-20">
        <Stepper currentStep={4} />

        <FormContainer title="Custom Voir Dire Questions">
          <form className="space-y-6" onSubmit={handleNext}>
              {questions.map((q, idx) => (
                <div key={idx} className="mb-6 p-4 border border-[#bfc6d1] rounded-lg bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <label className="block text-[#16305B] font-medium">
                      Question No. {idx + 1} <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeQuestion(idx)}
                      disabled={questions.length === 1 && !q.question.trim()}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors flex items-center gap-2 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-50"
                      title={questions.length === 1 ? "Clear this question" : "Remove this question"}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {questions.length === 1 ? "Clear" : "Remove"}
                      </span>
                    </button>
                  </div>

                  <div className="mb-3">
                    <label className="block text-sm text-[#16305B] font-medium mb-2">Response Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`type-${idx}`}
                          value="yesno"
                          checked={q.type === "yesno"}
                          onChange={(e) => handleChange(idx, "type", e.target.value)}
                          className="w-4 h-4 text-[#16305B] border-gray-300 focus:ring-[#16305B]"
                        />
                        <span className="text-sm text-[#16305B]">Yes/No</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`type-${idx}`}
                          value="text"
                          checked={q.type === "text"}
                          onChange={(e) => handleChange(idx, "type", e.target.value)}
                          className="w-4 h-4 text-[#16305B] border-gray-300 focus:ring-[#16305B]"
                        />
                        <span className="text-sm text-[#16305B]">Text Response</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#16305B] font-medium mb-2">Question</label>
                    <input
                      type="text"
                      value={q.question}
                      onChange={e => handleChange(idx, "question", e.target.value)}
                      placeholder={q.type === "yesno" ? 'Write out Voir Dire as a "Yes/No answer" question.' : 'Write your question for text response.'}
                      className="w-full px-4 py-2 border border-[#bfc6d1] rounded-md bg-white text-[#16305B] focus:outline-[#16305B]"
                    />
                    {validationErrors[idx] && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors[idx]}</p>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addQuestion}
                className="text-[#16305B] text-sm font-medium mb-4 hover:text-[#0A2342] transition-colors flex items-center gap-1"
              >
                <span className="text-lg">+</span>
                <span>Add Another Voir Dire Question</span>
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#16305B] text-white font-semibold px-8 py-2 rounded-md hover:bg-[#0A2342] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  "Next"
                )}
              </button>
            </form>
        </FormContainer>
      </section>
    </div>
  );
}