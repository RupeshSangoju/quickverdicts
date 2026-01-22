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
              Attorney
            </Link>
            <Link href="/for-juror" className="text-gray-700 hover:text-gray-900">
              Juror
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
            Why Become a Quick Verdicts Attorney?
          </h2>

          <p className="text-center text-gray-700 mt-3 text-base md:text-lg">
            Explore the top benefits of joining our secure, virtual jury platform.
          </p>

          {/* Cards */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-white/95 rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center mb-4">
                <span className="text-pink-500 text-xl">🖥️</span>
              </div>
              <h3 className="font-semibold text-gray-900">
                Resolve Real Cases Digitally
              </h3>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                Submit small claims cases to be heard and decided by verified jurors
                in your county. Quick Verdict delivers legally binding decisions—
                without stepping into a physical courtroom.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white/95 rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                <span className="text-blue-600 text-xl">💼</span>
              </div>
              <h3 className="font-semibold text-gray-900">Easy Case Upload</h3>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                Quickly upload case summaries, exhibits, and legal questions from your
                dashboard. Our guided format ensures jurors see only what they need.
                Head back to the home screen when needed with our dashboard.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white/95 rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center mb-4">
                <span className="text-orange-500 text-xl">⚖️</span>
              </div>
              <h3 className="font-semibold text-gray-900">Legally Binding Verdicts</h3>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                Jurors are vetted and sworn in virtually, and their decision carries
                the same legal weight as a traditional in-person small claims trial.
                Once a verdict is reached, the case is closed.
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
                src="\images\g.png" alt="Attorney in courtroom" className="rounded-lg shadow-lg w-full"
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
                    <p className="text-gray-600">Log in to your Quick Verdict dashboard and upload your case summary, exhibits, and key facts.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Set Your Jury Criteria</h3>
                    <p className="text-gray-600">Choose your target audience by county, age range, or demographics. Then upload your voi der questions.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Launch in a Virtual Courtroom</h3>
                    <p className="text-gray-600">Your case is presented to real people in a secure, private virtual environment. Jurors review materials, weigh the facts, and submit a verdict.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Verdict Gets Rendered</h3>
                    <p className="text-gray-600">Jurors you selected will render a verdict based on evidence submitted and witness testimony</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Case Closed</h3>
                    <p className="text-gray-600">Review material before it gets removed and open another case.</p>
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
            Testimonial
          </h2>
          <p className="text-center text-gray-600 mb-8">
            Hear from attorneys who have used Quick Verdicts
          </p>

          {/* Video Player - user will replace with YouTube embed */}
          <div className="relative rounded-lg overflow-hidden aspect-video shadow-lg bg-black">
            {!isPlaying ? (
              <>
                {/* Thumbnail */}
                <img src="/images/hammer.png" className="w-full h-full object-cover"/>

                {/* Play Button Overlay */}
                <button
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/30 hover:bg-black/40 transition"
                >
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                    <Play className="w-10 h-10 text-gray-900 ml-1" fill="currentColor" />
                  </div>
                </button>
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
              <h3 className="font-bold mb-4">Contact</h3>
              <p className="text-gray-300">650-762-6574</p>
              <p className="text-gray-300">hello@QV.com</p>
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
              <Link href="/" className="hover:text-white">Quick Verdicts®</Link>
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
