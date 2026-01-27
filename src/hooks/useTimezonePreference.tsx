'use client';

import React, { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';

export type TimezonePreference = 'local' | 'utc';

const STORAGE_KEY = 'pilotApp_timezonePreference';

interface TimezoneContextType {
  preference: TimezonePreference;
  isUTC: boolean;
  isLocal: boolean;
  togglePreference: () => void;
  setPreference: (value: TimezonePreference) => void;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<TimezonePreference>(() => {
    if (typeof window === 'undefined') {
      return 'local';
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'utc' || saved === 'local') {
      return saved;
    }
    return 'local';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, preference);
    }
  }, [preference]);

  const togglePreference = useCallback(() => {
    setPreference(prev => prev === 'local' ? 'utc' : 'local');
  }, []);

  const setPreferenceValue = useCallback((value: TimezonePreference) => {
    setPreference(value);
  }, []);

  const contextValue = useMemo(() => ({
    preference,
    isUTC: preference === 'utc',
    isLocal: preference === 'local',
    togglePreference,
    setPreference: setPreferenceValue,
  }), [preference, togglePreference, setPreferenceValue]);

  return (
    <TimezoneContext.Provider value={contextValue}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezonePreference() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezonePreference must be used within a TimezoneProvider');
  }
  return context;
}
