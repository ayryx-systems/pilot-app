'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapDisplayOptions } from '@/types';
import { Settings, Eye, EyeOff, Layers, RefreshCw } from 'lucide-react';

interface MapControlsProps {
  displayOptions: MapDisplayOptions;
  onOptionsChange: (options: MapDisplayOptions) => void;
  isDemo?: boolean;
  onWeatherRefresh?: () => void;
}

export function MapControls({ displayOptions, onOptionsChange, isDemo, onWeatherRefresh }: MapControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const handleToggle = (key: keyof MapDisplayOptions) => {
    onOptionsChange({
      ...displayOptions,
      [key]: !displayOptions[key],
    });
  };

  const controls = [
    { key: 'showDmeRings' as const, label: 'DME Rings', icon: '⭕' },
    { key: 'showWaypoints' as const, label: 'Waypoints', icon: '📍' },
    { key: 'showApproachRoutes' as const, label: 'Approach Routes', icon: '🛩️' },
    { key: 'showExtendedCenterlines' as const, label: 'Extended Centerlines', icon: '➖' },
    { key: 'showPireps' as const, label: 'PIREPs', icon: '⚠️' },
    { key: 'showGroundTracks' as const, label: 'Ground Tracks', icon: '🛤️' },
    { key: 'showOSMFeatures' as const, label: 'Airport Features (Runways, Taxiways, etc.)', icon: '🏢' },
    { key: 'showWeatherRadar' as const, label: 'Weather Radar (BETA)', icon: '🌦️' },
  ];

  return (
    <div
      ref={containerRef}
      className="bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-600"
      style={{
        position: 'relative',
        zIndex: 1001,
        isolation: 'isolate'
      }}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-center p-2 hover:bg-slate-700/50 rounded-lg relative"
      >
        <Layers className="w-5 h-5 text-blue-400" />
        {isDemo && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border border-white"></div>
        )}
      </button>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="border-t border-slate-600 p-2">
          <div className="space-y-1">
            {controls.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                className={`w-full flex items-center justify-between py-1 px-2 rounded text-xs
                  hover:bg-slate-700/50 transition-colors ${displayOptions[key]
                    ? 'text-white bg-slate-700/30'
                    : 'text-gray-400'
                  }`}
              >
                <div className="flex items-center space-x-1">
                  <span className="text-xs">{icon}</span>
                  <span className="text-xs">{label}</span>
                </div>
                {displayOptions[key] ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>

          {/* Weather Refresh Button - only show if weather radar is enabled */}
          {displayOptions.showWeatherRadar && onWeatherRefresh && (
            <div className="pt-2 border-t border-slate-600">
              <button
                onClick={() => {
                  onWeatherRefresh();
                  console.log('[MapControls] Manual weather refresh triggered');
                }}
                className="w-full flex items-center justify-center py-2 px-2 rounded text-xs
                  hover:bg-slate-700/50 transition-colors text-blue-400"
                title="Refresh weather data (use sparingly - updates every 10min automatically)"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                <span className="text-xs">Refresh Weather</span>
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
