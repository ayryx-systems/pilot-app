'use client';

import React, { useMemo, useRef, useEffect, useCallback } from 'react';
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
import { utcToAirportLocal, getSeason } from '@/utils/airportTime';
import { getAircraftCategoryFromType, categoryColors, getAircraftColor, rgbaToHex } from '@/utils/aircraftColors';

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

function getSeasonalBaseline(baseline: BaselineData | null | undefined): { season: string; byTimeSlot: Record<string, { medianTimeFrom50nm?: number }> } | null {
  if (!baseline) return null;
  
  const now = new Date();
  const season = getSeason(now, baseline);
  const seasonData = season === 'summer' ? baseline.summer : baseline.winter;
  
  if (!seasonData) return null;
  
  const byTimeSlot = (seasonData as Record<string, unknown>).byTimeSlotLocal as Record<string, { medianTimeFrom50nm?: number }> | undefined || seasonData.seasonalTimeSlots;
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
    const datasets: ChartData<'scatter'>['datasets'] = [];
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
          category: category,
        });
      }
    });

    const seasonalBaseline = getSeasonalBaseline(baseline);
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
          fill: false,
          tension: 0.1,
          showLine: true,
        });
      }
    }

    return { datasets, timeRange: { min: -2, max: 0 } }; // -2 hours to now
  }, [arrivals, airportCode, baseline]);

  // Helper functions for popup formatting
  const formatZulu = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown time';
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${year}-${month}-${day} ${hours}${minutes}Z`;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 0) return 'Future';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    if (minutes === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} min ago`;
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const createArrivalPopupContent = useCallback((arrival: Arrival): string => {
    const category = getAircraftCategory(arrival);
    const rgbaColor = getAircraftColor(category);
    const color = rgbaToHex(rgbaColor);
    
    const landingTime = arrival.timestampLanding;
    const zuluTimeStr = landingTime ? formatZulu(landingTime) : 'Unknown time';
    const currentRelativeTime = landingTime ? formatRelativeTime(landingTime) : 'Unknown';
    const durationFrom50nm = arrival.durationMinutes ? formatDuration(arrival.durationMinutes) : null;
    const aircraftType = arrival.aircraftType || 'Unknown';
    
    return `
      <div style="
        background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,20,0.95));
        border: 1px solid ${color};
        border-radius: 8px;
        padding: 8px 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1);
        backdrop-filter: blur(4px);
        color: #ffffff;
        font-size: 13px;
        font-weight: 500;
        text-align: center;
        min-width: 150px;
      ">
        <div style="color: ${color}; font-weight: 600; margin-bottom: 4px;">AIRCRAFT</div>
        <div style="color: #e5e7eb; font-size: 12px; margin-bottom: 4px;">${aircraftType}</div>
        ${durationFrom50nm ? `
          <div style="color: #9ca3af; font-size: 11px; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
            <div style="color: #e5e7eb; font-weight: 500;">Time from 50nm: ${durationFrom50nm}</div>
          </div>
        ` : ''}
        ${landingTime ? `
          <div style="color: #9ca3af; font-size: 11px; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
            <div style="color: #e5e7eb; font-weight: 500;">Landed: ${zuluTimeStr}</div>
            <div style="color: #9ca3af; font-size: 10px;">${currentRelativeTime}</div>
          </div>
        ` : ''}
      </div>
    `;
  }, []);

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
            callback: function(value: string | number) {
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
          enabled: false,
          external: function(context: { tooltip: { opacity: number; dataPoints?: Array<{ datasetIndex: number; index: number; raw?: { arrival?: Arrival } }>; caretX: number; caretY: number } }): void {
            const tooltipEl = document.getElementById('chartjs-tooltip');
            const chart = chartRef.current;
            
            if (!chart) return;
            
            const tooltipModel = context.tooltip;
            if (!tooltipModel.opacity) {
              if (tooltipEl) {
                tooltipEl.style.opacity = '0';
              }
              return;
            }
            
            if (tooltipModel.body) {
              const point = tooltipModel.dataPoints?.[0];
              const arrival = point?.raw?.arrival as Arrival | undefined;
              
              if (!arrival) {
                if (tooltipEl) {
                  tooltipEl.style.opacity = '0';
                }
                return;
              }
              
              const popupContent = createArrivalPopupContent(arrival);
              
              if (!tooltipEl) {
                const newTooltip = document.createElement('div');
                newTooltip.id = 'chartjs-tooltip';
                newTooltip.innerHTML = popupContent;
                document.body.appendChild(newTooltip);
              } else {
                tooltipEl.innerHTML = popupContent;
              }
              
              const tooltip = document.getElementById('chartjs-tooltip');
              if (tooltip) {
                const position = chart.canvas.getBoundingClientRect();
                const left = position.left + tooltipModel.caretX;
                const top = position.top + tooltipModel.caretY;
                
                tooltip.style.opacity = '1';
                tooltip.style.position = 'absolute';
                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
                tooltip.style.pointerEvents = 'none';
                tooltip.style.zIndex = '10000';
                tooltip.style.transform = 'translate(-50%, -100%)';
                tooltip.style.marginTop = '-10px';
              }
            }
          },
        },
      },
      onClick: (_event: MouseEvent, elements: Array<{ datasetIndex: number; index: number }>) => {
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
  }, [chartData, onPointClick, createArrivalPopupContent]);

  // Cleanup tooltip on unmount
  useEffect(() => {
    return () => {
      const tooltipEl = document.getElementById('chartjs-tooltip');
      if (tooltipEl) {
        tooltipEl.remove();
      }
    };
  }, []);

  if (!chartData || chartData.datasets.length === 0) {
    return (
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Arrival Duration: 50nm Boundary to Landing</h3>
        <p className="text-xs text-slate-400 mb-3">Shows how long each aircraft took from crossing 50nm to landing (last 2 hours)</p>
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
          No arrival data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">Arrival Times (Last Hour)</h3>
      <div className="h-48">
        <Scatter ref={chartRef} data={chartData} options={options} />
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Each point represents one landing. Click to view the ground track on the map. Colors indicate aircraft category.
      </p>
    </div>
  );
}

