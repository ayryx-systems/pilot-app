'use client';

import { useState, useEffect, useCallback } from 'react';

export type TimezonePreference = 'local' | 'utc';

const STORAGE_KEY = 'pilotApp_timezonePreference';

export function useTimezonePreference() {
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

  return {
    preference,
    isUTC: preference === 'utc',
    isLocal: preference === 'local',
    togglePreference,
    setPreference: setPreferenceValue,
  };
}
