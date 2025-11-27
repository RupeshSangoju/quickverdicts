"use client";

import { FC, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Gavel, Users } from "lucide-react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

// ============================================
// TYPES
// ============================================

interface LoadingState {
  isLoading: boolean;
  loadedCount: number;
  totalCount: number;
  hasError: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const IMAGES_TO_PRELOAD = ["/logo_sidebar_signup.png"];

// ============================================
// MAIN COMPONENT
// ============================================

const SignupPage: FC = () => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    loadedCount: 0,
    totalCount: IMAGES_TO_PRELOAD.length,
    hasError: false,
  });

  // ============================================
  // IMAGE PRELOADING
  // ============================================

  useEffect(() => {
    let mounted = true;
    let loaded = 0;
    let hasError = false;

    const loadImage = (src: string): Promise<void> => {
      return new Promise((resolve) => {
        const img = new window.Image();
        img.src = src;

        img.onload = () => {
          if (mounted) {
            loaded++;
            setLoadingState((prev) => ({
              ...prev,
              loadedCount: loaded,
            }));
          }
          resolve();
        };

        img.onerror = () => {
          if (mounted) {
            loaded++;
            hasError = true;
            setLoadingState((prev) => ({
              ...prev,
              loadedCount: loaded,
              hasError: true,
            }));
            console.error(`Failed to load image: ${src}`);
          }
          resolve();
        };
      });
    };

    // Load all images
    Promise.all(IMAGES_TO_PRELOAD.map(loadImage)).then(() => {
      if (mounted) {
        // Small delay for smooth transition
        setTimeout(() => {
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
          }));
        }, 200);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  // ============================================
  // ANALYTICS TRACKING
  // ============================================

  const trackSignupClick = useCallback((userType: "attorney" | "juror") => {
    // Track signup button click
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "signup_click", {
        user_type: userType,
        page: "signup_selection",
      });
    }
  }, []);

  const trackLoginClick = useCallback((userType: "attorney" | "juror") => {
    // Track login link click
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "login_link_click", {
        user_type: userType,
        source: "signup_page",
      });
    }
  }, []);

  // ============================================
  // LOADING SCREEN
  // ============================================

  if (loadingState.isLoading) {
    const progress = Math.round(
      (loadingState.loadedCount / loadingState.totalCount) * 100
    );

    return (
      <div className="fixed inset-0 bg-[#f9f7f2] flex flex-col items-center justify-center z-50">
        <div className="text-center">
          {/* Logo */}
          <div className="mb-6">
            <Image
              src="/logo_sidebar_signup.png"
              alt="Quick Verdicts Logo"
              width={200}
              height={80}
              priority
            />
          </div>

          {/* Progress Bar */}
          <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0A2342] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Loading Text */}
          <p className="text-[#455A7C] text-sm mt-3">Loading... {progress}%</p>

          {/* Error Message */}
          {loadingState.hasError && (
            <p className="text-red-600 text-xs mt-2">
              Some images failed to load, but the page will work normally.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN CONTENT
  // ============================================

  return (
    <div className="min-h-screen bg-[#f9f7f2] flex flex-col font-sans">
      {/* SEO Meta Tags (Client-side for dynamic content) */}
      <title>Sign Up - Quick Verdicts</title>
      <meta
        name="description"
        content="Create your Quick Verdicts account. Sign up as an attorney to start trials or as a juror to get paid for serving in virtual courtrooms."
      />

      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <main
        className="flex-1 flex flex-col justify-between pt-36 pb-0"
        role="main"
      >
        <div className="max-w-6xl mx-auto w-full px-6">
          {/* Back Button */}
          <nav className="mb-8" aria-label="Breadcrumb">
            <Link
              href="/"
              className="text-[#0A2342] text-base hover:underline focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded px-2 py-1 -ml-2"
              aria-label="Go back to homepage"
            >
              &larr; Back
            </Link>
          </nav>

          {/* Heading */}
          <header className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-[#0A2342] mb-4">
              Create Your Quick Verdicts Account
            </h1>
            <p className="text-[#0A2342] text-lg">
              It only takes a few minutes to get started. Please enter your
              information below to continue.
            </p>
          </header>

          {/* Cards */}
          <section
            className="grid grid-cols-1 md:grid-cols-2 gap-10 justify-center items-stretch max-w-4xl mx-auto"
            aria-label="Account type selection"
          >
            {/* Attorney Card */}
            <article className="bg-[#ede3cf] border border-[#e3e3e3] rounded-md shadow-sm px-8 py-12 flex flex-col items-center min-w-[320px]">
              <div className="flex-1 flex flex-col items-center justify-center">
                <h2 className="text-2xl font-bold text-[#0A2342] mb-2 text-center">
                  Attorney Sign-Up
                </h2>
                <p className="text-[#0A2342] font-semibold text-base text-center mb-8">
                  Start, manage, or join a small claims trial as a licensed
                  attorney.
                </p>

                <Link
                  href="/signup/attorney"
                  onClick={() => trackSignupClick("attorney")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0A2342] text-white rounded-md font-semibold text-base hover:bg-[#132c54] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2"
                  aria-label="Continue to attorney sign up"
                >
                  <Gavel size={18} aria-hidden="true" />
                  <span>Continue as an Attorney</span>
                </Link>

                <p className="text-[#0A2342] text-sm text-center mt-4">
                  or{" "}
                  <Link
                    href="/login/attorney"
                    onClick={() => trackLoginClick("attorney")}
                    className="underline hover:text-[#132c54] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0A2342] rounded"
                    aria-label="Log in to existing attorney account"
                  >
                    Log In to Your Attorney Account
                  </Link>
                </p>
              </div>
            </article>

            {/* Juror Card */}
            <article className="bg-[#ede3cf] border border-[#e3e3e3] rounded-md shadow-sm px-8 py-12 flex flex-col items-center min-w-[320px]">
              <div className="flex-1 flex flex-col items-center justify-center">
                <h2 className="text-2xl font-bold text-[#0A2342] mb-2 text-center">
                  Juror Sign-Up
                </h2>
                <p className="text-[#0A2342] font-semibold text-base text-center mb-8">
                  Sign up to serve in real trials and get paid for your time—100%
                  online.
                </p>

                <Link
                  href="/signup/juror"
                  onClick={() => trackSignupClick("juror")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0A2342] text-white rounded-md font-semibold text-base hover:bg-[#132c54] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2"
                  aria-label="Continue to juror sign up"
                >
                  <Users size={18} aria-hidden="true" />
                  <span>Continue as a Juror</span>
                </Link>

                <p className="text-[#0A2342] text-sm text-center mt-4">
                  or{" "}
                  <Link
                    href="/login/juror"
                    onClick={() => trackLoginClick("juror")}
                    className="underline hover:text-[#132c54] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0A2342] rounded"
                    aria-label="Log in to existing juror account"
                  >
                    Log In to Your Juror Account
                  </Link>
                </p>
              </div>
            </article>
          </section>

          {/* Help Text */}
          <div className="text-center mt-12 mb-8">
            <p className="text-[#455A7C] text-sm">
              Need help deciding?{" "}
              <Link
                href="/contact"
                className="text-[#0A2342] font-semibold underline hover:text-[#132c54] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0A2342] rounded"
              >
                Contact our support team
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto">
          <Footer />
        </div>
      </main>
    </div>
  );
};

export default SignupPage;