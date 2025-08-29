'use client';

import React, { useState } from 'react';
import { SituationSummary, ConnectionStatus } from '@/types';
import { AlertTriangle, CheckCircle, Info, Cloud, Wind, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(false);

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
    <div className="relative" style={{ zIndex: 2147483647 }}>
      {/* Header - More compact */}
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-white">Situation Overview</h2>
      </div>

      {/* Main Condition Grid - Always Visible */}
      {summary?.conditions ? (
        <div className="space-y-2">
          {/* Primary Grid - All conditions visible */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* Weather Button */}
            {(weather || summary.conditions.weather) && (
              <button
                onClick={() => setIsWeatherModalOpen(true)}
                className="flex flex-col items-center justify-center p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-center transition-all duration-200 hover:scale-105"
              >
                <div className="flex items-center justify-center w-5 h-5 mb-1 rounded-full bg-slate-600">
                  <Cloud className="w-3 h-3 text-blue-400" />
                </div>
                <span className="text-xs font-medium text-white">Weather</span>
                <div className="flex items-center mt-1">
                  {getStatusIcon(summary.conditions.weather?.status)}
                  <span className="ml-1 text-xs text-gray-300 capitalize">
                    {summary.conditions.weather?.status || 'Normal'}
                  </span>
                </div>
              </button>
            )}

            {/* Other Conditions */}
            {Object.entries(summary.conditions)
              .filter(([key]) => key !== 'weather')
              .slice(0, 5) // Show up to 5 more conditions (6 total)
              .map(([key, condition]) => {
                const getConditionIcon = (conditionKey: string) => {
                  switch (conditionKey.toLowerCase()) {
                    case 'traffic':
                      return '✈️';
                    case 'approach':
                      return '🛬';
                    case 'runway':
                      return '🛫';
                    case 'ground':
                      return '🚛';
                    case 'special':
                      return '⚠️';
                    default:
                      return '📋';
                  }
                };

                return (
                  <button
                    key={key}
                    onClick={() => openConditionModal(key, condition)}
                    className="flex flex-col items-center justify-center p-1.5 bg-slate-700/70 hover:bg-slate-600/70 rounded-lg text-center transition-all duration-200 hover:scale-105"
                  >
                    <div className="flex items-center justify-center w-5 h-5 mb-1 rounded-full bg-slate-600/50">
                      <span className="text-sm">{getConditionIcon(key)}</span>
                    </div>
                    <span className="text-xs font-medium text-white capitalize">{key}</span>
                    <div className="flex items-center mt-1">
                      {getStatusIcon(condition.status)}
                      <span className="ml-1 text-xs text-gray-300 capitalize">
                        {condition.status || 'Normal'}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>

          {/* Expandable Details Section */}
          <div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between p-1.5 hover:bg-slate-700/30 rounded transition-colors"
            >
              <span className="text-xs font-medium text-gray-300">
                {isExpanded ? 'Hide Details' : 'Show Details'}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="mt-2 space-y-2 bg-slate-800 border border-slate-600 rounded-lg p-2 relative" style={{ zIndex: 2147483647 }}>
                {/* Situation Summary */}
                {summary && (
                  <div className="p-2 bg-slate-700/30 rounded text-xs text-gray-200 max-h-24 overflow-y-auto">
                    <div className="font-medium text-white mb-1">Current Situation</div>
                    <div className="text-xs leading-relaxed">
                      {summary.situation_overview}
                    </div>
                  </div>
                )}

                {/* Additional Conditions if any */}
                {Object.entries(summary.conditions).length > 6 && (
                  <div className="grid grid-cols-1 gap-1">
                    {Object.entries(summary.conditions)
                      .filter(([key]) => key !== 'weather')
                      .slice(5) // Additional conditions beyond the first 6
                      .map(([key, condition]) => (
                        <button
                          key={key}
                          onClick={() => openConditionModal(key, condition)}
                          className="p-1.5 bg-slate-700/30 hover:bg-slate-600/30 rounded text-left transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              {getStatusIcon(condition.status)}
                              <span className="ml-2 text-xs font-medium capitalize text-white">{key}</span>
                            </div>
                            <span className="text-xs text-gray-400 capitalize">{condition.status}</span>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Loading/No Data State
        <div className="grid grid-cols-2 gap-1.5">
          {['Weather', 'Traffic', 'Approach', 'Runway', 'Ground', 'Special'].map((label) => (
            <div key={label} className="flex flex-col items-center justify-center p-2 bg-slate-700/30 rounded-lg">
              <div className="w-6 h-6 mb-1 rounded-full bg-slate-600/50 animate-pulse"></div>
              <span className="text-xs font-medium text-gray-400">{label}</span>
              <span className="text-xs text-gray-500 mt-1">Loading...</span>
            </div>
          ))}
        </div>
      )}

      {/* Status Indicators */}
      {(summary?.fallback || (summaryMetadata && !summaryMetadata.active)) && (
        <div className="mt-3 flex items-center p-2 bg-yellow-900/20 rounded text-yellow-200 text-xs">
          <Info className="w-3 h-3 mr-2 flex-shrink-0" />
          <span>
            {summaryMetadata && !summaryMetadata.active
              ? 'Processing inactive'
              : 'Using cached data'
            }
          </span>
        </div>
      )}

      {/* Loading State */}
      {!summary && (
        <div className="text-center text-gray-400 py-2">
          <Info className="w-4 h-4 mx-auto mb-1" />
          <p className="text-xs">
            {connectionStatus.connected
              ? 'Loading...'
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
