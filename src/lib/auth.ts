import { createHmac } from 'crypto';
import { randomInt } from 'crypto';

const MAGIC_LINK_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const MAGIC_CODE_EXPIRY_MS = 15 * 60 * 1000;
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type CodeEntry = { email: string; exp: number };
const magicCodeStore = new Map<string, CodeEntry>();

function pruneExpiredCodes(): void {
  const now = Date.now();
  for (const [code, entry] of magicCodeStore.entries()) {
    if (now > entry.exp) magicCodeStore.delete(code);
  }
}

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

export function createMagicCode(email: string): string {
  pruneExpiredCodes();
  const normalized = email.toLowerCase().trim();
  for (let i = 0; i < 10; i++) {
    const code = randomInt(100000, 999999).toString();
    if (magicCodeStore.has(code)) continue;
    magicCodeStore.set(code, { email: normalized, exp: Date.now() + MAGIC_CODE_EXPIRY_MS });
    return code;
  }
  const code = randomInt(100000, 999999).toString();
  magicCodeStore.set(code, { email: normalized, exp: Date.now() + MAGIC_CODE_EXPIRY_MS });
  return code;
}

export function consumeMagicCode(code: string): string | null {
  const trimmed = code.replace(/\D/g, '');
  if (trimmed.length !== 6) return null;
  const entry = magicCodeStore.get(trimmed);
  if (!entry || Date.now() > entry.exp) return null;
  magicCodeStore.delete(trimmed);
  return entry.email;
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

export function createSessionCookie(
  email: string,
  overrides?: { domain?: string }
): { name: string; value: string; options: Record<string, unknown> } {
  const payload = JSON.stringify({ email, exp: Date.now() + SESSION_COOKIE_MAX_AGE * 1000 });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = createHmac('sha256', getSecret()).update(encoded).digest('base64url');
  const options: Record<string, unknown> = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: '/',
  };
  if (overrides?.domain) options.domain = overrides.domain;
  return { name: 'pilot_session', value: `${encoded}.${sig}`, options };
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
