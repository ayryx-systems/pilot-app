'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { Clock, RotateCcw, Radio, Compass } from 'lucide-react';
import { getCurrentUTCTime, utcToAirportLocal, airportLocalToUTC, formatAirportLocalTime, formatUTCTime, getUTCDateString } from '@/utils/airportTime';
import { BaselineData, FlightCategory, SituationSummary } from '@/types';
import { FLIGHT_CATEGORY_COLORS, computeFlightCategory } from '@/utils/weatherCategory';
import { HelpButton } from './HelpButton';
import { useTimezonePreference } from '@/hooks/useTimezonePreference';

interface WeatherData {
  graph?: {
    timeSlots: string[];
    visibility: (number | null)[];
    ceiling: (number | null)[];
  } | null;
  visibility?: number | string;
  ceiling?: number | null;
  cloudbase?: number | null;
}

interface ETASelectorProps {
  airportCode: string;
  selectedTime: Date;
  onTimeChange: (time: Date) => void;
  maxHoursAhead?: number;
  baseline?: BaselineData | null;
  tafCategory: FlightCategory;
  metarCategory?: FlightCategory;
  weather?: WeatherData | null;
  summary?: SituationSummary | null;
}


export function ETASelector({
  airportCode,
  selectedTime,
  onTimeChange,
  maxHoursAhead = 24,
  baseline,
  tafCategory,
  metarCategory = 'VFR',
  weather,
  summary,
}: ETASelectorProps) {
  const { isUTC } = useTimezonePreference();
  const utcNow = getCurrentUTCTime();
  const airportNowLocal = utcToAirportLocal(utcNow, airportCode, baseline);
  const selectedTimeLocal = utcToAirportLocal(selectedTime, airportCode, baseline);
  
  const isNow = Math.abs(selectedTimeLocal.getTime() - airportNowLocal.getTime()) <= 60000;
  const hoursAhead = (selectedTime.getTime() - utcNow.getTime()) / (1000 * 60 * 60);
  const sliderValue = isNow ? 0 : Math.min(100, (hoursAhead / maxHoursAhead) * 100);

  const activeCategory = isNow ? metarCategory : tafCategory;
  const categoryColors = FLIGHT_CATEGORY_COLORS[activeCategory] || FLIGHT_CATEGORY_COLORS.unknown;
  const metarColors = FLIGHT_CATEGORY_COLORS[metarCategory] || FLIGHT_CATEGORY_COLORS.unknown;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (value <= 0.5) {
      onTimeChange(getCurrentUTCTime());
      return;
    }
    
    const targetHours = (value / 100) * maxHoursAhead;
    const targetLocalTime = new Date(airportNowLocal);
    targetLocalTime.setTime(targetLocalTime.getTime() + targetHours * 60 * 60 * 1000);
    
    const minutes = targetLocalTime.getUTCMinutes();
    const seconds = targetLocalTime.getUTCSeconds();
    const roundedMinutes = Math.round((minutes + seconds / 60) / 15) * 15;
    
    if (roundedMinutes >= 60) {
      targetLocalTime.setUTCHours(targetLocalTime.getUTCHours() + 1, 0, 0, 0);
    } else {
      targetLocalTime.setUTCMinutes(roundedMinutes, 0, 0);
    }
    
    onTimeChange(airportLocalToUTC(targetLocalTime, airportCode, baseline));
  };

  const formatTime = (date: Date) => {
    if (isUTC) {
      return formatUTCTime(date);
    }
    return formatAirportLocalTime(date, airportCode, baseline);
  };

  const formatDate = (date: Date) => {
    if (isUTC) {
      const dateStr = getUTCDateString(date);
      const todayStr = getUTCDateString(utcNow);
      const tomorrowDate = new Date(utcNow);
      tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
      const tomorrowStr = getUTCDateString(tomorrowDate);
      
      if (dateStr === todayStr) return 'Today';
      if (dateStr === tomorrowStr) return 'Tomorrow';
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[date.getUTCMonth()]} ${date.getUTCDate()}`;
    }
    
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
    if (isUTC) {
      const utcDate = airportLocalToUTC(date, airportCode, baseline);
      const hours = utcDate.getUTCHours();
      const minutes = utcDate.getUTCMinutes();
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const getSliderMarks = () => {
    const marks: Array<{ position: number; label: string; isDayBoundary: boolean; isHour: boolean; isQuarterHour: boolean }> = [];
    
    const currentTime = airportNowLocal.getTime();
    const currentHour = airportNowLocal.getUTCHours();
    const currentMinutes = airportNowLocal.getUTCMinutes();
    
    const nextQuarterHour = Math.ceil(currentMinutes / 15) * 15;
    const startTime = new Date(airportNowLocal);
    if (nextQuarterHour >= 60) {
      startTime.setUTCHours(currentHour + 1, 0, 0, 0);
    } else {
      startTime.setUTCHours(currentHour, nextQuarterHour, 0, 0);
    }
    
    const labelInterval = maxHoursAhead <= 12 ? 2 : maxHoursAhead <= 24 ? 3 : 6;
    
    for (let hoursAhead = 0; hoursAhead <= maxHoursAhead; hoursAhead += 0.25) {
      const targetLocalTime = new Date(startTime);
      targetLocalTime.setTime(startTime.getTime() + hoursAhead * 60 * 60 * 1000);
      
      const actualHoursAhead = (targetLocalTime.getTime() - currentTime) / (1000 * 60 * 60);
      
      if (actualHoursAhead > 0 && actualHoursAhead <= maxHoursAhead) {
        const position = (actualHoursAhead / maxHoursAhead) * 100;
        const minutes = targetLocalTime.getUTCMinutes();
        const hour = targetLocalTime.getUTCHours();
        const isDayBoundary = hour === 0 && minutes === 0;
        const isHour = minutes === 0;
        const isQuarterHour = minutes % 15 === 0;
        
        if (isQuarterHour) {
          let shouldLabel = false;
          if (isHour) {
            const hoursFromStart = Math.round(actualHoursAhead);
            shouldLabel = hoursFromStart % labelInterval === 0;
          }
          
          marks.push({
            position,
            label: shouldLabel ? formatTimeForMark(targetLocalTime) : '',
            isDayBoundary,
            isHour,
            isQuarterHour: true,
          });
        }
      }
    }
    
    return marks.sort((a, b) => a.position - b.position);
  };

  const sliderMarks = getSliderMarks();

  const weatherGradient = useMemo(() => {
    const gradientStops: string[] = [];
    const numStops = 50;
    const utcNow = getCurrentUTCTime();
    
    for (let i = 0; i <= numStops; i++) {
      const position = (i / numStops) * 100;
      const hoursAhead = (position / 100) * maxHoursAhead;
      
      let category: FlightCategory;
      
      if (position === 0) {
        category = metarCategory;
      } else if (summary?.timeSegments && summary.timeSegments.length > 0) {
        const targetTime = new Date(utcNow.getTime() + hoursAhead * 60 * 60 * 1000);
        const targetTimeMs = targetTime.getTime();
        
        let foundSegment = summary.timeSegments[0];
        for (const segment of summary.timeSegments) {
          const segmentStart = new Date(segment.timeFrom).getTime();
          const segmentEnd = new Date(segment.timeTo).getTime();
          
          if (targetTimeMs >= segmentStart && targetTimeMs < segmentEnd) {
            foundSegment = segment;
            break;
          }
        }
        
        category = foundSegment.flightCategory || 'VFR';
      } else if (weather?.graph) {
        const slotIndex = Math.min(
          Math.max(0, Math.round(hoursAhead * 4)),
          (weather.graph.visibility?.length || 0) - 1
        );
        const visibility = weather.graph.visibility?.[slotIndex] ?? null;
        const ceiling = weather.graph.ceiling?.[slotIndex] ?? null;
        category = computeFlightCategory(visibility, ceiling);
      } else {
        category = tafCategory;
      }
      
      const colors = FLIGHT_CATEGORY_COLORS[category] || FLIGHT_CATEGORY_COLORS.unknown;
      gradientStops.push(`${colors.color} ${position}%`);
    }
    
    return `linear-gradient(to right, ${gradientStops.join(', ')})`;
  }, [summary?.timeSegments, weather?.graph, metarCategory, tafCategory, maxHoursAhead]);

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

      <div className="relative mb-1 py-2 -my-2">
        <input
          type="range"
          min="0"
          max="100"
          step={0.1}
          value={sliderValue}
          onChange={handleSliderChange}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer eta-slider"
          style={{
            background: weatherGradient
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
                className={`w-px ${
                  mark.isHour 
                    ? 'h-3 bg-slate-400/60' 
                    : 'h-1.5 bg-slate-500/40'
                }`}
              />
            </div>
          ))}
        </div>
        <div className="relative mt-1.5 h-3">
          {sliderMarks.map((mark, index) => {
            if (!mark.label) return null;
            return (
              <div
                key={index}
                className="absolute flex flex-col items-center"
                style={{ left: `${mark.position}%`, transform: 'translateX(-50%)' }}
              >
                <span className="text-[10px] text-slate-300 font-medium">
                  {mark.label}
                </span>
              </div>
            );
          })}
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            .eta-slider::-webkit-slider-thumb {
              appearance: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: ${isNow ? metarColors.color : categoryColors.color};
              cursor: pointer;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
              border: ${isNow ? `2px solid ${metarColors.border}` : `2px solid ${categoryColors.border}`};
              margin-top: 0px;
            }
            .eta-slider::-moz-range-thumb {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: ${isNow ? metarColors.color : categoryColors.color};
              cursor: pointer;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
              border: ${isNow ? `2px solid ${metarColors.border}` : `2px solid ${categoryColors.border}`};
            }
          `
        }} />
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: categoryColors.bg,
              color: categoryColors.color,
            }}
          >
            {activeCategory} ({isNow ? 'METAR' : 'TAF'})
          </span>
        </div>
      </div>
    </div>
  );
}

export default ETASelector;
