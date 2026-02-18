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

function getRequestHostname(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  const raw = forwarded || host || '';
  return raw.split(',')[0].trim().split(':')[0] || '';
}

export async function GET(request: NextRequest) {
  const redirectOrigin = getRedirectOrigin(request);
  const response = NextResponse.redirect(`${redirectOrigin}/login`);
  const hostname = getRequestHostname(request) || new URL(redirectOrigin).hostname;
  const domain = getCookieDomain(hostname);
  const baseOptions: Record<string, unknown> = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  };
  response.cookies.set('pilot_session', '', baseOptions);
  if (domain) {
    response.cookies.set('pilot_session', '', { ...baseOptions, domain });
  }
  return response;
}
