"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { ArrowLeft, Gavel, Users } from "lucide-react";

interface RoleCardProps {
  title: string;
  description: string;
  loginHref: string;
  signupHref: string;
  icon: React.ElementType;
  loginLabel: string;
  signupLabel: string;
}

function RoleCard({
  title,
  description,
  loginHref,
  signupHref,
  icon: Icon,
  loginLabel,
  signupLabel,
}: RoleCardProps) {
  return (
    <div className="bg-[#ede3cf] border border-[#e3e3e3] rounded-md shadow-sm px-8 py-10 flex flex-col items-center min-w-[280px] hover:shadow-md transition-shadow duration-300">
      <h2
        className="text-2xl font-bold text-[#0A2342] mb-2 text-center"
        style={{ fontFamily: "inherit" }}
      >
        {title}
      </h2>
      <p className="text-[#0A2342] text-base text-center mb-8 leading-relaxed">
        {description}
      </p>
      <Link
        href={loginHref}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0A2342] text-white rounded-md font-semibold text-base hover:bg-[#132c54] transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2"
        aria-label={loginLabel}
      >
        <Icon size={18} aria-hidden="true" /> {loginLabel}
      </Link>
      <p className="text-[#0A2342] text-sm text-center mt-4">
        or{" "}
        <Link
          href={signupHref}
          className="underline hover:text-[#132c54] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-1 rounded"
        >
          {signupLabel}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState(0);
  const [imageError, setImageError] = useState(false);

  // Preload critical images
  useEffect(() => {
    const imagesToLoad = ["/logo_sidebar_signup.png"];

    let loaded = 0;
    const totalImages = imagesToLoad.length;

    const handleImageLoad = () => {
      loaded++;
      setLoadedImages(loaded);
      if (loaded === totalImages) {
        // Small delay for smoother transition
        setTimeout(() => setIsLoading(false), 300);
      }
    };

    const handleImageError = () => {
      loaded++;
      setLoadedImages(loaded);
      setImageError(true);
      if (loaded === totalImages) {
        setTimeout(() => setIsLoading(false), 300);
      }
    };

    imagesToLoad.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      img.onload = handleImageLoad;
      img.onerror = handleImageError;
    });

    // Fallback: force load after 3 seconds
    const fallbackTimer = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
      }
    }, 3000);

    return () => clearTimeout(fallbackTimer);
  }, [isLoading]);

  // Loading Screen
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#f9f7f2] flex flex-col items-center justify-center z-50">
        <div className="text-center">
          <div className="mb-6">
            <Image
              src="/logo_sidebar_signup.png"
              alt="Quick Verdicts Logo"
              width={200}
              height={80}
              priority
              className="mx-auto"
            />
          </div>
          <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0A2342] transition-all duration-300 ease-out"
              style={{
                width: `${(loadedImages / 1) * 100}%`,
              }}
            />
          </div>
          <p className="text-[#0A2342] text-sm mt-4 animate-pulse">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f7f2] flex flex-col font-sans">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col justify-between pt-24 sm:pt-32 lg:pt-36 pb-0">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6">
          {/* Back Button */}
          <div className="mb-6 sm:mb-8">
            <Link
              href="/"
              className="text-[#0A2342] text-base hover:underline flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2 rounded px-2 py-1 -ml-2 transition-colors duration-200"
              aria-label="Go back to home page"
            >
              <ArrowLeft size={18} aria-hidden="true" /> Back
            </Link>
          </div>

          {/* Heading */}
          <h1
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0A2342] text-center mb-2"
            style={{ fontFamily: "inherit" }}
          >
            Log into Your Quick Verdicts Account
          </h1>
          <p className="text-[#0A2342] text-base sm:text-lg text-center mb-8 sm:mb-12 px-4">
            Select your role below to log in
          </p>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 lg:gap-10 justify-center items-start max-w-4xl mx-auto">
            <RoleCard
              title="Attorney Login"
              description="Start, manage, or join a small claims trial as a licensed attorney."
              loginHref="/login/attorney"
              signupHref="/signup/attorney"
              icon={Gavel}
              loginLabel="Login as an Attorney"
              signupLabel="Create a New Attorney Account"
            />
            <RoleCard
              title="Juror Login"
              description="Serve in real trials and get paid for your time—100% online."
              loginHref="/login/juror"
              signupHref="/signup/juror"
              icon={Users}
              loginLabel="Login as a Juror"
              signupLabel="Create a New Juror Account"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 sm:mt-16">
          <Footer />
        </div>
      </main>
    </div>
  );
}