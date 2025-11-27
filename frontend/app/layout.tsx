import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import Script from "next/script";
import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";
import "./globals.css";

// ============================================
// METADATA CONFIGURATION
// ============================================

export const metadata: Metadata = {
  title: {
    default: "Quick Verdicts - Virtual Courtroom for Small Claims",
    template: "%s | Quick Verdicts",
  },
  description:
    "Quick Verdicts is a virtual courtroom where small claims trials happen quickly, securely, and virtually. Start your case online or get paid to serve as a remote juror.",
  keywords: [
    "virtual courtroom",
    "small claims",
    "online jury",
    "quick verdicts",
    "legal platform",
    "remote jury duty",
    "virtual trial",
  ],
  authors: [{ name: "Quick Verdicts" }],
  creator: "Quick Verdicts",
  publisher: "Quick Verdicts",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000"),
  
  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000",
    siteName: "Quick Verdicts",
    title: "Quick Verdicts - Virtual Courtroom for Small Claims",
    description:
      "A virtual courtroom where justice moves fast—and jurors get paid. Start your case online or get paid to serve as a remote juror.",
    images: [
      {
        url: "/Image1.png",
        width: 1200,
        height: 630,
        alt: "Quick Verdicts Virtual Courtroom",
      },
    ],
  },
  
  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "Quick Verdicts - Virtual Courtroom",
    description: "A virtual courtroom where justice moves fast—and jurors get paid.",
    images: ["/Image1.png"],
    creator: "@quickverdicts",
  },
  
  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  
  // Verification
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  },
  
  // App-specific
  applicationName: "Quick Verdicts",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Quick Verdicts",
  },
  formatDetection: {
    telephone: false,
  },
  
  // Manifest
  manifest: "/manifest.json",
};

// ============================================
// VIEWPORT CONFIGURATION
// ============================================

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0A2342" },
  ],
};

// ============================================
// MAIN LAYOUT COMPONENT
// ============================================

export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Google Fonts - Optimized loading */}
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/logo.png" />
        
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      
      <body className="bg-gray-100 text-gray-900 antialiased font-sans">
        {/* Google Analytics - Only in production */}
        {isProduction && GA_MEASUREMENT_ID && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_MEASUREMENT_ID}', {
                    page_path: window.location.pathname,
                    cookie_flags: 'SameSite=None;Secure',
                  });
                `,
              }}
            />
          </>
        )}
        
        {/* App Error Boundary - Catches app-level errors */}
        <AppErrorBoundary>
          {/* Toast Notifications */}
          <Toaster
            position="top-center"
            reverseOrder={false}
            gutter={8}
            toastOptions={{
              // Default options
              duration: 4000,
              style: {
                background: "#fff",
                color: "#0A2342",
                padding: "16px",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                maxWidth: "500px",
              },
              // Success toast
              success: {
                duration: 4000,
                iconTheme: {
                  primary: "#10b981",
                  secondary: "#fff",
                },
                style: {
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                },
              },
              // Error toast
              error: {
                duration: 5000,
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#fff",
                },
                style: {
                  background: "#fef2f2",
                  border: "1px solid #fca5a5",
                },
              },
              // Loading toast
              loading: {
                iconTheme: {
                  primary: "#0A2342",
                  secondary: "#fff",
                },
              },
            }}
          />
          
          {/* Main Content */}
          {children}
        </AppErrorBoundary>
        
        {/* Structured Data */}
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Quick Verdicts",
              url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000",
              logo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000"}/logo.png`,
              description:
                "A virtual courtroom where small claims trials happen quickly, securely, and virtually.",
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "Customer Service",
                email: "support@quickverdicts.com",
              },
            }),
          }}
        />
      </body>
    </html>
  );
}