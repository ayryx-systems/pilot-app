'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapDisplayOptions } from '@/types';
import { Eye, EyeOff, Layers, RefreshCw } from 'lucide-react';
import { HelpButton } from './HelpButton';
import { pilotOSMService } from '@/services/osmService';

interface MapControlsProps {
  displayOptions: MapDisplayOptions;
  onOptionsChange: (options: MapDisplayOptions) => void;
  isDemo?: boolean;
  selectedAirport?: string;
}

export function MapControls({ displayOptions, onOptionsChange, isDemo, selectedAirport }: MapControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const handleRefreshMapData = async () => {
    if (!selectedAirport || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await pilotOSMService.getAirportOSMData(selectedAirport, true);
      window.location.reload();
    } catch (error) {
      console.error('Failed to refresh map data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const controls = [
    { key: 'showDmeRings' as const, label: 'DME Rings', icon: '⭕' },
    { key: 'showWaypoints' as const, label: 'Waypoints', icon: '📍' },
    { key: 'showExtendedCenterlines' as const, label: 'Extended Centerlines', icon: '➖' },
    { key: 'showPireps' as const, label: 'PIREPs (ATC)', icon: '⚠️' },
    { key: 'showWeatherPireps' as const, label: 'PIREPs (Weather)', icon: '📢' },
    { key: 'showMetars' as const, label: 'METAR Stations', icon: '🌡️' },
    { key: 'showGroundTracks' as const, label: 'Approach Tracks', icon: '🛤️' },
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
      className="relative"
      style={{
        zIndex: 1001
      }}
    >
      {/* Toggle Button - Fixed on the right */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 px-2 py-2 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-600 hover:bg-slate-700/90 transition-colors relative"
        style={{
          position: 'relative',
          zIndex: 1002
        }}
      >
        <Layers className="w-5 h-5 text-blue-400 flex-shrink-0" />
        <span className="text-xs text-gray-300 font-medium whitespace-nowrap">Layers</span>
        {isDemo && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border border-white"></div>
        )}
      </button>

      {/* Expanded Controls - Positioned below button, aligned to right */}
      {isExpanded && (
        <div 
          className="absolute top-full right-0 mt-1 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-600 p-2 min-w-[240px]"
          style={{
            zIndex: 1001
          }}
        >
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-600">
            <span className="text-xs font-semibold text-gray-300">Map Layers</span>
            <HelpButton
              title="Map Layers"
              size="sm"
              content={
                <div className="space-y-2">
                  <p>
                    Toggle map layers to customize what information you see.
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <p><strong>DME Rings:</strong> Distance circles from airport (10, 25, 50nm)</p>
                    <p><strong>Waypoints:</strong> Navigational fixes and intersections</p>
                    <p><strong>Extended Centerlines:</strong> Runway approach paths</p>
                    <p><strong>PIREPs (ATC):</strong> Pilot reports extracted from ATC communications</p>
                    <p><strong>PIREPs (Weather):</strong> Official weather pilot reports</p>
                    <p><strong>Approach Tracks:</strong> Arrival paths from 50nm for the last 30 minutes</p>
                    <p><strong>Weather Radar:</strong> Live precipitation and storm data</p>
                    <p><strong>Airport Features:</strong> Runways, taxiways, and airport structures</p>
                  </div>
                  <p className="text-blue-300">
                    💡 Your layer preferences are saved automatically.
                  </p>
                </div>
              }
            />
          </div>
          <div className="space-y-1">
            {controls.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                className={`w-full flex items-center justify-between py-1 px-2 rounded text-xs
                  transition-colors ${displayOptions[key]
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

          {/* Refresh Map Data Button */}
          {selectedAirport && (
            <div className="mt-2 pt-2 border-t border-slate-600">
              <button
                onClick={handleRefreshMapData}
                disabled={isRefreshing}
                className="w-full flex items-center justify-center py-2 px-2 rounded text-xs
                  bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh Map Data'}</span>
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
