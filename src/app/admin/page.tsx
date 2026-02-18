'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Trash2, Check, X, ArrowLeft, Mail } from 'lucide-react';
import { getAirlineHeaders } from '@/lib/clientAirline';

interface WhitelistData {
  emails: string[];
  pending: { email: string; requestedAt: string }[];
}

function AdminContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<WhitelistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [sendLinkOnAdd, setSendLinkOnAdd] = useState(true);
  const [adding, setAdding] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const approved = searchParams.get('approved');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/whitelist', { headers: getAirlineHeaders() });
      if (!res.ok) throw new Error(res.status === 403 ? 'Access denied' : 'Failed to load');
      setData(await res.json());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;
    setAdding(true);
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      const headers = { ...getAirlineHeaders(), 'Content-Type': 'application/json' };
      let res = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'add', email, baseUrl }),
      });
      if (!res.ok) throw new Error('Failed to add');
      setError('');
      let updated = await res.json();
      if (sendLinkOnAdd) {
        res = await fetch('/api/admin/whitelist', {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'send_link', email, baseUrl }),
        });
        if (!res.ok) setError('Added but failed to send link');
        else { updated = await res.json(); setError(''); }
      } else setError('');
      setData(updated);
      setNewEmail('');
    } catch {
      setError('Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const handleAction = async (action: 'remove' | 'approve' | 'approve_send' | 'deny' | 'send_link', email: string) => {
    setActioning(email);
    try {
      const headers = { ...getAirlineHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, email, baseUrl: typeof window !== 'undefined' ? window.location.origin : undefined }),
      });
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      setError(`Failed to ${action}`);
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-red-400">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/" className="text-slate-400 hover:text-slate-200 text-sm">Back to app</Link>
            <a href="/api/auth/signout" className="text-slate-400 hover:text-slate-200 text-sm">Sign out</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-900">
      <header className="border-b border-slate-700/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-200 p-1 -ml-1 rounded">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-slate-100">Access</h1>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-8">
        {approved && (
          <div className="p-4 rounded-xl bg-emerald-900/30 border border-emerald-700/50 text-emerald-200 text-sm">
            <strong>{approved}</strong> has been approved.
          </div>
        )}

        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Add</h2>
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                disabled={adding}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:opacity-50"
              />
              <button
              type="submit"
              disabled={adding}
              className="px-4 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-100 font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <UserPlus size={18} />
              {adding ? 'Adding...' : 'Add'}
            </button>
            </div>
            <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={sendLinkOnAdd}
                onChange={(e) => setSendLinkOnAdd(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800"
              />
              Send sign-in link after adding
            </label>
          </form>
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Whitelist ({data?.emails.length ?? 0})
          </h2>
          <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-800/30">
            {data?.emails.length ? (
              <ul className="divide-y divide-slate-700/50">
                {data.emails.map((email) => (
                  <li key={email} className="flex items-center justify-between px-4 py-3 gap-2">
                    <span className="text-slate-200 text-sm font-mono truncate min-w-0 flex-1">{email}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAction('send_link', email)}
                        disabled={actioning === email}
                        className="px-2 py-1 rounded text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm"
                        title="Send sign-in link"
                      >
                        <Mail size={14} />
                        Send link
                      </button>
                      <button
                        onClick={() => handleAction('remove', email)}
                        disabled={actioning === email}
                        className="px-2 py-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">No emails yet</div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Pending ({data?.pending.length ?? 0})
          </h2>
          <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-800/30">
            {data?.pending.length ? (
              <ul className="divide-y divide-slate-700/50">
                {data.pending.map(({ email, requestedAt }) => (
                  <li key={email} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-200 text-sm font-mono block truncate">{email}</span>
                      <span className="text-slate-500 text-xs">
                        {new Date(requestedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAction('approve_send', email)}
                        disabled={actioning === email}
                        className="px-2.5 py-1 rounded text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium"
                        title="Approve and send sign-in link"
                      >
                        <Mail size={14} />
                        Approve & send link
                      </button>
                      <button
                        onClick={() => handleAction('approve', email)}
                        disabled={actioning === email}
                        className="px-2 py-1 rounded text-slate-400 hover:bg-slate-700/50 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm"
                        title="Approve only (no email)"
                      >
                        <Check size={14} />
                        Approve only
                      </button>
                      <button
                        onClick={() => handleAction('deny', email)}
                        disabled={actioning === email}
                        className="px-2 py-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm"
                        title="Deny"
                      >
                        <X size={14} />
                        Deny
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">No pending requests</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    }>
      <AdminContent />
    </Suspense>
  );
}
