import { NextRequest, NextResponse } from 'next/server';
import { consumeMagicLinkToken, createSessionCookie } from '@/lib/auth';
import { isValidRedirectUrl, getBaseUrl } from '@/lib/getAirline';

function getCookieDomain(hostname: string): string | undefined {
  if (hostname.endsWith('.ayryx.com')) return '.ayryx.com';
  return undefined;
}

function getRedirectBase(request: NextRequest): string {
  const redirectParam = request.nextUrl.searchParams.get('redirect');
  if (redirectParam && isValidRedirectUrl(redirectParam)) {
    return redirectParam.replace(/\/$/, '');
  }
  return getBaseUrl(request).replace(/\/$/, '');
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const base = getRedirectBase(request);

  if (!token) {
    return NextResponse.redirect(`${base}/login?error=invalid`);
  }

  const email = consumeMagicLinkToken(token);
  if (!email) {
    return NextResponse.redirect(`${base}/login?error=expired`);
  }

  const hostname = new URL(base).hostname;
  const domain = getCookieDomain(hostname);
  const { name, value, options } = createSessionCookie(email, domain ? { domain } : undefined);
  const response = NextResponse.redirect(`${base}/`);
  response.cookies.set(name, value, options);
  return response;
}
