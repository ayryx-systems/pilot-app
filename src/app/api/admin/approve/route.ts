import { NextRequest, NextResponse } from 'next/server';
import { consumeApproveToken } from '@/lib/auth';
import { approvePending, S3WhitelistError } from '@/lib/whitelistService';
import { getAirline } from '@/lib/getAirline';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid', request.url));
  }

  const email = consumeApproveToken(token);
  if (!email) {
    return NextResponse.redirect(new URL('/login?error=expired', request.url));
  }

  const airline = getAirline(request);
  try {
    await approvePending(airline, email);
  } catch (err) {
    if (err instanceof S3WhitelistError) {
      return NextResponse.redirect(new URL('/login?error=unavailable', request.url));
    }
    throw err;
  }

  const url = new URL('/admin', request.url);
  url.searchParams.set('approved', email);
  return NextResponse.redirect(url);
}
