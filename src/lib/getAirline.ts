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

export function isValidRedirectUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    if (u.hostname.endsWith('.ayryx.com')) return true;
    return false;
  } catch {
    return false;
  }
}

export function resolveBaseUrl(request: NextRequest, bodyBaseUrl?: string): string {
  const candidates = [
    bodyBaseUrl,
    request.headers.get('origin'),
    request.headers.get('referer')?.replace(/\/[^/]*$/, ''),
    getBaseUrl(request),
  ].filter(Boolean) as string[];
  for (const url of candidates) {
    const u = url.replace(/\/$/, '');
    if (isValidRedirectUrl(u)) return u;
  }
  return process.env.PILOT_APP_BASE_URL || 'https://pilot.ayryx.com';
}
