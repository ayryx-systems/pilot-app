import { NextRequest, NextResponse } from 'next/server';
import { getAirline } from '@/lib/getAirline';

export async function GET(request: NextRequest) {
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    headers[k] = v;
  });
  const airline = getAirline(request);
  return NextResponse.json({
    receivedHost: request.headers.get('host'),
    xForwardedHost: request.headers.get('x-forwarded-host'),
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    derivedAirline: airline,
    allHeaders: headers,
  });
}
