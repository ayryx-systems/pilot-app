'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Trash2, Check, X, ArrowLeft } from 'lucide-react';

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
  const [adding, setAdding] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const approved = searchParams.get('approved');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/whitelist');
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
      const res = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', email }),
      });
      if (!res.ok) throw new Error('Failed to add');
      const updated = await res.json();
      setData(updated);
      setNewEmail('');
    } catch {
      setError('Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const handleAction = async (action: 'remove' | 'approve' | 'deny', email: string) => {
    setActioning(email);
    try {
      const res = await fetch('/api/admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email }),
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
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/" className="text-slate-400 hover:text-slate-200 text-sm">Back to app</Link>
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
          <form onSubmit={handleAdd} className="flex gap-2">
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
                  <li key={email} className="flex items-center justify-between px-4 py-3">
                    <span className="text-slate-200 text-sm font-mono">{email}</span>
                    <button
                      onClick={() => handleAction('remove', email)}
                      disabled={actioning === email}
                      className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
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
                  <li key={email} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-200 text-sm font-mono block truncate">{email}</span>
                      <span className="text-slate-500 text-xs">
                        {new Date(requestedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleAction('approve', email)}
                        disabled={actioning === email}
                        className="p-1.5 rounded text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                        title="Approve"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => handleAction('deny', email)}
                        disabled={actioning === email}
                        className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        title="Deny"
                      >
                        <X size={18} />
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
