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
    <div>
      {/* Compact Header with Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-2 hover:bg-slate-700/30 rounded p-1 transition-colors"
      >
        <h2 className="text-sm font-semibold text-white">Situation Overview</h2>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Always Visible: Quick Status Strip */}
      {summary?.conditions && (
        <div className="flex gap-1 mb-2">
          {/* Critical status indicators only */}
          {(weather || summary.conditions.weather) && (
            <button
              onClick={() => setIsWeatherModalOpen(true)}
              className="flex-1 flex items-center justify-center p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
            >
              {getStatusIcon(summary.conditions.weather?.status)}
              <span className="ml-1 truncate">Weather</span>
            </button>
          )}

          {/* Show only 3 most important conditions in compact mode */}
          {Object.entries(summary.conditions)
            .filter(([key]) => key !== 'weather')
            .slice(0, 3)
            .map(([key, condition]) => (
              <button
                key={key}
                onClick={() => openConditionModal(key, condition)}
                className="flex-1 flex items-center justify-center p-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded text-xs transition-colors"
              >
                {getStatusIcon(condition.status)}
                <span className="ml-1 truncate capitalize">{key}</span>
              </button>
            ))}
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-2">
          {/* Situation Summary */}
          {summary && (
            <div className="p-2 bg-slate-700/30 rounded text-xs text-gray-200">
              {summary.situation_overview}
            </div>
          )}

          {/* Full Condition Grid */}
          {summary?.conditions && (
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(summary.conditions)
                .filter(([key]) => key !== 'weather')
                .slice(3) // Show remaining conditions
                .map(([key, condition]) => (
                  <button
                    key={key}
                    onClick={() => openConditionModal(key, condition)}
                    className="p-1.5 bg-slate-700/30 hover:bg-slate-600/30 rounded text-xs transition-colors text-left"
                  >
                    <div className="flex items-center mb-1">
                      {getStatusIcon(condition.status)}
                      <span className="ml-1 font-medium capitalize truncate">{key}</span>
                    </div>
                    <div className="text-gray-300 truncate">
                      {condition.short_summary || condition.description || 'No data'}
                    </div>
                  </button>
                ))}
            </div>
          )}

          {/* Status Indicators */}
          {(summary?.fallback || (summaryMetadata && !summaryMetadata.active)) && (
            <div className="flex items-center p-1 bg-yellow-900/20 rounded text-yellow-200 text-xs">
              <Info className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">
                {summaryMetadata && !summaryMetadata.active
                  ? 'Processing inactive'
                  : 'Cached data'
                }
              </span>
            </div>
          )}
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
