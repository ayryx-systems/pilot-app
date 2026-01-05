'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrivalSituationResponse,
  FlightCategory,
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
  options: { label: string; value: string | number }[];
  onChange: (value: string | number) => void;
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
            : 'bg-slate-700 text-white cursor-pointer'
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
                className="w-full text-left px-3 py-2 text-xs text-slate-200 first:rounded-t last:rounded-b"
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

  const handleConditionChange = (key: keyof CustomConditions, value: string | number | undefined) => {
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

  const barData = useMemo(() => {
    if (!situation?.distribution) return null;

    const { distribution } = situation;
    const baseline = distribution.baseline;
    const rangeStart = Math.min(baseline - 2, distribution.p10);
    const rangeEnd = Math.max(baseline + 25, distribution.p90 + 5);
    const range = rangeEnd - rangeStart;
    const scale = range > 0 ? 100 / range : 1;

    return {
      baseline,
      baselinePos: (baseline - rangeStart) * scale,
      typicalPos: (distribution.p50 - rangeStart) * scale,
      bestCasePos: (distribution.p10 - rangeStart) * scale,
      extendedPos: (distribution.p90 - rangeStart) * scale,
      typicalRangeStart: (distribution.p25 - rangeStart) * scale,
      typicalRangeEnd: (distribution.p75 - rangeStart) * scale,
      rangeStart,
      rangeEnd,
      p10: distribution.p10,
      p25: distribution.p25,
      p50: distribution.p50,
      p75: distribution.p75,
      p90: distribution.p90,
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
          <div className="h-24 bg-slate-700 rounded mb-4" />
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

  const { distribution, goAroundRate, extendedApproachProbability, referenceDays, explanation, matchCount } = situation || {};

  return (
    <div className={`bg-slate-800/60 rounded-lg border overflow-hidden ${isCustomMode ? 'border-amber-500/50' : 'border-slate-700'}`}>
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-white font-medium">Expected Arrival Duration</h3>
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
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 transition-colors"
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
        {barData && distribution && (
          <div className="mb-5">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-green-400 text-lg font-semibold">{formatDuration(barData.p10)}</div>
                <div className="text-slate-400 text-xs">Best case</div>
              </div>
              <div className="text-center">
                <div className="text-white text-xl font-bold">{formatDuration(barData.p25)}-{formatDuration(barData.p75)}</div>
                <div className="text-slate-400 text-xs">Typical range</div>
              </div>
              <div className="text-center">
                <div className="text-amber-400 text-lg font-semibold">{formatDuration(barData.p90)}+</div>
                <div className="text-slate-400 text-xs">Extended (1 in 10)</div>
              </div>
            </div>

            <div className="relative h-8 bg-slate-900/50 rounded-lg overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-green-500/30"
                style={{
                  left: `${barData.bestCasePos}%`,
                  width: `${barData.typicalRangeStart - barData.bestCasePos}%`,
                }}
              />
              <div
                className="absolute top-0 bottom-0 bg-slate-400/40"
                style={{
                  left: `${barData.typicalRangeStart}%`,
                  width: `${barData.typicalRangeEnd - barData.typicalRangeStart}%`,
                }}
              />
              <div
                className="absolute top-0 bottom-0 bg-amber-500/30"
                style={{
                  left: `${barData.typicalRangeEnd}%`,
                  width: `${barData.extendedPos - barData.typicalRangeEnd}%`,
                }}
              />

              <div
                className="absolute top-0 bottom-0 w-0.5 bg-blue-400"
                style={{ left: `${barData.baselinePos}%` }}
                title={`Baseline: ${formatDuration(distribution.baseline)}`}
              />

              <div
                className="absolute top-1 bottom-1 w-1 bg-white rounded-full shadow-lg"
                style={{ left: `${barData.typicalPos}%`, marginLeft: '-2px' }}
                title={`Typical: ${formatDuration(barData.p50)}`}
              />
            </div>

            <div className="flex justify-between mt-1.5 text-xs text-slate-500">
              <span>{formatDuration(barData.rangeStart)}</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-sm" />
                  <span>Baseline ({formatDuration(distribution.baseline)})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-white rounded-full" />
                  <span>Typical ({formatDuration(barData.p50)})</span>
                </div>
              </div>
              <span>{formatDuration(barData.rangeEnd)}</span>
            </div>
          </div>
        )}

        {extendedApproachProbability && distribution && (
          <div className="bg-slate-900/40 rounded p-3 mb-4">
            <div className="text-slate-300 text-xs font-medium mb-2">Risk of delay beyond baseline ({formatDuration(distribution.baseline)})</div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className={`text-sm font-semibold ${extendedApproachProbability.over5min > 30 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {extendedApproachProbability.over5min}%
                </div>
                <div className="text-slate-500 text-xs">+5 min</div>
                <div className="text-slate-600 text-xs">(&gt;{formatDuration(distribution.baseline + 5)})</div>
              </div>
              <div className="text-center">
                <div className={`text-sm font-semibold ${extendedApproachProbability.over10min > 20 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {extendedApproachProbability.over10min}%
                </div>
                <div className="text-slate-500 text-xs">+10 min</div>
                <div className="text-slate-600 text-xs">(&gt;{formatDuration(distribution.baseline + 10)})</div>
              </div>
              <div className="text-center">
                <div className={`text-sm font-semibold ${extendedApproachProbability.over15min > 10 ? 'text-orange-400' : 'text-slate-300'}`}>
                  {extendedApproachProbability.over15min}%
                </div>
                <div className="text-slate-500 text-xs">+15 min</div>
                <div className="text-slate-600 text-xs">(&gt;{formatDuration(distribution.baseline + 15)})</div>
              </div>
              <div className="text-center">
                <div className={`text-sm font-semibold ${extendedApproachProbability.over20min > 5 ? 'text-red-400' : 'text-slate-300'}`}>
                  {extendedApproachProbability.over20min}%
                </div>
                <div className="text-slate-500 text-xs">+20 min</div>
                <div className="text-slate-600 text-xs">(&gt;{formatDuration(distribution.baseline + 20)})</div>
              </div>
            </div>
          </div>
        )}

        {goAroundRate !== undefined && goAroundRate > 0 && (
          <div className="flex items-center justify-between bg-slate-900/40 rounded p-2 mb-4">
            <span className="text-slate-400 text-xs">Go-around rate</span>
            <span className={`text-sm font-medium ${goAroundRate > 2 ? 'text-amber-400' : 'text-slate-300'}`}>
              {goAroundRate.toFixed(1)}%
            </span>
          </div>
        )}

        {referenceDays && (referenceDays.typical || referenceDays.worstCase) && (
          <div className="border-t border-slate-700 pt-3">
            <div className="text-slate-400 text-xs mb-2">Reference Days (Real Historical Data)</div>
            <div className="grid grid-cols-2 gap-2">
              {referenceDays.typical && (
                <button
                  className="bg-slate-900/40 rounded p-2 text-left transition-colors"
                  onClick={() => onReferenceDayClick?.(referenceDays.typical!.date, referenceDays.typical!.timeSlot)}
                >
                  <div className="text-green-400 text-xs font-medium mb-1">Typical Day</div>
                  <div className="text-slate-300 text-xs">{referenceDays.typical.date}</div>
                  <div className="text-slate-500 text-xs">
                    {formatDuration(referenceDays.typical.p50 || 0)} typical
                  </div>
                </button>
              )}
              {referenceDays.worstCase && (
                <button
                  className="bg-slate-900/40 rounded p-2 text-left transition-colors"
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
