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
  const { preference, togglePreference } = useTimezonePreference();

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

  return (
    <div className="flex items-center gap-2 text-xs text-gray-300">
      <div className="flex items-center gap-1">
        <span className="text-gray-400">{airportCode}:</span>
        <span className="font-mono font-medium">{formatAirportLocalTime(currentTime)}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-400">UTC:</span>
        <span className="font-mono font-medium">{formatUTCTime(currentTime)}</span>
      </div>
      <button
        onClick={togglePreference}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors hover:bg-slate-700/50"
        title={`Display times in ${preference === 'local' ? 'UTC' : 'Local'} (currently showing ${preference === 'local' ? 'Local' : 'UTC'})`}
        style={{
          backgroundColor: preference === 'utc' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
          border: `1px solid ${preference === 'utc' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(148, 163, 184, 0.3)'}`,
          color: preference === 'utc' ? '#93c5fd' : '#cbd5e1',
        }}
      >
        <Globe className="w-3 h-3" />
        <span>{preference === 'utc' ? 'UTC' : 'Local'}</span>
      </button>
    </div>
  );
}
