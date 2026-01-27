'use client';

import { TimezoneProvider } from '@/hooks/useTimezonePreference';

export function TimezoneProviderWrapper({ children }: { children: React.ReactNode }) {
  return <TimezoneProvider>{children}</TimezoneProvider>;
}
