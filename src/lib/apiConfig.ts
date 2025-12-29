/**
 * API Configuration Utility
 * ==========================
 * 
 * Provides runtime detection of API base URL to avoid localhost hardcoding
 * which triggers browser local network permission prompts in production.
 */

/**
 * Get the API base URL, detecting the current hostname at runtime
 * Falls back to environment variable or localhost only for local development
 */
export function getApiBaseUrl(): string {
  // Check if we have an environment variable set (preferred)
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  // If running in browser, detect current hostname
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    
    // For localhost, use port 3001 (local development)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:3001`;
    }
    
    // For deployed environments, use same hostname (backend should be on same domain)
    // If backend is on different domain, set NEXT_PUBLIC_API_BASE_URL env var
    return `${protocol}//${hostname}`;
  }

  // Server-side fallback (shouldn't happen for client-side services, but just in case)
  return 'http://localhost:3001';
}

