'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapDisplayOptions } from '@/types';
import { Settings, Eye, EyeOff, Layers } from 'lucide-react';

interface MapControlsProps {
  displayOptions: MapDisplayOptions;
  onOptionsChange: (options: MapDisplayOptions) => void;
  isDemo?: boolean;
}

export function MapControls({ displayOptions, onOptionsChange, isDemo }: MapControlsProps) {
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
    { key: 'showExtendedCenterlines' as const, label: 'Extended Centerlines', icon: '➖' },
    { key: 'showPireps' as const, label: 'PIREPs (ATC)', icon: '⚠️' },
    { key: 'showWeatherPireps' as const, label: 'PIREPs (Weather)', icon: '📢' },
    { key: 'showGroundTracks' as const, label: 'Ground Tracks', icon: '🛤️' },
    { key: 'showOSMFeatures' as const, label: 'Airport Features (Runways, Taxiways, etc.)', icon: '🏢' },
    { key: 'showWeatherRadar' as const, label: 'Weather Radar', icon: '🌦️' },
    { key: 'showSigmetAirmet' as const, label: 'SIGMETs/AIRMETs', icon: '📋' },
    { key: 'showWindsAloft' as const, label: 'Winds Aloft', icon: '💨' },
    { key: 'showIcing' as const, label: 'Icing Forecast', icon: '🧊' },
    { key: 'showTurbulence' as const, label: 'Turbulence Forecast', icon: '🌊' },
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

        </div>
      )}
    </div>
  );
}
