"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Play, ArrowLeft, Mail, Video, HelpCircle } from "lucide-react";

const tutorialVideos = [
  {
    src: "/help_video1.png",
    title: "Lesson #01 - What is Quick Verdict?",
    length: "3 mins",
  },
  {
    src: "/help_video2.png",
    title: "Lesson #02 - How to set new trial?",
    length: "7 mins",
  },
  {
    src: "/help_video3.png",
    title: "Lesson #03 - How do I use my War Room?",
    length: "3 mins",
  },
  {
    src: "/help_video1.png",
    title: "Lesson #04 - What is Quick Verdict?",
    length: "3 mins",
  },
  {
    src: "/help_video2.png",
    title: "Lesson #05 - How to set new trial?",
    length: "7 mins",
  },
  {
    src: "/help_video3.png",
    title: "Lesson #06 - How do I use my War Room?",
    length: "3 mins",
  },
];

const faqs = [
  {
    q: "What is Quick Verdicts?",
    a: `Quick Verdicts is an online platform designed to streamline the trial experience for both attorneys and jurors. Attorneys can present real cases in a secure, efficient digital environment, while jurors have the opportunity to participate, deliberate, and earn compensation—all from the comfort of their own home. Each case is designed to be quick and focused, lasting no more than 8 hours total, including introductions, trial presentations, and jury deliberation. Attorneys benefit from valuable insights, and jurors are paid for their time and perspective.`,
  },
  {
    q: "As a potential juror, how do I sign up for trial cases?",
    a: "To sign up for trial cases, register on the Quick Verdicts platform and complete the onboarding process. Once your profile is set up, you will be notified about available cases and can choose to participate in those that match your interests and qualifications.",
  },
  {
    q: "As a potential juror, how do I qualify to be a jury?",
    a: "To qualify as a juror, you must complete the onboarding steps, watch the introduction video, and pass the qualification quiz with a perfect score. This ensures you understand the process and your responsibilities before participating in any trial.",
  },
  {
    q: "How do jurors get paid?",
    a: "Jurors are compensated for their participation in each case. After successfully completing a trial, payment is processed electronically and sent to the account details provided during registration. You will receive a notification once your payment is issued.",
  },
  {
    q: "As an attorney, how do I submit my trial cases?",
    a: "Attorneys can submit new trial cases directly from their dashboard by clicking the '+ New Case' button. You will be guided through entering case details, uploading necessary documents, and scheduling the trial for review and approval.",
  },
];

export default function AttorneyHelp({ onContact }: { onContact: () => void }) {
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [search, setSearch] = useState("");
  const [videoStart, setVideoStart] = useState(0);
  const router = useRouter();
  
  const filteredVideos = tutorialVideos.filter(v =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );
  
  const visibleVideos = filteredVideos.slice(videoStart, videoStart + 3);
  
  const filteredFaqs = faqs.filter(faq =>
    faq.q.toLowerCase().includes(search.toLowerCase()) ||
    faq.a.toLowerCase().includes(search.toLowerCase())
  );
  
  const canSlideLeft = videoStart > 0;
  const canSlideRight = videoStart + 3 < filteredVideos.length;
  
  const handleLeft = () => {
    if (canSlideLeft) setVideoStart(videoStart - 1);
  };
  
  const handleRight = () => {
    if (canSlideRight) setVideoStart(videoStart + 1);
  };
  
  useEffect(() => {
    if (videoStart + 3 > filteredVideos.length) {
      setVideoStart(Math.max(0, filteredVideos.length - 3));
    }
  }, [search, filteredVideos.length, videoStart]);

  return (
    <div className="flex-1 bg-[#F7F6F3] min-h-screen font-sans">
      <div className="w-full max-w-7xl mx-auto px-6 md:px-10 py-8">
        
        {/* Header Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <button
              className="flex items-center gap-2 text-[#16305B] hover:text-[#1e417a] transition-colors group"
              onClick={() => router.push('/attorney')}
            >
              <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-semibold">Back to Dashboard</span>
            </button>
            <button
              onClick={onContact}
              className="bg-[#16305B] text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-[#1e417a] transition-all shadow-sm hover:shadow-md flex items-center gap-2"
            >
              <Mail size={18} />
              Contact Us
            </button>
          </div>

          {/* Title + Search Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 cursor-pointer">
            <div>
              <h1 className="text-4xl font-bold text-[#16305B] mb-2">Help & Support</h1>
              <p className="text-gray-600">Find answers, tutorials, and get in touch with our team</p>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2 w-full md:w-auto md:min-w-[400px]">
              <Search className="text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search tutorials and FAQs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Tutorial Videos Section */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Video className="text-[#16305B]" size={28} />
            <div>
              <h2 className="text-2xl font-bold text-[#16305B]">Tutorial Videos</h2>
              <p className="text-sm text-gray-600">Step-by-step guides to help you get started</p>
            </div>
          </div>
          
          {/* Video Cards */}
          <div className="relative">
            <div className="flex gap-6 justify-center items-stretch w-full transition-all duration-300">
              {visibleVideos.length === 0 ? (
                <div className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <Video className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">No videos found matching your search.</p>
                  <button
                    onClick={() => setSearch("")}
                    className="mt-4 text-[#16305B] hover:underline font-medium"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                visibleVideos.map((v, idx) => (
                  <div
                    key={v.title + idx}
                    className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex-1 min-w-[280px] max-w-[360px] group cursor-pointer border border-gray-200"
                  >
                    <div className="relative w-full h-52 bg-gradient-to-br from-blue-50 to-gray-100 overflow-hidden">
                      <Image 
                        src={v.src} 
                        alt={v.title} 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/95 rounded-full p-4 shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="text-[#16305B] fill-[#16305B]" size={24} />
                        </div>
                      </div>
                      <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {v.length}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-[#16305B] mb-1 line-clamp-2 min-h-[48px]">
                        {v.title}
                      </h3>
                      <button className="text-sm text-blue-600 hover:underline font-medium">
                        Watch Now →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Navigation Buttons */}
            {filteredVideos.length > 3 && (
              <div className="flex justify-center gap-3 mt-8">
                <button
                  className={`p-3 rounded-full border-2 transition-all ${
                    canSlideLeft 
                      ? 'border-[#16305B] text-[#16305B] hover:bg-[#16305B] hover:text-white shadow-sm' 
                      : 'border-gray-300 text-gray-300 cursor-not-allowed'
                  }`}
                  onClick={handleLeft}
                  disabled={!canSlideLeft}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className={`p-3 rounded-full border-2 transition-all ${
                    canSlideRight 
                      ? 'border-[#16305B] text-[#16305B] hover:bg-[#16305B] hover:text-white shadow-sm' 
                      : 'border-gray-300 text-gray-300 cursor-not-allowed'
                  }`}
                  onClick={handleRight}
                  disabled={!canSlideRight}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* FAQ Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <HelpCircle className="text-[#16305B]" size={28} />
            <div>
              <h2 className="text-2xl font-bold text-[#16305B]">Frequently Asked Questions</h2>
              <p className="text-sm text-gray-600">Quick answers to common questions</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <HelpCircle className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg">No FAQs found matching your search.</p>
                <button
                  onClick={() => setSearch("")}
                  className="mt-4 text-[#16305B] hover:underline font-medium"
                >
                  Clear search
                </button>
              </div>
            ) : (
              filteredFaqs.map((faq, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all"
                >
                  <button
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  >
                    <span className="font-semibold text-[#16305B] text-lg pr-4">
                      {faq.q}
                    </span>
                    <ChevronDown 
                      className={`flex-shrink-0 text-[#16305B] transition-transform duration-300 ${
                        faqOpen === i ? 'rotate-180' : ''
                      }`} 
                      size={24}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      faqOpen === i ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-5 pb-5 text-gray-700 leading-relaxed border-t border-gray-100 pt-4">
                      {faq.a}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Still need help? */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 text-center border border-blue-100">
          <h3 className="text-2xl font-bold text-[#16305B] mb-2">Still need help?</h3>
          <p className="text-gray-600 mb-6">Our support team is here to assist you</p>
          <button
            onClick={onContact}
            className="bg-[#16305B] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#1e417a] transition-all shadow-sm hover:shadow-md inline-flex items-center gap-2"
          >
            <Mail size={20} />
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}