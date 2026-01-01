import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, NextRequest } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  // Health check must be public (used by reverse proxies / monitors)
  '/api/health(.*)',
  // Avoid Clerk redirect-to-sign-in for fetch() calls; these route handlers already return JSON 401/403.
  '/api/generate-translated-document(.*)',
  // Translation API - must be public for cross-subdomain calls (api.translatoraxis.com)
  // The route handler has its own auth check via auth() and verifies admin role
  '/api/translate(.*)',
]);

// Create the Clerk middleware with protected route handling
const clerkAuth = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

// Main middleware export - handles OPTIONS BEFORE Clerk to prevent redirect issues
export default async function middleware(request: NextRequest) {
  // Handle OPTIONS (CORS preflight) requests FIRST - before any auth
  // This is critical for cross-origin API calls from api.translatoraxis.com
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL || 'https://translatoraxis.com',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // For all other requests, use Clerk authentication
  return clerkAuth(request, {} as any);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

