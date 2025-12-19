'use client';

import React, { useState, useEffect } from 'react';
import { getCurrentUTCTime, utcToAirportLocal } from '@/utils/airportTime';
import { BaselineData } from '@/types';

interface ClockDisplayProps {
  airportCode?: string | null;
  baseline?: BaselineData | null;
}

export function ClockDisplay({ airportCode, baseline }: ClockDisplayProps) {
  const [currentTime, setCurrentTime] = useState(getCurrentUTCTime());

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
    return `${hours}:${minutes}:${seconds}`;
  };

  if (!airportCode) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-300">
      <div className="flex items-center gap-1">
        <span className="text-gray-400">Local:</span>
        <span className="font-mono font-medium">{formatAirportLocalTime(currentTime)}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-400">UTC:</span>
        <span className="font-mono font-medium">{formatUTCTime(currentTime)}</span>
      </div>
    </div>
  );
}
