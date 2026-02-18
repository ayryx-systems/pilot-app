import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/auth';
import { getAirlineConfig } from '@/lib/airlineConfig';
import { getAirline } from '@/lib/getAirline';

export async function GET(request: NextRequest) {
  const airline = getAirline(request);
  const sessionCookie = request.cookies.get('pilot_session');
  const email = verifySessionCookie(sessionCookie?.value);
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const config = await getAirlineConfig(airline);
  const admins = config.adminEmails.map((e) => e.toLowerCase().trim());
  return NextResponse.json({
    email,
    airline,
    isAdmin: admins.includes(email.toLowerCase()),
    features: config.features ?? {},
    logo: config.logo,
    name: config.name,
  });
}
