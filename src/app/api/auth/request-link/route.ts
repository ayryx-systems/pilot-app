import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createMagicLinkToken, createApproveToken } from '@/lib/auth';
import { isEmailWhitelisted, addPendingRequest } from '@/lib/whitelistService';
import { checkRateLimit } from '@/lib/rateLimit';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 503 });
  }

  const ip = getClientIp(request);
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil((retryAfter ?? 3600) / 60)} minutes.` },
      { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
    );
  }

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_PILOT_APP_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_PILOT_APP_URL is not configured' },
        { status: 503 }
      );
    }

    const fromDomain = process.env.RESEND_FROM_DOMAIN ?? 'mail.ayryx.com';
    const resend = new Resend(apiKey);

    if (await isEmailWhitelisted(email)) {
      const token = createMagicLinkToken(email);
      const verifyUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/verify?token=${token}`;
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

      return NextResponse.json({ success: true, kind: 'magic_link' });
    }

    const { added, alreadyPending } = await addPendingRequest(email);
    if (alreadyPending) {
      return NextResponse.json(
        { success: true, kind: 'pending', message: 'Request already pending.' }
      );
    }

    if (!added) {
      return NextResponse.json(
        { error: 'Email not authorized. Contact your flight operations.' },
        { status: 403 }
      );
    }

    const approverEmails = process.env.APPROVER_EMAILS?.split(',').map((e) => e.trim()).filter(Boolean) ?? [];
    if (approverEmails.length === 0) {
      return NextResponse.json(
        { success: true, kind: 'pending', message: 'Request submitted. An approver will review it.' }
      );
    }

    const approveToken = createApproveToken(email);
    const approveUrl = `${baseUrl.replace(/\/$/, '')}/api/admin/approve?token=${approveToken}`;

    const { error } = await resend.emails.send({
      from: `AYRYX <noreply@${fromDomain}>`,
      to: approverEmails,
      subject: `AYRYX: Access request from ${email}`,
      html: `
        <p><strong>${email}</strong> has requested access to AYRYX.</p>
        <p><a href="${approveUrl}">Approve</a> — one click adds them to the whitelist.</p>
        <p>Or manage requests at <a href="${baseUrl}/admin">${baseUrl}/admin</a></p>
      `,
    });

    if (error) {
      console.error('[auth] Resend approver email error:', error);
    }

    return NextResponse.json({ success: true, kind: 'pending', message: 'Request submitted. An approver will review it.' });
  } catch (err) {
    console.error('[auth] request-link error:', err);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
