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
  minHoursAhead: _minHoursAhead = 0,
  maxHoursAhead = 24,
  baseline,
}: TimeSliderProps) {
  // Get current UTC time
  const utcNow = getCurrentUTCTime();
  
  // Convert UTC now to airport local time (for display/calculation)
  const airportNowLocal = utcToAirportLocal(utcNow, airportCode, baseline);
  
  // Leftmost position is NOW (current time)
  const minTimeLocal = new Date(airportNowLocal);
  
  // Get start of today (00:00:00) in airport local time for calculating max time
  const todayStartLocal = new Date(airportNowLocal);
  todayStartLocal.setUTCHours(0, 0, 0, 0);
  
  // Calculate max time based on round hours from start of day
  const maxTimeLocal = new Date(todayStartLocal);
  maxTimeLocal.setTime(maxTimeLocal.getTime() + maxHoursAhead * 60 * 60 * 1000);
  
  // Ensure max is after NOW
  if (maxTimeLocal.getTime() <= minTimeLocal.getTime()) {
    maxTimeLocal.setTime(minTimeLocal.getTime() + maxHoursAhead * 60 * 60 * 1000);
  }
  
  // Convert selectedTime (UTC) to airport local time for display/calculation
  const selectedTimeLocal = utcToAirportLocal(selectedTime, airportCode, baseline);
  
  // Check if selected time is within 1 minute of airport's current time
  const isNow = Math.abs(selectedTimeLocal.getTime() - airportNowLocal.getTime()) <= 60000;
  
  // Calculate total time range
  const totalMinutes = (maxTimeLocal.getTime() - minTimeLocal.getTime()) / (1000 * 60);
  
  // Calculate which slot the selected time is in (or NOW position)
  let sliderValue: number;
  if (isNow) {
    // Position NOW at 0% (leftmost position)
    sliderValue = 0;
  } else {
    // Round selected time to nearest 15-minute boundary (00:00, 00:15, 00:30, 00:45, etc.)
    const selectedHours = selectedTimeLocal.getUTCHours();
    const selectedMinutes = selectedTimeLocal.getUTCMinutes();
    const roundedMinutes = Math.floor(selectedMinutes / 15) * 15;
    const roundedLocalTime = new Date(selectedTimeLocal);
    roundedLocalTime.setUTCHours(selectedHours, roundedMinutes, 0, 0);
    
    // Ensure rounded time is not before NOW
    if (roundedLocalTime.getTime() < minTimeLocal.getTime()) {
      roundedLocalTime.setTime(roundedLocalTime.getTime() + 15 * 60 * 1000);
    }
    
    const selectedMinutesFromMin = (roundedLocalTime.getTime() - minTimeLocal.getTime()) / (1000 * 60);
    sliderValue = Math.max(0, Math.min(100, (selectedMinutesFromMin / totalMinutes) * 100));
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    
    // If at 0% or very close, use NOW
    if (value <= 0.5) {
      const newUTCTime = getCurrentUTCTime();
      onTimeChange(newUTCTime);
      return;
    }
    
    // Calculate minutes from NOW
    const minutes = (value / 100) * totalMinutes;
    
    // Round to nearest 15-minute increment
    const slotNumber = Math.round(minutes / 15);
    
    // Find the next 15-minute boundary after NOW
    const nowHours = airportNowLocal.getUTCHours();
    const nowMinutes = airportNowLocal.getUTCMinutes();
    const next15MinBoundary = Math.ceil(nowMinutes / 15) * 15;
    
    // Calculate target time: start from next 15-min boundary, then add (slotNumber - 1) * 15 minutes
    let targetLocalTime: Date;
    
    if (next15MinBoundary >= 60) {
      // Next boundary is in the next hour (00:00 of next hour)
      targetLocalTime = new Date(airportNowLocal);
      targetLocalTime.setUTCHours(nowHours + 1, 0, 0, 0);
      // Add additional 15-minute slots if needed
      if (slotNumber > 1) {
        targetLocalTime.setTime(targetLocalTime.getTime() + (slotNumber - 1) * 15 * 60 * 1000);
      }
    } else {
      // Next boundary is in current hour
      targetLocalTime = new Date(airportNowLocal);
      targetLocalTime.setUTCHours(nowHours, next15MinBoundary, 0, 0);
      // Add additional 15-minute slots if needed
      if (slotNumber > 1) {
        targetLocalTime.setTime(targetLocalTime.getTime() + (slotNumber - 1) * 15 * 60 * 1000);
      }
    }
    
    // Convert airport local time back to UTC for storage
    const newUTCTime = airportLocalToUTC(targetLocalTime, airportCode, baseline);
    onTimeChange(newUTCTime);
  };

  const formatTime = (date: Date) => {
    // date should be a UTC Date object
    // formatAirportLocalTime will convert it to airport local time for display
    return formatAirportLocalTime(date, airportCode, baseline);
  };

  const formatDate = (date: Date) => {
    const dateLocal = utcToAirportLocal(date, airportCode, baseline);
    const todayLocal = utcToAirportLocal(utcNow, airportCode, baseline);
    
    // Compare local dates (not UTC dates)
    const dateLocalStr = `${dateLocal.getUTCFullYear()}-${String(dateLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(dateLocal.getUTCDate()).padStart(2, '0')}`;
    const todayLocalStr = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(todayLocal.getUTCDate()).padStart(2, '0')}`;
    
    const tomorrowLocal = new Date(todayLocal);
    tomorrowLocal.setUTCDate(tomorrowLocal.getUTCDate() + 1);
    const tomorrowLocalStr = `${tomorrowLocal.getUTCFullYear()}-${String(tomorrowLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowLocal.getUTCDate()).padStart(2, '0')}`;
    
    if (dateLocalStr === todayLocalStr) {
      return 'Today';
    } else if (dateLocalStr === tomorrowLocalStr) {
      return 'Tomorrow';
    } else {
      const month = dateLocal.getUTCMonth();
      const day = dateLocal.getUTCDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[month]} ${day}`;
    }
  };

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
            step={0.1}
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
