import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { verifySessionCookie, createMagicLinkToken } from '@/lib/auth';
import { getAirlineConfig, S3ConfigError } from '@/lib/airlineConfig';
import { getWhitelist, addToWhitelist, removeFromWhitelist, approvePending, denyPending, isEmailWhitelisted, S3WhitelistError } from '@/lib/whitelistService';
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
  let config;
  try {
    config = await getAirlineConfig(airline);
  } catch (err) {
    if (err instanceof S3ConfigError) {
      return NextResponse.json({ error: 'Configuration unavailable. Please try again later.' }, { status: 503 });
    }
    throw err;
  }
  const admins = config.adminEmails.map((e) => e.toLowerCase().trim());
  if (!admins.includes(email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { email, airline };
}

function handleS3Error(err: unknown): NextResponse | null {
  if (err instanceof S3ConfigError || err instanceof S3WhitelistError) {
    return NextResponse.json({ error: 'Service temporarily unavailable. Please try again later.' }, { status: 503 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  try {
    const data = await getWhitelist(admin.airline);
    return NextResponse.json({ ...data, airline: admin.airline });
  } catch (err) {
    const s3 = handleS3Error(err);
    if (s3) return s3;
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const { airline } = admin;
  const body = await request.json();
  const bodyBaseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : undefined;
  const baseUrl = resolveBaseUrl(request, bodyBaseUrl, airline);
  const action = body.action as string;
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
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
        const airlineMention = airline === 'ein' ? '<p><em>This is for Aer Lingus.</em></p>' : '';
        await resend.emails.send({
          from: `AYRYX <noreply@${fromDomain}>`,
          to: email,
          subject: airline === 'ein' ? "You're approved for AYRYX (Aer Lingus)" : "You're approved for AYRYX",
          html: `
            ${airlineMention}
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
      const airlineMention = airline === 'ein' ? '<p><em>This link is for Aer Lingus.</em></p>' : '';
      const { error } = await resend.emails.send({
        from: `AYRYX <noreply@${fromDomain}>`,
        to: email,
        subject: airline === 'ein' ? 'Sign in to AYRYX (Aer Lingus)' : 'Sign in to AYRYX',
        html: `
          ${airlineMention}
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
  } catch (err) {
    const s3 = handleS3Error(err);
    if (s3) return s3;
    throw err;
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
