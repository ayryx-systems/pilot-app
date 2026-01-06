'use client';

import React, { useEffect, useRef } from 'react';
import { Clock, RotateCcw, Radio, Compass } from 'lucide-react';
import { getCurrentUTCTime, utcToAirportLocal, airportLocalToUTC, formatAirportLocalTime } from '@/utils/airportTime';
import { BaselineData, FlightCategory } from '@/types';
import { FLIGHT_CATEGORY_COLORS } from '@/utils/weatherCategory';
import { HelpButton } from './HelpButton';

interface ETASelectorProps {
  airportCode: string;
  selectedTime: Date;
  onTimeChange: (time: Date) => void;
  maxHoursAhead?: number;
  baseline?: BaselineData | null;
  tafCategory: FlightCategory;
  isManualWeather: boolean;
  onManualWeatherChange: (isManual: boolean) => void;
  manualCategory: FlightCategory;
  onCategoryChange: (category: FlightCategory) => void;
}

const CATEGORIES: FlightCategory[] = ['VFR', 'MVFR', 'IFR', 'LIFR'];

export function ETASelector({
  airportCode,
  selectedTime,
  onTimeChange,
  maxHoursAhead = 24,
  baseline,
  tafCategory,
  isManualWeather,
  onManualWeatherChange,
  manualCategory,
  onCategoryChange,
}: ETASelectorProps) {
  const utcNow = getCurrentUTCTime();
  const airportNowLocal = utcToAirportLocal(utcNow, airportCode, baseline);
  const selectedTimeLocal = utcToAirportLocal(selectedTime, airportCode, baseline);
  
  const isNow = Math.abs(selectedTimeLocal.getTime() - airportNowLocal.getTime()) <= 60000;
  const hoursAhead = (selectedTime.getTime() - utcNow.getTime()) / (1000 * 60 * 60);
  const sliderValue = isNow ? 0 : Math.min(100, (hoursAhead / maxHoursAhead) * 100);

  const activeCategory = isManualWeather ? manualCategory : tafCategory;
  const categoryColors = FLIGHT_CATEGORY_COLORS[activeCategory] || FLIGHT_CATEGORY_COLORS.unknown;

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
    onTimeChange(airportLocalToUTC(targetLocalTime, airportCode, baseline));
  };

  const formatTime = (date: Date) => formatAirportLocalTime(date, airportCode, baseline);

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

  const formatTimeForMark = (date: Date) => {
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  const getSliderMarks = () => {
    const marks: Array<{ position: number; label: string; isDayBoundary: boolean }> = [];
    
    const currentTime = airportNowLocal.getTime();
    
    const targetHours = [6, 12, 18, 0];
    
    for (const targetHour of targetHours) {
      const targetLocalTime = new Date(airportNowLocal);
      targetLocalTime.setUTCMinutes(0, 0, 0);
      targetLocalTime.setUTCHours(targetHour, 0, 0, 0);
      
      if (targetLocalTime.getTime() <= currentTime) {
        targetLocalTime.setUTCDate(targetLocalTime.getUTCDate() + 1);
      }
      
      const hoursAhead = (targetLocalTime.getTime() - currentTime) / (1000 * 60 * 60);
      
      if (hoursAhead > 0 && hoursAhead <= maxHoursAhead) {
        const position = (hoursAhead / maxHoursAhead) * 100;
        const isDayBoundary = targetHour === 0;
        marks.push({
          position,
          label: formatTimeForMark(targetLocalTime),
          isDayBoundary,
        });
      }
    }
    
    return marks.sort((a, b) => a.position - b.position);
  };

  const sliderMarks = getSliderMarks();

  const isNowRef = useRef(isNow);
  const onTimeChangeRef = useRef(onTimeChange);
  isNowRef.current = isNow;
  onTimeChangeRef.current = onTimeChange;

  useEffect(() => {
    if (!isNow) return;
    onTimeChangeRef.current(getCurrentUTCTime());
    const interval = setInterval(() => {
      if (isNowRef.current) onTimeChangeRef.current(getCurrentUTCTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [isNow]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className={`text-lg font-bold ${isNow ? 'text-blue-300' : 'text-white'}`}>
            {formatTime(selectedTime)}
          </span>
          <span className="text-xs text-gray-400">{formatDate(selectedTime)}</span>
          {isNow ? (
            <>
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-400/50 rounded text-[10px] font-medium text-emerald-300">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                LIVE
              </span>
              <span className="text-[10px] text-slate-500">· slide to plan →</span>
            </>
          ) : (
            <span 
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: categoryColors.bg,
                color: categoryColors.color,
                border: `1px solid ${categoryColors.border}`,
              }}
            >
              <Compass className="w-2.5 h-2.5" />
              PLANNING +{hoursAhead.toFixed(1)}h
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNow && (
            <button
              onClick={() => onTimeChange(getCurrentUTCTime())}
              className="flex items-center gap-1 text-[10px] text-blue-400"
            >
              <RotateCcw className="w-3 h-3" />
              NOW
            </button>
          )}
          <HelpButton
            title="Arrival Time Selection"
            size="sm"
            content={
              <div className="space-y-2">
                <p>
                  Select your <strong>expected arrival time</strong> to see forecasted conditions and traffic patterns.
                </p>
                <p>
                  <strong>NOW:</strong> Shows current real-time conditions at the airport.
                </p>
                <p>
                  <strong>Future Time:</strong> Shows TAF weather forecast and historical traffic patterns for that time.
                </p>
                <p>
                  <strong>What-if Scenarios:</strong> You can manually select weather conditions (VFR/MVFR/IFR/LIFR) to see how different weather affects arrival patterns.
                </p>
                <p className="text-blue-300">
                  💡 Drag the slider to select a time.
                </p>
              </div>
            }
          />
        </div>
      </div>

      <div className="relative mb-1">
        <input
          type="range"
          min="0"
          max="100"
          step={0.5}
          value={sliderValue}
          onChange={handleSliderChange}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer eta-slider"
          style={{
            background: `linear-gradient(to right, 
              ${isNow ? '#60a5fa' : categoryColors.color} 0%, 
              ${isNow ? '#60a5fa' : categoryColors.color} ${sliderValue}%, 
              #475569 ${sliderValue}%, 
              #475569 100%)`
          }}
        />
        <div className="absolute top-0 left-0 right-0 h-1.5 pointer-events-none">
          {sliderMarks.map((mark, index) => (
            <div
              key={index}
              className="absolute top-0 bottom-0 flex flex-col items-center"
              style={{ left: `${mark.position}%`, transform: 'translateX(-50%)' }}
            >
              <div
                className={`w-px ${mark.isDayBoundary ? 'h-full bg-blue-400/60' : 'h-2 bg-slate-500/50'}`}
              />
            </div>
          ))}
        </div>
        <div className="relative mt-1.5 h-3">
          {sliderMarks.map((mark, index) => (
            <div
              key={index}
              className="absolute flex flex-col items-center"
              style={{ left: `${mark.position}%`, transform: 'translateX(-50%)' }}
            >
              <span className={`text-[9px] ${mark.isDayBoundary ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>
                {mark.label}
              </span>
            </div>
          ))}
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            .eta-slider::-webkit-slider-thumb {
              appearance: none;
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: ${isNow ? '#ffffff' : categoryColors.color};
              cursor: pointer;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
              border: ${isNow ? '2px solid #60a5fa' : `2px solid ${categoryColors.border}`};
            }
            .eta-slider::-moz-range-thumb {
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: ${isNow ? '#ffffff' : categoryColors.color};
              cursor: pointer;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
              border: ${isNow ? '2px solid #60a5fa' : `2px solid ${categoryColors.border}`};
            }
          `
        }} />
      </div>

      {!isNow && (
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/50">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                checked={!isManualWeather}
                onChange={() => onManualWeatherChange(false)}
                className="w-3 h-3 text-blue-500"
              />
              <span className="text-[10px] text-gray-300">TAF</span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: FLIGHT_CATEGORY_COLORS[tafCategory].bg,
                  color: FLIGHT_CATEGORY_COLORS[tafCategory].color,
                }}
              >
                {tafCategory}
              </span>
            </label>
          </div>
          
          <div className="flex items-center gap-1">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                checked={isManualWeather}
                onChange={() => onManualWeatherChange(true)}
                className="w-3 h-3 text-blue-500"
              />
              <span className="text-[10px] text-gray-400">What-if:</span>
            </label>
            {CATEGORIES.map((cat) => {
              const colors = FLIGHT_CATEGORY_COLORS[cat];
              const isSelected = isManualWeather && manualCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => { onManualWeatherChange(true); onCategoryChange(cat); }}
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded transition-all ${
                    isSelected ? '' : 'opacity-50'
                  }`}
                  style={{
                    backgroundColor: isSelected ? colors.bg : 'transparent',
                    color: isSelected ? colors.color : 'rgb(107, 114, 128)',
                    border: isSelected ? `1px solid ${colors.border}` : '1px solid transparent',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ETASelector;
