'use client';

import React, { useState, useMemo, memo } from 'react';
import { SituationSummary, ConnectionStatus, BaselineData, ArrivalForecast, FlightCategory } from '@/types';
import { AlertTriangle, CheckCircle, Info, Cloud, Plane, Navigation, ChevronUp, ChevronDown } from 'lucide-react';
import { WeatherModal } from './WeatherModal';
import { ConditionModal } from './ConditionModal';
import { WeatherGraphs } from './WeatherGraphs';
import { HelpButton } from './HelpButton';
import { FLIGHT_CATEGORY_COLORS } from '@/utils/weatherCategory';
import { useTimezonePreference } from '@/hooks/useTimezonePreference';
import { utcToAirportLocal, getAirportUTCOffset } from '@/utils/airportTime';

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
  arrivalForecast?: ArrivalForecast | null;
}

// Helper function to select appropriate time segment based on selected time
function selectTimeSegment(summary: SituationSummary | null, targetTime: Date): {
  situationOverview: string;
  status: 'normal' | 'caution' | 'alert';
  isNow: boolean;
  flightCategory: FlightCategory;
} {
  // Handle legacy format or missing data
  if (!summary || !summary.timeSegments || summary.timeSegments.length === 0) {
    return {
      situationOverview: summary?.situation_overview || "Situation data unavailable",
      status: 'normal',
      isNow: true,
      flightCategory: 'VFR',
    };
  }

  const targetTimeMs = targetTime.getTime();
  const now = Date.now();
  const isNow = Math.abs(targetTimeMs - now) <= 60000; // Within 1 minute

  // Find the appropriate time segment
  let selectedSegment = summary.timeSegments[0]; // Default to first segment

  for (const segment of summary.timeSegments) {
    const segmentStart = new Date(segment.timeFrom).getTime();
    const segmentEnd = new Date(segment.timeTo).getTime();

    // Check if target time falls within this segment
    if (targetTimeMs >= segmentStart && targetTimeMs < segmentEnd) {
      selectedSegment = segment;
      break;
    }
  }

  return {
    situationOverview: selectedSegment.situationOverview,
    status: selectedSegment.status,
    isNow,
    flightCategory: selectedSegment.flightCategory || 'VFR',
  };
}

export const SituationOverview = memo(function SituationOverview({
  summary,
  weather,
  loading,
  connectionStatus,
  airportCode,
  summaryMetadata,
  baseline,
  baselineLoading: _baselineLoading,
  isDemo,
  selectedTime,
  arrivalForecast,
}: SituationOverviewProps) {
  const { isUTC } = useTimezonePreference();
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Select appropriate time segment based on slider position
  // This now includes the flight category from the unified timeline (NOW uses METAR, future uses TAF)
  const activeSegment = useMemo(() => {
    return selectTimeSegment(summary, selectedTime || new Date());
  }, [summary, selectedTime]);

  // Use flight category from the unified timeline
  const flightCategory = activeSegment.flightCategory;
  const categoryColors = FLIGHT_CATEGORY_COLORS[flightCategory] || FLIGHT_CATEGORY_COLORS.unknown;

  const currentTime = selectedTime || new Date();
  const isNow = selectedTime ? (() => {
    const now = new Date();
    const diff = Math.abs(selectedTime.getTime() - now.getTime());
    return diff <= 60000;
  })() : true;

  // Determine if traffic is heavy
  const isHeavyTraffic = useMemo(() => {
    if (!arrivalForecast || !baseline || !arrivalForecast.arrivalCounts.length) {
      return false;
    }

    // Find the most recent completed 15-minute slot
    // We look backwards from the current time to find the last non-null slot
    const now = new Date();
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    let lastActualCount: number | null = null;
    let lastActualSlot: string | null = null;

    for (let i = arrivalForecast.timeSlots.length - 1; i >= 0; i--) {
      const count = arrivalForecast.arrivalCounts[i];
      if (count !== null && count !== undefined) {
        // Check if this slot is from today (if slotDates available)
        const isToday = arrivalForecast.slotDates 
          ? arrivalForecast.slotDates[i] === todayDateStr
          : true; // Legacy fallback
        
        if (!isToday) continue;
        
        // Check if this slot is in the past (completed)
        const slotTime = arrivalForecast.timeSlots[i];
        const [hours, minutes] = slotTime.split(':').map(Number);
        const slotDate = new Date(now);
        slotDate.setHours(hours, minutes, 0, 0);
        
        if (slotDate.getTime() <= now.getTime()) {
          lastActualCount = count;
          lastActualSlot = slotTime;
          break;
        }
      }
    }

    if (lastActualCount === null || !baseline.arrivals) {
      return false;
    }

    // Get baseline average for the same time slot
    // Baseline is keyed by HH:MM (local time)
    const baselineValue = baseline.arrivals[lastActualSlot];
    if (!baselineValue || !baselineValue.average) {
      return false;
    }

    // Consider "heavy" if actual is >150% of baseline average
    const threshold = baselineValue.average * 1.5;
    return lastActualCount > threshold;
  }, [arrivalForecast, baseline]);

  // Generate weather summary for collapsed state
  const weatherSummary = useMemo(() => {
    if (!weather) return null;
    
    const parts: string[] = [];
    
    // Flight category
    parts.push(flightCategory);
    
    // Ceiling/cloudbase
    if (weather.cloudbase !== null && weather.cloudbase !== undefined) {
      const cloudbaseAGL = Math.round(weather.cloudbase);
      parts.push(`Ceiling ${cloudbaseAGL} AGL`);
    } else if (weather.clouds && weather.clouds.length > 0) {
      const lowestCloud = weather.clouds[0];
      if (lowestCloud.coverage !== 'CLR' && lowestCloud.coverage !== 'SKC') {
        parts.push(`${lowestCloud.coverage} ${lowestCloud.altitude}`);
      }
    }
    
    // Visibility
    if (weather.visibility) {
      const vis = typeof weather.visibility === 'number' 
        ? `${weather.visibility}SM` 
        : weather.visibility;
      parts.push(`Vis ${vis}`);
    }
    
    // Wind
    if (weather.wind) {
      const windDir = weather.wind.direction.toString().padStart(3, '0');
      const windSpeed = weather.wind.speed;
      const gust = weather.wind.gust;
      const windStr = gust 
        ? `${windDir}@${windSpeed}G${gust}kt`
        : `${windDir}@${windSpeed}kt`;
      parts.push(windStr);
    }
    
    return parts.join(', ');
  }, [weather, flightCategory]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openConditionModal = (key: string, condition: any) => {
    setSelectedCondition({ key, condition });
  };

  const closeConditionModal = () => {
    setSelectedCondition(null);
  };
  const getStatusIcon = (status?: 'normal' | 'caution' | 'warning' | 'alert' | 'active' | 'inactive' | 'unavailable' | 'check-overview') => {
    switch (status) {
      case 'warning':
      case 'alert':
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

  const getStatusColor = (status?: 'normal' | 'caution' | 'warning' | 'alert' | 'active' | 'inactive' | 'unavailable' | 'check-overview') => {
    switch (status) {
      case 'warning':
      case 'alert':
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

  const getStatusTextColor = (status?: 'normal' | 'caution' | 'warning' | 'alert' | 'active' | 'inactive' | 'unavailable' | 'check-overview') => {
    switch (status) {
      case 'warning':
      case 'alert':
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
    <div className="relative space-y-4">
      {/* Current/Forecast Situation Summary */}
      {summary && (
        <div className={`p-2 rounded-lg border-2 bg-slate-700/50 ${getStatusColor(activeSegment.status)} text-gray-200`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {activeSegment.isNow ? (
                <span className="text-xs font-semibold text-green-400 uppercase tracking-wide flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  Live
                </span>
              ) : (
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                  📅 Forecast
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Heavy Traffic Indicator */}
              {isHeavyTraffic && (
                <div className="px-2 py-0.5 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/60">
                  Heavy Traffic
                </div>
              )}
              {/* Flight Category Badge */}
              <div 
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{ 
                  backgroundColor: categoryColors.bg,
                  color: categoryColors.color,
                  border: `1px solid ${categoryColors.border}`
                }}
              >
                {flightCategory}
              </div>
            </div>
          </div>
          <div className="text-sm leading-relaxed">
            {activeSegment.situationOverview}
          </div>
        </div>
      )}

      {/* Weather Card with Graphs - Always visible */}
      {weather && (() => {
        const now = new Date();
        const isNowMode = selectedTime ? Math.abs(selectedTime.getTime() - now.getTime()) < 60000 : true;
        const timeLabel = isNowMode 
          ? 'Now'
          : isUTC
            ? `at ${(selectedTime || now).getUTCHours().toString().padStart(2, '0')}:${(selectedTime || now).getUTCMinutes().toString().padStart(2, '0')}Z`
            : (() => {
                const timeToFormat = selectedTime || now;
                const localTime = airportCode && baseline 
                  ? utcToAirportLocal(timeToFormat, airportCode, baseline)
                  : timeToFormat;
                return `at ${localTime.getUTCHours().toString().padStart(2, '0')}:${localTime.getUTCMinutes().toString().padStart(2, '0')}`;
              })();
        
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-slate-700"></div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Weather
              </span>
              <div className="h-px flex-1 bg-slate-700"></div>
            </div>
            
            <div className="rounded-xl border-2 border-slate-500 bg-slate-700/80">
              <button
                onClick={() => setIsWeatherExpanded(!isWeatherExpanded)}
                className="w-full flex flex-col p-2 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center">
                    <Cloud className="w-5 h-5 text-white mr-2" />
                    <span className="text-sm font-semibold text-white">Weather Conditions ({timeLabel})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isWeatherExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
                {weatherSummary && (
                  <div className="text-xs text-gray-200 leading-tight font-medium text-left">
                    {weatherSummary}
                  </div>
                )}
              </button>
              {isWeatherExpanded && (
                <div className="px-2 pb-2 border-t border-slate-600/50">
                  <WeatherGraphs
                    weather={weather}
                    selectedTime={currentTime}
                    isNow={isNow}
                    airportCode={airportCode}
                    baseline={baseline}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })()}


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
