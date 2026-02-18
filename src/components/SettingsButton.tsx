'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Settings, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useAirline } from '@/contexts/AirlineContext';

export function SettingsButton() {
  const { email, isAdmin } = useAirline();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  if (!email) return null;

  return (
    <div className="relative flex-shrink-0" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
        aria-label="Settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 py-1 rounded-lg bg-slate-800 border border-slate-600 shadow-xl min-w-[180px] z-[6000]">
          <div className="px-3 py-2 border-b border-slate-600">
            <p className="text-slate-400 text-xs">Signed in as</p>
            <p className="text-slate-200 text-sm truncate" title={email}>
              {email}
            </p>
          </div>
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700/50 text-sm"
              onClick={() => setOpen(false)}
            >
              Manage access
            </Link>
          )}
          <a
            href="/api/auth/signout"
            className="flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-700/50 text-sm"
            onClick={() => setOpen(false)}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </a>
        </div>
      )}
    </div>
  );
}
