import { createHmac, randomBytes } from 'crypto';

const MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000;
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const tokenStore = new Map<string, { email: string; expiresAt: number }>();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters');
  }
  return secret;
}

export function createMagicLinkToken(email: string): string {
  const token = randomBytes(32).toString('hex');
  tokenStore.set(token, {
    email: email.toLowerCase().trim(),
    expiresAt: Date.now() + MAGIC_LINK_EXPIRY_MS,
  });
  return token;
}

export function consumeMagicLinkToken(token: string): string | null {
  const entry = tokenStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(token);
    return null;
  }
  tokenStore.delete(token);
  return entry.email;
}

export function isEmailWhitelisted(email: string): boolean {
  const list = process.env.EMAIL_WHITELIST?.toLowerCase().split(',').map((e) => e.trim()) ?? [];
  return list.includes(email.toLowerCase().trim());
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
