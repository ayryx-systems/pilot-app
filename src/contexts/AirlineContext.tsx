'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAirlineHeaders } from '@/lib/clientAirline';

export interface AirlineConfig {
  airline: string;
  email: string | null;
  isAdmin: boolean;
  features: Record<string, boolean>;
  logo: string | undefined;
  name: string | undefined;
  loading: boolean;
  configError: boolean;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = 'pilot_airline_config';

function getCachedConfig(): Omit<AirlineConfig, 'refresh'> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      airline: typeof parsed.airline === 'string' ? parsed.airline : 'ein',
      email: typeof parsed.email === 'string' ? parsed.email : null,
      isAdmin: Boolean(parsed.isAdmin),
      features: typeof parsed.features === 'object' && parsed.features ? (parsed.features as Record<string, boolean>) : {},
      logo: typeof parsed.logo === 'string' ? parsed.logo : undefined,
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      loading: false,
      configError: false,
    };
  } catch {
    return null;
  }
}

function setCachedConfig(data: { airline: string; email: string | null; isAdmin: boolean; features: Record<string, boolean>; logo?: string; name?: string }) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      airline: data.airline,
      email: data.email,
      isAdmin: data.isAdmin,
      features: data.features,
      logo: data.logo,
      name: data.name,
    }));
  } catch {
    // ignore storage errors
  }
}

const defaultConfig: AirlineConfig = {
  airline: 'ein',
  email: null,
  isAdmin: false,
  features: {},
  logo: undefined,
  name: undefined,
  loading: true,
  configError: false,
  refresh: async () => {},
};

const AirlineContext = createContext<AirlineConfig>(defaultConfig);

const RETRY_DELAYS_MS = [0, 1000, 2000];

export function AirlineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AirlineConfig, 'refresh'>>({
    ...defaultConfig,
    configError: false,
  });

  const refresh = useCallback(async () => {
    for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: getAirlineHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          const next = {
            airline: data.airline ?? 'ein',
            email: data.email ?? null,
            isAdmin: data.isAdmin ?? false,
            features: data.features ?? {},
            logo: data.logo,
            name: data.name,
            loading: false,
            configError: false,
          };
          setState(next);
          setCachedConfig(next);
          return;
        }
        if (res.status === 503) {
          const cached = getCachedConfig();
          if (cached) {
            setState(cached);
          } else {
            setState((prev) => ({ ...prev, loading: false, configError: true }));
          }
          return;
        }
      } catch {
        // retry on next iteration
      }
    }
    const cached = getCachedConfig();
    if (cached) {
      setState(cached);
    } else {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refresh]);

  return (
    <AirlineContext.Provider value={{ ...state, refresh }}>
      {children}
    </AirlineContext.Provider>
  );
}

export function useAirline(): AirlineConfig {
  const ctx = useContext(AirlineContext);
  return ctx ?? defaultConfig;
}
