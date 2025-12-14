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
  const [cloudbaseData, setCloudbaseData] = useState<any>(null);
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
      setCloudbaseData(null);
      setWindData(null);
      return;
    }

    const { timeSlots, visibility, cloudbase, wind } = graphData;

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

    if (cloudbase.some(c => c !== null)) {
      setCloudbaseData({
        labels: formattedLabels || timeSlots,
        data: cloudbase,
        selectedIndex,
        selectedTime: selectedIndex >= 0 ? timeSlots[selectedIndex] : 'NOW',
      });
    } else {
      setCloudbaseData(null);
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
  
  const visibilitySelectedIdx = visibilityData?.selectedIndex ?? -1;
  const cloudbaseSelectedIdx = cloudbaseData?.selectedIndex ?? -1;
  const windSelectedIdx = windData?.selectedIndex ?? -1;
  
  const visibilityPlugins = useMemo(() => [
    {
      id: 'highlightSelected',
      afterDraw: (chart: any) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        
        if (visibilitySelectedIdx >= 0 && visibilitySelectedIdx < meta.data.length) {
          const point = meta.data[visibilitySelectedIdx];
          const x = point.x;
          const y = point.y;
          
          ctx.save();
          ctx.strokeStyle = 'white';
          ctx.fillStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgb(59, 130, 246)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      },
    },
  ], [visibilitySelectedIdx]);
  
  const cloudbasePlugins = useMemo(() => [
    {
      id: 'highlightSelected',
      afterDraw: (chart: any) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        
        if (cloudbaseSelectedIdx >= 0 && cloudbaseSelectedIdx < meta.data.length) {
          const point = meta.data[cloudbaseSelectedIdx];
          const x = point.x;
          const y = point.y;
          
          ctx.save();
          ctx.strokeStyle = 'white';
          ctx.fillStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgb(59, 130, 246)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      },
    },
  ], [cloudbaseSelectedIdx]);
  
  const windPlugins = useMemo(() => [
    {
      id: 'highlightSelected',
      afterDraw: (chart: any) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        
        if (windSelectedIdx >= 0 && windSelectedIdx < meta.data.length) {
          const point = meta.data[windSelectedIdx];
          const x = point.x;
          const y = point.y;
          
          ctx.save();
          ctx.strokeStyle = 'white';
          ctx.fillStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgb(59, 130, 246)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      },
    },
  ], [windSelectedIdx]);

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

      {visibilityData && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-300">Visibility</h3>
            <span className="text-xs text-gray-500">METAR</span>
          </div>
          <div className="h-48">
            <Line
            data={{
              labels: visibilityData.labels,
              datasets: [
                {
                  label: 'Visibility (km)',
                  data: visibilityData.data,
                  borderColor: 'rgb(59, 130, 246)',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: {
                duration: 0,
              },
              transitions: {
                active: {
                  animation: {
                    duration: 0,
                  },
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
                      if (value === null || value === undefined) return 'N/A';
                      if (value >= 10) return '10+ km (unlimited)';
                      return `${value.toFixed(1)} km`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                  },
                  ticks: {
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
                  min: 0,
                  max: 10,
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                  },
                  ticks: {
                    color: 'rgba(255, 255, 255, 0.6)',
                    stepSize: 2,
                  },
                  title: {
                    display: true,
                    text: 'Kilometers',
                    color: 'rgba(255, 255, 255, 0.6)',
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
            plugins={visibilityPlugins}
            />
          </div>
        </div>
      )}

      {cloudbaseData && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-300">Cloudbase</h3>
            <span className="text-xs text-gray-500">METAR</span>
          </div>
          <div className="h-48">
            <Line
            data={{
              labels: cloudbaseData.labels,
              datasets: [
                {
                  label: 'Cloudbase (ft)',
                  data: cloudbaseData.data,
                  borderColor: 'rgb(59, 130, 246)',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: { duration: 0 },
              transitions: {
                active: {
                  animation: {
                    duration: 0,
                  },
                },
              },
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  enabled: true,
                },
              },
              scales: {
                x: {
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                  },
                  ticks: {
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
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                  },
                  ticks: {
                    color: 'rgba(255, 255, 255, 0.6)',
                  },
                  title: {
                    display: true,
                    text: 'Feet',
                    color: 'rgba(255, 255, 255, 0.6)',
                  },
                },
              },
            }}
            plugins={cloudbasePlugins}
            />
          </div>
        </div>
      )}

      {windData && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-300">Wind Speed</h3>
            <span className="text-xs text-gray-500">METAR</span>
          </div>
          <div className="h-48">
            <Line
            data={{
              labels: windData.labels,
              datasets: [
                {
                  label: 'Wind Speed (knots)',
                  data: windData.data,
                  borderColor: 'rgb(59, 130, 246)',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  fill: true,
                  tension: 0.4,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: {
                duration: 0,
              },
              transitions: {
                active: {
                  animation: {
                    duration: 0,
                  },
                },
              },
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  enabled: true,
                },
              },
              scales: {
                x: {
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                  },
                  ticks: {
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
                  grid: {
                    color: 'rgba(255, 255, 255, 0.1)',
                  },
                  ticks: {
                    color: 'rgba(255, 255, 255, 0.6)',
                  },
                  title: {
                    display: true,
                    text: 'Knots',
                    color: 'rgba(255, 255, 255, 0.6)',
                  },
                },
              },
            }}
            plugins={windPlugins}
            />
          </div>
        </div>
      )}
    </div>
  );
});


