import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createMagicLinkToken, createApproveToken } from '@/lib/auth';
import { isEmailWhitelisted, addPendingRequest } from '@/lib/whitelistService';
import { getAirlineConfig } from '@/lib/airlineConfig';
import { getAirline, getBaseUrl } from '@/lib/getAirline';
import { checkRateLimit } from '@/lib/rateLimit';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isValidBaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    if (u.hostname.endsWith('.ayryx.com')) return true;
    return false;
  } catch {
    return false;
  }
}

function resolveBaseUrl(request: NextRequest, bodyBaseUrl?: string): string {
  const candidates = [
    bodyBaseUrl,
    request.headers.get('origin'),
    request.headers.get('referer')?.replace(/\/[^/]*$/, ''),
    getBaseUrl(request),
  ].filter(Boolean) as string[];
  for (const url of candidates) {
    const u = url.replace(/\/$/, '');
    if (isValidBaseUrl(u)) return u;
  }
  return process.env.PILOT_APP_BASE_URL || 'https://pilot.ayryx.com';
}

export async function POST(request: NextRequest) {
  const airline = getAirline(request);

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
    const bodyBaseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : undefined;
    const baseUrl = resolveBaseUrl(request, bodyBaseUrl);
    const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
    if (isLocal) {
      return NextResponse.json(
        { error: 'Sign-in is disabled for local development. Use the deployed app (e.g. ein.ayryx.com) to sign in.' },
        { status: 400 }
      );
    }

    const fromDomain = process.env.RESEND_FROM_DOMAIN ?? 'mail.ayryx.com';
    const resend = new Resend(apiKey);

    const config = await getAirlineConfig(airline);
    const admins = config.adminEmails.map((e) => e.toLowerCase().trim());
    const isAdmin = admins.includes(email.toLowerCase());
    const whitelisted = await isEmailWhitelisted(airline, email);

    if (whitelisted || isAdmin) {
      const token = createMagicLinkToken(email);
      const verifyUrl = `${baseUrl.replace(/\/$/, '')}/api/auth/verify?token=${token}`;
      const { error } = await resend.emails.send({
        from: `AYRYX <noreply@${fromDomain}>`,
        to: email,
        subject: 'Sign in to AYRYX',
        html: `
          <p>Click the link below to sign in to AYRYX:</p>
          <p><a href="${verifyUrl}">Sign in to AYRYX</a></p>
          <p>This link is valid for 30 days. Need a new one? Just enter your email at the app and we'll send another.</p>
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

    const { added, alreadyPending } = await addPendingRequest(airline, email);
    const pendingMessage = 'This email address is not yet approved for AYRYX. A request for approval has been sent. Once approved, you can sign in anytime by entering your email here — we\'ll send you a link.';
    if (alreadyPending) {
      return NextResponse.json(
        { success: true, kind: 'pending', message: 'This email address is not yet approved. Your prior request is still pending. Once approved, you can sign in anytime by entering your email here — we\'ll send you a link.' }
      );
    }

    if (!added) {
      return NextResponse.json(
        { error: 'Email not authorized. Contact your flight operations.' },
        { status: 403 }
      );
    }

    const approverEmails = config.approverEmails;
    if (approverEmails.length === 0) {
      return NextResponse.json(
        { success: true, kind: 'pending', message: pendingMessage }
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

    return NextResponse.json({ success: true, kind: 'pending', message: pendingMessage });
  } catch (err) {
    console.error('[auth] request-link error:', err);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
