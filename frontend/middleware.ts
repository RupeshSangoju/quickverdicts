import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require cookie acceptance.
// These are public marketing / auth-recovery pages linked from the landing
// page and login screen — they must be reachable without the cookie gate,
// otherwise the middleware redirects them to "/" (and Next.js caches that
// redirect from the pre-acceptance prefetch, so they stay broken after Accept).
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/for-attorneys',
  '/for-juror',
  '/contact',
  '/forgot-password',
  '/reset-password',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is a public route that doesn't need cookie check
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));

  // If it's a public route, allow it
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For other routes, check if user has accepted cookies
  const cookieAccepted = request.cookies.get('cookiePolicy')?.value === 'accepted';

  // If cookies not accepted, redirect to home page
  if (!cookieAccepted) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
