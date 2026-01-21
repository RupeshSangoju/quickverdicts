"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';

export default function ForAttorneys() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <img src="/api/placeholder/150/50" alt="Quick Verdicts Logo" className="h-12" />
          </Link>
          <nav className="flex items-center space-x-6">
            <Link href="/" className="text-gray-700 hover:text-gray-900">
              Home
            </Link>
            <Link href="/for-attorneys" className="text-blue-900 font-semibold">
              Attorney
            </Link>
            <Link href="/signup/juror" className="text-gray-700 hover:text-gray-900">
              Juror
            </Link>
            <Link href="/login" className="text-gray-700 hover:text-gray-900">
              Login
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-900 to-blue-800 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url('/api/placeholder/1920/600')" }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-5xl font-bold mb-4">
            Why Become a Quick Verdicts Attorney?
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto mb-8">
            Leverage the power of online jury trials and move your small claims cases forward faster than ever before.
          </p>
          <Link href="/signup/attorney" className="bg-white text-blue-900 px-8 py-3 rounded font-medium hover:bg-gray-100 inline-block">
            Get Started
          </Link>
        </div>
      </section>

      {/* Three Benefits Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Fast Resolution</h3>
            <p className="text-gray-600">
              Get verdicts in days, not months. Our virtual courtroom streamlines the entire process, saving you time and resources.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Real Local Jurors</h3>
            <p className="text-gray-600">
              Your cases are heard by verified jurors from the actual county where your case originated, ensuring authentic verdicts.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Legally Binding</h3>
            <p className="text-gray-600">
              All verdicts are legally binding and enforceable, giving you the same authority as traditional court decisions.
            </p>
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
                src="/api/placeholder/600/400"
                alt="Attorney in courtroom"
                className="rounded-lg shadow-lg w-full"
              />
            </div>

            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                How It Works for Attorneys
              </h2>
              <p className="text-gray-600 mb-6">
                Quick Verdicts helps you move cases forward and gives you cost-effective options before heading to court.
              </p>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Create Your Profile</h3>
                    <p className="text-gray-600">Set up your attorney account and get verified in minutes.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Submit Your Case</h3>
                    <p className="text-gray-600">Upload case details, evidence, and any supporting documentation.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Jurors Review</h3>
                    <p className="text-gray-600">Verified local jurors review your case materials and evidence in our secure virtual courtroom.</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-900 text-white rounded-full flex items-center justify-center font-bold mr-3">
                    4
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Get Your Verdict</h3>
                    <p className="text-gray-600">Receive a detailed verdict with juror feedback, typically within 48 hours.</p>
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
          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            <img
              src="/api/placeholder/800/450"
              alt="Testimonial video thumbnail"
              className="w-full"
            />
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                <Play className="w-12 h-12 text-gray-900 ml-2" fill="currentColor" />
              </div>
            </button>
          </div>

          {/* Pagination dots */}
          <div className="flex justify-center mt-6 space-x-2">
            <button className="w-3 h-3 rounded-full bg-blue-900"></button>
            <button className="w-3 h-3 rounded-full bg-gray-300"></button>
            <button className="w-3 h-3 rounded-full bg-gray-300"></button>
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
            <Link href="/login" className="bg-white text-blue-900 border-2 border-blue-900 px-12 py-3 rounded hover:bg-blue-50 font-medium">
              Already have an account? Login
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-950 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold mb-4">Contact</h3>
              <p className="text-gray-300">650-762-6574</p>
              <p className="text-gray-300">hello@QV.com</p>
            </div>
            <div>
              <h3 className="font-bold mb-4">Resources</h3>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/for-attorneys" className="hover:text-white">For Attorneys</Link></li>
                <li><Link href="/signup/juror" className="hover:text-white">For Jurors</Link></li>
                <li><Link href="/" className="hover:text-white">Home</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms of Use</Link></li>
                <li><Link href="/consumer-choice" className="hover:text-white">Consumer Choice</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Get Started</h3>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/signup/attorney" className="hover:text-white">Attorney Sign Up</Link></li>
                <li><Link href="/signup/juror" className="hover:text-white">Juror Sign Up</Link></li>
                <li><Link href="/login" className="hover:text-white">Login</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8 text-center">
            <p className="text-sm text-gray-300">
              © 2026 Quick Verdicts®. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
