import { NextRequest, NextResponse } from 'next/server';

function getCookieDomain(hostname: string): string | undefined {
  if (hostname.endsWith('.ayryx.com')) return '.ayryx.com';
  return undefined;
}

function getRedirectOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  if (origin && (origin.includes('ayryx.com') || origin.includes('localhost'))) {
    return origin.replace(/\/$/, '');
  }
  if (referer) {
    try {
      const u = new URL(referer);
      if (u.origin.includes('ayryx.com') || u.origin.includes('localhost')) return u.origin;
    } catch {}
  }
  return process.env.NODE_ENV === 'production'
    ? (process.env.PILOT_APP_BASE_URL || 'https://pilot.ayryx.com')
    : 'http://localhost:3006';
}

export async function GET(request: NextRequest) {
  const redirectOrigin = getRedirectOrigin(request);
  const response = NextResponse.redirect(`${redirectOrigin}/login`);
  const hostname = new URL(redirectOrigin).hostname;
  const domain = getCookieDomain(hostname);
  const options: Record<string, unknown> = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  };
  if (domain) options.domain = domain;
  response.cookies.set('pilot_session', '', options);
  return response;
}
