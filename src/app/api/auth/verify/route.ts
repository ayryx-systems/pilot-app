import { NextRequest, NextResponse } from 'next/server';
import { consumeMagicLinkToken, createSessionCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid', request.url));
  }

  const email = consumeMagicLinkToken(token);
  if (!email) {
    return NextResponse.redirect(new URL('/login?error=expired', request.url));
  }

  const { name, value, options } = createSessionCookie(email);
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set(name, value, options);
  return response;
}
