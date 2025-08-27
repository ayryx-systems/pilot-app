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
      <h2 className="text-lg font-semibold mb-3 text-white">Situation Overview</h2>

      {/* Weather Button */}
      {(weather || summary?.conditions?.weather) && (
        <button
          onClick={() => setIsWeatherModalOpen(true)}
          className="mb-4 w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {getStatusIcon(summary?.conditions?.weather?.status)}
              <span className="text-sm font-medium text-white ml-2">Weather</span>
            </div>
            <div className="text-xs text-gray-400">Tap for details</div>
          </div>
          <div className="text-sm text-gray-300 mt-1">
            {summary?.conditions?.weather?.short_summary || weather?.conditions || 'Weather information unavailable'}
          </div>
        </button>
      )}

      {/* Situation Summary */}
      {summary ? (
        <div className="space-y-3">
          <div className="p-3 bg-slate-700 rounded-lg">
            <p className="text-sm text-gray-200">{summary.situation_overview}</p>
          </div>

          {/* Expandable Condition Cards */}
          {summary.conditions && (
            <div className="space-y-2">
              {Object.entries(summary.conditions)
                .filter(([key]) => key !== 'weather') // Exclude weather from conditions list
                .map(([key, condition]) => {
                  const isExpanded = expandedConditions.has(key);
                  return (
                    <div key={key} className="space-y-2">
                      {/* Condition Button */}
                      <button
                        onClick={() => toggleConditionExpansion(key)}
                        className="w-full p-3 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {getStatusIcon(condition.status)}
                            <span className="text-sm font-medium text-white ml-2 capitalize">{key}</span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {isExpanded ? 'Tap to collapse' : 'Tap for details'}
                          </div>
                        </div>
                        <div className="text-sm text-gray-300 mt-1">
                          {condition.short_summary || condition.description || 'No summary available'}
                        </div>
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="ml-4 p-3 bg-slate-800/50 rounded-lg border-l-2 border-slate-600">
                          <p className="text-sm text-gray-300 leading-relaxed">
                            {condition.long_summary || condition.description || 'Detailed information not available'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
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
