'use client';

import React, { useState, useEffect } from 'react';
import { getCurrentUTCTime, utcToAirportLocal } from '@/utils/airportTime';
import { BaselineData } from '@/types';
import { useTimezonePreference } from '@/hooks/useTimezonePreference';
import { Globe } from 'lucide-react';

interface ClockDisplayProps {
  airportCode?: string | null;
  baseline?: BaselineData | null;
}

export function ClockDisplay({ airportCode, baseline }: ClockDisplayProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentUTCTime());
  const { preference, togglePreference, isUTC } = useTimezonePreference();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentUTCTime());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatAirportLocalTime = (utcDate: Date): string => {
    if (!airportCode) return '--:--:--';
    
    const localDate = utcToAirportLocal(utcDate, airportCode, baseline);
    const hours = localDate.getUTCHours().toString().padStart(2, '0');
    const minutes = localDate.getUTCMinutes().toString().padStart(2, '0');
    const seconds = localDate.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatUTCTime = (date: Date): string => {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}Z`;
  };

  if (!airportCode) {
    return null;
  }

  const displayedTime = isUTC ? formatUTCTime(currentTime) : formatAirportLocalTime(currentTime);
  const timezoneLabel = isUTC ? 'UTC' : airportCode;

  return (
    <button
      onClick={togglePreference}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all hover:bg-slate-700/50 active:bg-slate-700/70 border border-slate-600/50 hover:border-slate-500/70"
      title={`Click to switch to ${isUTC ? 'local time' : 'UTC'} (currently showing ${isUTC ? 'UTC' : 'local time'})`}
    >
      <span className="font-mono font-semibold text-gray-200">{displayedTime}</span>
      <span className="text-gray-400 font-normal">({timezoneLabel})</span>
      <Globe className="w-3 h-3 text-gray-400 flex-shrink-0" />
    </button>
  );
}
