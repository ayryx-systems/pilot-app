'use client';

import { LogOut } from 'lucide-react';

export function ConfigUnavailableScreen() {
  return (
    <div className="min-h-dvh bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-xl font-semibold text-slate-100">Service temporarily unavailable</h1>
        <p className="text-slate-400 text-sm">
          Configuration could not be loaded. Please try again later.
        </p>
        <a
          href="/api/auth/signout"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </a>
      </div>
    </div>
  );
}
