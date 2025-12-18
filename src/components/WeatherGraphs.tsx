'use client';

import React, { useEffect, useRef, useState, useMemo, memo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getCurrentUTCTime } from '@/utils/airportTime';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface WeatherGraphsProps {
  weather?: {
    metar?: string;
    metarFriendly?: string;
    visibility?: number | string;
    clouds?: Array<{ coverage: string; altitude: number }>;
    ceiling?: number | null;
    cloudbase?: number | null;
    wind?: {
      direction: number;
      speed: number;
      gust?: number;
    };
    taf?: {
      rawTAF?: string;
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
          ceiling?: number | null;
    cloudbase?: number | null;
        }>;
        summary?: string;
      };
    };
    graph?: {
      timeSlots: string[];
      visibility: (number | null)[];
      ceiling: (number | null)[];
      cloudbase?: (number | null)[];
      wind: (number | null)[];
      metarRaw: string | null;
      tafRaw: string | null;
    } | null;
  };
  selectedTime: Date;
  isNow: boolean;
}

export const WeatherGraphs = memo(function WeatherGraphs({
  weather,
  selectedTime,
  isNow,
}: WeatherGraphsProps) {
  const [visibilityData, setVisibilityData] = useState<any>(null);
  const [ceilingData, setCeilingData] = useState<any>(null);
  const [windData, setWindData] = useState<any>(null);

  // Memoize graph data to prevent unnecessary recalculations
  const graphData = useMemo(() => {
    if (!weather?.graph) return null;
    return weather.graph;
  }, [weather?.graph]);

  // Create formatted labels with round hour values, showing only unique hours
  const formattedLabels = useMemo(() => {
    if (!graphData?.timeSlots) return null;
    
    const labels: string[] = [];
    let lastHour = '';
    
    graphData.timeSlots.forEach((label) => {
      if (label === 'NOW') {
        labels.push('NOW');
        return;
      }
      
      const [hours, minutes] = label.split(':').map(Number);
      
      // Round to nearest hour for display
      const roundedHour = minutes >= 30 ? (hours + 1) % 24 : hours;
      const hourLabel = `${String(roundedHour).padStart(2, '0')}:00`;
      
      // Only include label if it's a new hour (avoid duplicates)
      if (hourLabel !== lastHour) {
        labels.push(hourLabel);
        lastHour = hourLabel;
      } else {
        labels.push('');
      }
    });
    
    return labels;
  }, [graphData?.timeSlots]);

  // Memoize selected index calculation
  const selectedIndex = useMemo(() => {
    if (!graphData) return -1;
    
    const { timeSlots } = graphData;
    const now = getCurrentUTCTime();
    const selectedMinutes = Math.floor((selectedTime.getTime() - now.getTime()) / (1000 * 60));
    
    let idx = -1;
    const nowIndex = timeSlots.indexOf('NOW');
    
    if (isNow && nowIndex >= 0) {
      idx = nowIndex;
    } else {
      const slotIntervalMinutes = 15;
      const targetSlot = Math.round(selectedMinutes / slotIntervalMinutes);
      
      if (targetSlot >= 0 && targetSlot < timeSlots.length) {
        idx = targetSlot;
      } else if (targetSlot < 0) {
        idx = nowIndex >= 0 ? nowIndex : 0;
      } else {
        idx = timeSlots.length - 1;
      }
    }
    
    return idx;
  }, [graphData, selectedTime, isNow]);

  useEffect(() => {
    if (!graphData) {
      setVisibilityData(null);
      setCeilingData(null);
      setWindData(null);
      return;
    }

    const { timeSlots, visibility, ceiling, cloudbase, wind } = graphData;
    const ceilingData = ceiling || cloudbase;

    if (visibility.some(v => v !== null)) {
      setVisibilityData({
        labels: formattedLabels || timeSlots,
        data: visibility,
        selectedIndex,
        selectedTime: selectedIndex >= 0 ? timeSlots[selectedIndex] : 'NOW',
      });
    } else {
      setVisibilityData(null);
    }

    if (ceilingData && ceilingData.some((c: number | null) => c !== null)) {
      setCeilingData({
        labels: formattedLabels || timeSlots,
        data: ceilingData,
        selectedIndex,
        selectedTime: selectedIndex >= 0 ? timeSlots[selectedIndex] : 'NOW',
      });
    } else {
      setCeilingData(null);
    }

    if (wind.some(w => w !== null)) {
      setWindData({
        labels: formattedLabels || timeSlots,
        data: wind,
        selectedIndex,
        selectedTime: selectedIndex >= 0 ? timeSlots[selectedIndex] : 'NOW',
      });
    } else {
      setWindData(null);
    }
  }, [graphData, selectedIndex, formattedLabels]);

  if (!weather?.graph) {
    return null;
  }

  const { metarRaw, tafRaw } = weather.graph;

  const graphs = [
    { data: visibilityData, title: 'Visibility', yTitle: 'Kilometers', isBottom: false },
    { data: ceilingData, title: 'Ceiling', yTitle: 'Feet', isBottom: false },
    { data: windData, title: 'Wind Speed', yTitle: 'Knots', isBottom: true },
  ].filter(g => g.data !== null);

  return (
    <div className="space-y-4">
      {metarRaw && (
        <div className="text-xs font-mono text-gray-400 bg-gray-900 p-2 rounded">
          <div className="text-gray-500 mb-1">METAR (CURRENT)</div>
          {metarRaw}
        </div>
      )}
      
      {tafRaw && (
        <div className="text-xs font-mono text-gray-400 bg-gray-900 p-2 rounded">
          <div className="text-gray-500 mb-1">TAF (FORECAST)</div>
          {tafRaw}
        </div>
      )}

      {graphs.length > 0 && (
        <div className="space-y-1">
          {graphs.map((graph, index) => {
            const isBottom = index === graphs.length - 1;
            const isVisibility = graph.title === 'Visibility';
            const isCeiling = graph.title === 'Ceiling';
            const isWind = graph.title === 'Wind Speed';

            return (
              <div key={graph.title} className={isBottom ? '' : 'mb-0'}>
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xs font-semibold text-gray-300">{graph.title}</h3>
                </div>
                <div className="h-32">
                  <Line
                    data={{
                      labels: graph.data.labels,
                      datasets: [
                        {
                          label: `${graph.title} (${graph.yTitle.toLowerCase()})`,
                          data: graph.data.data,
                          borderColor: 'rgb(59, 130, 246)',
                          backgroundColor: isCeiling 
                            ? 'rgba(59, 130, 246, 0.1)'
                            : 'rgba(59, 130, 246, 0.1)',
                          fill: isCeiling 
                            ? { target: 'origin', above: 'rgba(59, 130, 246, 0.1)' }
                            : true,
                          tension: 0.4,
                          pointRadius: (ctx: any) => {
                            const value = graph.data.data[ctx.dataIndex];
                            if (value === null || value === undefined) return 0;
                            return ctx.dataIndex === selectedIndex ? 6 : 0;
                          },
                          pointHoverRadius: 4,
                          pointBackgroundColor: (ctx: any) => {
                            const value = graph.data.data[ctx.dataIndex];
                            if (value === null || value === undefined) return 'transparent';
                            return ctx.dataIndex === selectedIndex ? '#ffffff' : 'transparent';
                          },
                          pointBorderColor: (ctx: any) => {
                            const value = graph.data.data[ctx.dataIndex];
                            if (value === null || value === undefined) return 'transparent';
                            return ctx.dataIndex === selectedIndex ? 'rgb(59, 130, 246)' : 'transparent';
                          },
                          pointBorderWidth: (ctx: any) => {
                            const value = graph.data.data[ctx.dataIndex];
                            if (value === null || value === undefined) return 0;
                            return ctx.dataIndex === selectedIndex ? 2 : 0;
                          },
                          spanGaps: false,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      animation: { duration: 0 },
                      transitions: {
                        active: {
                          animation: { duration: 0 },
                        },
                      },
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          enabled: true,
                          callbacks: {
                            label: function(context: any) {
                              const value = context.parsed.y;
                              if (value === null || value === undefined) {
                                if (isCeiling) return 'No ceiling (clear skies)';
                                return 'N/A';
                              }
                              if (isVisibility) {
                                if (value >= 10) return '10+ km (unlimited)';
                                return `${value.toFixed(1)} km`;
                              }
                              if (isCeiling) {
                                return `${value.toLocaleString()} ft`;
                              }
                              if (isWind) {
                                return `${value.toFixed(1)} knots`;
                              }
                              return value.toString();
                            },
                          },
                        },
                      },
                      layout: {
                        padding: {
                          left: 0,
                          right: 0,
                        },
                      },
                      scales: {
                        x: {
                          display: true,
                          grid: {
                            display: true,
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: isBottom,
                          },
                          ticks: {
                            display: isBottom,
                            color: 'rgba(255, 255, 255, 0.6)',
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8,
                            callback: function(value: any, index: number) {
                              const label = this.getLabelForValue(value);
                              return label || undefined;
                            },
                          },
                        },
                        y: {
                          min: isVisibility ? 0 : undefined,
                          max: isVisibility ? 10 : undefined,
                          grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false,
                          },
                          ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            stepSize: isVisibility ? 2 : undefined,
                            callback: function(value: any) {
                              if (isVisibility) {
                                if (value === 10) return '10+';
                                return value.toString();
                              }
                              if (isCeiling) {
                                if (value === 0) return 'ground';
                                return value.toString();
                              }
                              return value.toString();
                            },
                          },
                          title: {
                            display: true,
                            text: graph.yTitle,
                            color: 'rgba(255, 255, 255, 0.6)',
                            font: {
                              size: 10,
                            },
                          },
                          afterFit: function(scaleInstance: any) {
                            scaleInstance.width = 70;
                          },
                        },
                      },
                      onHover: (event, activeElements) => {
                        const canvas = event.native?.target as HTMLCanvasElement;
                        if (canvas) {
                          canvas.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                        }
                      },
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});


