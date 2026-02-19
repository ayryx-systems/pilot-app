import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/auth';
import { getAirlineConfig, S3ConfigError } from '@/lib/airlineConfig';
import { getAirline } from '@/lib/getAirline';

export async function GET(request: NextRequest) {
  const airline = getAirline(request);
  const sessionCookie = request.cookies.get('pilot_session');
  const email = verifySessionCookie(sessionCookie?.value);
  let config;
  try {
    config = await getAirlineConfig(airline);
  } catch (err) {
    if (err instanceof S3ConfigError) {
      return NextResponse.json({ error: 'Configuration unavailable. Please try again later.' }, { status: 503 });
    }
    throw err;
  }
  const payload: Record<string, unknown> = {
    email: email ?? null,
    airline,
    isAdmin: false,
    features: config.features ?? {},
    logo: config.logo,
    name: config.name,
  };
  if (email) {
    const admins = (config.adminEmails ?? [])
      .map((e) => (typeof e === 'string' ? e : String(e)).toLowerCase().trim())
      .filter(Boolean);
    const emailLower = email.toLowerCase().trim();
    payload.isAdmin = admins.includes(emailLower);
    if (request.nextUrl.searchParams.get('debug') === '1') {
      payload._debug = { admins, emailLower, match: payload.isAdmin, configLogo: config.logo, configName: config.name };
    }
  }
  return NextResponse.json(payload);
}
