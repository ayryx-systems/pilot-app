import type { NextRequest } from 'next/server';

export function getAirline(request: NextRequest): string {
  return request.headers.get('x-airline') || 'ein';
}

export function getBaseUrl(request: NextRequest): string {
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    (process.env.NODE_ENV === 'production' ? undefined : 'localhost:3006');
  if (!host) {
    const fallback = process.env.PILOT_APP_BASE_URL || 'https://pilot.ayryx.com';
    return fallback.replace(/\/$/, '');
  }
  const hostname = host.split(',')[0].trim();
  const protocol =
    request.headers.get('x-forwarded-proto') ||
    (hostname.includes('localhost') || hostname.includes('127.0.0.1') ? 'http' : 'https');
  return `${protocol === 'https' ? 'https' : 'http'}://${hostname}`;
}
