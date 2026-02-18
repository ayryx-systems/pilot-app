import { createHmac } from 'crypto';

const MAGIC_LINK_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters');
  }
  return secret;
}

export function createMagicLinkToken(email: string): string {
  const exp = Date.now() + MAGIC_LINK_EXPIRY_MS;
  const payload = JSON.stringify({ email: email.toLowerCase().trim(), exp, t: 'magic' });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function consumeMagicLinkToken(token: string): string | null {
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  try {
    const expectedSig = createHmac('sha256', getSecret()).update(encoded).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (payload.t !== 'magic' || !payload.email) return null;
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload.email;
  } catch {
    return null;
  }
}

export function createApproveToken(email: string): string {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ email: email.toLowerCase().trim(), exp, t: 'approve' });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function consumeApproveToken(token: string): string | null {
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  try {
    const expectedSig = createHmac('sha256', getSecret()).update(encoded).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (payload.t !== 'approve' || !payload.email) return null;
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload.email;
  } catch {
    return null;
  }
}

export function createSessionCookie(email: string): { name: string; value: string; options: Record<string, unknown> } {
  const payload = JSON.stringify({ email, exp: Date.now() + SESSION_COOKIE_MAX_AGE * 1000 });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  return {
    name: 'pilot_session',
    value: `${encoded}.${sig}`,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: '/',
    },
  };
}

export function verifySessionCookie(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const [encoded, sig] = cookieValue.split('.');
  if (!encoded || !sig) return null;
  try {
    const expectedSig = createHmac('sha256', getSecret()).update(encoded).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload.email ?? null;
  } catch {
    return null;
  }
}
