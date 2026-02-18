import { NextRequest, NextResponse } from 'next/server';

function getCookieDomain(hostname: string): string | undefined {
  if (hostname.endsWith('.ayryx.com')) return '.ayryx.com';
  return undefined;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  const hostname = request.nextUrl.hostname;
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
