'use client';

import React from 'react';
import { FlightCategory } from '@/types';

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
    color: 'rgb(34, 197, 94)',
    bg: 'rgba(34, 197, 94, 0.1)',
    description: 'Clear: >5mi vis, >3000ft ceiling',
  },
  MVFR: {
    label: 'MVFR',
    color: 'rgb(59, 130, 246)',
    bg: 'rgba(59, 130, 246, 0.1)',
    description: 'Marginal: 3-5mi vis, 1000-3000ft',
  },
  IFR: {
    label: 'IFR',
    color: 'rgb(234, 88, 12)',
    bg: 'rgba(234, 88, 12, 0.1)',
    description: 'Poor: 1-3mi vis, 500-1000ft',
  },
  LIFR: {
    label: 'LIFR',
    color: 'rgb(220, 38, 38)',
    bg: 'rgba(220, 38, 38, 0.1)',
    description: 'Very poor: <1mi vis, <500ft',
  },
  unlimited: {
    label: 'VFR',
    color: 'rgb(34, 197, 94)',
    bg: 'rgba(34, 197, 94, 0.1)',
    description: 'Clear conditions',
  },
  unknown: {
    label: '?',
    color: 'rgb(156, 163, 175)',
    bg: 'rgba(156, 163, 175, 0.1)',
    description: 'Unknown conditions',
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
        <div className="h-2 rounded-full bg-gradient-to-r from-green-500 via-blue-500 via-orange-500 to-red-500 opacity-40" />
        
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
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-80'
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

