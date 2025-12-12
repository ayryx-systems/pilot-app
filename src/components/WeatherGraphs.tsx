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
import { utcToAirportLocal, getAirportLocalDateString, formatAirportLocalTime } from '@/utils/airportTime';
import { BaselineData } from '@/types';

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
    metar: string;
    visibility?: string;
    wind?: {
      direction: number;
      speed: number;
      gust?: number;
    };
    taf?: {
      forecast?: {
        periods: Array<{
          timeFrom: string;
          timeTo: string;
          changeType: string;
          wind?: { direction: number; speed: number; gust?: number };
          visibility?: string;
          clouds?: Array<{ coverage: string; altitude: number }>;
        }>;
      };
    };
  };
  airportCode: string;
  selectedTime: Date;
  baseline?: BaselineData | null;
  isNow: boolean;
}

function parseVisibility(visStr?: string): number | null {
  if (!visStr) return null;
  const match = visStr.match(/(\d+(?:\.\d+)?)\s*(?:SM|mi|mile)/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

function getCloudbase(clouds?: Array<{ coverage: string; altitude: number }>): number | null {
  if (!clouds || clouds.length === 0) return null;
  const lowestCloud = clouds.find(c => c.coverage !== 'CLR' && c.coverage !== 'SKC');
  return lowestCloud ? lowestCloud.altitude / 100 : null;
}

export function WeatherGraphs({
  weather,
  airportCode,
  selectedTime,
  baseline,
  isNow,
}: WeatherGraphsProps) {
  const [visibilityData, setVisibilityData] = useState<any>(null);
  const [cloudbaseData, setCloudbaseData] = useState<any>(null);
  const [windData, setWindData] = useState<any>(null);

  useEffect(() => {
    if (!weather) {
      setVisibilityData(null);
      setCloudbaseData(null);
      setWindData(null);
      return;
    }

    const currentVis = parseVisibility(weather.visibility);
    const currentCloudbase = null;
    const currentWind = weather.wind?.speed || null;

    const timeSlots: string[] = [];
    const visibilities: (number | null)[] = [];
    const cloudbases: (number | null)[] = [];
    const windSpeeds: (number | null)[] = [];

    const selectedTimeLocal = utcToAirportLocal(selectedTime, airportCode, baseline);
    const selectedHour = selectedTimeLocal.getUTCHours();
    const selectedMinute = selectedTimeLocal.getUTCMinutes();
    const selectedTimeLabel = `${String(selectedHour).padStart(2, '0')}:${String(Math.floor(selectedMinute / 15) * 15).padStart(2, '0')}`;

    if (isNow && currentVis !== null) {
      timeSlots.push('NOW');
      visibilities.push(currentVis);
      cloudbases.push(currentCloudbase);
      windSpeeds.push(currentWind);
    }

    if (weather.taf?.forecast?.periods && weather.taf.forecast.periods.length > 0) {
      const periods = weather.taf.forecast.periods;
      const slotMap = new Map<string, { vis: number | null; cloudbase: number | null; wind: number | null }>();

      periods.forEach((period) => {
        try {
          const fromTime = new Date(period.timeFrom);
          const toTime = new Date(period.timeTo);
          
          if (isNaN(fromTime.getTime()) || isNaN(toTime.getTime())) {
            return;
          }

          const fromLocal = utcToAirportLocal(fromTime, airportCode, baseline);
          const toLocal = utcToAirportLocal(toTime, airportCode, baseline);

          const periodVis = parseVisibility(period.visibility);
          const periodCloudbase = getCloudbase(period.clouds);
          const periodWind = period.wind?.speed || null;

          const fromHour = fromLocal.getUTCHours();
          const fromMin = Math.floor(fromLocal.getUTCMinutes() / 15) * 15;
          const toHour = toLocal.getUTCHours();
          const toMin = Math.floor(toLocal.getUTCMinutes() / 15) * 15;

          const fromSlot = `${String(fromHour).padStart(2, '0')}:${String(fromMin).padStart(2, '0')}`;
          const toSlot = `${String(toHour).padStart(2, '0')}:${String(toMin).padStart(2, '0')}`;

          slotMap.set(fromSlot, { vis: periodVis, cloudbase: periodCloudbase, wind: periodWind });
          slotMap.set(toSlot, { vis: periodVis, cloudbase: periodCloudbase, wind: periodWind });
        } catch (e) {
          console.warn('Error parsing TAF period:', e);
        }
      });

      const sortedSlots = Array.from(slotMap.keys()).sort();
      sortedSlots.forEach(slot => {
        if (!timeSlots.includes(slot)) {
          const data = slotMap.get(slot)!;
          timeSlots.push(slot);
          visibilities.push(data.vis);
          cloudbases.push(data.cloudbase);
          windSpeeds.push(data.wind);
        }
      });
    }

    const selectedIndex = timeSlots.indexOf(selectedTimeLabel);

    if (timeSlots.length > 0) {
      setVisibilityData({
        labels: timeSlots,
        data: visibilities,
        selectedIndex,
        selectedTime: selectedTimeLabel,
      });

      if (cloudbases.some(c => c !== null)) {
        setCloudbaseData({
          labels: timeSlots,
          data: cloudbases,
          selectedIndex,
          selectedTime: selectedTimeLabel,
        });
      } else {
        setCloudbaseData(null);
      }

      if (windSpeeds.some(w => w !== null)) {
        setWindData({
          labels: timeSlots,
          data: windSpeeds,
          selectedIndex,
          selectedTime: selectedTimeLabel,
        });
      } else {
        setWindData(null);
      }
    } else {
      setVisibilityData(null);
      setCloudbaseData(null);
      setWindData(null);
    }
  }, [weather, airportCode, selectedTime, baseline, isNow]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#94a3b8',
          font: {
            size: 9,
          },
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
      },
      x: {
        ticks: {
          color: '#94a3b8',
          font: {
            size: 9,
          },
          maxRotation: 45,
          minRotation: 45,
          maxTicksLimit: 8,
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
      },
    },
  };

  if (!visibilityData && !cloudbaseData && !windData) {
    return null;
  }

  return (
    <div className="space-y-3">
      {visibilityData && (
        <div className="p-2 bg-slate-800/50 rounded border border-slate-700/50">
          <div className="text-xs font-medium text-gray-300 mb-2">Visibility</div>
          <div style={{ height: '120px', position: 'relative' }}>
            <Line
              data={{
                labels: visibilityData.labels,
                datasets: [
                  {
                    data: visibilityData.data.map((v: number | null, i: number) => ({
                      x: i,
                      y: v,
                    })),
                    borderColor: isNow ? '#60a5fa' : '#475569',
                    backgroundColor: isNow ? 'rgba(96, 165, 250, 0.1)' : 'rgba(71, 85, 105, 0.1)',
                    borderWidth: isNow ? 2 : 1.5,
                    borderDash: isNow ? [] : [5, 5],
                    fill: true,
                    tension: 0.4,
                    pointRadius: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (visibilityData.selectedIndex >= 0 && index === visibilityData.selectedIndex) {
                        return 6;
                      }
                      return visibilityData.data[index] !== null ? 2 : 0;
                    },
                    pointBackgroundColor: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (visibilityData.selectedIndex >= 0 && index === visibilityData.selectedIndex) {
                        return '#ffffff';
                      }
                      return visibilityData.data[index] !== null ? (isNow ? '#60a5fa' : '#475569') : 'transparent';
                    },
                    pointBorderColor: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (visibilityData.selectedIndex >= 0 && index === visibilityData.selectedIndex) {
                        return '#60a5fa';
                      }
                      return visibilityData.data[index] !== null ? (isNow ? '#60a5fa' : '#475569') : 'transparent';
                    },
                    pointBorderWidth: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (visibilityData.selectedIndex >= 0 && index === visibilityData.selectedIndex) {
                        return 3;
                      }
                      return visibilityData.data[index] !== null ? 1 : 0;
                    },
                    spanGaps: false,
                  },
                ],
              }}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    ...chartOptions.scales.y,
                    title: {
                      display: true,
                      text: 'Miles',
                      color: '#94a3b8',
                      font: { size: 10 },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {cloudbaseData && cloudbaseData.data.some((c: number | null) => c !== null) && (
        <div className="p-2 bg-slate-800/50 rounded border border-slate-700/50">
          <div className="text-xs font-medium text-gray-300 mb-2">Cloudbase</div>
          <div style={{ height: '120px', position: 'relative' }}>
            <Line
              data={{
                labels: cloudbaseData.labels,
                datasets: [
                  {
                    data: cloudbaseData.data.map((c: number | null, i: number) => ({
                      x: i,
                      y: c,
                    })),
                    borderColor: isNow ? '#60a5fa' : '#475569',
                    backgroundColor: isNow ? 'rgba(96, 165, 250, 0.1)' : 'rgba(71, 85, 105, 0.1)',
                    borderWidth: isNow ? 2 : 1.5,
                    borderDash: isNow ? [] : [5, 5],
                    fill: true,
                    tension: 0.4,
                    pointRadius: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (cloudbaseData.selectedIndex >= 0 && index === cloudbaseData.selectedIndex) {
                        return 6;
                      }
                      return cloudbaseData.data[index] !== null ? 2 : 0;
                    },
                    pointBackgroundColor: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (cloudbaseData.selectedIndex >= 0 && index === cloudbaseData.selectedIndex) {
                        return '#ffffff';
                      }
                      return cloudbaseData.data[index] !== null ? (isNow ? '#60a5fa' : '#475569') : 'transparent';
                    },
                    pointBorderColor: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (cloudbaseData.selectedIndex >= 0 && index === cloudbaseData.selectedIndex) {
                        return '#60a5fa';
                      }
                      return cloudbaseData.data[index] !== null ? (isNow ? '#60a5fa' : '#475569') : 'transparent';
                    },
                    pointBorderWidth: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (cloudbaseData.selectedIndex >= 0 && index === cloudbaseData.selectedIndex) {
                        return 3;
                      }
                      return cloudbaseData.data[index] !== null ? 1 : 0;
                    },
                    spanGaps: false,
                  },
                ],
              }}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    ...chartOptions.scales.y,
                    title: {
                      display: true,
                      text: 'Feet (x100)',
                      color: '#94a3b8',
                      font: { size: 10 },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {windData && windData.data.some((w: number | null) => w !== null) && (
        <div className="p-2 bg-slate-800/50 rounded border border-slate-700/50">
          <div className="text-xs font-medium text-gray-300 mb-2">Wind Speed</div>
          <div style={{ height: '120px', position: 'relative' }}>
            <Line
              data={{
                labels: windData.labels,
                datasets: [
                  {
                    data: windData.data.map((w: number | null, i: number) => ({
                      x: i,
                      y: w,
                    })),
                    borderColor: isNow ? '#60a5fa' : '#475569',
                    backgroundColor: isNow ? 'rgba(96, 165, 250, 0.1)' : 'rgba(71, 85, 105, 0.1)',
                    borderWidth: isNow ? 2 : 1.5,
                    borderDash: isNow ? [] : [5, 5],
                    fill: true,
                    tension: 0.4,
                    pointRadius: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (windData.selectedIndex >= 0 && index === windData.selectedIndex) {
                        return 6;
                      }
                      return windData.data[index] !== null ? 2 : 0;
                    },
                    pointBackgroundColor: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (windData.selectedIndex >= 0 && index === windData.selectedIndex) {
                        return '#ffffff';
                      }
                      return windData.data[index] !== null ? (isNow ? '#60a5fa' : '#475569') : 'transparent';
                    },
                    pointBorderColor: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (windData.selectedIndex >= 0 && index === windData.selectedIndex) {
                        return '#60a5fa';
                      }
                      return windData.data[index] !== null ? (isNow ? '#60a5fa' : '#475569') : 'transparent';
                    },
                    pointBorderWidth: (ctx: any) => {
                      const index = ctx.parsed.x;
                      if (windData.selectedIndex >= 0 && index === windData.selectedIndex) {
                        return 3;
                      }
                      return windData.data[index] !== null ? 1 : 0;
                    },
                    spanGaps: false,
                  },
                ],
              }}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    ...chartOptions.scales.y,
                    title: {
                      display: true,
                      text: 'Knots',
                      color: '#94a3b8',
                      font: { size: 10 },
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
