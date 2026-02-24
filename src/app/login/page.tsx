'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getRequestUrl, getAirlineHeaders, getAirlineFromLocation } from '@/lib/clientAirline';
import { useAirline } from '@/contexts/AirlineContext';

const DEFAULT_EIN_DOMAINS = ['aerlingus.com', 'ayryx.com'];

function LoginForm() {
  const [mounted, setMounted] = useState(false);
  const isEin = mounted && getAirlineFromLocation() === 'ein';
  const { logo: airlineLogo } = useAirline();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [successKind, setSuccessKind] = useState<'magic_link' | 'pending'>('magic_link');
  const [successMessage, setSuccessMessage] = useState('');
  const [code, setCode] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [codeError, setCodeError] = useState('');
  const [einDomains, setEinDomains] = useState<string[]>(DEFAULT_EIN_DOMAINS);
  const [einDomain, setEinDomain] = useState(DEFAULT_EIN_DOMAINS[0]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isEin) return;
    const url = getRequestUrl('/api/auth/domains');
    fetch(url, { headers: getAirlineHeaders() })
      .then((res) => res.json())
      .then((data: { domains?: string[] }) => {
        const list = data.domains?.length ? data.domains : DEFAULT_EIN_DOMAINS;
        setEinDomains(list);
        setEinDomain((prev) => (list.includes(prev) ? prev : list[0]));
      })
      .catch(() => {});
  }, [isEin]);

  const errorParam = searchParams.get('error');
  const initialError = errorParam === 'expired'
    ? 'Your sign-in link expired. Please request a new one.'
    : errorParam === 'invalid'
      ? 'Invalid or expired link. Please request a new sign-in link.'
      : errorParam === 'unavailable'
        ? 'Service temporarily unavailable. Please try again later.'
        : '';

  const normalizeEmail = (val: string): string => {
    const trimmed = val.trim();
    if (!trimmed) return '';
    if (isEin && !trimmed.includes('@')) {
      return `${trimmed}@${einDomain}`;
    }
    return trimmed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullEmail = normalizeEmail(email);
    if (!fullEmail) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const url = getRequestUrl('/api/auth/request-link');
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...getAirlineHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fullEmail,
          baseUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error || 'Something went wrong');
        return;
      }

      setStatus('success');
      setSuccessKind((data.kind as 'magic_link' | 'pending') || 'magic_link');
      setSuccessMessage(data.message);
      setEmail('');
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length !== 6) {
      setCodeError('Enter a 6-digit code');
      setCodeStatus('error');
      return;
    }
    setCodeStatus('loading');
    setCodeError('');
    try {
      const url = getRequestUrl('/api/auth/verify-code');
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...getAirlineHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeStatus('error');
        setCodeError(data.error || 'Invalid or expired code');
        return;
      }
      window.location.href = '/';
    } catch {
      setCodeStatus('error');
      setCodeError('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-800 border border-slate-700 shadow-xl p-8">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={airlineLogo || '/icons/icon-192x192.png'}
            alt="Logo"
            className="h-8 sm:h-10 w-auto mx-auto mb-4"
          />
          <p className="text-slate-400 text-sm">Enter your email to sign in or request access</p>
        </div>

        {initialError && (
          <div className="mb-6 p-4 rounded-lg bg-amber-900/30 border border-amber-700/50 text-amber-200 text-sm">
            {initialError}
          </div>
        )}

        {status === 'success' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-900/30 border border-emerald-700/50 text-emerald-200 text-sm">
              {successKind === 'magic_link'
                ? 'Check your email. Enter the 6-digit code below to sign in. Don\'t see it? Check your spam folder.'
                : successMessage || 'Request submitted. An approver will review it.'}
            </div>
            <button
              type="button"
              onClick={() => { setStatus('idle'); setErrorMsg(''); setSuccessKind('magic_link'); setSuccessMessage(''); }}
              className="w-full py-2.5 text-slate-300 hover:text-slate-100 text-sm"
            >
              {successKind === 'magic_link' ? 'Send another code' : 'Submit another request'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              {isEin ? (
                <div className="flex rounded-lg bg-slate-700/50 border border-slate-600 overflow-hidden focus-within:ring-2 focus-within:ring-slate-500 focus-within:border-transparent">
                  <input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (v.includes('@')) {
                          const atIdx = v.indexOf('@');
                          const local = v.slice(0, atIdx);
                          const domain = v.slice(atIdx + 1).toLowerCase();
                          if (einDomains.includes(domain)) {
                            setEmail(local);
                            setEinDomain(domain);
                          } else {
                            setEmail(v.replace(/@.*$/, ''));
                          }
                        } else {
                          setEmail(v);
                        }
                      }}
                    placeholder="firstname.lastname"
                    required
                    autoComplete="email"
                    disabled={status === 'loading'}
                    className="flex-1 min-w-0 px-4 py-3 bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
                  />
                  <select
                    value={einDomain}
                    onChange={(e) => setEinDomain(e.target.value)}
                    disabled={status === 'loading'}
                    className="px-4 py-3 pr-8 text-slate-300 bg-slate-700/80 border-l border-slate-600 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {einDomains.map((d) => (
                      <option key={d} value={d}>
                        @{d}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@airline.com"
                  required
                  autoComplete="email"
                  disabled={status === 'loading'}
                  className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:opacity-50"
                />
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-200 text-sm">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3 px-4 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'loading' ? 'Sending...' : 'Send sign-in code'}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-700">
          <p className="text-slate-400 text-sm mb-2">Have a code? Enter it here</p>
          <form onSubmit={handleCodeSubmit} className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setCodeError('');
              }}
              placeholder="000000"
              disabled={codeStatus === 'loading'}
              className="flex-1 px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:opacity-50 text-center text-lg tracking-widest font-mono"
            />
            <button
              type="submit"
              disabled={codeStatus === 'loading' || code.length !== 6}
              className="py-3 px-5 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {codeStatus === 'loading' ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          {codeError && (
            <p className="mt-2 text-red-400 text-sm">{codeError}</p>
          )}
        </div>

        <p className="mt-8 text-center text-slate-500 text-xs">
          Having trouble? Contact your flight operations or <a href="mailto:support@ayryx.com" className="text-slate-400 hover:text-slate-300 underline">AYRYX support at support@ayryx.com</a>.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
