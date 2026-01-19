'use client';

import React, { useMemo } from 'react';
import { FlightCategory } from '@/types';
import { computeFlightCategory, FLIGHT_CATEGORY_COLORS, FLIGHT_CATEGORY_DESCRIPTIONS } from '@/utils/weatherCategory';
import { Cloud } from 'lucide-react';

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
  tafCategory: FlightCategory;
}


export function WeatherOutlook({
  weather,
  selectedTime,
  tafCategory,
}: WeatherOutlookProps) {
  const colors = FLIGHT_CATEGORY_COLORS[tafCategory] || FLIGHT_CATEGORY_COLORS.unknown;

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

      <div className="flex items-center justify-between">
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

      <div 
        className="text-xs text-center py-1.5 rounded"
        style={{
          backgroundColor: colors.bg,
          color: colors.color,
          border: `1px solid ${colors.border}`,
        }}
      >
        {FLIGHT_CATEGORY_DESCRIPTIONS[tafCategory]}
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

