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
import { utcToAirportLocal, getAirportLocalDateString, formatAirportLocalTime, getCurrentUTCTime } from '@/utils/airportTime';
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
      rawTAF: string;
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
  };
  airportCode: string;
  selectedTime: Date;
  baseline?: BaselineData | null;
  isNow: boolean;
}

function parseVisibility(vis?: string | number): number | null {
  if (vis === null || vis === undefined) return null;
  
  if (typeof vis === 'number') {
    return vis;
  }
  
  if (typeof vis === 'string') {
    const upperVis = vis.toUpperCase();
    
    if (upperVis === '10+' || upperVis === 'P10SM' || upperVis === 'P10') {
      return 10;
    }
    
    if (upperVis === '6+' || upperVis === 'P6SM' || upperVis === 'P6') {
      return 6;
    }
    
    const match = vis.match(/(\d+(?:\s*\/\s*\d+)?)\s*(?:SM|mi|mile|M)/i);
    if (match) {
      const value = match[1];
      if (value.includes('/')) {
        const parts = value.split('/').map(p => p.trim());
        if (parts.length === 2) {
          return parseFloat(parts[0]) / parseFloat(parts[1]);
        }
      }
      return parseFloat(value);
    }
    
    const numMatch = vis.match(/^(\d+(?:\.\d+)?)$/);
    if (numMatch) {
      return parseFloat(numMatch[1]);
    }
  }
  
  return null;
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
    const currentCloudbase = weather.cloudbase !== null && weather.cloudbase !== undefined ? weather.cloudbase : null;
    const currentWind = weather.wind?.speed || null;

    const timeSlots: string[] = [];
    const visibilities: (number | null)[] = [];
    const cloudbases: (number | null)[] = [];
    const windSpeeds: (number | null)[] = [];

    const selectedTimeLocal = utcToAirportLocal(selectedTime, airportCode, baseline);
    const selectedHour = selectedTimeLocal.getUTCHours();
    const selectedMinute = selectedTimeLocal.getUTCMinutes();
    const selectedTimeSlotMinutes = selectedHour * 60 + Math.floor(selectedMinute / 15) * 15;
    const selectedTimeLabel = `${String(Math.floor(selectedTimeSlotMinutes / 60) % 24).padStart(2, '0')}:${String(selectedTimeSlotMinutes % 60).padStart(2, '0')}`;

    const nowTime = getCurrentUTCTime();
    const nowTimeLocal = utcToAirportLocal(nowTime, airportCode, baseline);
    const nowHour = nowTimeLocal.getUTCHours();
    const nowMinute = nowTimeLocal.getUTCMinutes();
    const nowTimeSlotMinutes = nowHour * 60 + Math.floor(nowMinute / 15) * 15;
    const nowTimeLabel = `${String(Math.floor(nowTimeSlotMinutes / 60) % 24).padStart(2, '0')}:${String(nowTimeSlotMinutes % 60).padStart(2, '0')}`;

    const hoursToShow = 36;
    const slotsToShow = hoursToShow * 4;

    const slotMap = new Map<string, { vis: number | null; cloudbase: number | null; wind: number | null; isTempo: boolean; periodIndex: number }>();

    if (weather?.taf?.forecast?.periods && weather.taf.forecast.periods.length > 0) {
      const periods = weather.taf.forecast.periods;

      const regularPeriods: typeof periods = [];
      const tempoPeriods: typeof periods = [];

      periods.forEach((period) => {
        const isTempo = period.changeType === 'TEMPO' || period.changeType === 'tempo';
        if (isTempo) {
          tempoPeriods.push(period);
        } else {
          regularPeriods.push(period);
        }
      });

      regularPeriods.forEach((period, periodIndex) => {
        try {
          const fromTime = new Date(period.timeFrom);
          const toTime = new Date(period.timeTo);
          
          if (isNaN(fromTime.getTime()) || isNaN(toTime.getTime())) {
            return;
          }

          const fromLocal = utcToAirportLocal(fromTime, airportCode, baseline);
          const toLocal = utcToAirportLocal(toTime, airportCode, baseline);

          const periodVis = parseVisibility(period.visibility);
          const periodCloudbase = period.cloudbase !== null && period.cloudbase !== undefined ? period.cloudbase : null;
          const periodWind = period.wind?.speed || null;

          const fromHour = fromLocal.getUTCHours();
          const fromMin = fromLocal.getUTCMinutes();
          const toHour = toLocal.getUTCHours();
          const toMin = toLocal.getUTCMinutes();

          const fromSlotMinutes = fromHour * 60 + fromMin;
          const toSlotMinutes = toHour * 60 + toMin;

          const startSlotMinutes = Math.max(fromSlotMinutes, nowTimeSlotMinutes);

          for (let slotMin = startSlotMinutes; slotMin <= toSlotMinutes; slotMin += 15) {
            const hour = Math.floor(slotMin / 60) % 24;
            const minute = slotMin % 60;
            const timeSlot = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

            if (!slotMap.has(timeSlot)) {
              slotMap.set(timeSlot, { 
                vis: periodVis, 
                cloudbase: periodCloudbase, 
                wind: periodWind,
                isTempo: false,
                periodIndex
              });
            }
          }
        } catch (e) {
          console.warn('Error parsing TAF period:', e, period);
        }
      });

      tempoPeriods.forEach((period, tempoIndex) => {
        try {
          const fromTime = new Date(period.timeFrom);
          const toTime = new Date(period.timeTo);
          
          if (isNaN(fromTime.getTime()) || isNaN(toTime.getTime())) {
            return;
          }

          const fromLocal = utcToAirportLocal(fromTime, airportCode, baseline);
          const toLocal = utcToAirportLocal(toTime, airportCode, baseline);

          const periodVis = parseVisibility(period.visibility);
          const periodCloudbase = period.cloudbase !== null && period.cloudbase !== undefined ? period.cloudbase : null;
          const periodWind = period.wind?.speed || null;

          const fromHour = fromLocal.getUTCHours();
          const fromMin = fromLocal.getUTCMinutes();
          const toHour = toLocal.getUTCHours();
          const toMin = toLocal.getUTCMinutes();

          const fromSlotMinutes = fromHour * 60 + fromMin;
          const toSlotMinutes = toHour * 60 + toMin;

          const startSlotMinutes = Math.max(fromSlotMinutes, nowTimeSlotMinutes);

          for (let slotMin = startSlotMinutes; slotMin <= toSlotMinutes; slotMin += 15) {
            const hour = Math.floor(slotMin / 60) % 24;
            const minute = slotMin % 60;
            const timeSlot = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

            slotMap.set(timeSlot, { 
              vis: periodVis, 
              cloudbase: periodCloudbase, 
              wind: periodWind,
              isTempo: true,
              periodIndex: tempoIndex
            });
          }
        } catch (e) {
          console.warn('Error parsing TAF TEMPO period:', e, period);
        }
      });

    }

    const slotEntries: Array<{ slot: string; vis: number | null; cloudbase: number | null; wind: number | null; sortKey: number }> = [];

    for (let i = 0; i <= slotsToShow; i++) {
      const slotMin = nowTimeSlotMinutes + (i * 15);
      const totalMinutes = slotMin;
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      const timeSlot = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      
      const data = slotMap.get(timeSlot);
      slotEntries.push({
        slot: timeSlot,
        vis: data ? data.vis : null,
        cloudbase: data ? data.cloudbase : null,
        wind: data ? data.wind : null,
        sortKey: slotMin,
      });
    }

    if (isNow && currentVis !== null) {
      const nowIndex = slotEntries.findIndex(entry => entry.sortKey === nowTimeSlotMinutes);
      
      if (nowIndex >= 0) {
        slotEntries[nowIndex].slot = 'NOW';
        slotEntries[nowIndex].vis = currentVis;
        slotEntries[nowIndex].cloudbase = currentCloudbase;
        slotEntries[nowIndex].wind = currentWind;
      } else {
        const insertIndex = slotEntries.findIndex(entry => entry.sortKey > nowTimeSlotMinutes);
        if (insertIndex >= 0) {
          slotEntries.splice(insertIndex, 0, {
            slot: 'NOW',
            vis: currentVis,
            cloudbase: currentCloudbase,
            wind: currentWind,
            sortKey: nowTimeSlotMinutes,
          });
        } else {
          slotEntries.push({
            slot: 'NOW',
            vis: currentVis,
            cloudbase: currentCloudbase,
            wind: currentWind,
            sortKey: nowTimeSlotMinutes,
          });
        }
      }
    }

    slotEntries.sort((a, b) => {
      if (a.slot === 'NOW' && b.slot === 'NOW') return 0;
      if (a.slot === 'NOW') return nowTimeSlotMinutes - b.sortKey;
      if (b.slot === 'NOW') return a.sortKey - nowTimeSlotMinutes;
      return a.sortKey - b.sortKey;
    });

    slotEntries.forEach(entry => {
      timeSlots.push(entry.slot);
      visibilities.push(entry.vis);
      cloudbases.push(entry.cloudbase);
      windSpeeds.push(entry.wind);
    });

    let selectedIndex = -1;
    const nowIndex = timeSlots.indexOf('NOW');
    
    if (isNow && nowIndex >= 0) {
      selectedIndex = nowIndex;
    } else {
      selectedIndex = timeSlots.indexOf(selectedTimeLabel);
      if (selectedIndex < 0 && nowIndex >= 0) {
        selectedIndex = nowIndex;
      }
    }

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

  if (!weather) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* METAR Display */}
      {weather.metar && (
        <div className="p-2 bg-slate-800/50 rounded border border-slate-700/50">
          <div className="text-xs font-semibold text-gray-300 mb-1 flex items-center justify-between">
            <span>METAR</span>
            {isNow && <span className="text-blue-400 text-[10px] font-medium">CURRENT</span>}
          </div>
          <div className="text-[10px] font-mono text-gray-400 break-all">{weather.metar}</div>
        </div>
      )}

      {/* TAF Display */}
      {weather.taf?.rawTAF && (
        <div className="p-2 bg-slate-800/50 rounded border border-dashed border-slate-600/50">
          <div className="text-xs font-semibold text-gray-400 mb-1 flex items-center justify-between">
            <span>TAF</span>
            {!isNow && <span className="text-slate-500 text-[10px] font-medium">FORECAST</span>}
          </div>
          <div className="text-[10px] font-mono text-gray-500 break-all">{weather.taf.rawTAF}</div>
        </div>
      )}

      {/* Visibility Graph */}
      {visibilityData && (
        <div className="p-2 bg-slate-800/50 rounded border border-slate-700/50">
          <div className="text-xs font-medium text-gray-300 mb-2 flex items-center justify-between">
            <span>Visibility</span>
            <span className="text-[10px] text-gray-500">
              {isNow ? 'METAR' : 'TAF'}
            </span>
          </div>
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
          <div className="text-xs font-medium text-gray-300 mb-2 flex items-center justify-between">
            <span>Cloudbase</span>
            <span className="text-[10px] text-gray-500">
              {isNow ? 'METAR' : 'TAF'}
            </span>
          </div>
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
          <div className="text-xs font-medium text-gray-300 mb-2 flex items-center justify-between">
            <span>Wind Speed</span>
            <span className="text-[10px] text-gray-500">
              {isNow ? 'METAR' : 'TAF'}
            </span>
          </div>
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
