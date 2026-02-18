import type { NextRequest } from 'next/server';

export function getAirline(request: NextRequest): string {
  return request.headers.get('x-airline') || 'ein';
}

export function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3006';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  return `${protocol === 'https' ? 'https' : 'http'}://${host}`;
}
