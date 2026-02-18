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
  refresh: async () => {},
};

const AirlineContext = createContext<AirlineConfig>(defaultConfig);

export function AirlineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AirlineConfig, 'refresh'>>({
    ...defaultConfig,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { headers: getAirlineHeaders() });
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
        });
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
