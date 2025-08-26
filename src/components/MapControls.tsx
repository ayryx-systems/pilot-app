'use client';

import React, { useState } from 'react';
import { MapDisplayOptions } from '@/types';
import { Settings, Eye, EyeOff, Map } from 'lucide-react';

interface MapControlsProps {
  displayOptions: MapDisplayOptions;
  onOptionsChange: (options: MapDisplayOptions) => void;
}

export function MapControls({ displayOptions, onOptionsChange }: MapControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = (key: keyof MapDisplayOptions) => {
    onOptionsChange({
      ...displayOptions,
      [key]: !displayOptions[key],
    });
  };

  const controls = [
    { key: 'showRunways' as const, label: 'Runways', icon: '✈️' },
    { key: 'showDmeRings' as const, label: 'DME Rings', icon: '⭕' },
    { key: 'showWaypoints' as const, label: 'Waypoints', icon: '📍' },
    { key: 'showPireps' as const, label: 'PIREPs', icon: '⚠️' },
    { key: 'showTracks' as const, label: 'Ground Tracks', icon: '🛤️' },
  ];

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-600">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-700/50 rounded-lg"
      >
        <div className="flex items-center space-x-2">
          <Map className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Map Layers</span>
        </div>
        <Settings className={`w-4 h-4 text-gray-400 transition-transform ${
          isExpanded ? 'rotate-90' : ''
        }`} />
      </button>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="border-t border-slate-600 p-2">
          <div className="space-y-1">
            {controls.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                className={`w-full flex items-center justify-between p-2 rounded text-sm
                  hover:bg-slate-700/50 transition-colors ${
                    displayOptions[key] 
                      ? 'text-white bg-slate-700/30' 
                      : 'text-gray-400'
                  }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-xs">{icon}</span>
                  <span>{label}</span>
                </div>
                {displayOptions[key] ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="border-t border-slate-600 mt-2 pt-2">
            <div className="flex space-x-1">
              <button
                onClick={() => {
                  const allOn: MapDisplayOptions = {
                    showRunways: true,
                    showDmeRings: true,
                    showWaypoints: true,
                    showPireps: true,
                    showTracks: true,
                  };
                  onOptionsChange(allOn);
                }}
                className="flex-1 px-2 py-1 text-xs bg-green-700/30 hover:bg-green-700/50 
                         text-green-400 rounded transition-colors"
              >
                All On
              </button>
              <button
                onClick={() => {
                  const allOff: MapDisplayOptions = {
                    showRunways: false,
                    showDmeRings: false,
                    showWaypoints: false,
                    showPireps: false,
                    showTracks: false,
                  };
                  onOptionsChange(allOff);
                }}
                className="flex-1 px-2 py-1 text-xs bg-red-700/30 hover:bg-red-700/50 
                         text-red-400 rounded transition-colors"
              >
                All Off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
