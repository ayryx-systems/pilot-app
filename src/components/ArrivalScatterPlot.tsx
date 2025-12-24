'use client';

import React, { useMemo, useRef, useEffect } from 'react';
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
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { Arrival, BaselineData } from '@/types';
import { utcToAirportLocal, getSeason, getAirportUTCOffset } from '@/utils/airportTime';
import { getAircraftCategoryFromType, categoryColors } from '@/utils/aircraftColors';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController
);

interface ArrivalScatterPlotProps {
  arrivals: Arrival[];
  airportCode: string;
  baseline?: BaselineData | null;
  onPointClick?: (arrival: Arrival) => void;
}

// Aircraft category mapping - use OpenSky category if available, otherwise fallback to aircraftType
const getAircraftCategory = (arrival: Arrival): string => {
  // Prefer aircraftCategory from OpenSky category codes (more reliable)
  if (arrival.aircraftCategory) {
    return arrival.aircraftCategory;
  }
  
  // Fallback to aircraftType-based categorization
  return getAircraftCategoryFromType(arrival.aircraftType);
};

const categoryNames: Record<string, string> = {
  light: 'Light',
  small: 'Small',
  large: 'Large',
  heavy: 'Heavy',
  other: 'Other',
  // Legacy categories for fallback
  regional: 'Regional',
  narrowbody: 'Narrow-body',
  widebody: 'Wide-body',
};

function getSeasonalBaseline(baseline: BaselineData | null | undefined, airportCode: string): { season: string; byTimeSlot: Record<string, { medianTimeFrom50nm?: number }> } | null {
  if (!baseline) return null;
  
  const now = new Date();
  const season = getSeason(now, baseline);
  const seasonData = season === 'summer' ? baseline.summer : baseline.winter;
  
  if (!seasonData) return null;
  
  const byTimeSlot = (seasonData as any).byTimeSlotLocal || seasonData.seasonalTimeSlots;
  if (!byTimeSlot) return null;
  
  return { season, byTimeSlot };
}

function convertBaselineToHoursAgo(
  baseline: Record<string, { medianTimeFrom50nm?: number }>,
  airportCode: string,
  baselineData?: BaselineData | null
): Array<{ x: number; y: number }> {
  const now = new Date();
  const nowLocal = utcToAirportLocal(now, airportCode, baselineData);
  const nowLocalHours = nowLocal.getUTCHours();
  const nowLocalMinutes = nowLocal.getUTCMinutes();
  const nowLocalHoursSinceMidnight = nowLocalHours + nowLocalMinutes / 60;
  
  const baselinePoints: Array<{ x: number; y: number }> = [];
  
  for (const [slot, slotData] of Object.entries(baseline)) {
    if (!slotData.medianTimeFrom50nm) continue;
    
    const [hours, minutes] = slot.split(':').map(Number);
    const slotHoursSinceMidnight = hours + minutes / 60;
    
    let hoursAgo: number;
    
    if (slotHoursSinceMidnight <= nowLocalHoursSinceMidnight) {
      hoursAgo = slotHoursSinceMidnight - nowLocalHoursSinceMidnight;
    } else {
      hoursAgo = slotHoursSinceMidnight - nowLocalHoursSinceMidnight - 24;
    }
    
    if (hoursAgo >= -2 && hoursAgo <= 0) {
      baselinePoints.push({
        x: hoursAgo,
        y: slotData.medianTimeFrom50nm / 60,
      });
    }
  }
  
  return baselinePoints.sort((a, b) => a.x - b.x);
}

export function ArrivalScatterPlot({ arrivals, airportCode, baseline, onPointClick }: ArrivalScatterPlotProps) {
  const chartRef = useRef<ChartJS<'scatter'>>(null);

  // Process arrivals into scatter plot data
  const chartData = useMemo(() => {
    if (!arrivals || arrivals.length === 0) {
      return null;
    }

    // Calculate time range: last 2 hours from now
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Group arrivals by category
    const categoryData: Record<string, Arrival[]> = {};
    arrivals.forEach(arrival => {
      const category = getAircraftCategory(arrival);
      if (!categoryData[category]) {
        categoryData[category] = [];
      }
      categoryData[category].push(arrival);
    });

    // Create datasets for each category
    const datasets: any[] = [];
    const categoryOrder = ['widebody', 'narrowbody', 'regional', 'small', 'light', 'heavy', 'large', 'other']; // Order by size

    categoryOrder.forEach(category => {
      const categoryArrivals = categoryData[category];
      if (categoryArrivals && categoryArrivals.length > 0) {
        const scatterData = categoryArrivals.map(arrival => {
          // Calculate minutes ago from now (negative = in the past)
          const landingTime = new Date(arrival.timestampLanding);
          const minutesAgo = (landingTime.getTime() - now.getTime()) / (1000 * 60);
          // Convert to hours (negative = past, positive = future)
          const hoursAgo = minutesAgo / 60;

          return {
            x: hoursAgo,
            y: arrival.durationMinutes,
            arrival: arrival, // Store full arrival object for click handling
          };
        });

        datasets.push({
          label: `${categoryNames[category]} (${categoryArrivals.length})`,
          data: scatterData,
          backgroundColor: categoryColors[category].replace('1)', '0.6)'),
          borderColor: categoryColors[category],
          pointRadius: 4,
          pointHoverRadius: 6,
          category: category,
        });
      }
    });

    const seasonalBaseline = getSeasonalBaseline(baseline, airportCode);
    if (seasonalBaseline && seasonalBaseline.byTimeSlot) {
      const baselineLineData = convertBaselineToHoursAgo(seasonalBaseline.byTimeSlot, airportCode, baseline);
      
      if (baselineLineData.length > 0) {
        const seasonLabel = seasonalBaseline.season === 'summer' ? 'Summer Average' : 'Winter Average';
        datasets.push({
          label: seasonLabel,
          data: baselineLineData,
          type: 'line',
          borderColor: 'rgba(0, 0, 0, 1)',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          borderWidth: 2,
          borderDash: [10, 5],
          pointRadius: 2,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.1,
          showLine: true,
        });
      }
    }

    return { datasets, timeRange: { min: -2, max: 0 } }; // -2 hours to now
  }, [arrivals, airportCode, baseline]);

  const options = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: chartData?.timeRange?.min ?? -2,
          max: chartData?.timeRange?.max ?? 0,
          title: {
            display: true,
            text: 'Landing Time (relative to now)',
            color: '#e2e8f0',
            font: {
              size: 12,
            },
          },
          ticks: {
            color: '#94a3b8',
            callback: function(value: any) {
              if (typeof value !== 'number') return '';
              // Value is in hours (negative = past, positive = future)
              if (Math.abs(value) < 0.01) return 'Now';
              if (value < 0) {
                const absValue = Math.abs(value);
                const hours = Math.floor(absValue);
                const minutes = Math.round((absValue % 1) * 60);
                if (hours > 0 && minutes === 0) {
                  return `${hours}h ago`;
                } else if (hours > 0 && minutes > 0) {
                  return `${hours}h ${minutes}m ago`;
                } else {
                  return `${minutes}m ago`;
                }
              } else {
                const minutes = Math.round(value * 60);
                return `+${minutes}m`;
              }
            },
            stepSize: 1, // Every hour
            maxTicksLimit: 5, // Limit to prevent overcrowding
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Flight Duration: 50nm to Landing (minutes)',
            color: '#e2e8f0',
            font: {
              size: 12,
            },
          },
          ticks: {
            color: '#94a3b8',
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: '#e2e8f0',
            font: {
              size: 11,
            },
            usePointStyle: true,
            padding: 10,
          },
        },
        tooltip: {
          callbacks: {
            title: function(context: any) {
              const point = context[0];
              const arrival = point.raw?.arrival as Arrival | undefined;
              if (arrival) {
                const landingTime = new Date(arrival.timestampLanding);
                return landingTime.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
              }
              return '';
            },
            label: function(context: any) {
              const arrival = context.raw?.arrival as Arrival | undefined;
              if (arrival) {
                const hours = Math.floor(arrival.durationMinutes / 60);
                const minutes = Math.round(arrival.durationMinutes % 60);
                return [
                  `Flight Duration: ${hours}h ${minutes}m (${arrival.durationMinutes.toFixed(1)} min)`,
                  `Time from 50nm boundary to landing`,
                  `Aircraft Type: ${arrival.aircraftType || 'Unknown'}`,
                  `Callsign: ${arrival.callsign}`,
                  `ICAO: ${arrival.icao}`,
                ];
              }
              return '';
            },
          },
        },
      },
      onClick: (event: any, elements: any) => {
        if (elements.length > 0 && onPointClick) {
          const element = elements[0];
          const datasetIndex = element.datasetIndex;
          const dataIndex = element.index;
          const dataset = chartData?.datasets[datasetIndex];
          if (dataset && dataset.data[dataIndex]) {
            const arrival = dataset.data[dataIndex].arrival as Arrival;
            if (arrival) {
              onPointClick(arrival);
            }
          }
        }
      },
    };
  }, [chartData, onPointClick]);

  if (!chartData || chartData.datasets.length === 0) {
    return (
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Arrival Duration: 50nm Boundary to Landing</h3>
        <p className="text-xs text-slate-400 mb-3">Shows how long each aircraft took from crossing 50nm to landing (last 2 hours)</p>
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
          No arrival data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">Arrival Times (Last Hour)</h3>
      <div className="h-64">
        <Scatter ref={chartRef} data={chartData} options={options} />
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Each point represents one landing. Click to view the ground track on the map. Colors indicate aircraft category.
      </p>
    </div>
  );
}

