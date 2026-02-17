import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionCookie } from '@/lib/auth-edge';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

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
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('pilot_session');
  const email = await verifySessionCookie(sessionCookie?.value);
  if (!email) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (path === '/admin') {
    const admins = process.env.ADMIN_EMAILS?.toLowerCase().split(',').map((e) => e.trim()) ?? [];
    if (!admins.includes(email.toLowerCase())) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|static|favicon.ico).*)'],
};
