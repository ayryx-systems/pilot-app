import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@/lib/auth';
import { getWhitelist, addToWhitelist, removeFromWhitelist, approvePending, denyPending } from '@/lib/whitelistService';

function getAdminEmails(): string[] {
  return process.env.ADMIN_EMAILS?.toLowerCase().split(',').map((e) => e.trim()).filter(Boolean) ?? [];
}

function isAdmin(email: string): boolean {
  return getAdminEmails().includes(email.toLowerCase().trim());
}

async function requireAdmin(request: NextRequest): Promise<{ email: string } | NextResponse> {
  const sessionCookie = request.cookies.get('pilot_session');
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const email = verifySessionCookie(sessionCookie.value);
  if (!email || !isAdmin(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { email };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const data = await getWhitelist();
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const body = await request.json();
  const action = body.action as string;
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  if (action === 'add') {
    await addToWhitelist(email);
    const data = await getWhitelist();
    return NextResponse.json(data);
  }

  if (action === 'remove') {
    await removeFromWhitelist(email);
    const data = await getWhitelist();
    return NextResponse.json(data);
  }

  if (action === 'approve') {
    await approvePending(email);
    const data = await getWhitelist();
    return NextResponse.json(data);
  }

  if (action === 'deny') {
    await denyPending(email);
    const data = await getWhitelist();
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
