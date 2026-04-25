"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Play, Facebook, Twitter, Linkedin, Youtube, Space } from 'lucide-react';
import Image from "next/image";

export default function QuickVerdictsLanding() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex flex-col items-center">
            {/* Logo placeholder - will be replaced with your image */}
            <img src="/images/logo.png" alt="Quick Verdicts Logo" className="h-20 w-auto"/>
          </Link>
          <nav className="flex items-center space-x-6">
            <Link href="/for-attorneys" className="text-gray-700 hover:text-gray-900">
              Attorney Info
            </Link>
            <Link href="/for-juror" className="text-gray-700 hover:text-gray-900">
              Juror Info
            </Link>
            <Link href="/signup" className="bg-blue-900 text-white px-6 py-2 rounded hover:bg-blue-800">
              Sign up
            </Link>
            <Link href="/login" className="text-gray-700 hover:text-gray-900">
              Login
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-neutral-100">
        <div className="relative">
          {/* Four Images - will be replaced with your designs */}
          <div className="absolute top-10 left-50 w-40 h-40">
            <img  src="/images/a.png"  alt="Design 1"  className="w-full h-full object-cover" />           
          </div>

          <div className="absolute top-10 right-50 w-40 h-40">
            <img src="/images/c.png" alt="Design 2" className="w-full h-full object-cover" />
          </div>

          <div className="absolute bottom-0 left-50 w-40 h-40">
            <img src="/images/b.png" alt="Design 3" className="w-full h-full object-cover" />
          </div>

          <div className="absolute bottom-0 right-50 w-40 h-40">
            <img src="/images/d.png" alt="Design 4" className="w-full h-full object-cover" />
          </div>

          {/* Hero Content */}
          <div className="text-center pt-40 pb-12">
            <h1 className="text-[44px] leading-[1.1] font-bold text-gray-900 mb-6">
              An Online Mock Jury Platform 
            </h1>
            <h2 className="text-[30px] leading-[1.1] text-gray-900 mb-6">
              Real-time.  Remote.  Reasonably Priced.
            </h2>
            <p className="text-[18px] leading-[1.6] font-medium text-gray-600 max-w-3xl mx-auto mb-10">
Quick Verdicts is the latest in legal tech for mock jury trials.  QV connects attorneys with 
local, screened mock jurors for case presentation, deliberation and a final mock verdict.  
Jurors get paid.  Mock trials are for a set time period.  Costs are low.  <br></br>
Currently serving 
cases in:            </p>
    <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-10">

      {/* State Dropdown */}
      <select
        className="border border-gray-300 rounded-md px-4 py-2 text-gray-700 cursor-pointer"
        value={selectedState}
        onChange={(e) => setSelectedState(e.target.value)}
      >
        <option value="">State</option>
        <option value="texas">Texas</option>
      </select>

      {/* County Dropdown */}
      <select
        className="border border-gray-300 rounded-md px-4 py-2 text-gray-700 disabled:bg-gray-200 disabled:cursor-not-border border-gray-300 rounded-md px-4 py-2 text-gray-700 
             disabled:bg-gray-100 disabled:text-gray-400 
             disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
        disabled={!selectedState}
      >
        <option value="">County</option>
        {selectedState === "texas" && (
          <option value="dallas">Dallas</option>
        )}
      </select>

    </div>

            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-blue-900 text-white px-10 py-3 rounded-md font-semibold text-[16px] hover:bg-blue-800 transition"
            >
              Get started
            </Link>
          </div>
          </div>
        </section>

         <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Video Section */}

          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Welcome to Quick Verdicts
          </h2>
          {/* Video Section 
          <p className="text-center text-gray-600 mb-8">
            Watch this quick video to see how our virtual courtroom helps attorneys and jurors move cases forward fast.
          </p>
          */}
          <div className="flex justify-center">
          <div className="relative w-[800px] rounded-lg overflow-hidden aspect-video shadow-lg bg-black">
            {!isPlaying ? (
              <>
                {/* Thumbnail */}
                <img src="/images/hammer.png" className="w-full h-full object-cover"/>

                {/* Play Button Overlay 
                <button
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/30 hover:bg-black/40 transition"
                >
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                    <Play className="w-10 h-10 text-gray-900 ml-1" fill="currentColor" />
                  </div>
                </button>
                */}
              </>
            ) : (
              /* YouTube iframe */
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/Jix-vP5M1R0?start=1&autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}
          </div>
        </div>

        {/* Security Section */}
        <div className="mt-24 grid md:grid-cols-2 gap-12 items-center">
          {/* Digital Security Image - will be replaced with your image */}
          <div className="   p-12 rounded-lg">
            <img src="/images/e.png" alt="Digital Security" className="w-full h-auto" />
          </div>

          <div>
            <h3 className="text-3xl font-bold text-gray-900 mb-6">
              Secure Connections
            </h3>
            <p className="text-gray-600 mb-4">
              We built our platform on Azure with an embedded Microsoft Teams-based conference call center accessible only after login.

            </p>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Multi-factor identification is used for attorneys and jurors.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Jurors appear live following login.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Demonstrative aids used for jurors’ consideration are deleted following the QV Trial.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Trial presentations are considered privileged under state and federal law.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Jurors are initially screened for qualifications based on residency, employment and knowledge of parties.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Attorneys create additional screening questions and select jurors from applicants.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>QV admin assistance during trial</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Get Started Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Get Started with Quick Verdicts
              </h2>
              <p className="text-gray-600 mb-6">
                Whether you&apos;re presenting a case or ready to serve as a juror, Quick Verdicts makes getting started simple. Choose your path below:
              </p>

              <div className="mb-8">
                <h3 className="font-bold text-gray-900 mb-3">I&apos;m an Attorney</h3>
                <ul className="space-y-2 text-gray-700 ml-4">
                  <li>• Create your profile in minutes</li>
                  <li>• Submit case details</li>
                  <li>• Prepare Jury Charge in War Room</li>
                  <li>• Select applicants for jurors</li>
                  <li>• Present case live or by video</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-3">I Want to Be a Juror</h3>
                <ul className="space-y-2 text-gray-700 ml-4">
                  <li>• Get paid for your time</li>
                  <li>• After-hours times available</li>
                  <li>• Choose cases from the Job Board</li>
                  <li>• Complete a simple vetting process</li>
                  <li>• Deliberate with your fellow jurors remotely</li>
                  <li>• Your opinion helps the attorneys</li>
                </ul>
              </div>
            </div>

            {/* Started Image - will be replaced with your image */}
            <div className=" p-12 rounded-lg">
              <img src="/images/f.png" alt="Get Started" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-8">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">What is Quick Verdicts?</h3>
              <p className="text-gray-600 mb-6">Quick Verdicts is a low-cost virtual courtroom platform where attorneys schedule and prepare a case for a timed presentation to local mock jurors who deliberate the issues and submit a final mock verdict.
              </p>
              <hr className="border-black" />
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">How does it work for attorneys?</h3>
              <p className="text-gray-600 mb-6">
                Attorneys login to create a case.  QV provides a War Room for attorneys to upload demonstratives and create jury questions in the easy-to-use Jury Charge Builder.Attorneys can present a case either live or by pre-recorded video.  Each case will have 5-8 local mock jurors who appear at the scheduled time to review the presentation, deliberate, and submit their Final Verdict.  A short de-briefing period is provided.Please click on Attorney Info above for more information. 
              </p>
              <hr className="border-black" />
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">What types of cases work best?</h3>
              <p className="text-gray-600 mb-6">
                Cases work best where all sides of the presentation can be made within the allotted time.  Cases include vehicle accidents involving personal injury, other personal injury (slip & falls), property damage and contract disputes. Disputes may turn on credibility of the witnesses, liability facts, and damages assessment.  
              </p>
              <hr className="border-black" />
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">What does a juror do on Quick Verdicts?</h3>
              <p className="text-gray-600">
                Jurors sign up and can access a Job Board for cases in their county of residence.  Jurors are paid by the case immediately following the case presentation.  Jurors may be asked to decide what caused an accident or an incident and how much money should be awarded to a plaintiff.  
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-gray-600 mb-8">
            Sign up today as an Attorney or a Juror
          </p>
          <Link href="/signup" className="bg-blue-900 text-white px-12 py-3 rounded hover:bg-blue-800 font-medium inline-block w-full max-w-md">
            Sign up
          </Link>
          <div className="mt-4">
            <Link href="/login" className="text-blue-900 hover:underline">
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-950 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-bold mb-4">Contact</h3>
              <p className="text-gray-300">Hours:</p>
              <p className="text-gray-300">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;9:00 a.m. to 5:00 p.m. M-F (or as needed) </p>
              <p className='text-gray-300'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;9:00 a.m. to 2:00 p.m. Sat.</p>
              <p className="text-gray-300">QVTrial@quickverdicts.com</p>
            </div>
            <div>
              <h3 className="font-bold mb-4">Navigation</h3>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/" className="hover:text-white">Home</Link></li>
                <li><Link href="/for-attorneys" className="hover:text-white">Attorney</Link></li>
                <li><Link href="/for-juror" className="hover:text-white">Juror</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8 flex flex-wrap justify-between items-center">
            <div className="flex space-x-6 text-sm text-gray-300">
              <Link href="/" className="hover:text-white">Quick Verdicts<sup className="text-[12px]">™</sup></Link>
              <Link href="/" className="hover:text-white">Privacy</Link>
              <Link href="/" className="hover:text-white">Terms of Use</Link>
              <Link href="/" className="hover:text-white">Consumer Choice</Link>
            </div>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <span className="text-sm text-gray-300">Follow Us</span>
              <a href="/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <Youtube className="w-5 h-5" />
              </a>
              <a href="/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
