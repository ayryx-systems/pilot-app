'use client';

import React, { useState } from 'react';
import { SituationSummary, ConnectionStatus } from '@/types';
import { AlertTriangle, CheckCircle, Info, Cloud, Wind } from 'lucide-react';
import { WeatherModal } from './WeatherModal';
import { ConditionModal } from './ConditionModal';

interface WeatherData {
  metar: string;
  metarFriendly: string;
  conditions: string;
  temperature?: string;
  wind?: {
    direction: number;
    speed: number;
    gust?: number;
  };
  visibility?: string;
  timestamp: string;
}

interface SituationOverviewProps {
  summary?: SituationSummary | null;
  weather?: WeatherData;
  loading: boolean;
  connectionStatus: ConnectionStatus;
  airportCode?: string;
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
  airportCode,
  summaryMetadata
}: SituationOverviewProps) {
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<{ key: string; condition: any } | null>(null);

  const openConditionModal = (key: string, condition: any) => {
    setSelectedCondition({ key, condition });
  };

  const closeConditionModal = () => {
    setSelectedCondition(null);
  };
  const getStatusIcon = (status?: 'normal' | 'caution' | 'warning' | 'active' | 'inactive' | 'unavailable' | 'check-overview') => {
    switch (status) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'caution':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
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
      <h2 className="text-base font-semibold mb-2 text-white">Situation Overview</h2>

      {/* Situation Summary - Compact */}
      {summary && (
        <div className="mb-3 p-2 bg-slate-700 rounded-md">
          <p className="text-xs text-gray-200 leading-relaxed">{summary.situation_overview}</p>
        </div>
      )}

      {/* 2x3 Condition Grid */}
      {summary?.conditions && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Weather Button - Half Width */}
          {(weather || summary.conditions.weather) && (
            <button
              onClick={() => setIsWeatherModalOpen(true)}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors text-left"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center">
                  {getStatusIcon(summary.conditions.weather?.status)}
                  <span className="text-xs font-medium text-white ml-1">Weather</span>
                </div>
              </div>
              <div className="text-xs text-gray-300 truncate">
                {summary.conditions.weather?.short_summary || weather?.conditions || 'Weather unavailable'}
              </div>
            </button>
          )}

          {/* Other Conditions - Grid Layout */}
          {Object.entries(summary.conditions)
            .filter(([key]) => key !== 'weather')
            .slice(0, 5) // Limit to 5 additional conditions for 2x3 grid
            .map(([key, condition]) => (
              <button
                key={key}
                onClick={() => openConditionModal(key, condition)}
                className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-md transition-colors text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center">
                    {getStatusIcon(condition.status)}
                    <span className="text-xs font-medium text-white ml-1 capitalize truncate">{key}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-300 truncate">
                  {condition.short_summary || condition.description || 'No data'}
                </div>
              </button>
            ))}
        </div>
      )}

      {/* Status Indicators */}
      {(summary?.fallback || (summaryMetadata && !summaryMetadata.active)) && (
        <div className="flex items-center p-1.5 bg-yellow-900/30 rounded text-yellow-200 text-xs">
          <Info className="w-3 h-3 mr-1 flex-shrink-0" />
          <span className="truncate">
            {summaryMetadata && !summaryMetadata.active
              ? 'Processing inactive'
              : 'Cached data'
            }
          </span>
        </div>
      )}

      {/* Loading State */}
      {!summary && (
        <div className="text-center text-gray-400 py-4">
          <Info className="w-6 h-6 mx-auto mb-1" />
          <p className="text-xs">
            {connectionStatus.connected
              ? 'Loading analysis...'
              : 'Connect to load data'
            }
          </p>
        </div>
      )}

      {/* Weather Modal */}
      <WeatherModal
        isOpen={isWeatherModalOpen}
        onClose={() => setIsWeatherModalOpen(false)}
        airportCode={airportCode || 'Unknown'}
        weatherData={weather}
        summaryData={summary?.conditions?.weather}
      />

      {/* Condition Modal */}
      {selectedCondition && (
        <ConditionModal
          isOpen={!!selectedCondition}
          onClose={closeConditionModal}
          title={selectedCondition.key}
          condition={selectedCondition.condition}
          airportCode={airportCode}
        />
      )}
    </div>
  );
}
