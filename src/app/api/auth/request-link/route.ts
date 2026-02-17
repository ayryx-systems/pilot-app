import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import {
  isEmailWhitelisted,
  createMagicLinkToken,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 503 });
  }

  try {
    const resend = new Resend(apiKey);
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!isEmailWhitelisted(email)) {
      return NextResponse.json(
        { error: 'Email not authorized. Contact your flight operations.' },
        { status: 403 }
      );
    }

    const token = createMagicLinkToken(email);
    const baseUrl = process.env.NEXT_PUBLIC_PILOT_APP_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_PILOT_APP_URL is not configured' },
        { status: 503 }
      );
    }
    const verifyUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/verify?token=${token}`;

    const fromDomain = process.env.RESEND_FROM_DOMAIN ?? 'mail.ayryx.com';
    const { error } = await resend.emails.send({
      from: `AYRYX <noreply@${fromDomain}>`,
      to: email,
      subject: 'Sign in to AYRYX',
      html: `
        <p>Click the link below to sign in to AYRYX:</p>
        <p><a href="${verifyUrl}">Sign in to AYRYX</a></p>
        <p>This link expires in 15 minutes.</p>
        <p>If you didn't request this, you can ignore this email.</p>
      `,
    });

    if (error) {
      console.error('[auth] Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[auth] request-link error:', err);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
