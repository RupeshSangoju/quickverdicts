"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Play, Lock, Globe, Mail, Shield, Star, Power, Facebook, Twitter, Linkedin, Youtube } from 'lucide-react';

export default function QuickVerdictsLanding() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rounded-full"></div>
            </div>
            <span className="text-xl font-semibold">QUICK VERDICTS</span>
          </Link>
          <nav className="flex items-center space-x-6">
            <Link href="/signup/attorney" className="text-gray-700 hover:text-gray-900">
              Attorney
            </Link>
            <Link href="/signup/juror" className="text-gray-700 hover:text-gray-900">
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

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative">
          {/* Decorative Images */}
          <div className="absolute top-0 left-10 w-32 h-32">
            <div className="relative">
              <img src="/api/placeholder/120/120" alt="Legal" className="rounded-full w-full h-full object-cover" />
              <div className="absolute -left-8 top-1/2 transform -translate-y-1/2">
                <div className="flex flex-col space-y-1">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-0.5 bg-gray-800" style={{ width: `${20 + i * 3}px` }}></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute top-0 right-10 w-32 h-32">
            <div className="relative">
              <img src="/api/placeholder/120/120" alt="Legal" className="rounded-full w-full h-full object-cover" />
              <div className="absolute -right-8 top-1/2 transform -translate-y-1/2">
                <svg width="60" height="60" viewBox="0 0 60 60" className="text-gray-800">
                  <circle cx="30" cy="30" r="28" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="30" cy="30" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="30" cy="30" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-10 w-32 h-32">
            <div className="relative">
              <img src="/api/placeholder/120/120" alt="Legal" className="rounded-full w-full h-full object-cover" />
              <div className="absolute -left-8 top-1/2 transform -translate-y-1/2">
                <div className="flex flex-col space-y-1">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-0.5 bg-gray-800" style={{ width: `${20 + i * 3}px` }}></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 right-10 w-32 h-32">
            <div className="relative">
              <img src="/api/placeholder/120/120" alt="Legal" className="rounded-full w-full h-full object-cover" />
              <div className="absolute -right-8 top-1/2 transform -translate-y-1/2">
                <svg width="60" height="60" viewBox="0 0 60 60" className="text-gray-800">
                  <path d="M0 30 L60 30 M30 0 L30 60 M10 10 L50 50 M50 10 L10 50" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              </div>
            </div>
          </div>

          {/* Hero Content */}
          <div className="text-center pt-24 pb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Real Cases. Real Impact. Remotely.
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8">
              Quick Verdicts connects attorneys with verified jurors to resolve legally binding small claims cases online faster, fairer, and more efficiently.
            </p>
            <Link href="/signup" className="bg-blue-900 text-white px-8 py-3 rounded hover:bg-blue-800 font-medium inline-block">
              Get started
            </Link>
          </div>
        </div>

        {/* Video Section */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Welcome to Quick Verdicts
          </h2>
          <p className="text-center text-gray-600 mb-8">
            Watch this quick video to see how our virtual courtroom helps attorneys and jurors move cases forward fast.
          </p>
          <div className="relative bg-gray-900 rounded-lg overflow-hidden max-w-3xl mx-auto">
            <img src="/api/placeholder/800/450" alt="Video thumbnail" className="w-full" />
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                <Play className="w-12 h-12 text-gray-900 ml-2" fill="currentColor" />
              </div>
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-white p-4">
              <div className="flex items-center space-x-4">
                <button className="text-gray-900">
                  <Play className="w-6 h-6" />
                </button>
                <div className="flex-1 h-1 bg-gray-300 rounded-full">
                  <div className="h-full w-0 bg-blue-900 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="mt-24 grid md:grid-cols-2 gap-12 items-center">
          <div className="bg-blue-50 p-12 rounded-lg">
            <h3 className="text-4xl font-bold text-blue-900 mb-6">
              DIGITAL<br />SECURITY
            </h3>
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <Lock className="w-16 h-16 text-blue-900" />
                <div className="flex space-x-1">
                  {[...Array(4)].map((_, i) => (
                    <Star key={i} className="w-6 h-6 text-blue-900" fill="currentColor" />
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Globe className="w-16 h-16 text-blue-900" />
                <div className="text-blue-900 font-mono text-sm">
                  01001101010<br />10101010101
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Shield className="w-16 h-16 text-blue-900" />
                <Mail className="w-16 h-16 text-blue-900" />
              </div>
              <Power className="w-12 h-12 text-blue-900" />
            </div>
          </div>

          <div>
            <h3 className="text-3xl font-bold text-gray-900 mb-6">
              Security You Can Trust
            </h3>
            <p className="text-gray-600 mb-4">
              Protecting your case, your data, and your voice.
            </p>
            <p className="text-gray-600 mb-6">
              At Quick Verdicts, your privacy and the integrity of every case are our highest priorities.
            </p>
            <p className="text-gray-600 mb-6">
              That&apos;s why we built our platform with bank-level encryption, secure user authentication, and strict access controls for every participant.
            </p>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Data Encryption:</strong> Every piece of data—from user bios to case files—is encrypted in transit and at rest.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Anonymous Jury Deliberations:</strong> We use advanced masking methods and all juror responses remain anonymous unless legally required.</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span><strong>Compliance & Integrity:</strong> We follow industry best practices and align with legal standards to ensure digital proceedings are just as secure as in-person trials.</span>
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
                  <li>• Submit your case details</li>
                  <li>• Upload case materials securely</li>
                  <li>• Receive verdicts and insights in days</li>
                </ul>
                <Link href="/signup/attorney" className="inline-block mt-4 bg-blue-900 text-white px-6 py-2 rounded hover:bg-blue-800 font-medium">
                  Sign up as Attorney
                </Link>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-3">I Want to Be a Juror</h3>
                <ul className="space-y-2 text-gray-700 ml-4">
                  <li>• Make your voice count on your own schedule</li>
                  <li>• Complete a simple vetting process</li>
                  <li>• Review real, legally-binding cases online</li>
                  <li>• Deliberate and log your verdict remotely</li>
                  <li>• Get paid for your time</li>
                </ul>
                <Link href="/signup/juror" className="inline-block mt-4 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-medium">
                  Sign up as Juror
                </Link>
              </div>
            </div>

            <div className="bg-blue-50 p-12 rounded-lg">
              <h3 className="text-4xl font-bold text-blue-900 mb-8">STARTED</h3>
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="w-full h-32 bg-blue-100 rounded flex items-center justify-center mb-4">
                    <div className="text-6xl text-blue-900">🖼️</div>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute left-0 bottom-0 text-6xl">👋</div>
                  <div className="bg-white p-6 rounded-lg shadow-sm ml-12">
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="w-16 h-16 bg-blue-900 rounded flex items-center justify-center">
                        <Play className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 border-2 border-blue-900 rounded"></div>
                          <div className="flex-1 h-2 bg-gray-200 rounded"></div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-blue-900 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                          <div className="flex-1 h-2 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-0 top-0 text-4xl">⚙️</div>
                  <div className="absolute right-0 bottom-0">
                    <div className="w-12 h-12 bg-blue-900 rounded-full"></div>
                  </div>
                </div>
              </div>
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
              <p className="text-gray-600">
                Quick Verdicts is a virtual courtroom platform where attorneys can present small claims cases to real, local jurors, who then review evidence and issue binding verdicts—entirely online.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">How does it work?</h3>
              <p className="text-gray-600">
                Attorneys upload case materials, evidence, and questions. Jurors are selected from the local county, then join a secure virtual courtroom to review the case and render a decision. You receive a full verdict with juror feedback, analysis, and damages recommendations—typically within 48 hours.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">What types of cases work best?</h3>
              <p className="text-gray-600">
                Quick Verdicts is ideal for small claims, personal injury, contract disputes, landlord-tenant cases, and other civil matters under $25,000.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">What does a juror do on Quick Verdicts?</h3>
              <p className="text-gray-600">
                As a juror, you join a secure virtual courtroom to review real small claims cases. You&apos;ll examine case files, watch video statements (if available), and answer deliberation questions. Once you deliver your verdict, you might view their case.
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
            Sign up today and post your first case
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
              <p className="text-gray-300">650-762-6574</p>
              <p className="text-gray-300">hello@QV.com</p>
            </div>
            <div>
              <h3 className="font-bold mb-4">Navigation</h3>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/" className="hover:text-white">Home</Link></li>
                <li><Link href="/signup/attorney" className="hover:text-white">Attorney</Link></li>
                <li><Link href="/signup/juror" className="hover:text-white">Juror</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8 flex flex-wrap justify-between items-center">
            <div className="flex space-x-6 text-sm text-gray-300">
              <Link href="/" className="hover:text-white">Quick Verdicts®</Link>
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms of Use</Link>
              <Link href="/consumer-choice" className="hover:text-white">Consumer Choice</Link>
            </div>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <span className="text-sm text-gray-300">Follow Us</span>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <Youtube className="w-5 h-5" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
