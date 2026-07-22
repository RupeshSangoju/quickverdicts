"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Play, Facebook, Twitter, Linkedin, Youtube } from 'lucide-react';
export default function ForAttorneys() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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

      <section
        className="relative w-full min-h-[640px] flex items-center justify-center overflow-hidden rounded-xl"
        style={{
          backgroundImage: "url('/images/h.png')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Glass Container */}
        <div className="relative z-10 w-[90%] max-w-6xl rounded-2xl bg-white/40 backdrop-blur-s border border-white/40 shadow-2xl px-10 py-10">

          {/* Heading */}
          <h2 className="text-center text-3xl md:text-4xl font-bold text-gray-900">
            Why Use Quick Verdicts for your Mock Trials? 
          </h2>

          <p className="text-center text-gray-700 mt-3 text-base md:text-lg">
            Explore the benefits of joining our easy-to-use, virtual jury platform.
          </p>

          {/* Cards */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-white/95 rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center mb-4">
                <span className="text-pink-500 text-xl">🖥️</span>
              </div>
              <h3 className="font-semibold text-gray-900">
                Test Case Themes
              </h3>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
Gauge local mock jurors’ opinions on the most compelling arguments, witness credibility, 
liability exposure, and damages.   

              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white/95 rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                <span className="text-blue-600 text-xl">💼</span>
              </div>
              <h3 className="font-semibold text-gray-900">Strategic Value</h3>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
Local mock jurors’ deliberated verdicts are useful for settlement assessment, Stowers demands, mediation, witness credibility evaluations, venue intelligence and testing case themes.

              </p>
            </div>

            {/* Card 3 */}
<div className="bg-white/95 rounded-xl shadow-lg p-6 border border-gray-200">
  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center mb-4 mx-auto">
    <span className="text-orange-500 text-xl">⚖️</span>
  </div>

  <h3 className="font-semibold text-gray-900">Quick Turnaround </h3>

  <p className="text-sm text-gray-600 mt-2 leading-relaxed">
Efficient workflow saves attorney preparation time.  Many mock trials scheduled within 10 days – 2 weeks.
  </p>
</div>
          </div>

          {/* Button */}
          <div className="mt-10 flex justify-center">
            <Link href="/signup/attorney">
            <button className="bg-[#0B1B3F] text-white px-10 py-2.5 rounded-md shadow-md hover:bg-[#0A1635] transition cursor-pointer">
              Sign up
            </button>
            </Link>
          </div>
        </div>
      </section>


      {/* How It Works Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              {/* Placeholder image - user will replace */}
              <img
                src="\images\k.png" alt="Attorney in courtroom" className="rounded-lg shadow-lg w-full"
              />
            </div>

            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                How It Works for Attorneys
              </h2>


              <div className="space-y-4">
                <div className="flex items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Create Your Case</h3>
                    <p className="text-gray-600">Log in to your Quick Verdicts dashboard to see your cases and their status. <br></br>
                      Click Create Case to start a new one and schedule it for “trial.”
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Set Your Jury Criteria</h3>
                    <p className="text-gray-600">Jurors are generally pre-screened.  Add case- specific voir dire questions.  </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Draft the Jury Charge in the War Room</h3>
                    <p className="text-gray-600">Access the War Room for your case.  
                     Enter Jury Charge definitions, instructions and jury questions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Select Applicants for Jurors</h3>
                    <p className="text-gray-600">Watch your Notifications and Dashboard for Applicants.
                    Accept or reject up to 10 jurors for a panel of 6-8.
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Pre-record Presentation or Appear Live</h3>
                    <p className="text-gray-600">If you pre-record the presentation, upload the .mp4 video in the War Room. <br></br>  
                      If you appear live, go to the case in your dashboard and click “Join Trial.”
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Debriefing Period</h3>
                    <p className="text-gray-600">After you are notified that the jury has returned a 
verdict, re-join the QV Courtroom for a debriefing
period with the jurors.	

</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            How It Works
          </h2>
<div className="mt-12 px-10 text-sm text-gray-600">
  <hr className="mb-4" />
  <p>
     In a 2026 study published in the American Psychological Association, researchers found that virtual
    (remote) deliberating jurors were just as attentive and thoughtful and deliberations were generally
    comparable with those of in person deliberations. <i>Virtually the Same? A Comparison Between In-Person and
    Virtual Mock Jury Deliberations</i>, pages 1, 16. https://doi.org/101037/lhb0000643.
    Published Jan. 29, 2026. Authors: Krystia Reed, Valerie P. Hans, Vivian N. Rotenstein,
    Peter McKendall, Addison Rodriguez, Rebecca K. Helm, and Valerie F. Reyna.
  </p>
</div>
<br></br>
          <p className="text-center text-gray-600 mb-8">
            Click below for a close up of the Attorney Journey
          </p>

          {/* Video Player - user will replace with YouTube embed */}
        <div className="relative rounded-lg overflow-hidden aspect-video shadow-lg bg-black">
          <iframe
            className="w-full h-full"
            src="https://sway.cloud.microsoft/s/a4IsVExPsi6KOpj5/embed"
            frameBorder="0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          {/* Blocks clicks on Sway's top-right share/open button */}
          <div
            className="absolute top-0 right-5 w-40 h-12 z-10"
            aria-hidden="true"
          />
            {/* Center area */}
<div
    className="absolute z-20"
    style={{
      top: "50%",
      left: 0,
      width: "740px",
      height: "50%",
      background: "rgba(0,0,0,0.001)",
    }}
  />

<div
    className="absolute z-20"
    style={{
      top: "50%",
      left: 0,
      width: "740px",
      height: "50%",
      background: "rgba(0,0,0,0.001)",
    }}
  />

{/* Above the nav button */}
<div
  className="absolute z-20"
  style={{
    top: "50%",
    right: "20px",      // Leave scrollbar free
    width: "200px",
    height: "170px",
    background: "rgba(0,0,0,0.001)",
  }}
/>

{/* Right of the nav button */}
<div
  className="absolute z-20"
  style={{
    top: "443px",
    left: "764px",
    width: "176px",     // 196 - 20
    height: "60px",
    background: "rgba(0,0,0,0.001)",
  }}
/>

{/* Below the nav button */}
<div
  className="absolute z-20"
  style={{
    top: "503px",
    right: "20px",      // Leave scrollbar free
    width: "200px",
    height: "225px",
    background: "rgba(0,0,0,0.001)",
  }}
/>
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
            Sign up today and start your first case
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup/attorney" className="bg-blue-900 text-white px-12 py-3 rounded hover:bg-blue-800 font-medium">
              Sign up as Attorney
            </Link>
            <Link href="/login/attorney" className="bg-white text-blue-900 border-2 border-blue-900 px-12 py-3 rounded hover:bg-blue-50 font-medium">
              Already have an account? Login
            </Link>
          </div>
        </div>
      </section>

     {/* Footer */}
      <footer className="bg-blue-950 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-gray-300">Business Hours:</p>
              <p className="text-gray-300">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Mon., Wed., Fri.&nbsp;&nbsp;8:00 a.m. to 5:00 p.m. CST </p>
              <p className='text-gray-300'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Tues. & Thurs.&nbsp;&nbsp;&nbsp;&nbsp;9:00 a.m. to 8:30 p.m. CST</p>
              <p className='text-gray-300'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Sat.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;9:00 a.m. to 2:00 p.m. CST</p>
              <br></br>
              <p className="text-gray-300">Contact:</p>
              <p className="text-gray-300">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;QVTrials@quickverdicts.com</p>
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
                        <div className=" flex space-x-6 text-sm text-gray-300">
<p className="text-gray-300">Only essential, functional, security, and limited analytics cookies are used.  We do not use 
targeted advertising or marketing cookies.  </p>
</div>
          <div className=" pt-8 flex flex-wrap justify-between items-center">
            <div className="flex space-x-6 text-sm text-gray-300">
              <p className="text-gray-300">© Adaki, LLC d/b/a Quick Verdicts <sup className="text-[12px]">™</sup> 2026 All rights reserved.</p>
                              <a
    href="https://documents83y89129y.blob.core.windows.net/new/QV Privacy Policy new.pdf"
    target="_blank"
    rel="noopener noreferrer"
    className="hover:underline"
  >
    Privacy Policy
  </a>
                <a
    href="https://documents83y89129y.blob.core.windows.net/new/QV%20Terms%20and%20Conditions.pdf"
    target="_blank"
    rel="noopener noreferrer"
    className="hover:underline"
  >
    Terms of Use
  </a>
            </div>
            {/* 
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
            */}
          </div>
        </div>
      </footer>
    </div>
  );
}
