'use client';

import React from 'react';
import { FlightCategory } from '@/types';
import { FLIGHT_CATEGORY_COLORS, FLIGHT_CATEGORY_THRESHOLDS } from '@/utils/weatherCategory';
import { Zap } from 'lucide-react';

interface WeatherScenarioToggleProps {
  isManual: boolean;
  onManualChange: (isManual: boolean) => void;
  manualCategory: FlightCategory;
  onCategoryChange: (category: FlightCategory) => void;
  tafCategory: FlightCategory;
}

const CATEGORIES: FlightCategory[] = ['VFR', 'MVFR', 'IFR', 'LIFR'];

export function WeatherScenarioToggle({
  isManual,
  onManualChange,
  manualCategory,
  onCategoryChange,
  tafCategory,
}: WeatherScenarioToggleProps) {
  const activeCategory = isManual ? manualCategory : tafCategory;
  const colors = FLIGHT_CATEGORY_COLORS[activeCategory] || FLIGHT_CATEGORY_COLORS.unknown;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-300">Weather Scenario</span>
        <div className="flex items-center gap-2">
          {isManual && manualCategory !== tafCategory && (
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Custom
            </span>
          )}
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{
              backgroundColor: colors.bg,
              color: colors.color,
              border: `1px solid ${colors.border}`,
            }}
          >
            {activeCategory}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="radio"
            name="weather-scenario"
            checked={!isManual}
            onChange={() => onManualChange(false)}
            className="w-3.5 h-3.5 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-xs text-gray-300">TAF Forecast</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="radio"
            name="weather-scenario"
            checked={isManual}
            onChange={() => onManualChange(true)}
            className="w-3.5 h-3.5 text-amber-500 bg-gray-700 border-gray-600 focus:ring-amber-500 focus:ring-2"
          />
          <span className="text-xs text-gray-300">What-if</span>
        </label>
      </div>

      {isManual && (
        <div className="space-y-1">
          <div className="flex gap-1.5">
            {CATEGORIES.map((cat) => {
              const catColors = FLIGHT_CATEGORY_COLORS[cat];
              const isSelected = manualCategory === cat;
              
              return (
                <button
                  key={cat}
                  onClick={() => onCategoryChange(cat)}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded transition-all ${
                    isSelected 
                      ? 'ring-2 ring-offset-1 ring-offset-slate-800' 
                      : 'opacity-60 hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: isSelected ? catColors.bg : 'rgba(55, 65, 81, 0.5)',
                    color: isSelected ? catColors.color : 'rgb(156, 163, 175)',
                    border: `1px solid ${isSelected ? catColors.border : 'rgba(75, 85, 99, 0.5)'}`,
                    boxShadow: isSelected ? `0 0 8px ${catColors.bg}` : 'none',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5 text-[10px] text-gray-300 text-center">
            {CATEGORIES.map((cat) => (
              <div key={cat} className="flex-1 truncate">
                {FLIGHT_CATEGORY_THRESHOLDS[cat]}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WeatherScenarioToggle;
