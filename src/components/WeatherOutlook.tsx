'use client';

import React, { useMemo } from 'react';
import { FlightCategory } from '@/types';
import { computeFlightCategory, FLIGHT_CATEGORY_COLORS, FLIGHT_CATEGORY_DESCRIPTIONS } from '@/utils/weatherCategory';
import { Cloud, Zap } from 'lucide-react';

interface WeatherData {
  visibility?: number | string;
  ceiling?: number | null;
  cloudbase?: number | null;
  taf?: {
    rawTAF?: string;
    forecast?: {
      periods: Array<{
        timeFrom: string;
        timeTo: string;
        changeType: string;
        visibility?: number | string;
        clouds?: Array<{ coverage: string; altitude: number }>;
        ceiling?: number | null;
        cloudbase?: number | null;
      }>;
    };
  };
  graph?: {
    timeSlots: string[];
    visibility: (number | null)[];
    ceiling: (number | null)[];
  } | null;
}

interface WeatherOutlookProps {
  weather?: WeatherData | null;
  selectedTime: Date;
  isManual: boolean;
  onManualChange: (isManual: boolean) => void;
  manualCategory: FlightCategory;
  onCategoryChange: (category: FlightCategory) => void;
  tafCategory: FlightCategory;
}

const CATEGORIES: FlightCategory[] = ['VFR', 'MVFR', 'IFR', 'LIFR'];

export function WeatherOutlook({
  weather,
  selectedTime,
  isManual,
  onManualChange,
  manualCategory,
  onCategoryChange,
  tafCategory,
}: WeatherOutlookProps) {
  const activeCategory = isManual ? manualCategory : tafCategory;
  const colors = FLIGHT_CATEGORY_COLORS[activeCategory] || FLIGHT_CATEGORY_COLORS.unknown;

  const tafConditionLabel = useMemo(() => {
    if (!weather?.graph) return null;
    
    const now = new Date();
    const hoursAhead = (selectedTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const slotIndex = Math.max(0, Math.round(hoursAhead * 4));
    
    const visibility = weather.graph.visibility?.[slotIndex];
    const ceiling = weather.graph.ceiling?.[slotIndex];
    
    const visLabel = visibility !== null && visibility !== undefined 
      ? (visibility >= 10 ? '10+ km' : `${visibility.toFixed(1)} km`) 
      : 'N/A';
    const ceilLabel = ceiling !== null && ceiling !== undefined 
      ? `${ceiling.toLocaleString()} ft` 
      : 'unlimited';
    
    return `${visLabel} vis, ${ceilLabel} ceiling`;
  }, [weather?.graph, selectedTime]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Cloud className="w-4 h-4" />
        <span className="font-medium">Weather at ETA</span>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="radio"
            name="weather-mode"
            checked={!isManual}
            onChange={() => onManualChange(false)}
            className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-2"
          />
          <div className="flex-1 flex items-center justify-between">
            <span className="text-sm text-gray-200">TAF Forecast</span>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: FLIGHT_CATEGORY_COLORS[tafCategory].bg,
                  color: FLIGHT_CATEGORY_COLORS[tafCategory].color,
                  border: `1px solid ${FLIGHT_CATEGORY_COLORS[tafCategory].border}`,
                }}
              >
                {tafCategory}
              </span>
              {tafConditionLabel && (
                <span className="text-xs text-gray-500">{tafConditionLabel}</span>
              )}
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="weather-mode"
            checked={isManual}
            onChange={() => onManualChange(true)}
            className="w-4 h-4 mt-1 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-2"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-200">What-if scenario</span>
              {isManual && manualCategory !== tafCategory && (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  differs from TAF
                </span>
              )}
            </div>
            
            {isManual && (
              <div className="flex gap-1">
                {CATEGORIES.map((cat) => {
                  const catColors = FLIGHT_CATEGORY_COLORS[cat];
                  const isSelected = manualCategory === cat;
                  
                  return (
                    <button
                      key={cat}
                      onClick={() => onCategoryChange(cat)}
                      className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded transition-all ${
                        isSelected 
                          ? 'ring-2 ring-offset-1 ring-offset-gray-900' 
                          : 'opacity-60'
                      }`}
                      style={{
                        backgroundColor: isSelected ? catColors.bg : 'rgba(55, 65, 81, 0.5)',
                        color: isSelected ? catColors.color : 'rgb(156, 163, 175)',
                        borderColor: isSelected ? catColors.border : 'transparent',
                        border: `1px solid ${isSelected ? catColors.border : 'rgba(75, 85, 99, 0.5)'}`,
                        boxShadow: isSelected ? `0 0 8px ${catColors.bg}` : 'none',
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </label>
      </div>

      <div 
        className="text-xs text-center py-1.5 rounded"
        style={{
          backgroundColor: colors.bg,
          color: colors.color,
          border: `1px solid ${colors.border}`,
        }}
      >
        {FLIGHT_CATEGORY_DESCRIPTIONS[activeCategory]}
      </div>
    </div>
  );
}

export function deriveWeatherCategoryFromTAF(
  weather: WeatherData | null | undefined,
  selectedTime: Date
): FlightCategory {
  if (!weather?.graph) {
    return 'VFR';
  }
  
  const now = new Date();
  const hoursAhead = (selectedTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const slotIndex = Math.max(0, Math.round(hoursAhead * 4));
  
  const visibility = weather.graph.visibility?.[slotIndex] ?? null;
  const ceiling = weather.graph.ceiling?.[slotIndex] ?? null;
  
  return computeFlightCategory(visibility, ceiling);
}

export default WeatherOutlook;

