import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const buildIdPath = join(process.cwd(), '.build-id.json');
  let buildId: string | null = null;
  if (existsSync(buildIdPath)) {
    try {
      buildId = JSON.parse(readFileSync(buildIdPath, 'utf8')).buildId ?? null;
    } catch {
      buildId = process.env.NEXT_PUBLIC_APP_BUILD_ID ?? null;
    }
  } else {
    buildId = process.env.NEXT_PUBLIC_APP_BUILD_ID ?? null;
  }
  const res = NextResponse.json({ buildId });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}
