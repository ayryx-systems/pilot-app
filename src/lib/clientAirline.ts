const DEFAULT_FALLBACK = 'ein';

export function getAirlineFromLocation(): string {
  if (typeof window === 'undefined') return DEFAULT_FALLBACK;
  const hostname = window.location.hostname;
  const params = new URLSearchParams(window.location.search);

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return params.get('airline') || process.env.NEXT_PUBLIC_DEFAULT_AIRLINE || DEFAULT_FALLBACK;
  }
  if (hostname === 'pilot.ayryx.com') {
    return process.env.NEXT_PUBLIC_DEFAULT_AIRLINE || DEFAULT_FALLBACK;
  }
  if (hostname.endsWith('.ayryx.com')) {
    return hostname.split('.')[0] || process.env.NEXT_PUBLIC_DEFAULT_AIRLINE || DEFAULT_FALLBACK;
  }
  return process.env.NEXT_PUBLIC_DEFAULT_AIRLINE || DEFAULT_FALLBACK;
}

export function getRequestUrl(path: string): string {
  const airline = getAirlineFromLocation();
  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  if (isLocalhost) {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}airline=${encodeURIComponent(airline)}`;
  }
  return path;
}

export function getAirlineHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const airline = getAirlineFromLocation();
  return { 'X-Airline': airline };
}
