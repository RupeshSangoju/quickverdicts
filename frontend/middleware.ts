import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require cookie acceptance
const publicRoutes = ['/', '/login', '/signup'];

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
