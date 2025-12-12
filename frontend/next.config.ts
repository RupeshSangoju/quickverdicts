import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ============================================
  // BUILD CONFIGURATION
  // ============================================

  // REMOVED standalone - doesn't work well with IIS
  // output: "standalone",

  // ============================================
  // CODE QUALITY CHECKS
  // ============================================

  eslint: {
    ignoreDuringBuilds: process.env.IGNORE_BUILD_ERRORS === 'true',
    dirs: ['app', 'components', 'lib', 'hooks', 'types'],
  },

  typescript: {
    ignoreBuildErrors: process.env.IGNORE_BUILD_ERRORS === 'true',
  },

  // ============================================
  // PERFORMANCE OPTIMIZATIONS
  // ============================================

  reactStrictMode: true,

  images: {
    domains: ['quickverdicts.blob.core.windows.net'],
    formats: ['image/avif', 'image/webp'],
  },

  compress: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  // ============================================
  // SECURITY HEADERS
  // ============================================

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          // Removed Cross-Origin-Embedder-Policy to allow YouTube embeds
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' https: http:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:",
              "style-src 'self' 'unsafe-inline' https:",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data: https:",
              "connect-src 'self' http: https: ws: wss:",
              "media-src 'self' blob: https: http:",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https:",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'"
            ].join('; ')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;