import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionCookie } from '@/lib/auth-edge';

function getAirlineFromHost(hostname: string, searchParams: URLSearchParams): string {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return searchParams.get('airline') || process.env.DEFAULT_AIRLINE || 'ein';
  }
  if (hostname === 'pilot.ayryx.com') {
    return process.env.DEFAULT_AIRLINE || 'ein';
  }
  if (hostname.endsWith('.ayryx.com')) {
    return hostname.split('.')[0] || process.env.DEFAULT_AIRLINE || 'ein';
  }
  return process.env.DEFAULT_AIRLINE || 'ein';
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const airline = getAirlineFromHost(request.nextUrl.hostname, request.nextUrl.searchParams);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-airline', airline);

  if (
    path.startsWith('/api/') ||
    path === '/health' ||
    path.startsWith('/_next/') ||
    path.startsWith('/static/') ||
    path === '/favicon.ico' ||
    path === '/manifest.json' ||
    path.startsWith('/icons/') ||
    path === '/login'
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const sessionCookie = request.cookies.get('pilot_session');
  const email = await verifySessionCookie(sessionCookie?.value);
  if (!email) {
    const loginUrl = new URL('/login', request.url);
    if (request.nextUrl.searchParams.get('airline')) {
      loginUrl.searchParams.set('airline', request.nextUrl.searchParams.get('airline')!);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next|static|favicon.ico).*)'],
};
