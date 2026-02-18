const MAX_REQUESTS_PER_HOUR = 20;
const WINDOW_MS = 60 * 60 * 1000;

const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  let entry = store.get(identifier);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(identifier, entry);
    return { allowed: true };
  }
  if (entry.count >= MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}
