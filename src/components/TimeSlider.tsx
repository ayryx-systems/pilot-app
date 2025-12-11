'use client';

import React from 'react';
import { Clock } from 'lucide-react';

interface TimeSliderProps {
  currentTime: Date;
  selectedTime: Date;
  onTimeChange: (time: Date) => void;
  minHoursAhead?: number;
  maxHoursAhead?: number;
}

export function TimeSlider({
  currentTime,
  selectedTime,
  onTimeChange,
  minHoursAhead = 0,
  maxHoursAhead = 24,
}: TimeSliderProps) {
  const now = currentTime;
  const minTime = new Date(now.getTime() + minHoursAhead * 60 * 60 * 1000);
  const maxTime = new Date(now.getTime() + maxHoursAhead * 60 * 60 * 1000);
  
  const totalMinutes = (maxTime.getTime() - minTime.getTime()) / (1000 * 60);
  const selectedMinutes = (selectedTime.getTime() - minTime.getTime()) / (1000 * 60);
  const sliderValue = Math.max(0, Math.min(100, (selectedMinutes / totalMinutes) * 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    const minutes = (value / 100) * totalMinutes;
    const newTime = new Date(minTime.getTime() + minutes * 60 * 1000);
    onTimeChange(newTime);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const isNow = selectedTime.getTime() <= now.getTime() + 60000; // Within 1 minute of now

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
                #3b82f6 0%, 
                #3b82f6 ${sliderValue}%, 
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
                background: ${isNow ? '#ef4444' : '#3b82f6'};
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                border: 2px solid white;
              }
              .time-slider::-moz-range-thumb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: ${isNow ? '#ef4444' : '#3b82f6'};
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                border: 2px solid white;
              }
            `
          }} />
        </div>

        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="text-right">
            <div className={`text-lg font-bold ${isNow ? 'text-red-400' : 'text-blue-400'}`}>
              {formatTime(selectedTime)}
            </div>
            <div className="text-xs text-gray-400">
              {formatDate(selectedTime)}
            </div>
          </div>
          
          {isNow && (
            <div className="px-2 py-1 bg-red-500/20 border border-red-500/50 rounded text-xs font-medium text-red-300">
              NOW
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>{formatTime(minTime)}</span>
        <span>{formatTime(maxTime)}</span>
      </div>
    </div>
  );
}
