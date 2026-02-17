import { NextRequest, NextResponse } from 'next/server';
import { consumeApproveToken } from '@/lib/auth';
import { approvePending } from '@/lib/whitelistService';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid', request.url));
  }

  const email = consumeApproveToken(token);
  if (!email) {
    return NextResponse.redirect(new URL('/login?error=expired', request.url));
  }

  await approvePending(email);

  const url = new URL('/admin', request.url);
  url.searchParams.set('approved', email);
  return NextResponse.redirect(url);
}
