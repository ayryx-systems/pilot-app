const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return '';
  }
  return secret;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  return atob(padded);
}

export async function verifySessionCookie(cookieValue: string | undefined): Promise<string | null> {
  if (!cookieValue) return null;
  const [encoded, sig] = cookieValue.split('.');
  if (!encoded || !sig) return null;

  const secret = getSecret();
  if (!secret) return null;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expectedSigBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(encoded)
    );
    const expectedSig = arrayBufferToBase64Url(expectedSigBuffer);
    if (sig !== expectedSig) return null;

    const json = base64UrlDecode(encoded);
    const payload = JSON.parse(json) as { email?: string; exp?: number };
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload.email ?? null;
  } catch {
    return null;
  }
}
