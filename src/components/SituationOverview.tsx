'use client';

import React, { useState, useMemo, memo } from 'react';
import { SituationSummary, ConnectionStatus, BaselineData } from '@/types';
import { AlertTriangle, CheckCircle, Info, Cloud, Wind, Plane, Navigation, ChevronUp, ChevronDown } from 'lucide-react';
import { WeatherModal } from './WeatherModal';
import { ConditionModal } from './ConditionModal';
import { WeatherGraphs } from './WeatherGraphs';
import { utcToAirportLocal, formatAirportLocalTime } from '@/utils/airportTime';
import { HelpButton } from './HelpButton';

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
  visibility?: number | string;
  clouds?: Array<{ coverage: string; altitude: number }>;
  cloudbase?: number | null;
  timestamp: string;
  taf?: {
    rawTAF: string;
    tafFriendly?: string;
    forecast?: {
      periods: Array<{
        timeFrom: string;
        timeTo: string;
        changeType: string;
        wind?: { direction: number; speed: number; gust?: number };
        visibility?: number | string;
        weather?: string;
        clouds?: Array<{ coverage: string; altitude: number }>;
        cloudbase?: number | null;
      }>;
      summary?: string;
    };
  };
  graph?: {
    timeSlots: string[];
    visibility: (number | null)[];
    cloudbase: (number | null)[];
    wind: (number | null)[];
    metarRaw: string | null;
    tafRaw: string | null;
  } | null;
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
  baseline?: BaselineData | null;
  baselineLoading?: boolean;
  isDemo?: boolean;
  selectedTime?: Date;
}

export const SituationOverview = memo(function SituationOverview({
  summary,
  weather,
  loading,
  connectionStatus,
  airportCode,
  summaryMetadata,
  baseline,
  baselineLoading,
  isDemo,
  selectedTime,
}: SituationOverviewProps) {
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<{ key: string; condition: any } | null>(null);
  const [isWeatherExpanded, setIsWeatherExpanded] = useState(false);

  // All hooks must be called before any early returns
  const filteredConditions = useMemo(() => {
    return summary?.conditions
      ? Object.entries(summary.conditions).filter(([key]) => 
          key !== 'weather' && 
          key !== 'processing' && 
          key !== 'runway' && 
          key !== 'ground'
        )
      : [];
  }, [summary?.conditions]);

  const currentTime = selectedTime || new Date();
  const isNow = selectedTime ? (() => {
    const now = new Date();
    const diff = Math.abs(selectedTime.getTime() - now.getTime());
    return diff <= 60000;
  })() : true;


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

  const getStatusColor = (status?: 'normal' | 'caution' | 'warning' | 'active' | 'inactive' | 'unavailable' | 'check-overview') => {
    switch (status) {
      case 'warning':
        return 'bg-slate-700 border-red-500';
      case 'caution':
        return 'bg-slate-700 border-yellow-500';
      case 'check-overview':
        return 'bg-slate-700 border-blue-500';
      case 'inactive':
      case 'unavailable':
        return 'bg-slate-700 border-gray-500';
      default:
        return 'bg-slate-700 border-green-500';
    }
  };

  const getStatusTextColor = (status?: 'normal' | 'caution' | 'warning' | 'active' | 'inactive' | 'unavailable' | 'check-overview') => {
    switch (status) {
      case 'warning':
        return 'text-red-400';
      case 'caution':
        return 'text-yellow-400';
      case 'check-overview':
        return 'text-blue-400';
      case 'inactive':
      case 'unavailable':
        return 'text-gray-400';
      default:
        return 'text-green-400';
    }
  };

  // Function to determine overall alert level from all conditions
  const getOverallAlertLevel = (): 'normal' | 'caution' | 'warning' => {
    if (!summary?.conditions) return 'normal';

    const statuses = Object.values(summary.conditions)
      .map(condition => condition?.status)
      .filter((status): status is 'normal' | 'caution' | 'warning' => 
        status === 'normal' || status === 'caution' || status === 'warning'
      );

    if (statuses.some(s => s === 'warning')) return 'warning';
    if (statuses.some(s => s === 'caution')) return 'caution';
    return 'normal';
  };


  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-2">
          <div className="h-4 bg-slate-600 rounded"></div>
          <div className="h-4 bg-slate-600 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  const getConditionIcon = (conditionKey: string) => {
    switch (conditionKey.toLowerCase()) {
      case 'traffic':
        return <Plane className="w-5 h-5 text-white" />;
      case 'approach':
        return <Navigation className="w-5 h-5 text-white" />;
      case 'special':
        return <AlertTriangle className="w-5 h-5 text-white" />;
      default:
        return <Info className="w-5 h-5 text-white" />;
    }
  };

  return (
    <div className="relative space-y-4" style={{ zIndex: 2147483647 }}>
      {/* Current Situation Summary */}
      {summary && (
        <div className={`p-2 rounded-lg border-2 bg-slate-700/50 ${getStatusColor(getOverallAlertLevel())} text-gray-200`}>
          <div className="text-sm leading-relaxed">
            {summary.situation_overview}
          </div>
        </div>
      )}

      {/* CONDITIONS Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-slate-700"></div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Conditions
          </span>
          <HelpButton
            title="Airport Conditions"
            size="sm"
            content={
              <div className="space-y-2">
                <p>
                  Quick status indicators for key arrival factors at this airport.
                </p>
                <p>
                  <strong className="text-green-400">🟢 Green:</strong> Normal conditions - no concerns
                </p>
                <p>
                  <strong className="text-yellow-400">🟡 Yellow (Caution):</strong> Elevated conditions - plan accordingly
                </p>
                <p>
                  <strong className="text-red-400">🔴 Red (Warning):</strong> Significant concerns - review carefully
                </p>
                <div className="border-t border-slate-600 pt-2 mt-2">
                  <p className="font-semibold mb-1">Condition Types:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li><strong>Weather:</strong> Visibility, ceiling, wind, precipitation</li>
                    <li><strong>Traffic:</strong> Arrival volume and congestion</li>
                    <li><strong>Approach:</strong> Delays, approach procedures</li>
                    <li><strong>Special:</strong> NOTAMs, TFRs, closures</li>
                  </ul>
                </div>
                <p className="text-blue-300">
                  💡 Click on any condition for detailed information.
                </p>
              </div>
            }
          />
          <div className="h-px flex-1 bg-slate-700"></div>
        </div>

        {summary?.conditions ? (
          <div className="space-y-2">
            {/* Weather Card with Graphs */}
            {(weather || summary.conditions.weather) && (
              <div className={`rounded-xl border-2 border-slate-500 bg-slate-700/80 ${getStatusColor(summary.conditions.weather?.status)}`}>
                <button
                  onClick={() => setIsWeatherExpanded(!isWeatherExpanded)}
                  className="w-full flex flex-col p-2 hover:bg-slate-600/30 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center">
                      <Cloud className="w-5 h-5 text-white mr-2" />
                      <span className={`text-sm font-semibold ${getStatusTextColor(summary.conditions.weather?.status)}`}>Weather</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(summary.conditions.weather?.status)}
                      {isWeatherExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-300 leading-tight mb-2 text-left">
                    {summary.conditions.weather?.short_summary ||
                      (summary.conditions.weather?.status === 'check-overview' ? 'Check METAR' :
                        summary.conditions.weather?.status?.charAt(0).toUpperCase() +
                        summary.conditions.weather?.status?.slice(1) || 'Normal conditions')}
                  </div>
                </button>
                {isWeatherExpanded && weather && (
                  <div className="px-2 pb-2 border-t border-slate-600/50">
                    <WeatherGraphs
                      weather={weather}
                      selectedTime={currentTime}
                      isNow={isNow}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Other Conditions - Traffic, Approach, Special */}
            {filteredConditions.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {filteredConditions.map(([key, condition]) => (
                  <button
                    key={key}
                    onClick={() => openConditionModal(key, condition)}
                    className={`flex flex-col p-2 rounded-xl text-left transition-all duration-200 hover:scale-105 border-2 border-slate-500 bg-slate-700/80 hover:bg-slate-600 ${getStatusColor(condition.status)}`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center">
                        {getConditionIcon(key)}
                        <span className={`text-sm font-semibold capitalize ml-2 ${getStatusTextColor(condition.status)}`}>{key}</span>
                      </div>
                      {getStatusIcon(condition.status)}
                    </div>
                    <div className="text-xs text-gray-300 leading-tight">
                      {condition.short_summary ||
                        (condition.status?.charAt(0).toUpperCase() +
                          condition.status?.slice(1) || 'Normal conditions')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {['Weather', 'Traffic', 'Approach', 'Special'].map((label) => (
              <div key={label} className={`flex flex-col p-2 rounded-xl border-2 border-slate-600 bg-slate-700`}>
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center">
                    <div className="w-5 h-5 rounded-full bg-slate-500 animate-pulse mr-2"></div>
                    <span className="text-sm font-semibold text-gray-400">{label}</span>
                  </div>
                  <div className="w-4 h-4 rounded-full bg-slate-500 animate-pulse"></div>
                </div>
                <div className="text-xs text-gray-400 animate-pulse">
                  Loading...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
        isDemo={isDemo}
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
});
