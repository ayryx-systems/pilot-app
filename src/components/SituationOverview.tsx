'use client';

import React, { useState } from 'react';
import { SituationSummary, ConnectionStatus } from '@/types';
import { AlertTriangle, CheckCircle, Info, Cloud, Wind } from 'lucide-react';
import { WeatherModal } from './WeatherModal';

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
  const [expandedConditions, setExpandedConditions] = useState<Set<string>>(new Set());

  const toggleConditionExpansion = (conditionKey: string) => {
    setExpandedConditions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conditionKey)) {
        newSet.delete(conditionKey);
      } else {
        newSet.add(conditionKey);
      }
      return newSet;
    });
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

      {/* Compact Condition Grid */}
      {summary?.conditions && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Weather Button - Compact */}
          {(weather || summary.conditions.weather) && (
            <button
              onClick={() => setIsWeatherModalOpen(true)}
              className="col-span-2 p-2 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {getStatusIcon(summary.conditions.weather?.status)}
                  <span className="text-xs font-medium text-white ml-1">Weather</span>
                </div>
                <div className="text-xs text-gray-400">Details</div>
              </div>
              <div className="text-xs text-gray-300 mt-1 truncate">
                {summary.conditions.weather?.short_summary || weather?.conditions || 'Weather unavailable'}
              </div>
            </button>
          )}

          {/* Other Conditions - Grid Layout */}
          {Object.entries(summary.conditions)
            .filter(([key]) => key !== 'weather')
            .map(([key, condition]) => {
              const isExpanded = expandedConditions.has(key);
              return (
                <div key={key} className="col-span-1">
                  <button
                    onClick={() => toggleConditionExpansion(key)}
                    className="w-full p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-md transition-colors text-left"
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

                  {/* Expanded Details - Full Width */}
                  {isExpanded && (
                    <div className="col-span-2 mt-2 p-2 bg-slate-800/50 rounded-md border-l-2 border-slate-600">
                      <p className="text-xs text-gray-300 leading-relaxed">
                        {condition.long_summary || condition.description || 'Detailed information not available'}
                      </p>
                      <button
                        onClick={() => toggleConditionExpansion(key)}
                        className="mt-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        Collapse
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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
    </div>
  );
}
