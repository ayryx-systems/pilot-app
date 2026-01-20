'use client';

import React from 'react';
import { FlightCategory } from '@/types';
import { FLIGHT_CATEGORY_COLORS, FLIGHT_CATEGORY_DESCRIPTIONS } from '@/utils/weatherCategory';

interface WeatherCategorySliderProps {
  value: FlightCategory;
  onChange: (category: FlightCategory) => void;
  disabled?: boolean;
  label?: string;
}

const CATEGORIES: FlightCategory[] = ['VFR', 'MVFR', 'IFR', 'LIFR'];

const CATEGORY_INFO: Record<FlightCategory, { label: string; color: string; bg: string; description: string }> = {
  VFR: {
    label: 'VFR',
    color: FLIGHT_CATEGORY_COLORS.VFR.color,
    bg: FLIGHT_CATEGORY_COLORS.VFR.bg,
    description: FLIGHT_CATEGORY_DESCRIPTIONS.VFR,
  },
  MVFR: {
    label: 'MVFR',
    color: FLIGHT_CATEGORY_COLORS.MVFR.color,
    bg: FLIGHT_CATEGORY_COLORS.MVFR.bg,
    description: FLIGHT_CATEGORY_DESCRIPTIONS.MVFR,
  },
  IFR: {
    label: 'IFR',
    color: FLIGHT_CATEGORY_COLORS.IFR.color,
    bg: FLIGHT_CATEGORY_COLORS.IFR.bg,
    description: FLIGHT_CATEGORY_DESCRIPTIONS.IFR,
  },
  LIFR: {
    label: 'LIFR',
    color: FLIGHT_CATEGORY_COLORS.LIFR.color,
    bg: FLIGHT_CATEGORY_COLORS.LIFR.bg,
    description: FLIGHT_CATEGORY_DESCRIPTIONS.LIFR,
  },
  unlimited: {
    label: 'VFR',
    color: FLIGHT_CATEGORY_COLORS.unlimited.color,
    bg: FLIGHT_CATEGORY_COLORS.unlimited.bg,
    description: FLIGHT_CATEGORY_DESCRIPTIONS.unlimited,
  },
  unknown: {
    label: '?',
    color: FLIGHT_CATEGORY_COLORS.unknown.color,
    bg: FLIGHT_CATEGORY_COLORS.unknown.bg,
    description: FLIGHT_CATEGORY_DESCRIPTIONS.unknown,
  },
};

export function WeatherCategorySlider({ 
  value, 
  onChange, 
  disabled = false,
  label = 'Weather Scenario',
}: WeatherCategorySliderProps) {
  const currentIndex = CATEGORIES.indexOf(value);
  const info = CATEGORY_INFO[value] || CATEGORY_INFO.unknown;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    onChange(CATEGORIES[index]);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-300">{label}</span>
        <span 
          className="text-xs font-semibold px-2 py-0.5 rounded"
          style={{ 
            backgroundColor: info.bg,
            color: info.color,
            border: `1px solid ${info.color}`,
          }}
        >
          {info.label}
        </span>
      </div>
      
      <div className="relative">
        <div className="h-2 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 via-orange-500 to-red-500 opacity-40" />
        
        <input
          type="range"
          min={0}
          max={CATEGORIES.length - 1}
          value={currentIndex >= 0 ? currentIndex : 0}
          onChange={handleSliderChange}
          disabled={disabled}
          className="absolute top-0 w-full h-2 appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed"
          style={{
            WebkitAppearance: 'none',
          }}
        />
        
        <style jsx>{`
          input[type='range']::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: ${info.color};
            border: 3px solid rgb(31, 41, 55);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
            cursor: pointer;
            margin-top: -6px;
          }
          input[type='range']::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: ${info.color};
            border: 3px solid rgb(31, 41, 55);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
            cursor: pointer;
          }
          input[type='range']:disabled::-webkit-slider-thumb {
            opacity: 0.5;
            cursor: not-allowed;
          }
          input[type='range']:disabled::-moz-range-thumb {
            opacity: 0.5;
            cursor: not-allowed;
          }
        `}</style>
      </div>
      
      <div className="flex justify-between mt-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => !disabled && onChange(cat)}
            disabled={disabled}
            className={`text-xs font-medium transition-all ${
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
            style={{
              color: cat === value ? CATEGORY_INFO[cat].color : 'rgb(107, 114, 128)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>
      
      <p className="text-xs text-gray-400 mt-2 text-center">
        {info.description}
      </p>
    </div>
  );
}

export default WeatherCategorySlider;

