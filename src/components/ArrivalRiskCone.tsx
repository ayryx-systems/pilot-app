'use client';

import React, { useMemo } from 'react';
import {
  ArrivalSituationResponse,
  FlightCategory,
} from '@/types';

interface ArrivalRiskConeProps {
  situation: ArrivalSituationResponse | null;
  loading?: boolean;
  error?: string;
  onReferenceDayClick?: (date: string, timeSlot: string) => void;
}

function getFlightCategoryColor(category: FlightCategory): string {
  switch (category) {
    case 'VFR':
      return '#22c55e';
    case 'MVFR':
      return '#3b82f6';
    case 'IFR':
      return '#ef4444';
    case 'LIFR':
      return '#a855f7';
    default:
      return '#6b7280';
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export default function ArrivalRiskCone({
  situation,
  loading = false,
  error,
  onReferenceDayClick,
}: ArrivalRiskConeProps) {
  const coneData = useMemo(() => {
    if (!situation?.distribution) return null;

    const { distribution } = situation;
    const baseline = distribution.baseline;
    const range = distribution.max - distribution.min;
    const scale = range > 0 ? 100 / range : 1;

    return {
      baseline,
      baselinePos: (baseline - distribution.min) * scale,
      p10Pos: (distribution.p10 - distribution.min) * scale,
      p25Pos: (distribution.p25 - distribution.min) * scale,
      p50Pos: (distribution.p50 - distribution.min) * scale,
      p75Pos: (distribution.p75 - distribution.min) * scale,
      p90Pos: (distribution.p90 - distribution.min) * scale,
      p95Pos: (distribution.p95 - distribution.min) * scale,
      min: distribution.min,
      max: distribution.max,
    };
  }, [situation]);

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/3 mb-4" />
          <div className="h-32 bg-slate-700 rounded mb-4" />
          <div className="h-4 bg-slate-700 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-red-500/30">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (!situation) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="text-slate-500 text-sm text-center">
          Select an arrival time to see the forecast
        </div>
      </div>
    );
  }

  if (situation.insufficientData) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-amber-500/30">
        <div className="text-amber-400 text-sm">{situation.message}</div>
      </div>
    );
  }

  if (situation.error) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-red-500/30">
        <div className="text-red-400 text-sm">{situation.error}</div>
      </div>
    );
  }

  const { distribution, goAroundRate, extendedApproachProbability, referenceDays, conditions, explanation, matchCount } = situation;
  const flightCategoryColor = getFlightCategoryColor(conditions.flightCategory);

  return (
    <div className="bg-slate-800/60 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">Arrival Duration Forecast</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Based on {matchCount} similar historical situations
          </p>
        </div>
        <div
          className="px-2 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: `${flightCategoryColor}20`, color: flightCategoryColor }}
        >
          {conditions.flightCategory}
        </div>
      </div>

      <div className="p-4">
        {coneData && (
          <div className="mb-6">
            <div className="relative h-20 bg-slate-900/50 rounded-lg overflow-hidden">
              <div
                className="absolute top-0 bottom-0 opacity-20"
                style={{
                  left: `${coneData.p10Pos}%`,
                  right: `${100 - coneData.p90Pos}%`,
                  background: 'linear-gradient(90deg, #22c55e, #22c55e 30%, #eab308 50%, #ef4444 80%, #ef4444)',
                }}
              />

              <div
                className="absolute top-0 bottom-0 opacity-40"
                style={{
                  left: `${coneData.p25Pos}%`,
                  right: `${100 - coneData.p75Pos}%`,
                  background: 'linear-gradient(90deg, #22c55e, #eab308 50%, #ef4444)',
                }}
              />

              <div
                className="absolute top-1/4 bottom-1/4 rounded"
                style={{
                  left: `${coneData.p50Pos}%`,
                  width: '3px',
                  marginLeft: '-1.5px',
                  backgroundColor: '#fff',
                  boxShadow: '0 0 8px rgba(255,255,255,0.5)',
                }}
              />

              {coneData.baselinePos >= 0 && coneData.baselinePos <= 100 && (
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-dashed border-blue-400"
                  style={{
                    left: `${coneData.baselinePos}%`,
                  }}
                />
              )}

              <div className="absolute bottom-1 left-2 text-xs text-slate-400">
                {formatDuration(coneData.min)}
              </div>
              <div className="absolute bottom-1 right-2 text-xs text-slate-400">
                {formatDuration(coneData.max)}
              </div>
            </div>

            <div className="flex justify-between mt-2 text-xs">
              <div className="text-green-400">P10: {formatDuration(distribution.p10)}</div>
              <div className="text-white font-medium">P50: {formatDuration(distribution.p50)}</div>
              <div className="text-red-400">P90: {formatDuration(distribution.p90)}</div>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 border-t-2 border-dashed border-blue-400" />
                <span>Baseline ({formatDuration(distribution.baseline)})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 bg-white rounded-sm" />
                <span>Median</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-900/40 rounded p-3">
            <div className="text-slate-400 text-xs mb-1">Extended Approach Risk</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">+5 min</span>
                <span className="text-slate-300">{extendedApproachProbability.over5min}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">+10 min</span>
                <span className="text-amber-400">{extendedApproachProbability.over10min}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">+15 min</span>
                <span className="text-orange-400">{extendedApproachProbability.over15min}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">+20 min</span>
                <span className="text-red-400">{extendedApproachProbability.over20min}%</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 rounded p-3">
            <div className="text-slate-400 text-xs mb-1">Operational Metrics</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Go-Around Rate</span>
                <span className={goAroundRate > 2 ? 'text-amber-400' : 'text-slate-300'}>
                  {goAroundRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Time of Day</span>
                <span className="text-slate-300 capitalize">{conditions.timeOfDay}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Trend</span>
                <span className={
                  conditions.trend === 'improving' ? 'text-green-400' :
                  conditions.trend === 'deteriorating' ? 'text-red-400' : 'text-slate-300'
                }>
                  {conditions.trend}
                </span>
              </div>
              {conditions.hadIFR && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Recent IFR</span>
                  <span className="text-amber-400">Yes (backlog)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {(referenceDays.typical || referenceDays.worstCase) && (
          <div className="border-t border-slate-700 pt-3">
            <div className="text-slate-400 text-xs mb-2">Reference Days (Real Historical Data)</div>
            <div className="grid grid-cols-2 gap-2">
              {referenceDays.typical && (
                <button
                  className="bg-slate-900/40 hover:bg-slate-900/60 rounded p-2 text-left transition-colors"
                  onClick={() => onReferenceDayClick?.(referenceDays.typical!.date, referenceDays.typical!.timeSlot)}
                >
                  <div className="text-green-400 text-xs font-medium mb-1">Typical Day</div>
                  <div className="text-slate-300 text-xs">{referenceDays.typical.date}</div>
                  <div className="text-slate-500 text-xs">
                    {formatDuration(referenceDays.typical.p50 || 0)} median
                  </div>
                  <div className="text-slate-500 text-xs">
                    {referenceDays.typical.matchScore}% match
                  </div>
                </button>
              )}
              {referenceDays.worstCase && (
                <button
                  className="bg-slate-900/40 hover:bg-slate-900/60 rounded p-2 text-left transition-colors"
                  onClick={() => onReferenceDayClick?.(referenceDays.worstCase!.date, referenceDays.worstCase!.timeSlot)}
                >
                  <div className="text-red-400 text-xs font-medium mb-1">Worst Case</div>
                  <div className="text-slate-300 text-xs">{referenceDays.worstCase.date}</div>
                  <div className="text-slate-500 text-xs">
                    {formatDuration(referenceDays.worstCase.max || 0)} max
                  </div>
                  {referenceDays.worstCase.goArounds && referenceDays.worstCase.goArounds > 0 && (
                    <div className="text-amber-500 text-xs">
                      {referenceDays.worstCase.goArounds} go-around(s)
                    </div>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 text-xs text-slate-500 leading-relaxed">
          {explanation}
        </div>
      </div>
    </div>
  );
}

