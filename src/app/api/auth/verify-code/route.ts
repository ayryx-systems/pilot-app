import { NextRequest, NextResponse } from 'next/server';
import { consumeMagicCode, createSessionCookie } from '@/lib/auth';
import { getBaseUrl } from '@/lib/getAirline';
import { checkRateLimit } from '@/lib/rateLimit';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function getCookieDomain(hostname: string): string | undefined {
  if (hostname.endsWith('.ayryx.com')) return '.ayryx.com';
  return undefined;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(`verify-code:${ip}`);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil((retryAfter ?? 3600) / 60)} minutes.` },
      { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
    );
  }

  try {
    const body = await request.json();
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const email = consumeMagicCode(code);
    if (!email) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    const baseUrl = getBaseUrl(request).replace(/\/$/, '');
    const hostname = new URL(baseUrl).hostname;
    const domain = getCookieDomain(hostname);
    const { name, value, options } = createSessionCookie(email, domain ? { domain } : undefined);
    const response = NextResponse.json({ success: true });
    response.cookies.set(name, value, options);
    return response;
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
