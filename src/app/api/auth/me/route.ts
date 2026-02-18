import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/auth';
import { getAirlineConfig, S3ConfigError } from '@/lib/airlineConfig';
import { getAirline } from '@/lib/getAirline';

export async function GET(request: NextRequest) {
  const airline = getAirline(request);
  const sessionCookie = request.cookies.get('pilot_session');
  const email = verifySessionCookie(sessionCookie?.value);
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let config;
  try {
    config = await getAirlineConfig(airline);
  } catch (err) {
    if (err instanceof S3ConfigError) {
      return NextResponse.json({ error: 'Configuration unavailable. Please try again later.' }, { status: 503 });
    }
    throw err;
  }
  const admins = (config.adminEmails ?? [])
    .map((e) => (typeof e === 'string' ? e : String(e)).toLowerCase().trim())
    .filter(Boolean);
  const emailLower = email.toLowerCase().trim();
  const isAdmin = admins.includes(emailLower);
  const payload: Record<string, unknown> = {
    email,
    airline,
    isAdmin,
    features: config.features ?? {},
    logo: config.logo,
    name: config.name,
  };
  if (request.nextUrl.searchParams.get('debug') === '1') {
    payload._debug = { admins, emailLower, match: isAdmin, configLogo: config.logo, configName: config.name };
  }
  return NextResponse.json(payload);
}
