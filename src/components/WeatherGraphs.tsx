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
      weatherEvents?: Array<{
        startIndex: number;
        endIndex: number;
        weather: string;
        category: string;
        changeType: string;
      }>;
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

  const { metarRaw, tafRaw, weatherEvents } = weather.graph;

  const graphs = [
    { data: visibilityData, title: 'Visibility', yTitle: 'Kilometers', isBottom: false },
    { data: ceilingData, title: 'Ceiling', yTitle: 'Feet', isBottom: false },
    { data: windData, title: 'Wind Speed', yTitle: 'Knots', isBottom: true },
  ].filter(g => g.data !== null);

  const getWeatherEventColor = (category: string) => {
    switch (category) {
      case 'thunderstorm':
        return 'bg-purple-500';
      case 'snow':
        return 'bg-blue-400';
      case 'rain':
        return 'bg-blue-500';
      case 'fog':
        return 'bg-gray-400';
      case 'freezing':
        return 'bg-cyan-400';
      case 'volcanic':
        return 'bg-red-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getWeatherEventLabel = (weather: string) => {
    const upper = weather.toUpperCase();
    if (upper.includes('TS')) return 'Thunderstorm';
    if (upper.includes('SN')) return 'Snow';
    if (upper.includes('RA') || upper.includes('DZ')) return 'Rain';
    if (upper.includes('FG') || upper.includes('BR') || upper.includes('HZ')) return 'Fog';
    if (upper.includes('PL') || upper.includes('GR') || upper.includes('GS')) return 'Freezing';
    if (upper.includes('VA')) return 'Volcanic';
    return weather;
  };

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

      {weatherEvents && weatherEvents.length > 0 && graphData && (() => {
        const validEvents = weatherEvents.filter((event) => 
          graphData.timeSlots && 
          event.startIndex >= 0 && 
          event.endIndex < graphData.timeSlots.length
        );

        if (validEvents.length === 0) return null;

        const maxRows = Math.min(validEvents.length, 6);
        const rowHeight = 32;
        const timelineHeight = maxRows * rowHeight + 28;
        const chartLabels = formattedLabels || graphData.timeSlots;
        const emptyData = new Array(graphData.timeSlots.length).fill(null);

        return (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-semibold text-gray-300">Weather Events</h3>
            </div>
            <div className="relative rounded p-2" style={{ minHeight: `${timelineHeight}px` }}>
              <div className="flex">
                <div className="flex-shrink-0" style={{ width: '70px' }}>
                  {validEvents.slice(0, maxRows).map((event, idx) => (
                    <div
                      key={`label-${idx}`}
                      className="flex items-center justify-end pr-2"
                      style={{ height: `${rowHeight - 4}px`, marginBottom: '4px' }}
                    >
                      <span className="text-[10px] text-gray-400 truncate w-full text-right font-medium">
                        {getWeatherEventLabel(event.weather)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 relative" style={{ minWidth: 0 }}>
                  <div className="h-32 pointer-events-none">
                    <Line
                      data={{
                        labels: chartLabels,
                        datasets: [{
                          data: emptyData,
                          borderColor: 'transparent',
                          backgroundColor: 'transparent',
                          pointRadius: 0,
                          pointHoverRadius: 0,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 0 },
                        plugins: {
                          legend: { display: false },
                          tooltip: { enabled: false },
                        },
                        scales: {
                          x: {
                            display: true,
                            grid: {
                              display: true,
                              color: 'rgba(255, 255, 255, 0.1)',
                              drawBorder: true,
                            },
                            ticks: {
                              display: true,
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
                            display: false,
                          },
                        },
                      }}
                    />
                  </div>
                  <div className="absolute top-0 left-0 right-0 bottom-6 pointer-events-none">
                    {validEvents.slice(0, maxRows).map((event, idx) => {
                      const startTime = graphData.timeSlots[event.startIndex];
                      const endTime = graphData.timeSlots[event.endIndex];
                      const startPercent = (event.startIndex / (graphData.timeSlots.length - 1)) * 100;
                      const endPercent = ((event.endIndex + 1) / (graphData.timeSlots.length - 1)) * 100;
                      const widthPercent = endPercent - startPercent;
                      
                      return (
                        <div
                          key={idx}
                          className="absolute"
                          style={{ 
                            height: `${rowHeight - 4}px`,
                            top: `${idx * rowHeight}px`,
                            left: `${startPercent}%`,
                            width: `${widthPercent}%`,
                            minWidth: '3px',
                          }}
                        >
                          <div
                            className={`h-full ${getWeatherEventColor(event.category)} rounded opacity-85 hover:opacity-100 transition-opacity border border-gray-600 shadow-sm`}
                            title={`${getWeatherEventLabel(event.weather)} - ${startTime} to ${endTime}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {validEvents.length > maxRows && (
                    <div className="text-[10px] text-gray-500 mt-2 ml-1">
                      +{validEvents.length - maxRows} more events
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
});


