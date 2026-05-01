import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware for Server-Side Route Protection
 *
 * This middleware runs on the server before pages are rendered,
 * providing an additional layer of security on top of client-side
 * authentication checks.
 *
 * NOTE: The primary authentication is handled client-side via useProtectedRoute
 * hook which checks localStorage. This middleware provides a complementary layer
 * by enforcing route patterns and can be enhanced to check HTTP-only cookies
 * in the future for stronger security.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define protected route patterns — match the route and all its sub-paths
  const protectedRoutes = [
    { pattern: /^\/attorney(\/|$)/i, loginPath: '/login/attorney', name: 'attorney' },
    { pattern: /^\/admin(\/|$)/i, loginPath: '/admin/login', name: 'admin' },
    { pattern: /^\/juror(\/|$)/i, loginPath: '/login/juror', name: 'juror' },
  ];

  // Public routes that should not be protected
  const publicRoutes = [
    '/login',
    '/signup',
    '/admin/login',
  ];

  // Check if current path is a public route
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for authentication token in HTTP-only cookie
  const token = request.cookies.get('token')?.value;

  // Check if the current path matches a protected route
  for (const route of protectedRoutes) {
    if (route.pattern.test(pathname)) {
      if (!token) {
        return NextResponse.redirect(new URL(route.loginPath, request.url));
      }
      return NextResponse.next();
    }
  }

  // Allow the request to proceed
  return NextResponse.next();
}

/**
 * Configure which routes the middleware should run on
 *
 * This middleware will run on all /attorney, /admin, and /juror routes
 * except for static files, API routes, and Next.js internal routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.webp).*)',
  ],
};
