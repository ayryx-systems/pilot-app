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

export function AirlineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AirlineConfig, 'refresh'>>({
    ...defaultConfig,
    configError: false,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAirlineHeaders(),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setState({
          airline: data.airline ?? 'ein',
          email: data.email ?? null,
          isAdmin: data.isAdmin ?? false,
          features: data.features ?? {},
          logo: data.logo,
          name: data.name,
          loading: false,
          configError: false,
        });
      } else if (res.status === 503) {
        setState((prev) => ({ ...prev, loading: false, configError: true }));
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
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
