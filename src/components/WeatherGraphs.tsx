'use client';

import React, { useEffect, useRef, useState } from 'react';
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

export function WeatherGraphs({
  weather,
  selectedTime,
  isNow,
}: WeatherGraphsProps) {
  const [visibilityData, setVisibilityData] = useState<any>(null);
  const [cloudbaseData, setCloudbaseData] = useState<any>(null);
  const [windData, setWindData] = useState<any>(null);

  useEffect(() => {
    if (!weather?.graph) {
      setVisibilityData(null);
      setCloudbaseData(null);
      setWindData(null);
      return;
    }

    const graph = weather.graph;
    const { timeSlots, visibility, cloudbase, wind } = graph;

    const now = getCurrentUTCTime();
    const selectedMinutes = Math.floor((selectedTime.getTime() - now.getTime()) / (1000 * 60));
    
    let selectedIndex = -1;
    const nowIndex = timeSlots.indexOf('NOW');
    
    if (isNow && nowIndex >= 0) {
      selectedIndex = nowIndex;
    } else {
      const slotIntervalMinutes = 15;
      const targetSlot = Math.round(selectedMinutes / slotIntervalMinutes);
      if (targetSlot >= 0 && targetSlot < timeSlots.length) {
        selectedIndex = targetSlot;
      } else if (nowIndex >= 0) {
        selectedIndex = nowIndex;
      }
    }

    if (visibility.some(v => v !== null)) {
      setVisibilityData({
        labels: timeSlots,
        data: visibility,
        selectedIndex,
        selectedTime: selectedIndex >= 0 ? timeSlots[selectedIndex] : 'NOW',
      });
    } else {
      setVisibilityData(null);
    }

    if (cloudbase.some(c => c !== null)) {
      setCloudbaseData({
        labels: timeSlots,
        data: cloudbase,
        selectedIndex,
        selectedTime: selectedIndex >= 0 ? timeSlots[selectedIndex] : 'NOW',
      });
    } else {
      setCloudbaseData(null);
    }

    if (wind.some(w => w !== null)) {
      setWindData({
        labels: timeSlots,
        data: wind,
        selectedIndex,
        selectedTime: selectedIndex >= 0 ? timeSlots[selectedIndex] : 'NOW',
      });
    } else {
      setWindData(null);
    }
  }, [weather?.graph, selectedTime, isNow]);

  if (!weather?.graph) {
    return null;
  }

  const { metarRaw, tafRaw } = weather.graph;

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
                  label: 'Visibility (miles)',
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
                    text: 'Miles',
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
            plugins={[
              {
                id: 'highlightSelected',
                afterDraw: (chart) => {
                  const ctx = chart.ctx;
                  const chartArea = chart.chartArea;
                  const meta = chart.getDatasetMeta(0);
                  
                  if (visibilityData.selectedIndex >= 0 && visibilityData.selectedIndex < meta.data.length) {
                    const point = meta.data[visibilityData.selectedIndex];
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
            ]}
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
            plugins={[
              {
                id: 'highlightSelected',
                afterDraw: (chart) => {
                  const ctx = chart.ctx;
                  const meta = chart.getDatasetMeta(0);
                  
                  if (cloudbaseData.selectedIndex >= 0 && cloudbaseData.selectedIndex < meta.data.length) {
                    const point = meta.data[cloudbaseData.selectedIndex];
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
            ]}
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
            plugins={[
              {
                id: 'highlightSelected',
                afterDraw: (chart) => {
                  const ctx = chart.ctx;
                  const meta = chart.getDatasetMeta(0);
                  
                  if (windData.selectedIndex >= 0 && windData.selectedIndex < meta.data.length) {
                    const point = meta.data[windData.selectedIndex];
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
            ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
