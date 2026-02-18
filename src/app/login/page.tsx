'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [successKind, setSuccessKind] = useState<'magic_link' | 'pending'>('magic_link');
  const [successMessage, setSuccessMessage] = useState('');

  const errorParam = searchParams.get('error');
  const initialError = errorParam === 'expired' 
    ? 'Your sign-in link expired. Please request a new one.'
    : errorParam === 'invalid'
    ? 'Invalid or expired link. Please request a new sign-in link.'
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
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

  return (
    <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-800 border border-slate-700 shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-slate-100 mb-1">AYRYX</h1>
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
                ? 'Check your email. Click the link to sign in. It\'s valid for 30 days. Don\'t see it? Check your spam folder.'
                : successMessage || 'Request submitted. An approver will review it.'}
            </div>
            <button
              type="button"
              onClick={() => { setStatus('idle'); setErrorMsg(''); setSuccessKind('magic_link'); setSuccessMessage(''); }}
              className="w-full py-2.5 text-slate-300 hover:text-slate-100 text-sm"
            >
              {successKind === 'magic_link' ? 'Send another link' : 'Submit another request'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
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
              {status === 'loading' ? 'Sending...' : 'Send sign-in link'}
            </button>
          </form>
        )}

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
