'use client';

import React, { useState, useEffect } from 'react';
import { getCurrentUTCTime, utcToAirportLocal } from '@/utils/airportTime';
import { BaselineData } from '@/types';
import { useTimezonePreference } from '@/hooks/useTimezonePreference';

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

  const utcTime = formatUTCTime(currentTime);
  const localTime = formatAirportLocalTime(currentTime);

  return (
    <div className="flex items-center gap-2">
      <div className="font-mono font-semibold text-gray-200 text-xs">
        {isUTC ? utcTime : localTime}
      </div>
      
      <button
        onClick={togglePreference}
        className="relative inline-flex items-center rounded-md bg-slate-700/50 border border-slate-600/50 hover:border-slate-500/70 p-0.5 transition-all cursor-pointer"
        title={`Click to switch to ${isUTC ? 'local time' : 'UTC'}`}
        aria-label={`Switch to ${isUTC ? 'local time' : 'UTC'}`}
      >
        <div className="relative flex">
          <div 
            className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-blue-600 rounded transition-all duration-200 ease-in-out ${
              isUTC ? 'left-0.5' : 'right-0.5'
            }`}
          />
          <div className="relative flex items-center">
            <span className={`px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap ${
              isUTC ? 'text-white' : 'text-gray-400'
            }`}>
              UTC
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap ${
              !isUTC ? 'text-white' : 'text-gray-400'
            }`}>
              {airportCode}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}
