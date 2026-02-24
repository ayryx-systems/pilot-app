import { NextResponse } from 'next/server';

export async function GET() {
  const buildId = process.env.NEXT_PUBLIC_APP_BUILD_ID ?? null;
  const res = NextResponse.json({ buildId });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
