"use client";

import { useState, useEffect, useCallback, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { FaTwitter, FaInstagram, FaFacebook, FaLinkedin, FaPlay } from "react-icons/fa";
import { FaGavel, FaMoneyBillWave } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

// Lazy load heavy components
const Footer = dynamic(() => import("./components/Footer"), {
  loading: () => <div className="h-64 bg-[#f9f7f2]" />,
});

const Navbar = dynamic(() => import("./components/Navbar"), {
  loading: () => <div className="h-16 bg-white" />,
});

/* ===========================================================
   CONSTANTS & CONFIGURATION
   =========================================================== */

const SITE_CONFIG = {
  name: "Quick Verdicts",
  tagline: "For lawyers: Strategic. Expedient. Cost effective",
  subtitle: "For Mock Jurors: Get paid to serve remotely",
  description: "Resolve disputes quickly with Quick Verdicts. Attorneys can start virtual trials, and citizens can get paid to serve as remote jurors.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://quickverdicts.com",
  image: "/Image1.png",
  keywords: [
    "virtual courtroom",
    "mock trial",
    "online jury",
    "quick verdicts",
    "legal platform",
    "remote juror",
    "virtual trial",
    "online arbitration",
  ].join(", "),
} as const;

const VIDEO_CONFIG = {
  attorney: {
    id: "Jix-vP5M1R0",
    title: "How Attorneys Use Quick Verdicts",
    thumbnail: "/image2.png",
  },
  juror: {
    id: "Lo58uzXStms",
    title: "How Jurors Serve on Quick Verdicts",
    thumbnail: "/image3.png",
  },
} as const;

const CRITICAL_IMAGES = [
  "/Image1.png",
  "/image2.png",
  "/image3.png",
  "/image4.png",
  "/image5.png",
] as const;

const FAQ_DATA = [
  {
    question: "What is Quick Verdicts?",
    answer: "Quick Verdicts is a mock trial preparation and virtual courtroom platform where attorneys can present disputes to screened, local jurors.",
  },
  {
    question: "What types of cases work best?",
    answer: "Pre-mediation cases, Stowers issues, single fact-issues and other civil cases under $1M.",
  },
  {
    question: "What does a juror do on Quick Verdicts?",
    answer: "As a juror, you join a secure virtual courtroom to review real cases. You'll examine evidence, watch video statements, and deliberate with your fellow mock jurors to arrive at a consensus on a Final Verdict.",
  },
] as const;

/* ===========================================================
   TYPES
   =========================================================== */

interface LoadingState {
  isLoading: boolean;
  loadedCount: number;
  totalCount: number;
  errors: string[];
}

type UserType = "attorney" | "juror";
type VideoType = "attorney" | "juror";

/* ===========================================================
   SUB-COMPONENTS
   =========================================================== */

// Loading Screen Component
const LoadingScreen = memo(({ progress, errors }: { progress: number; errors: string[] }) => (
  <div className="fixed inset-0 bg-[#f9f7f2] flex flex-col items-center justify-center z-50">
    <div className="text-center max-w-md px-6">
      {/* Logo */}
      <h1 className="text-4xl md:text-5xl font-bold text-[#0A2342] mb-6">
        Quick Verdicts
      </h1>

      {/* Animated Loader */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 border-4 border-[#e3e3e3] rounded-full" />
        <div className="absolute inset-0 border-4 border-[#0A2342] rounded-full border-t-transparent animate-spin" />
      </div>

      {/* Loading Progress */}
      <div className="mb-4">
        <div className="w-full bg-[#e3e3e3] rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#0A2342] h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Loading Text */}
      <p className="text-[#455A7C] font-medium text-lg">
        Loading... {progress}%
      </p>

      {/* Error Messages (if any) */}
      {errors.length > 0 && (
        <div className="mt-4 text-sm text-red-600">
          <p>Some images failed to load, but the site will work normally.</p>
        </div>
      )}
    </div>
  </div>
));
LoadingScreen.displayName = "LoadingScreen";

// Video Modal Component
const VideoModal = memo(({ 
  video, 
  onClose 
}: { 
  video: { id: string; title: string } | null; 
  onClose: () => void;
}) => {
  if (!video) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-modal-title"
    >
      <div
        className="relative w-full max-w-4xl bg-black rounded-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screen Reader Title */}
        <h2 id="video-modal-title" className="sr-only">
          {video.title}
        </h2>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Close video modal"
          type="button"
        >
          <IoMdClose className="text-2xl text-gray-800" />
        </button>

        {/* YouTube Video Embed */}
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: 0 }}
          />
        </div>
      </div>
    </div>
  );
});
VideoModal.displayName = "VideoModal";

// CTA Button Component
const CTAButton = memo(({ 
  href, 
  type, 
  location, 
  children, 
  variant = "primary" 
}: { 
  href: string; 
  type: UserType; 
  location: string; 
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) => {
  const handleClick = () => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "cta_click", {
        user_type: type,
        location: location,
      });
    }
  };

  const styles = variant === "primary"
    ? "px-5 py-2.5 bg-[#0A2342] text-white font-semibold rounded-md hover:bg-[#1a3666] transition flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2"
    : "px-5 py-2.5 bg-[#e6f4ea] text-[#1a7f37] border border-[#b7e0c3] rounded-md font-semibold hover:bg-[#d2ecd8] transition flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#1a7f37] focus:ring-offset-2";

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={styles}
      aria-label={type === "attorney" ? "Start a trial as an attorney" : "Sign up to be a paid juror"}
    >
      {children}
    </Link>
  );
});
CTAButton.displayName = "CTAButton";

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    loadedCount: 0,
    totalCount: CRITICAL_IMAGES.length,
    errors: [],
  });

  /* ===========================================================
     IMAGE PRELOADING
     =========================================================== */

  useEffect(() => {
    let mounted = true;
    let loaded = 0;
    const errors: string[] = [];

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
            errors.push(`Failed to load: ${src}`);
            setLoadingState((prev) => ({
              ...prev,
              loadedCount: loaded,
              errors: [...prev.errors, `Failed to load: ${src}`],
            }));
            console.error(`Failed to load image: ${src}`);
          }
          resolve();
        };
      });
    };

    // Load all images
    Promise.all(CRITICAL_IMAGES.map(loadImage)).then(() => {
      if (mounted) {
        // Small delay for smooth transition
        setTimeout(() => {
          setLoadingState((prev) => ({
            ...prev,
            isLoading: false,
          }));
        }, 300);
      }
    });

    // Cleanup
    return () => {
      mounted = false;
    };
  }, []);

  /* ===========================================================
     VIDEO MODAL HANDLERS
     =========================================================== */

  const openVideoModal = useCallback((videoType: VideoType) => {
    const video = VIDEO_CONFIG[videoType];
    setCurrentVideo({
      id: video.id,
      title: video.title,
    });
    setIsModalOpen(true);
    document.body.style.overflow = "hidden";

    // Track video play event (for analytics)
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "video_play", {
        video_type: videoType,
        video_title: video.title,
      });
    }
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setCurrentVideo(null);
    document.body.style.overflow = "unset";

    // Track video close event
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "video_close", {
        video_title: currentVideo?.title,
      });
    }
  }, [currentVideo]);

  // Keyboard navigation for modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        closeModal();
      }
    };

    if (isModalOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isModalOpen, closeModal]);

  // Cleanup scroll lock on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  /* ===========================================================
     RENDER
     =========================================================== */

  // Loading screen
  if (loadingState.isLoading) {
    const progress = Math.round(
      (loadingState.loadedCount / loadingState.totalCount) * 100
    );
    return <LoadingScreen progress={progress} errors={loadingState.errors} />;
  }

  return (
    <>
      {/* Video Modal */}
      {isModalOpen && <VideoModal video={currentVideo} onClose={closeModal} />}

      <div className="bg-[#f9f7f2] text-[#0A2342] font-sans">
        {/* Navbar */}
        <Navbar />

        {/* Hero Section */}
        <section className="pt-42 pb-12 text-center">
          <h1 className="text-3xl md:text-4xl font-semibold text-[#0A2342] leading-snug">
            {SITE_CONFIG.tagline}
          </h1>
          <p className="mt-2 text-2xl md:text-3xl font-semibold text-[#0A2342] px-4">
            {SITE_CONFIG.subtitle}
          </p>
          <div className="mt-6 flex justify-center gap-4 flex-wrap px-4">
            <CTAButton href="/signup/attorney" type="attorney" location="hero" variant="primary">
              <FaGavel aria-hidden="true" />
              <span>Start a Trial Now</span>
            </CTAButton>
            <CTAButton href="/signup/juror" type="juror" location="hero" variant="secondary">
              <FaMoneyBillWave aria-hidden="true" />
              <span>Get Paid to be a Juror</span>
            </CTAButton>
          </div>
          <div className="mt-10 mb-20 flex justify-center px-4">
            <Image
              src="/Image1.png"
              alt="Scales of Justice representing fair virtual trials"
              width={700}
              height={500}
              className="rounded-md shadow-md max-w-full h-auto"
              priority
            />
          </div>
        </section>

        {/* Two Column Intro Heading */}
        <section className="max-w-8xl mx-auto text-center px-6">
          <h2 className="text-2xl md:text-4xl font-semibold text-[#0A2342] leading-snug">
            Start a Trial or Get Paid to Be a Juror—All Online.
          </h2>
        </section>

        {/* Two Column Section */}
        <section
          id="how-it-works"
          className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-8 items-stretch"
        >
          {/* Attorneys */}
          <article className="bg-white border border-[#e3e3e3] rounded-lg p-0 shadow-sm flex flex-col">
            {/* Video Thumbnail */}
            <button
              type="button"
              className="relative rounded-t-lg overflow-hidden cursor-pointer group w-full h-[300px] bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#0A2342]"
              onClick={() => openVideoModal("attorney")}
              aria-label="Play video about how attorneys use Quick Verdicts"
            >
              <Image
                src={VIDEO_CONFIG.attorney.thumbnail}
                alt="Attorney explaining how to use Quick Verdicts platform"
                width={520}
                height={300}
                className="object-cover w-full h-full"
                loading="eager"
              />
              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-black/10 to-black/30 group-hover:from-black/10 group-hover:via-black/20 group-hover:to-black/40 transition-all duration-300">
                <div className="bg-white rounded-full p-5 shadow-2xl transition-all duration-300 group-hover:scale-110">
                  <FaPlay className="text-[#0A2342] text-3xl pl-1" aria-hidden="true" />
                </div>
              </div>
            </button>

            <div className="p-6 flex flex-col flex-grow">
              <h3 className="mt-2 text-xl font-semibold text-[#0A2342]">
                Jurors are screened. Mock trials are timed.
              </h3>
              <p className="mt-2 text-[#1a3666] text-base">
                The platform intends to resolve the question:
              </p>
              <p className="mt-1 text-[#0A2342] text-base font-semibold italic">
                What would a jury in a certain county do?
              </p>
              <ol className="mt-4 space-y-4 text-[#0A2342] text-sm list-none">
                <li>
                  <p className="font-semibold">1. Start Your Trial</p>
                  <p>Create an account and open a case in minutes.</p>
                </li>
                <li>
                  <p className="font-semibold">2. Prepare Your Case</p>
                  <p>
                    Upload evidence into secure war room, QV provides templates for Voir dire questions and the Jury Charge. Pre-record all sides of the trial presentation or plan to appear live.
                  </p>
                </li>
                <li>
                  <p className="font-semibold">3. Hold Your Trial Online</p>
                  <p>
                    Schedule and conduct your trial with panel of 6-8 jurors - 100% virtually.
                  </p>
                </li>
              </ol>
              <div className="mt-auto pt-6">
                <CTAButton href="/signup/attorney" type="attorney" location="attorney_section" variant="primary">
                  Start a Trial Now
                </CTAButton>
              </div>
            </div>
          </article>

          {/* Jurors */}
          <article className="bg-white border border-[#e3e3e3] rounded-lg p-0 shadow-sm flex flex-col">
            {/* Video Thumbnail */}
            <button
              type="button"
              className="relative rounded-t-lg overflow-hidden cursor-pointer group w-full h-[300px] bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1a7f37]"
              onClick={() => openVideoModal("juror")}
              aria-label="Play video about how jurors serve on Quick Verdicts"
            >
              <Image
                src={VIDEO_CONFIG.juror.thumbnail}
                alt="Juror explaining how to serve on virtual trials"
                width={520}
                height={300}
                className="object-cover w-full h-full"
                loading="eager"
              />
              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-black/10 to-black/30 group-hover:from-black/10 group-hover:via-black/20 group-hover:to-black/40 transition-all duration-300">
                <div className="bg-white rounded-full p-5 shadow-2xl transition-all duration-300 group-hover:scale-110">
                  <FaPlay className="text-[#0A2342] text-3xl pl-1" aria-hidden="true" />
                </div>
              </div>
            </button>

            <div className="p-6 flex flex-col flex-grow">
              <h3 className="mt-2 text-xl font-semibold text-[#0A2342]">
                We Pay Jurors to Deliberate Online
              </h3>
              <p className="mt-2 text-[#1a3666] text-base">
                Serving a mock jury is now more accessible—and rewarding. Sign up,
                find a case, and join the trial on the scheduled date. All online.
                All paid.
              </p>
              <ol className="mt-4 space-y-4 text-[#0A2342] text-sm list-none">
                <li>
                  <p className="font-semibold">1. Sign Up to Serve</p>
                  <p>
                    Create a free account and get verified as a potential juror.
                  </p>
                </li>
                <li>
                  <p className="font-semibold">2. Find a Trial to Join</p>
                  <p>Browse upcoming cases on the juror job board, QV will further screen you for possible conflicts.</p>
                </li>
                <li>
                  <p className="font-semibold">3. Join the Live Trial</p>
                  <p>
                    Log in on the scheduled date and participate in the virtual trial.
                  </p>
                </li>
              </ol>
              <div className="mt-auto pt-6">
                <CTAButton href="/signup/juror" type="juror" location="juror_section" variant="secondary">
                  Get Paid to be a Juror
                </CTAButton>
              </div>
            </div>
          </article>
        </section>

        {/* More about quick verdicts */}
        <section className="bg-[#f9f7f2] py-12 px-6">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0A2342] text-center mb-10">
            Learn More About Quick Verdicts
          </h2>
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
            {/* Text */}
            <div>
              <h3 className="text-2xl font-semibold text-[#0A2342] mb-4">
                With Quick Verdicts advisory verdicts are faster, more accessible, and more
                affordable for everyone.
              </h3>
              <ul className="mt-4 text-[#455A7C] space-y-4 text-base font-semibold list-none">
                <li>
                  Attorney's access to War Room with preformatted and editable Voir Dire questions and Jury Charge.
                </li>
                <li>
                  Pre-record case or appear live. 3 tiers available, timed trials at set costs:
                  <ul className="list-disc list-inside mt-2">
                    <li>2.5 hours $3500</li>
                    <li>3.5 hours $4500</li>
                    <li>4.5 hours $5500</li>
                  </ul>
                </li>
                <li>Cost effective enough for multiple trials</li>
                <li>Recording of trial and deliberations provided</li>
                <li>6-7 local mock jurors screened for prejudice and bias</li>
                <li>Demonstrative evidence can be uploaded and accessed by Jurors.</li>
                <li>Debriefing period provided following verdict</li>
                <li>Each Juror completes witness evaluations</li>
              </ul>
            </div>
            {/* Image */}
            <div className="flex justify-center md:justify-end">
              <Image
                src="/image4.png"
                alt="Professional attorney working on Quick Verdicts platform"
                width={600}
                height={380}
                className="rounded-md object-cover shadow-md max-w-full h-auto"
                loading="lazy"
              />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 md:px-20 py-16 text-left">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0A2342] mb-6">
            Frequently Asked Questions
          </h2>
          <dl className="space-y-8 divide-y divide-[#C6CDD9]">
            {FAQ_DATA.map((faq, index) => (
              <div key={index} className={index === 0 ? "pb-6" : "pt-6 pb-6"}>
                <dt className="font-semibold text-[#0A2342] text-lg">
                  {faq.question}
                </dt>
                <dd className="text-[#1a3666] mt-2">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* CTA Section */}
        <section className="bg-[#EEE7D5] py-16 text-center border-t border-[#ede3cf] m-0">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0A2342] mb-2">
            Ready to Join a Trial—or Start One?
          </h2>
          <p className="mt-2 text-[#1a3666] font-semibold max-w-4xl mx-auto px-4">
            Whether you're here to serve or to try a case, Quick Verdicts is ready
            when you are. Join us participating in a faster,
            smarter pretrial resolution system.
          </p>
          <div className="mt-6 flex justify-center gap-4 flex-wrap px-4">
            <CTAButton href="/signup/attorney" type="attorney" location="cta_bottom" variant="primary">
              <FaGavel aria-hidden="true" />
              <span>Start a Trial Now</span>
            </CTAButton>
            <CTAButton href="/signup/juror" type="juror" location="cta_bottom" variant="secondary">
              <FaMoneyBillWave aria-hidden="true" />
              <span>Get Paid to be a Juror</span>
            </CTAButton>
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
