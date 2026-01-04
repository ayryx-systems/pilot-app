'use client';

import React, { useEffect, useRef } from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import { getCurrentUTCTime, utcToAirportLocal, airportLocalToUTC, formatAirportLocalTime } from '@/utils/airportTime';
import { BaselineData, FlightCategory } from '@/types';
import { FLIGHT_CATEGORY_COLORS } from '@/utils/weatherCategory';

interface ETASelectorProps {
  airportCode: string;
  selectedTime: Date;
  onTimeChange: (time: Date) => void;
  maxHoursAhead?: number;
  baseline?: BaselineData | null;
  weatherCategory?: FlightCategory;
}

export function ETASelector({
  airportCode,
  selectedTime,
  onTimeChange,
  maxHoursAhead = 24,
  baseline,
  weatherCategory = 'VFR',
}: ETASelectorProps) {
  const utcNow = getCurrentUTCTime();
  const airportNowLocal = utcToAirportLocal(utcNow, airportCode, baseline);
  const selectedTimeLocal = utcToAirportLocal(selectedTime, airportCode, baseline);
  
  const isNow = Math.abs(selectedTimeLocal.getTime() - airportNowLocal.getTime()) <= 60000;
  
  const hoursAhead = (selectedTime.getTime() - utcNow.getTime()) / (1000 * 60 * 60);
  const sliderValue = isNow ? 0 : Math.min(100, (hoursAhead / maxHoursAhead) * 100);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    
    if (value <= 0.5) {
      onTimeChange(getCurrentUTCTime());
      return;
    }
    
    const targetHours = (value / 100) * maxHoursAhead;
    const roundedSlots = Math.round(targetHours * 4);
    
    const next15MinBoundary = Math.ceil(airportNowLocal.getUTCMinutes() / 15) * 15;
    const targetLocalTime = new Date(airportNowLocal);
    
    if (next15MinBoundary >= 60) {
      targetLocalTime.setUTCHours(airportNowLocal.getUTCHours() + 1, 0, 0, 0);
      if (roundedSlots > 1) {
        targetLocalTime.setTime(targetLocalTime.getTime() + (roundedSlots - 1) * 15 * 60 * 1000);
      }
    } else {
      targetLocalTime.setUTCHours(airportNowLocal.getUTCHours(), next15MinBoundary, 0, 0);
      if (roundedSlots > 1) {
        targetLocalTime.setTime(targetLocalTime.getTime() + (roundedSlots - 1) * 15 * 60 * 1000);
      }
    }
    
    const newUTCTime = airportLocalToUTC(targetLocalTime, airportCode, baseline);
    onTimeChange(newUTCTime);
  };

  const handleResetToNow = () => {
    onTimeChange(getCurrentUTCTime());
  };

  const formatTime = (date: Date) => {
    return formatAirportLocalTime(date, airportCode, baseline);
  };

  const formatDate = (date: Date) => {
    const dateLocal = utcToAirportLocal(date, airportCode, baseline);
    const todayLocal = utcToAirportLocal(utcNow, airportCode, baseline);
    
    const dateLocalStr = `${dateLocal.getUTCFullYear()}-${String(dateLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(dateLocal.getUTCDate()).padStart(2, '0')}`;
    const todayLocalStr = `${todayLocal.getUTCFullYear()}-${String(todayLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(todayLocal.getUTCDate()).padStart(2, '0')}`;
    
    const tomorrowLocal = new Date(todayLocal);
    tomorrowLocal.setUTCDate(tomorrowLocal.getUTCDate() + 1);
    const tomorrowLocalStr = `${tomorrowLocal.getUTCFullYear()}-${String(tomorrowLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowLocal.getUTCDate()).padStart(2, '0')}`;
    
    if (dateLocalStr === todayLocalStr) return 'Today';
    if (dateLocalStr === tomorrowLocalStr) return 'Tomorrow';
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[dateLocal.getUTCMonth()]} ${dateLocal.getUTCDate()}`;
  };

  const isNowRef = useRef(isNow);
  const onTimeChangeRef = useRef(onTimeChange);
  isNowRef.current = isNow;
  onTimeChangeRef.current = onTimeChange;

  useEffect(() => {
    if (!isNow) return;

    onTimeChangeRef.current(getCurrentUTCTime());

    const interval = setInterval(() => {
      if (isNowRef.current) {
        onTimeChangeRef.current(getCurrentUTCTime());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isNow]);

  const categoryColors = FLIGHT_CATEGORY_COLORS[weatherCategory] || FLIGHT_CATEGORY_COLORS.unknown;

  return (
    <div className="bg-slate-800/80 rounded-lg border border-slate-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="w-4 h-4" />
          <span className="font-medium">Expected Time of Arrival</span>
        </div>
        {!isNow && (
          <button
            onClick={handleResetToNow}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to NOW
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className={`text-2xl font-bold ${isNow ? 'text-blue-300' : 'text-white'}`}>
          {formatTime(selectedTime)}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-400">{formatDate(selectedTime)}</span>
          <span className="text-xs text-gray-500">{airportCode} local</span>
        </div>
        {isNow && (
          <div className="px-2 py-0.5 bg-blue-500/20 border border-blue-400/50 rounded text-xs font-medium text-blue-300">
            NOW
          </div>
        )}
        {!isNow && (
          <div 
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: categoryColors.bg,
              color: categoryColors.color,
              border: `1px solid ${categoryColors.border}`,
            }}
          >
            +{hoursAhead.toFixed(1)}h
          </div>
        )}
      </div>

      <div className="relative">
        <input
          type="range"
          min="0"
          max="100"
          step={0.5}
          value={sliderValue}
          onChange={handleSliderChange}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer eta-slider"
          style={{
            background: `linear-gradient(to right, 
              ${isNow ? '#60a5fa' : categoryColors.color} 0%, 
              ${isNow ? '#60a5fa' : categoryColors.color} ${sliderValue}%, 
              #475569 ${sliderValue}%, 
              #475569 100%)`
          }}
        />
        <style dangerouslySetInnerHTML={{
          __html: `
            .eta-slider::-webkit-slider-thumb {
              appearance: none;
              width: 18px;
              height: 18px;
              border-radius: 50%;
              background: ${isNow ? '#ffffff' : categoryColors.color};
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
              border: ${isNow ? '3px solid #60a5fa' : `2px solid ${categoryColors.border}`};
            }
            .eta-slider::-moz-range-thumb {
              width: 18px;
              height: 18px;
              border-radius: 50%;
              background: ${isNow ? '#ffffff' : categoryColors.color};
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
              border: ${isNow ? '3px solid #60a5fa' : `2px solid ${categoryColors.border}`};
            }
          `
        }} />
      </div>

      <div className="flex justify-between mt-1 text-[10px] text-gray-500">
        <span>NOW</span>
        <span>+6h</span>
        <span>+12h</span>
        <span>+18h</span>
        <span>+24h</span>
      </div>
    </div>
  );
}

export default ETASelector;

