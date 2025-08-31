'use client';

import React, { useState } from 'react';
import { SituationSummary, ConnectionStatus } from '@/types';
import { AlertTriangle, CheckCircle, Info, Cloud, Wind, Plane, Radio, Zap, MapPin, Navigation, Car } from 'lucide-react';
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
  isDemo?: boolean;
}

export function SituationOverview({
  summary,
  weather,
  loading,
  connectionStatus,
  airportCode,
  summaryMetadata,
  isDemo
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

  return (
    <div className="relative" style={{ zIndex: 2147483647 }}>

      {/* Demo Mode Indicator */}
      {isDemo && (
        <div className="mb-3 p-3 rounded-lg bg-orange-600/20 border-2 border-orange-500/50 text-orange-200">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            STORM DEMO MODE - Denver International Airport
          </div>
          <div className="text-xs text-orange-300 mt-1">
            Simulating severe weather conditions with windshear reports and reduced visibility
          </div>
        </div>
      )}

      {/* Current Situation - Fixed Element */}
      {summary && (
        <div className="p-2 rounded-lg border-2 mb-3 bg-slate-700/50 border-slate-500/50 text-gray-200">
          <div className="text-sm leading-relaxed">
            {summary.situation_overview}
          </div>
        </div>
      )}

      {/* Main Condition Grid - Always Visible */}
      {summary?.conditions ? (
        <div className="space-y-2">
          {/* Primary Grid - All conditions visible */}
          <div className="grid grid-cols-2 gap-3">
            {/* Weather Button */}
            {(weather || summary.conditions.weather) && (
              <button
                onClick={() => setIsWeatherModalOpen(true)}
                className={`flex flex-col p-2 rounded-xl text-left transition-all duration-200 hover:scale-105 border-2 shadow-lg hover:shadow-xl hover:bg-slate-600 ${
                  getStatusColor(summary.conditions.weather?.status)
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center">
                    <Cloud className="w-5 h-5 text-white mr-2" />
                    <span className={`text-sm font-semibold ${getStatusTextColor(summary.conditions.weather?.status)}`}>Weather</span>
                  </div>
                  {getStatusIcon(summary.conditions.weather?.status)}
                </div>
                <div className="text-xs text-gray-300 leading-tight">
                  {summary.conditions.weather?.short_summary || 
                   (summary.conditions.weather?.status === 'check-overview' ? 'Check METAR' : 
                    summary.conditions.weather?.status?.charAt(0).toUpperCase() + 
                    summary.conditions.weather?.status?.slice(1) || 'Normal conditions')}
                </div>
              </button>
            )}

            {/* Other Conditions */}
            {Object.entries(summary.conditions)
              .filter(([key]) => key !== 'weather' && key !== 'processing')
              .slice(0, 5) // Show up to 5 more conditions (6 total)
              .map(([key, condition]) => {
                const getConditionIcon = (conditionKey: string) => {
                  switch (conditionKey.toLowerCase()) {
                    case 'traffic':
                      return <Plane className="w-5 h-5 text-white" />;
                    case 'approach':
                      return <Navigation className="w-5 h-5 text-white" />;
                    case 'runway':
                      return <MapPin className="w-5 h-5 text-white" />;
                    case 'ground':
                      return <Car className="w-5 h-5 text-white" />;
                    case 'special':
                      return <AlertTriangle className="w-5 h-5 text-white" />;
                    default:
                      return <Info className="w-5 h-5 text-white" />;
                  }
                };

                return (
                  <button
                    key={key}
                    onClick={() => openConditionModal(key, condition)}
                    className={`flex flex-col p-2 rounded-xl text-left transition-all duration-200 hover:scale-105 border-2 shadow-lg hover:shadow-xl hover:bg-slate-600 ${
                      getStatusColor(condition.status)
                    }`}
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
                );
              })}
          </div>

          {/* Additional Conditions if any - Show as regular buttons below the main grid */}
          {Object.entries(summary.conditions).length > 6 && (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(summary.conditions)
                .filter(([key]) => key !== 'weather' && key !== 'processing')
                .slice(5) // Additional conditions beyond the first 6
                .map(([key, condition]) => {
                  const getConditionIcon = (conditionKey: string) => {
                    switch (conditionKey.toLowerCase()) {
                      case 'traffic':
                        return <Plane className="w-5 h-5 text-white" />;
                      case 'approach':
                        return <Navigation className="w-5 h-5 text-white" />;
                      case 'runway':
                        return <MapPin className="w-5 h-5 text-white" />;
                      case 'ground':
                        return <Car className="w-5 h-5 text-white" />;
                      case 'special':
                        return <AlertTriangle className="w-5 h-5 text-white" />;
                      default:
                        return <Info className="w-5 h-5 text-white" />;
                    }
                  };

                  return (
                    <button
                      key={key}
                      onClick={() => openConditionModal(key, condition)}
                      className={`flex flex-col p-2 rounded-xl text-left transition-all duration-200 hover:scale-105 border-2 shadow-lg hover:shadow-xl hover:bg-slate-600 ${
                        getStatusColor(condition.status)
                      }`}
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
                  );
                })}
            </div>
          )}
        </div>
      ) : (
        // Loading/No Data State
        <div className="grid grid-cols-2 gap-3">
          {['Weather', 'Traffic', 'Approach', 'Runway', 'Ground', 'Special'].map((label) => (
            <div key={label} className="flex flex-col p-2 rounded-xl border-2 border-slate-600 bg-slate-700">
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
}
