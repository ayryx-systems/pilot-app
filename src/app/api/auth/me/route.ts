import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/auth';

function getAdminEmails(): string[] {
  return process.env.ADMIN_EMAILS?.toLowerCase().split(',').map((e) => e.trim()).filter(Boolean) ?? [];
}

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('pilot_session');
  const email = verifySessionCookie(sessionCookie?.value);
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admins = getAdminEmails();
  return NextResponse.json({
    email,
    isAdmin: admins.includes(email.toLowerCase()),
  });
}
