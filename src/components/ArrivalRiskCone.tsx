'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrivalSituationResponse,
  FlightCategory,
  WindCategory,
  PrecipitationType,
  WeatherTrend,
} from '@/types';
import { ChevronDown, RotateCcw } from 'lucide-react';

export interface CustomConditions {
  visibilitySM?: number;
  ceilingFt?: number;
  windKt?: number;
  precipitation?: PrecipitationType;
  hadIFR?: boolean;
  trend?: WeatherTrend;
}

interface ArrivalRiskConeProps {
  situation: ArrivalSituationResponse | null;
  loading?: boolean;
  error?: string;
  onReferenceDayClick?: (date: string, timeSlot: string) => void;
  forecastConditions?: {
    visibilitySM?: number;
    ceilingFt?: number;
    windKt?: number;
  };
  onConditionsChange?: (conditions: CustomConditions | null, isCustom: boolean) => void;
}

const VISIBILITY_OPTIONS = [
  { label: 'VFR (5+ SM)', value: 10, category: 'VFR' },
  { label: 'MVFR (3-5 SM)', value: 4, category: 'MVFR' },
  { label: 'IFR (1-3 SM)', value: 2, category: 'IFR' },
  { label: 'LIFR (<1 SM)', value: 0.5, category: 'LIFR' },
];

const CEILING_OPTIONS = [
  { label: 'Unlimited', value: null, category: 'VFR' },
  { label: 'VFR (3000+ ft)', value: 4000, category: 'VFR' },
  { label: 'MVFR (1000-3000 ft)', value: 2000, category: 'MVFR' },
  { label: 'IFR (500-1000 ft)', value: 700, category: 'IFR' },
  { label: 'LIFR (<500 ft)', value: 300, category: 'LIFR' },
];

const WIND_OPTIONS = [
  { label: 'Calm (<5 kt)', value: 3, category: 'calm' },
  { label: 'Light (5-15 kt)', value: 10, category: 'light' },
  { label: 'Moderate (15-25 kt)', value: 20, category: 'moderate' },
  { label: 'Strong (25+ kt)', value: 30, category: 'strong' },
];

const PRECIPITATION_OPTIONS: { label: string; value: PrecipitationType }[] = [
  { label: 'None', value: 'none' },
  { label: 'Rain', value: 'rain' },
  { label: 'Snow', value: 'snow' },
  { label: 'Fog', value: 'fog' },
  { label: 'Thunderstorm', value: 'thunderstorm' },
  { label: 'Freezing', value: 'freezing' },
];

const TREND_OPTIONS: { label: string; value: WeatherTrend }[] = [
  { label: 'Improving', value: 'improving' },
  { label: 'Steady', value: 'steady' },
  { label: 'Deteriorating', value: 'deteriorating' },
];

function getFlightCategoryColor(category: FlightCategory): string {
  switch (category) {
    case 'VFR': return '#22c55e';
    case 'MVFR': return '#3b82f6';
    case 'IFR': return '#ef4444';
    case 'LIFR': return '#a855f7';
    default: return '#6b7280';
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

function getVisibilityLabel(sm?: number): string {
  if (sm === undefined || sm === null) return 'VFR';
  if (sm >= 5) return 'VFR';
  if (sm >= 3) return 'MVFR';
  if (sm >= 1) return 'IFR';
  return 'LIFR';
}

function getCeilingLabel(ft?: number | null): string {
  if (ft === undefined || ft === null) return 'Unlimited';
  if (ft >= 3000) return 'VFR';
  if (ft >= 1000) return 'MVFR';
  if (ft >= 500) return 'IFR';
  return 'LIFR';
}

function getWindLabel(kt?: number): string {
  if (kt === undefined || kt === null) return 'Calm';
  if (kt < 5) return 'Calm';
  if (kt < 15) return 'Light';
  if (kt < 25) return 'Moderate';
  return 'Strong';
}

interface DropdownProps {
  label: string;
  value: string;
  options: { label: string; value: any }[];
  onChange: (value: any) => void;
  disabled?: boolean;
  categoryColor?: string;
}

function Dropdown({ label, value, options, onChange, disabled, categoryColor }: DropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${
          disabled
            ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
            : 'bg-slate-700 hover:bg-slate-600 text-white cursor-pointer'
        }`}
        style={categoryColor && !disabled ? { borderLeft: `3px solid ${categoryColor}` } : undefined}
      >
        <span className="font-medium">{label}:</span>
        <span>{value}</span>
        {!disabled && <ChevronDown className="w-3 h-3 ml-0.5" />}
      </button>
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded shadow-xl z-50 min-w-[140px]">
            {options.map((opt) => (
              <button
                key={String(opt.value)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-700 text-slate-200 first:rounded-t last:rounded-b"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ArrivalRiskCone({
  situation,
  loading = false,
  error,
  onReferenceDayClick,
  forecastConditions,
  onConditionsChange,
}: ArrivalRiskConeProps) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customConditions, setCustomConditions] = useState<CustomConditions>({
    visibilitySM: 10,
    ceilingFt: undefined,
    windKt: 10,
    precipitation: 'none',
    hadIFR: false,
    trend: 'steady',
  });

  useEffect(() => {
    if (forecastConditions && !isCustomMode) {
      setCustomConditions(prev => ({
        ...prev,
        visibilitySM: forecastConditions.visibilitySM ?? 10,
        ceilingFt: forecastConditions.ceilingFt,
        windKt: forecastConditions.windKt ?? 10,
      }));
    }
  }, [forecastConditions, isCustomMode]);

  const handleModeChange = (custom: boolean) => {
    setIsCustomMode(custom);
    if (custom) {
      onConditionsChange?.(customConditions, true);
    } else {
      onConditionsChange?.(null, false);
    }
  };

  const handleConditionChange = (key: keyof CustomConditions, value: any) => {
    const newConditions = { ...customConditions, [key]: value };
    setCustomConditions(newConditions);
    if (isCustomMode) {
      onConditionsChange?.(newConditions, true);
    }
  };

  const handleReset = () => {
    const resetConditions: CustomConditions = {
      visibilitySM: forecastConditions?.visibilitySM ?? 10,
      ceilingFt: forecastConditions?.ceilingFt,
      windKt: forecastConditions?.windKt ?? 10,
      precipitation: 'none',
      hadIFR: false,
      trend: 'steady',
    };
    setCustomConditions(resetConditions);
    setIsCustomMode(false);
    onConditionsChange?.(null, false);
  };

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

  const displayConditions = isCustomMode ? {
    visibility: getVisibilityLabel(customConditions.visibilitySM),
    ceiling: getCeilingLabel(customConditions.ceilingFt),
    wind: getWindLabel(customConditions.windKt),
    precipitation: customConditions.precipitation || 'none',
    hadIFR: customConditions.hadIFR || false,
    trend: customConditions.trend || 'steady',
  } : situation?.conditions;

  const flightCategory = displayConditions?.visibility as FlightCategory || 'VFR';
  const flightCategoryColor = getFlightCategoryColor(flightCategory);

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

  if (!situation && !isCustomMode) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="text-slate-500 text-sm text-center">
          Select an arrival time to see the forecast
        </div>
      </div>
    );
  }

  if (situation?.insufficientData && !isCustomMode) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-amber-500/30">
        <div className="text-amber-400 text-sm">{situation.message}</div>
      </div>
    );
  }

  if (situation?.error && !isCustomMode) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-red-500/30">
        <div className="text-red-400 text-sm">{situation.error}</div>
      </div>
    );
  }

  const { distribution, goAroundRate, extendedApproachProbability, referenceDays, conditions, explanation, matchCount } = situation || {};

  return (
    <div className={`bg-slate-800/60 rounded-lg border overflow-hidden ${isCustomMode ? 'border-amber-500/50' : 'border-slate-700'}`}>
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-white font-medium">Arrival Duration Forecast</h3>
            {situation && (
              <p className="text-slate-400 text-xs mt-0.5">
                Based on {matchCount} similar historical situations
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isCustomMode && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded">
                CUSTOM
              </span>
            )}
            <div
              className="px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: `${flightCategoryColor}20`, color: flightCategoryColor }}
            >
              {flightCategory}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="conditionMode"
              checked={!isCustomMode}
              onChange={() => handleModeChange(false)}
              className="w-3 h-3 text-blue-500"
            />
            <span className="text-xs text-slate-300">TAF Forecast</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="conditionMode"
              checked={isCustomMode}
              onChange={() => handleModeChange(true)}
              className="w-3 h-3 text-amber-500"
            />
            <span className="text-xs text-slate-300">Custom Scenario</span>
          </label>
          {isCustomMode && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Dropdown
            label="VIS"
            value={getVisibilityLabel(customConditions.visibilitySM)}
            options={VISIBILITY_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
            onChange={(v) => handleConditionChange('visibilitySM', v)}
            disabled={!isCustomMode}
            categoryColor={getFlightCategoryColor(getVisibilityLabel(customConditions.visibilitySM) as FlightCategory)}
          />
          <Dropdown
            label="CEIL"
            value={getCeilingLabel(customConditions.ceilingFt)}
            options={CEILING_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
            onChange={(v) => handleConditionChange('ceilingFt', v)}
            disabled={!isCustomMode}
            categoryColor={getFlightCategoryColor(getCeilingLabel(customConditions.ceilingFt) as FlightCategory)}
          />
          <Dropdown
            label="WIND"
            value={getWindLabel(customConditions.windKt)}
            options={WIND_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
            onChange={(v) => handleConditionChange('windKt', v)}
            disabled={!isCustomMode}
          />
          <Dropdown
            label="WX"
            value={customConditions.precipitation === 'none' ? 'None' : customConditions.precipitation || 'None'}
            options={PRECIPITATION_OPTIONS}
            onChange={(v) => handleConditionChange('precipitation', v)}
            disabled={!isCustomMode}
          />
          <Dropdown
            label="Trend"
            value={customConditions.trend || 'steady'}
            options={TREND_OPTIONS}
            onChange={(v) => handleConditionChange('trend', v)}
            disabled={!isCustomMode}
          />
          <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs ${
            isCustomMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
          } ${customConditions.hadIFR ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
            <input
              type="checkbox"
              checked={customConditions.hadIFR || false}
              onChange={(e) => handleConditionChange('hadIFR', e.target.checked)}
              disabled={!isCustomMode}
              className="w-3 h-3"
            />
            Recent IFR
          </label>
        </div>

        {isCustomMode && (
          <p className="text-xs text-amber-400/70 mt-2">
            Exploring what happens under these conditions using real historical data
          </p>
        )}
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

            {distribution && (
              <>
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
              </>
            )}
          </div>
        )}

        {extendedApproachProbability && goAroundRate !== undefined && (
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
                {conditions && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {referenceDays && (referenceDays.typical || referenceDays.worstCase) && (
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

        {explanation && (
          <div className="mt-3 text-xs text-slate-500 leading-relaxed">
            {explanation}
          </div>
        )}
      </div>
    </div>
  );
}
