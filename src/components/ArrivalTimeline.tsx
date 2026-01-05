'use client';

import React, { useMemo, useRef, useCallback, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  Filler,
  ChartOptions,
  ChartData,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Scatter } from 'react-chartjs-2';
import { Arrival, BaselineData, HistoricalArrival, FlightCategory, MatchedDaysResponse } from '@/types';
import { utcToAirportLocal, getSeason } from '@/utils/airportTime';
import { getAircraftCategoryFromType, categoryColors } from '@/utils/aircraftColors';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { ExampleDayCard } from './ExampleDayCard';
import { HelpButton } from './HelpButton';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  Filler,
  annotationPlugin
);

interface ArrivalTimelineProps {
  arrivals: Arrival[];
  airportCode: string;
  baseline?: BaselineData | null;
  matchedDaysData?: MatchedDaysResponse | null;
  selectedTime: Date;
  weatherCategory?: FlightCategory;
  onPointClick?: (arrival: Arrival) => void;
  onHistoricalPointClick?: (arrival: HistoricalArrival) => void;
}

const WEATHER_COLORS: Record<FlightCategory, string> = {
  VFR: 'rgba(34, 197, 94, 0.15)',
  MVFR: 'rgba(59, 130, 246, 0.15)',
  IFR: 'rgba(234, 88, 12, 0.15)',
  LIFR: 'rgba(220, 38, 38, 0.15)',
  unlimited: 'rgba(34, 197, 94, 0.15)',
  unknown: 'rgba(156, 163, 175, 0.15)',
};

const WEATHER_BORDER_COLORS: Record<FlightCategory, string> = {
  VFR: 'rgba(34, 197, 94, 0.8)',
  MVFR: 'rgba(59, 130, 246, 0.8)',
  IFR: 'rgba(234, 88, 12, 0.8)',
  LIFR: 'rgba(220, 38, 38, 0.8)',
  unlimited: 'rgba(34, 197, 94, 0.8)',
  unknown: 'rgba(156, 163, 175, 0.8)',
};

const categoryNames: Record<string, string> = {
  light: 'Light',
  small: 'Small',
  large: 'Large',
  heavy: 'Heavy',
  other: 'Other',
  regional: 'Regional',
  narrowbody: 'Narrow-body',
  widebody: 'Wide-body',
};

const getAircraftCategory = (arrival: Arrival): string => {
  if (arrival.aircraftCategory) {
    return arrival.aircraftCategory;
  }
  return getAircraftCategoryFromType(arrival.aircraftType);
};

function getSeasonalBaseline(baseline: BaselineData | null | undefined, airportCode: string) {
  if (!baseline) return null;
  
  const now = new Date();
  const season = getSeason(now, baseline);
  const seasonData = season === 'summer' ? baseline.summer : baseline.winter;
  
  if (!seasonData) return null;
  
  const byTimeSlot = (seasonData as Record<string, unknown>).byTimeSlotLocal || 
    (seasonData as Record<string, unknown>).seasonalTimeSlots;
  if (!byTimeSlot) return null;
  
  return { season, byTimeSlot: byTimeSlot as Record<string, { medianTimeFrom50nm?: number }> };
}

export function ArrivalTimeline({ 
  arrivals, 
  airportCode, 
  baseline, 
  matchedDaysData,
  selectedTime,
  weatherCategory = 'VFR',
  onPointClick,
  onHistoricalPointClick,
}: ArrivalTimelineProps) {
  const chartRef = useRef<ChartJS<'scatter'>>(null);
  
  const isAtNow = Math.abs(selectedTime.getTime() - Date.now()) < 60000;
  const hoursAhead = (selectedTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const currentSeason = getSeason(new Date(), baseline);

  const chartData = useMemo(() => {
    const datasets: ChartData<'scatter'>['datasets'] = [];
    const now = Date.now();
    const chartMax = isAtNow ? 0.5 : Math.max(hoursAhead + 0.5, 1);
    
    if (arrivals && arrivals.length > 0) {
      const categoryData: Record<string, Arrival[]> = {};
      arrivals.forEach(arrival => {
        const category = getAircraftCategory(arrival);
        if (!categoryData[category]) {
          categoryData[category] = [];
        }
        categoryData[category].push(arrival);
      });

      const categoryOrder = ['widebody', 'narrowbody', 'regional', 'small', 'light', 'heavy', 'large', 'other'];

      categoryOrder.forEach(category => {
        const categoryArrivals = categoryData[category];
        if (categoryArrivals && categoryArrivals.length > 0) {
          const scatterData = categoryArrivals.map(arrival => {
            const landingTime = new Date(arrival.timestampLanding);
            const hoursAgo = (landingTime.getTime() - now) / (1000 * 60 * 60);

            return {
              x: hoursAgo,
              y: arrival.durationMinutes,
              arrival: arrival,
            };
          });

          datasets.push({
            label: `${categoryNames[category]} (${categoryArrivals.length})`,
            data: scatterData,
            backgroundColor: categoryColors[category]?.replace('1)', '0.7)') || 'rgba(156, 163, 175, 0.7)',
            borderColor: categoryColors[category] || 'rgba(156, 163, 175, 1)',
            pointRadius: 5,
            pointHoverRadius: 7,
          } as ChartData<'scatter'>['datasets'][0]);
        }
      });
    }

    const seasonalBaseline = getSeasonalBaseline(baseline, airportCode);
    if (seasonalBaseline && seasonalBaseline.byTimeSlot) {
      const nowLocal = utcToAirportLocal(new Date(), airportCode, baseline);
      const nowLocalHours = nowLocal.getUTCHours();
      const nowLocalMinutes = nowLocal.getUTCMinutes();
      const nowLocalHoursSinceMidnight = nowLocalHours + nowLocalMinutes / 60;
      
      const baselinePoints: Array<{ x: number; y: number }> = [];
      
      for (const [slot, slotData] of Object.entries(seasonalBaseline.byTimeSlot)) {
        if (!slotData.medianTimeFrom50nm) continue;
        
        const [hours, minutes] = slot.split(':').map(Number);
        const slotHoursSinceMidnight = hours + minutes / 60;
        
        let hoursFromNow = slotHoursSinceMidnight - nowLocalHoursSinceMidnight;
        
        if (hoursFromNow < -12) hoursFromNow += 24;
        if (hoursFromNow > 24) hoursFromNow -= 24;
        
        if (hoursFromNow >= -2 && hoursFromNow <= chartMax) {
          baselinePoints.push({
            x: hoursFromNow,
            y: slotData.medianTimeFrom50nm / 60,
          });
        }
        
        if (!isAtNow && chartMax > 12) {
          let hoursFromNowNextDay = hoursFromNow + 24;
          if (hoursFromNowNextDay >= -2 && hoursFromNowNextDay <= chartMax) {
            baselinePoints.push({
              x: hoursFromNowNextDay,
              y: slotData.medianTimeFrom50nm / 60,
            });
          }
        }
      }
      
      if (baselinePoints.length > 0) {
        baselinePoints.sort((a, b) => a.x - b.x);
        const seasonLabel = seasonalBaseline.season === 'summer' ? 'Baseline (Summer)' : 'Baseline (Winter)';
        datasets.push({
          label: seasonLabel,
          data: baselinePoints,
          type: 'line' as const,
          borderColor: 'rgba(255, 255, 255, 0.5)',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 2,
          borderDash: [8, 4],
          pointRadius: 0,
          pointHoverRadius: 3,
          fill: false,
          tension: 0.3,
          showLine: true,
        } as unknown as ChartData<'scatter'>['datasets'][0]);
      }
    }

    return { 
      datasets, 
      timeRange: { 
        min: -2, 
        max: chartMax 
      } 
    };
  }, [arrivals, airportCode, baseline, selectedTime, isAtNow, hoursAhead]);

  const options = useMemo((): ChartOptions<'scatter'> => {
    const annotations: Record<string, unknown> = {};
    
    annotations['nowLine'] = {
      type: 'line',
      xMin: 0,
      xMax: 0,
      borderColor: 'rgba(239, 68, 68, 0.8)',
      borderWidth: 2,
      borderDash: [6, 3],
      label: {
        display: true,
        content: 'NOW',
        position: 'end',
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        color: 'white',
        font: { size: 10, weight: 'bold' },
        padding: 3,
      },
    };

    if (!isAtNow) {
      const baseColor = WEATHER_BORDER_COLORS[weatherCategory] || WEATHER_BORDER_COLORS.unknown;
      const gradientWidth = Math.min(2, hoursAhead * 0.3);
      
      annotations['weatherCore'] = {
        type: 'box',
        xMin: hoursAhead - gradientWidth,
        xMax: hoursAhead + gradientWidth,
        yMin: 0,
        yMax: 50,
        backgroundColor: baseColor.replace('0.8)', '0.2)'),
        borderColor: 'transparent',
        drawTime: 'beforeDatasetsDraw',
      };
      
      annotations['weatherFadeLeft'] = {
        type: 'box',
        xMin: Math.max(0, hoursAhead - gradientWidth * 2),
        xMax: hoursAhead - gradientWidth,
        yMin: 0,
        yMax: 50,
        backgroundColor: baseColor.replace('0.8)', '0.08)'),
        borderColor: 'transparent',
        drawTime: 'beforeDatasetsDraw',
      };
      
      annotations['weatherFadeRight'] = {
        type: 'box',
        xMin: hoursAhead + gradientWidth,
        xMax: hoursAhead + gradientWidth * 2,
        yMin: 0,
        yMax: 50,
        backgroundColor: baseColor.replace('0.8)', '0.08)'),
        borderColor: 'transparent',
        drawTime: 'beforeDatasetsDraw',
      };

      annotations['etaLine'] = {
        type: 'line',
        xMin: hoursAhead,
        xMax: hoursAhead,
        borderColor: 'rgba(59, 130, 246, 0.6)',
        borderWidth: 2,
        label: {
          display: true,
          content: 'ETA',
          position: 'end',
          backgroundColor: 'rgba(59, 130, 246, 0.9)',
          color: 'white',
          font: { size: 10, weight: 'bold' },
          padding: 3,
        },
      };

      if (matchedDaysData?.aggregatedStats) {
        const stats = matchedDaysData.aggregatedStats;
        const etaX = hoursAhead;
        const markerWidth = 0.15;

        if (stats.p10 !== null && stats.p90 !== null) {
          annotations['etaRangeBox'] = {
            type: 'box',
            xMin: etaX - markerWidth,
            xMax: etaX + markerWidth,
            yMin: stats.p10,
            yMax: stats.p90,
            backgroundColor: 'rgba(99, 102, 241, 0.25)',
            borderColor: 'rgba(99, 102, 241, 0.6)',
            borderWidth: 2,
            borderRadius: 4,
          };

          annotations['etaP10'] = {
            type: 'line',
            xMin: etaX - markerWidth - 0.05,
            xMax: etaX + markerWidth + 0.05,
            yMin: stats.p10,
            yMax: stats.p10,
            borderColor: 'rgba(34, 197, 94, 0.9)',
            borderWidth: 3,
            label: {
              display: true,
              content: `${stats.p10.toFixed(0)}m`,
              position: 'end',
              backgroundColor: 'rgba(34, 197, 94, 0.9)',
              color: 'white',
              font: { size: 9, weight: 'bold' },
              padding: 2,
            },
          };

          annotations['etaP90'] = {
            type: 'line',
            xMin: etaX - markerWidth - 0.05,
            xMax: etaX + markerWidth + 0.05,
            yMin: stats.p90,
            yMax: stats.p90,
            borderColor: 'rgba(249, 115, 22, 0.9)',
            borderWidth: 3,
            label: {
              display: true,
              content: `${stats.p90.toFixed(0)}m`,
              position: 'end',
              backgroundColor: 'rgba(249, 115, 22, 0.9)',
              color: 'white',
              font: { size: 9, weight: 'bold' },
              padding: 2,
            },
          };
        }

        if (stats.p50 !== null) {
          annotations['etaP50'] = {
            type: 'line',
            xMin: etaX - markerWidth - 0.08,
            xMax: etaX + markerWidth + 0.08,
            yMin: stats.p50,
            yMax: stats.p50,
            borderColor: 'rgba(255, 255, 255, 0.95)',
            borderWidth: 4,
            label: {
              display: true,
              content: `Typical: ${stats.p50.toFixed(0)}m`,
              position: 'start',
              backgroundColor: 'rgba(55, 65, 81, 0.95)',
              color: 'white',
              font: { size: 10, weight: 'bold' },
              padding: 3,
            },
          };
        }
      }
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            usePointStyle: true,
            padding: 12,
            font: { size: 11 },
            color: 'rgba(156, 163, 175, 0.9)',
            filter: (item) => {
              return !item.text?.includes('Baseline');
            },
          },
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (context) => {
              const point = context.raw as { x: number; y: number; arrival?: Arrival };
              
              if (point.arrival) {
                const arrival = point.arrival;
                return [
                  `${arrival.callsign || arrival.icao}`,
                  `Type: ${arrival.aircraftType || 'Unknown'}`,
                  `Duration: ${point.y.toFixed(1)} min`,
                ];
              }
              
              return `${point.y.toFixed(1)} min`;
            },
          },
        },
        annotation: {
          annotations,
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: chartData?.timeRange.min ?? -2,
          max: chartData?.timeRange.max ?? 1,
          title: {
            display: true,
            text: 'Hours from Now',
            font: { weight: 'bold' },
            color: 'rgba(209, 213, 219, 0.9)',
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.08)',
          },
          ticks: {
            color: 'rgba(156, 163, 175, 0.9)',
            stepSize: 2,
            callback: (value) => {
              const v = Math.round(Number(value) * 10) / 10;
              if (Math.abs(v) < 0.01) return 'Now';
              if (v < 0) return `${Math.abs(v)}h ago`;
              return `+${v}h`;
            },
          },
        },
        y: {
          min: 10,
          max: 45,
          title: {
            display: true,
            text: 'Duration from 50nm (min)',
            font: { weight: 'bold' },
            color: 'rgba(209, 213, 219, 0.9)',
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.08)',
          },
          ticks: {
            color: 'rgba(156, 163, 175, 0.9)',
          },
        },
      },
      onClick: (event, elements) => {
        if (elements.length > 0 && onPointClick) {
          const element = elements[0];
          const dataset = chartData?.datasets[element.datasetIndex];
          const point = (dataset?.data as Array<{ arrival?: Arrival }>)?.[element.index];
          
          if (point?.arrival) {
            onPointClick(point.arrival);
          }
        }
      },
    };
  }, [chartData, isAtNow, hoursAhead, weatherCategory, matchedDaysData, onPointClick, onHistoricalPointClick]);

  if (!chartData || chartData.datasets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>No arrival data available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-200">
            Arrival Duration Timeline
          </h3>
          <HelpButton
            title="Arrival Duration Timeline"
            size="sm"
            content={
              <div className="space-y-2">
                <p>
                  Shows how long arrivals take from <strong>50 nautical miles out</strong> to landing, based on historical data.
                </p>
                <p>
                  <strong>Vertical Axis:</strong> Duration in minutes from 50nm to touchdown
                </p>
                <p>
                  <strong>Horizontal Axis:</strong> Time of landing (hours from now)
                </p>
                <p>
                  <strong>Colored Dots:</strong> Individual aircraft grouped by type (light, regional, narrowbody, widebody, etc.)
                </p>
                <p>
                  <strong className="text-white/70">White Dashed Line:</strong> Historical seasonal median - typical duration for this time
                </p>
                <p>
                  <strong className="text-gray-400">Gray Shaded Areas:</strong> Risk zones (P10-P90 range) showing best-case to extended arrival times
                </p>
                <p>
                  <strong className="text-blue-400">Blue Points:</strong> Historical arrivals from similar weather days
                </p>
                <p className="text-blue-300">
                  💡 Click on dots to see the aircraft's ground track on the map.
                </p>
              </div>
            }
          />
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <span className="inline-block w-4 border-t-2 border-dashed border-white/50"></span>
            <span>{currentSeason === 'summer' ? 'Summer' : 'Winter'} median</span>
          </div>
        </div>
        {!isAtNow && matchedDaysData?.aggregatedStats && (
          <div className="flex items-center gap-2 text-xs">
            <span 
              className="px-2 py-0.5 rounded font-medium"
              style={{ 
                backgroundColor: WEATHER_COLORS[weatherCategory],
                color: WEATHER_BORDER_COLORS[weatherCategory],
                border: `1px solid ${WEATHER_BORDER_COLORS[weatherCategory]}`,
              }}
            >
              {weatherCategory}
            </span>
            <span className="text-gray-400">
              Based on {matchedDaysData.matchCount} similar days
            </span>
          </div>
        )}
      </div>
      
      <div className="h-72 bg-gray-800/50 rounded-lg border border-gray-700 p-2">
        <Scatter 
          ref={chartRef} 
          data={{ datasets: chartData.datasets }} 
          options={options} 
        />
      </div>
      
      {!isAtNow && matchedDaysData?.aggregatedStats && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <div className="bg-gray-800/60 rounded p-2 border border-gray-700">
            <div className="text-xs text-gray-400">Best Case (P10)</div>
            <div className="text-lg font-semibold text-green-400">
              {matchedDaysData.aggregatedStats.p10?.toFixed(0) ?? '-'}m
            </div>
          </div>
          <div className="bg-gray-800/60 rounded p-2 border border-gray-700">
            <div className="text-xs text-gray-400">Typical (P50)</div>
            <div className="text-lg font-semibold text-gray-200">
              {matchedDaysData.aggregatedStats.p50?.toFixed(0) ?? '-'}m
            </div>
          </div>
          <div className="bg-gray-800/60 rounded p-2 border border-gray-700">
            <div className="text-xs text-gray-400">Extended (P90)</div>
            <div className="text-lg font-semibold text-orange-400">
              {matchedDaysData.aggregatedStats.p90?.toFixed(0) ?? '-'}m
            </div>
          </div>
          <div className="bg-gray-800/60 rounded p-2 border border-gray-700">
            <div className="text-xs text-gray-400">Baseline</div>
            <div className="text-lg font-semibold text-gray-300">
              {matchedDaysData.baselineMinutes?.toFixed(0) ?? '-'}m
            </div>
          </div>
        </div>
      )}
      
      <ExampleDaysSection 
        exampleDays={matchedDaysData?.exampleDays}
        airportCode={airportCode}
        isAtNow={isAtNow}
        selectedTime={selectedTime}
        baselineMinutes={matchedDaysData?.baselineMinutes}
      />
    </div>
  );
}

interface ExampleDaysSectionProps {
  exampleDays?: MatchedDaysResponse['exampleDays'];
  airportCode: string;
  isAtNow: boolean;
  selectedTime: Date;
  baselineMinutes?: number;
}

function ExampleDaysSection({ exampleDays, airportCode, isAtNow, selectedTime, baselineMinutes }: ExampleDaysSectionProps) {
  const [expanded, setExpanded] = useState(false);
  
  if (isAtNow || !exampleDays || exampleDays.length === 0) {
    return null;
  }
  
  // Convert selectedTime to local hour for the marker
  // Note: utcToAirportLocal stores local time in UTC fields, so use getUTCHours
  const localTime = utcToAirportLocal(selectedTime, airportCode);
  const selectedHour = localTime.getUTCHours() + localTime.getUTCMinutes() / 60;
  
  return (
    <div className="mt-4 border-t border-gray-700/50 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm text-gray-300 hover:text-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4" />
          <span className="font-medium">Similar Historical Days</span>
          <span className="text-xs text-gray-500">({exampleDays.length} examples)</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
      
      {expanded && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500 mb-2">
            These historical days had similar weather conditions at this time slot. 
            Click to see their full arrival patterns.
          </p>
          {exampleDays.map((example, idx) => (
            <ExampleDayCard
              key={`${example.date}-${idx}`}
              example={example}
              airportCode={airportCode}
              selectedHour={selectedHour}
              baselineMinutes={baselineMinutes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ArrivalTimeline;

