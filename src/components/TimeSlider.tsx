'use client';

import React, { useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { getCurrentUTCTime, utcToAirportLocal, airportLocalToUTC, formatAirportLocalTime } from '@/utils/airportTime';
import { BaselineData } from '@/types';

interface TimeSliderProps {
  airportCode: string;
  selectedTime: Date;
  onTimeChange: (time: Date) => void;
  minHoursAhead?: number;
  maxHoursAhead?: number;
  baseline?: BaselineData | null;
}

export function TimeSlider({
  airportCode,
  selectedTime,
  onTimeChange,
  minHoursAhead = 0,
  maxHoursAhead = 24,
  baseline,
}: TimeSliderProps) {
  // Get current UTC time
  const utcNow = getCurrentUTCTime();
  
  // Convert UTC now to airport local time (for display/calculation)
  const airportNowLocal = utcToAirportLocal(utcNow, airportCode, baseline);
  
  // Calculate min/max times in airport local time
  const minTimeLocal = new Date(airportNowLocal.getTime() + minHoursAhead * 60 * 60 * 1000);
  const maxTimeLocal = new Date(airportNowLocal.getTime() + maxHoursAhead * 60 * 60 * 1000);
  
  // Convert selectedTime (UTC) to airport local time for display/calculation
  const selectedTimeLocal = utcToAirportLocal(selectedTime, airportCode, baseline);
  
  const totalMinutes = (maxTimeLocal.getTime() - minTimeLocal.getTime()) / (1000 * 60);
  const selectedMinutes = (selectedTimeLocal.getTime() - minTimeLocal.getTime()) / (1000 * 60);
  const sliderValue = Math.max(0, Math.min(100, (selectedMinutes / totalMinutes) * 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    const minutes = (value / 100) * totalMinutes;
    const newLocalTime = new Date(minTimeLocal.getTime() + minutes * 60 * 1000);
    
    // Convert airport local time back to UTC for storage
    const newUTCTime = airportLocalToUTC(newLocalTime, airportCode, baseline);
    onTimeChange(newUTCTime);
  };

  const formatTime = (date: Date) => {
    // date should be a UTC Date object
    // formatAirportLocalTime will convert it to airport local time for display
    return formatAirportLocalTime(date, airportCode, baseline);
  };

  const formatDate = (date: Date) => {
    const dateLocal = utcToAirportLocal(date, airportCode, baseline);
    const todayLocal = airportNowLocal;
    const tomorrowLocal = new Date(todayLocal);
    tomorrowLocal.setDate(tomorrowLocal.getDate() + 1);
    
    // Compare dates (just date part, not time) - use UTC dates for comparison
    const dateStr = date.toISOString().split('T')[0];
    const todayStr = utcNow.toISOString().split('T')[0];
    const tomorrowDate = new Date(utcNow);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
    
    if (dateStr === todayStr) {
      return 'Today';
    } else if (dateStr === tomorrowStr) {
      return 'Tomorrow';
    } else {
      return dateLocal.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Check if selected time is within 1 minute of airport's current time
  const isNow = Math.abs(selectedTimeLocal.getTime() - airportNowLocal.getTime()) <= 60000;
  
  // Track if we're in "NOW" mode to update in real-time
  const isNowRef = useRef(isNow);
  const onTimeChangeRef = useRef(onTimeChange);
  
  // Keep refs updated
  isNowRef.current = isNow;
  onTimeChangeRef.current = onTimeChange;

  // Update selectedTime in real-time when slider is at NOW
  useEffect(() => {
    if (!isNow) {
      return; // Don't update if user has moved slider away from NOW
    }

    // Update immediately to sync with current time
    onTimeChangeRef.current(getCurrentUTCTime());

    // Set up interval to update every second
    const interval = setInterval(() => {
      // Check if still in "NOW" mode (user hasn't moved slider)
      if (isNowRef.current) {
        onTimeChangeRef.current(getCurrentUTCTime());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isNow]);

  return (
    <div className="bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/50 px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Clock className="w-4 h-4" />
          <span className="font-medium">Time:</span>
        </div>
        
        <div className="flex-1 relative">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={sliderValue}
            onChange={handleSliderChange}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer time-slider"
            style={{
              background: `linear-gradient(to right, 
                ${isNow ? '#60a5fa' : '#475569'} 0%, 
                ${isNow ? '#60a5fa' : '#475569'} ${sliderValue}%, 
                #475569 ${sliderValue}%, 
                #475569 100%)`
            }}
          />
          <style dangerouslySetInnerHTML={{
            __html: `
              .time-slider::-webkit-slider-thumb {
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: ${isNow ? '#ffffff' : '#60a5fa'};
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                border: ${isNow ? '3px solid #60a5fa' : '2px solid white'};
              }
              .time-slider::-moz-range-thumb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: ${isNow ? '#ffffff' : '#60a5fa'};
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                border: ${isNow ? '3px solid #60a5fa' : '2px solid white'};
              }
            `
          }} />
        </div>

        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="text-right">
            <div className={`text-lg font-bold ${isNow ? 'text-blue-300' : 'text-slate-300'}`}>
              {formatTime(selectedTime)}
            </div>
            <div className="text-xs text-gray-400">
              {formatDate(selectedTime)} ({airportCode})
            </div>
          </div>
          
          {isNow && (
            <div className="px-2 py-1 bg-blue-500/20 border border-blue-400/50 rounded text-xs font-medium text-blue-300">
              NOW
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
