'use client';

import React from 'react';
import { SituationSummary, ConnectionStatus } from '@/types';
import { AlertTriangle, CheckCircle, Info, Cloud, Wind } from 'lucide-react';

interface WeatherData {
  conditions: string;
  temperature?: string;
  wind?: {
    direction: number;
    speed: number;
    gust?: number;
  };
  visibility?: string;
}

interface SituationOverviewProps {
  summary?: SituationSummary | null;
  weather?: WeatherData;
  loading: boolean;
  connectionStatus: ConnectionStatus;
  summaryMetadata?: {
    active: boolean;
    generated: boolean;
  };
}

export function SituationOverview({ 
  summary, 
  weather, 
  loading,
  connectionStatus,
  summaryMetadata
}: SituationOverviewProps) {
  const getStatusIcon = (status?: 'normal' | 'caution' | 'warning' | 'inactive' | 'unavailable' | 'check-overview') => {
    switch (status) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'caution':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'inactive':
      case 'unavailable':
        return <Info className="w-4 h-4 text-gray-400" />;
      case 'check-overview':
        return <Cloud className="w-4 h-4 text-blue-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <h2 className="text-lg font-semibold mb-3 text-white">Situation Overview</h2>
        <div className="space-y-2">
          <div className="h-4 bg-slate-600 rounded"></div>
          <div className="h-4 bg-slate-600 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 text-white">Situation Overview</h2>
      
      {/* Weather Summary */}
      {weather && (
        <div className="mb-4 p-3 bg-slate-700 rounded-lg">
          <div className="flex items-center mb-2">
            <Cloud className="w-4 h-4 text-blue-400 mr-2" />
            <span className="text-sm font-medium text-white">Current Weather</span>
          </div>
          <div className="text-xs text-gray-300 space-y-1">
            <div>Conditions: {weather.conditions}</div>
            {weather.wind && (
              <div className="flex items-center">
                <Wind className="w-3 h-3 mr-1" />
                Wind: {weather.wind.direction}° at {weather.wind.speed}kt
                {weather.wind.gust && ` gusting ${weather.wind.gust}kt`}
              </div>
            )}
            {weather.visibility && <div>Visibility: {weather.visibility}</div>}
            {weather.temperature && <div>Temperature: {weather.temperature}°C</div>}
          </div>
        </div>
      )}

      {/* Situation Summary */}
      {summary ? (
        <div className="space-y-3">
          <div className="p-3 bg-slate-700 rounded-lg">
            <p className="text-sm text-gray-200">{summary.situation_overview}</p>
          </div>

          {/* Conditions */}
          {summary.conditions && (
            <div className="space-y-2">
              {Object.entries(summary.conditions).map(([key, condition]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(condition.status)}
                    <span className="text-sm capitalize text-white">{key}</span>
                  </div>
                  <span className="text-xs text-gray-300">{condition.description}</span>
                </div>
              ))}
            </div>
          )}

          {(summary.fallback || (summaryMetadata && !summaryMetadata.active)) && (
            <div className="flex items-center p-2 bg-yellow-900/30 rounded text-yellow-200 text-xs">
              <Info className="w-3 h-3 mr-1" />
              {summaryMetadata && !summaryMetadata.active 
                ? 'Airport data processing not active'
                : 'Using cached data'
              }
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-8">
          <Info className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">
            {connectionStatus.connected 
              ? 'Loading situation analysis...' 
              : 'Connect to load situation data'
            }
          </p>
        </div>
      )}
    </div>
  );
}
