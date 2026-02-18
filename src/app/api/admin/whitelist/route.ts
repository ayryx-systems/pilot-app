import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { verifySessionCookie, createMagicLinkToken } from '@/lib/auth';
import { getAirlineConfig } from '@/lib/airlineConfig';
import { getWhitelist, addToWhitelist, removeFromWhitelist, approvePending, denyPending, isEmailWhitelisted } from '@/lib/whitelistService';
import { getAirline, resolveBaseUrl } from '@/lib/getAirline';

async function requireAdmin(request: NextRequest): Promise<{ email: string; airline: string } | NextResponse> {
  const airline = getAirline(request);
  const sessionCookie = request.cookies.get('pilot_session');
  if (!sessionCookie?.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const email = verifySessionCookie(sessionCookie.value);
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const config = await getAirlineConfig(airline);
  const admins = config.adminEmails.map((e) => e.toLowerCase().trim());
  if (!admins.includes(email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { email, airline };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const data = await getWhitelist(admin.airline);
  return NextResponse.json({ ...data, airline: admin.airline });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { airline } = admin;
  const body = await request.json();
  const bodyBaseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : undefined;
  const baseUrl = resolveBaseUrl(request, bodyBaseUrl);
  const action = body.action as string;
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  if (action === 'add') {
    await addToWhitelist(airline, email);
    const data = await getWhitelist(airline);
    return NextResponse.json({ ...data, airline });
  }

  if (action === 'remove') {
    await removeFromWhitelist(airline, email);
    const data = await getWhitelist(airline);
    return NextResponse.json({ ...data, airline });
  }

  if (action === 'approve') {
    await approvePending(airline, email);
    const data = await getWhitelist(airline);
    return NextResponse.json({ ...data, airline });
  }

  if (action === 'approve_send') {
    await approvePending(airline, email);
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const token = createMagicLinkToken(email);
      const verifyUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/verify?token=${token}&redirect=${encodeURIComponent(baseUrl)}`;
      const fromDomain = process.env.RESEND_FROM_DOMAIN ?? 'mail.ayryx.com';
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: `AYRYX <noreply@${fromDomain}>`,
        to: email,
        subject: "You're approved for AYRYX",
        html: `
            <p>You've been approved for AYRYX. Click the link below to sign in:</p>
            <p><a href="${verifyUrl}">Sign in to AYRYX</a></p>
            <p>Once approved, you can always sign in by going to the app and entering your email — we'll send you a new link whenever you need one.</p>
          `,
      });
    }
    const data = await getWhitelist(airline);
    return NextResponse.json({ ...data, airline });
  }

  if (action === 'deny') {
    await denyPending(airline, email);
    const data = await getWhitelist(airline);
    return NextResponse.json({ ...data, airline });
  }

  if (action === 'send_link') {
    if (!(await isEmailWhitelisted(airline, email))) {
      return NextResponse.json({ error: 'Email must be on whitelist' }, { status: 400 });
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 503 });
    }
    const token = createMagicLinkToken(email);
    const verifyUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/verify?token=${token}&redirect=${encodeURIComponent(baseUrl)}`;
    const fromDomain = process.env.RESEND_FROM_DOMAIN ?? 'mail.ayryx.com';
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `AYRYX <noreply@${fromDomain}>`,
      to: email,
      subject: 'Sign in to AYRYX',
      html: `
        <p>Click the link below to sign in to AYRYX:</p>
        <p><a href="${verifyUrl}">Sign in to AYRYX</a></p>
        <p>This link is valid for 30 days. Need a new one? Just enter your email at the app and we'll send another.</p>
      `,
    });
    if (error) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
    const data = await getWhitelist(airline);
    return NextResponse.json({ ...data, airline });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
