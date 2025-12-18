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

interface TrafficTimelineProps {
  baseline: BaselineData | null;
  airportCode: string;
  date?: Date;
  currentTime?: Date;
  loading?: boolean;
}

function getDayOfWeekName(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getUTCDay()];
}

function getSeason(dateStr: string, baseline: BaselineData | null, year: string): 'summer' | 'winter' {
  if (!baseline || !baseline.dstDatesByYear) {
    return 'summer';
  }

  const yearStr = typeof year === 'string' ? year : year.toString();
  const dstDates = baseline.dstDatesByYear[yearStr];

  if (!dstDates) {
    return 'summer';
  }

  const [dstStartYear, dstStartMonth, dstStartDay] = dstDates.start.split('-').map(Number);
  const [dstEndYear, dstEndMonth, dstEndDay] = dstDates.end.split('-').map(Number);
  const dstStart = new Date(dstStartYear, dstStartMonth - 1, dstStartDay);
  const dstEnd = new Date(dstEndYear, dstEndMonth - 1, dstEndDay);

  const [dateYear, dateMonth, dateDay] = dateStr.split('-').map(Number);
  const dateOnly = new Date(dateYear, dateMonth - 1, dateDay);
  const dstStartOnly = new Date(dstStart.getFullYear(), dstStart.getMonth(), dstStart.getDate());
  const dstEndOnly = new Date(dstEnd.getFullYear(), dstEnd.getMonth(), dstEnd.getDate());

  if (dateOnly >= dstStartOnly && dateOnly < dstEndOnly) {
    return 'summer';
  }
  return 'winter';
}

function getSeasonalAverageData(baseline: BaselineData | null, season: 'summer' | 'winter') {
  if (!baseline) return null;
  
  const seasonalData = baseline[season];
  if (!seasonalData || !seasonalData.seasonalTimeSlots) {
    return null;
  }

  const timeSlots = Object.keys(seasonalData.seasonalTimeSlots).sort();
  const counts = timeSlots.map(ts => seasonalData.seasonalTimeSlots![ts].averageCount || seasonalData.seasonalTimeSlots![ts].averageArrivals || 0);
  const sampleSizes = timeSlots.map(ts => seasonalData.seasonalTimeSlots![ts].sampleSize?.days || 0);

  return { timeSlots, counts, sampleSizes, season };
}

function alignTimeSlots(dayTimeSlots: string[], seasonalTimeSlots: string[]) {
  const allTimeSlots = [...new Set([...dayTimeSlots, ...seasonalTimeSlots])].sort();

  const dayData = new Map<string, number>();
  dayTimeSlots.forEach((ts, idx) => {
    dayData.set(ts, idx);
  });

  const seasonalData = new Map<string, number>();
  seasonalTimeSlots.forEach((ts, idx) => {
    seasonalData.set(ts, idx);
  });

  return {
    alignedTimeSlots: allTimeSlots,
    dayIndices: allTimeSlots.map(ts => dayData.get(ts)),
    seasonalIndices: allTimeSlots.map(ts => seasonalData.get(ts))
  };
}

function getTimeSlotKey(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const slotMinutes = Math.floor(minutes / 15) * 15;
  return `${hours.toString().padStart(2, '0')}:${slotMinutes.toString().padStart(2, '0')}`;
}

export function TrafficTimeline({ baseline, airportCode, date, currentTime, loading }: TrafficTimelineProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    if (!baseline || loading) {
      setChartData(null);
      return;
    }

    const displayDate = date || new Date();
    const dateStr = displayDate.toISOString().split('T')[0];
    const dayOfWeek = getDayOfWeekName(dateStr);
    const timeSlot = currentTime ? getTimeSlotKey(currentTime) : getTimeSlotKey(new Date());
    const dayOfWeekDisplay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

    const [year] = dateStr.split('-');
    const season = getSeason(dateStr, baseline, year);
    const seasonDisplay = season.charAt(0).toUpperCase() + season.slice(1);

    const dayData = baseline[season]?.dayOfWeekTimeSlots?.[dayOfWeek];

    if (!dayData) {
      console.warn(`No data found for ${dayOfWeek} in ${season}`);
      setChartData(null);
      return;
    }

    const dayTimeSlots = Object.keys(dayData).sort();
    const dayCounts = dayTimeSlots.map(ts => dayData[ts].averageCount || dayData[ts].averageArrivals || 0);
    const daySampleSizes = dayTimeSlots.map(ts => dayData[ts].sampleSize?.days || 0);

    const seasonalAvg = getSeasonalAverageData(baseline, season);
    if (!seasonalAvg) {
      console.warn(`Could not get ${season} seasonal average data`);
      setChartData(null);
      return;
    }

    const alignment = alignTimeSlots(dayTimeSlots, seasonalAvg.timeSlots);

    const alignedDayCounts = alignment.alignedTimeSlots.map((ts, idx) => {
      const dayIdx = alignment.dayIndices[idx];
      return dayIdx !== undefined ? dayCounts[dayIdx] : null;
    });

    const alignedSeasonalCounts = alignment.alignedTimeSlots.map((ts, idx) => {
      const seasonalIdx = alignment.seasonalIndices[idx];
      return seasonalIdx !== undefined ? seasonalAvg.counts[seasonalIdx] : null;
    });

    const matchedTimeSlot = dayTimeSlots.find(ts => ts === timeSlot) || dayTimeSlots[0];
    const currentTimeSlotIndex = alignment.alignedTimeSlots.indexOf(matchedTimeSlot);

    setChartData({
      labels: alignment.alignedTimeSlots,
      datasets: [
        {
          label: `${dayOfWeekDisplay} Average`,
          data: alignedDayCounts,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2.5,
          fill: false,
          tension: 0.4,
          pointRadius: (ctx: any) => {
            if (alignedDayCounts[ctx.dataIndex] === null) return 0;
            return ctx.dataIndex === currentTimeSlotIndex ? 6 : 3;
          },
          pointBackgroundColor: (ctx: any) => {
            if (alignedDayCounts[ctx.dataIndex] === null) return 'transparent';
            return ctx.dataIndex === currentTimeSlotIndex ? '#ef4444' : '#3b82f6';
          },
          pointBorderColor: (ctx: any) => {
            if (alignedDayCounts[ctx.dataIndex] === null) return 'transparent';
            return ctx.dataIndex === currentTimeSlotIndex ? '#dc2626' : '#3b82f6';
          },
          pointBorderWidth: (ctx: any) => {
            if (alignedDayCounts[ctx.dataIndex] === null) return 0;
            return ctx.dataIndex === currentTimeSlotIndex ? 3 : 1;
          },
          spanGaps: true
        },
        {
          label: `${seasonDisplay} Seasonal Average`,
          data: alignedSeasonalCounts,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: (ctx: any) => alignedSeasonalCounts[ctx.dataIndex] !== null ? 2 : 0,
          pointBackgroundColor: (ctx: any) => alignedSeasonalCounts[ctx.dataIndex] !== null ? '#10b981' : 'transparent',
          pointBorderColor: (ctx: any) => alignedSeasonalCounts[ctx.dataIndex] !== null ? '#10b981' : 'transparent',
          spanGaps: true
        }
      ],
      daySampleSizes,
      seasonalSampleSizes: seasonalAvg.sampleSizes,
      dayIndices: alignment.dayIndices,
      seasonalIndices: alignment.seasonalIndices,
      title: `Aircraft Passing 50nm Threshold - ${dayOfWeekDisplay} vs ${seasonDisplay} Average`
    });
  }, [baseline, airportCode, date, currentTime, loading]);

  if (loading) {
    return (
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-3/4 mb-4"></div>
          <div className="h-48 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!baseline || !chartData) {
    return (
      <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
        <p className="text-sm text-gray-400">Baseline data not available</p>
      </div>
    );
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#e2e8f0',
          font: {
            size: 12
          }
        }
      },
      title: {
        display: true,
        text: chartData.title,
        color: '#e2e8f0',
        font: {
          size: 14,
          weight: 'bold' as const
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            if (value === null) return null;
            let label = `${context.dataset.label}: ${value.toFixed(1)} aircraft`;

            if (context.datasetIndex === 0) {
              const dayIdx = chartData.dayIndices[context.dataIndex];
              const sampleSize = dayIdx !== undefined ? chartData.daySampleSizes[dayIdx] : null;
              return sampleSize ? `${label} (${sampleSize} days)` : label;
            } else {
              const seasonalIdx = chartData.seasonalIndices[context.dataIndex];
              const sampleSize = seasonalIdx !== undefined ? chartData.seasonalSampleSizes[seasonalIdx] : null;
              return sampleSize ? `${label} (${sampleSize} days)` : label;
            }
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Aircraft Passing 50nm Threshold (Average per Day)',
          color: '#94a3b8',
          font: {
            size: 11
          }
        },
        ticks: {
          color: '#94a3b8'
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time (Local)',
          color: '#94a3b8',
          font: {
            size: 11
          }
        },
        ticks: {
          color: '#94a3b8',
          maxRotation: 45,
          minRotation: 45
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        }
      }
    }
  };

  return (
    <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
      <div style={{ height: '300px', position: 'relative' }}>
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
}
