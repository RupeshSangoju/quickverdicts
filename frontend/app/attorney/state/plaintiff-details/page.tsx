// app/attorney/state/plaintiff-details/page.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Stepper from "../../components/Stepper";
import FormContainer from "../../components/FormContainer";

type Plaintiff = { name: string; email: string; };
type PlaintiffGroup = { reps: Plaintiff[]; plaintiffs: Plaintiff[]; };

export default function PlaintiffDetailsPage() {
  const [groups, setGroups] = useState<PlaintiffGroup[]>([
    { reps: [{ name: "", email: "" }], plaintiffs: [{ name: "", email: "" }] },
  ]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("plaintiffGroups");
    if (saved) {
      try {
        setGroups(JSON.parse(saved));
      } catch (e) {
        // Keep default
      }
    }
  }, []);

  const validate = () => {
    const errors: Record<string, string> = {};
    groups.forEach((group, gIdx) => {
      group.reps.forEach((rep, rIdx) => {
        if (!rep.name.trim()) errors[`repName-${gIdx}-${rIdx}`] = "Rep name is required";
        if (!rep.email.trim()) errors[`repEmail-${gIdx}-${rIdx}`] = "Rep email is required";
      });
      group.plaintiffs.forEach((p, pIdx) => {
        if (!p.name.trim()) errors[`plaintiffName-${gIdx}-${pIdx}`] = "Plaintiff name is required";
      });
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    localStorage.setItem("plaintiffGroups", JSON.stringify(groups));
    await new Promise(resolve => setTimeout(resolve, 300));
    router.push("/attorney/state/defendant-details");
  };

  const updateField = (
    gIdx: number,
    type: "reps" | "plaintiffs",
    idx: number,
    field: "name" | "email",
    value: string
  ) => {
    const newGroups = [...groups];
    (newGroups[gIdx][type] as Plaintiff[])[idx][field] = value;
    setGroups(newGroups);
  };

  const addRep = (gIdx: number) => {
    const newGroups = [...groups];
    newGroups[gIdx].reps.push({ name: "", email: "" });
    setGroups(newGroups);
  };

  const removeRep = (gIdx: number, rIdx: number) => {
    const newGroups = [...groups];
    newGroups[gIdx].reps.splice(rIdx, 1);
    setGroups(newGroups);
  };

  const addPlaintiff = (gIdx: number) => {
    const newGroups = [...groups];
    newGroups[gIdx].plaintiffs.push({ name: "", email: "" });
    setGroups(newGroups);
  };

  const addGroup = () => {
    setGroups([...groups, { reps: [{ name: "", email: "" }], plaintiffs: [{ name: "", email: "" }] }]);
  };

  const removePlaintiff = (gIdx: number, pIdx: number) => {
    const newGroups = [...groups];
    newGroups[gIdx].plaintiffs.splice(pIdx, 1);
    setGroups(newGroups);
  };

  const removeGroup = (gIdx: number) => {
    if (groups.length === 1) return;
    const newGroups = [...groups];
    newGroups.splice(gIdx, 1);
    setGroups(newGroups);
  };

  return (
    <div className="min-h-screen flex bg-[#faf8f3] font-sans">
      <aside className="hidden lg:flex flex-col w-[265px]">
        <div className="flex-1 text-white text-gray-700 bg-[#16305B] relative">
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
              <p>Please fill out the following fields with the necessary information.</p>
              <p>Any with * is required.</p>
            </div>
          </div>
        </div>
      </aside>
      <section className="flex-1 flex flex-col min-h-screen bg-[#faf8f3] px-0 md:px-0 mb-20">
        <Stepper currentStep={2} />

        <FormContainer title="Plaintiff Details">
          <form className="space-y-6" onSubmit={handleNext}>
              {groups.map((group, gIdx) => (
                <div key={gIdx} className="p-4 border rounded-md bg-white space-y-4 relative">
                  <h2 className="text-lg font-semibold text-[#16305B]">Plaintiff Group #{gIdx + 1}</h2>
                  {groups.length > 1 && (
                    <button
                      type="button"
                      className="absolute top-2 right-2 text-red-500 px-2 py-1 hover:bg-red-50 rounded"
                      onClick={() => removeGroup(gIdx)}
                      title="Remove Group"
                    >
                      ✕
                    </button>
                  )}

                  {/* Mock Legal Representatives */}
                  {group.reps.map((rep, rIdx) => (
                    <div key={rIdx} className="space-y-2 border-b pb-4 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-[#16305B]">
                          Mock Legal Representation #{rIdx + 1}
                        </label>
                        {group.reps.length > 1 && (
                          <button
                            type="button"
                            className="text-red-500 px-2 py-1 hover:bg-red-50 rounded text-sm"
                            onClick={() => removeRep(gIdx, rIdx)}
                            title="Remove Representative"
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Mock Legal Representation Name"
                        value={rep.name}
                        onChange={e => updateField(gIdx, "reps", rIdx, "name", e.target.value)}
                        className="w-full px-4 py-2 border border-[#bfc6d1] text-[#16305B] rounded-md focus:outline-[#16305B]"
                      />
                      {validationErrors[`repName-${gIdx}-${rIdx}`] && (
                        <p className="text-red-500 text-sm">{validationErrors[`repName-${gIdx}-${rIdx}`]}</p>
                      )}
                      <input
                        type="email"
                        placeholder="Mock Legal Representation Email"
                        value={rep.email}
                        onChange={e => updateField(gIdx, "reps", rIdx, "email", e.target.value)}
                        className="w-full px-4 py-2 border border-[#bfc6d1] text-[#16305B] rounded-md focus:outline-[#16305B]"
                      />
                      {validationErrors[`repEmail-${gIdx}-${rIdx}`] && (
                        <p className="text-red-500 text-sm">{validationErrors[`repEmail-${gIdx}-${rIdx}`]}</p>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addRep(gIdx)}
                    className="text-[#16305B] text-sm font-medium hover:text-[#0A2342] transition"
                  >
                    + Add Mock Legal Representation
                  </button>

                  {/* Plaintiffs */}
                  <div className="pt-4">
                    <h3 className="text-sm font-medium text-[#16305B] mb-3">Plaintiffs</h3>
                    {group.plaintiffs.map((p, pIdx) => (
                      <div key={pIdx} className="space-y-2 mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder={`Plaintiff Name #${pIdx + 1}`}
                            value={p.name}
                            onChange={e => updateField(gIdx, "plaintiffs", pIdx, "name", e.target.value)}
                            className="flex-1 px-4 py-2 border border-[#bfc6d1] text-[#16305B] rounded-md focus:outline-[#16305B]"
                          />
                          {group.plaintiffs.length > 1 && (
                            <button
                              type="button"
                              className="text-red-500 px-3 py-2 hover:bg-red-50 rounded"
                              onClick={() => removePlaintiff(gIdx, pIdx)}
                              title="Remove Plaintiff"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        {validationErrors[`plaintiffName-${gIdx}-${pIdx}`] && (
                          <p className="text-red-500 text-sm">{validationErrors[`plaintiffName-${gIdx}-${pIdx}`]}</p>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addPlaintiff(gIdx)}
                      className="text-[#16305B] text-sm font-medium hover:text-[#0A2342] transition"
                    >
                      + Add Plaintiff
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addGroup}
                className="w-full border border-[#16305B] text-[#16305B] py-2 rounded-md font-medium hover:bg-[#16305B] hover:text-white transition"
              >
                + Add Another Plaintiff Group
              </button>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#16305B] text-white font-semibold px-8 py-2 rounded-md hover:bg-[#0A2342] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              </div>
          </form>
        </FormContainer>
      </section>
    </div>
  );
}