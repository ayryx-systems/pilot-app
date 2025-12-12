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
import { utcToAirportLocal, getAirportUTCOffset, getAirportLocalDateString, getSeason as getAirportSeason } from '@/utils/airportTime';

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

interface TimeBasedGraphsProps {
  baseline: BaselineData | null;
  airportCode: string;
  selectedTime: Date;
  loading?: boolean;
  onTimeClick?: (time: Date) => void;
}

function getDayOfWeekName(dateStr: string): string {
  // dateStr is in YYYY-MM-DD format (airport local date)
  // Parse it as a local date (not UTC)
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

function getSeasonalAverageData(baseline: BaselineData | null, season: 'summer' | 'winter') {
  if (!baseline) return null;
  
  const seasonalData = baseline[season];
  if (!seasonalData || !seasonalData.seasonalTimeSlots) {
    return null;
  }

  const timeSlots = Object.keys(seasonalData.seasonalTimeSlots).sort();
  const counts = timeSlots.map(ts => seasonalData.seasonalTimeSlots![ts].averageCount || 0);
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

function getTimeSlotKey(date: Date, airportCode: string, baseline?: BaselineData | null): string {
  // date is a UTC Date object representing a moment in time
  // Convert UTC date to airport local time
  const localDate = utcToAirportLocal(date, airportCode, baseline);
  // Extract hours and minutes from the local time representation
  // Since utcToAirportLocal returns a Date where UTC milliseconds represent local time,
  // we use getUTCHours() and getUTCMinutes() to get the local time components
  const hours = localDate.getUTCHours();
  const minutes = localDate.getUTCMinutes();
  const slotMinutes = Math.floor(minutes / 15) * 15;
  const timeSlot = `${hours.toString().padStart(2, '0')}:${slotMinutes.toString().padStart(2, '0')}`;
  
  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('[TimeBasedGraphs] getTimeSlotKey:', {
      inputUTC: date.toISOString(),
      localDateUTC: localDate.toISOString(),
      hours,
      minutes,
      slotMinutes,
      timeSlot
    });
  }
  
  return timeSlot;
}

export function TimeBasedGraphs({
  baseline,
  airportCode,
  selectedTime,
  loading,
  onTimeClick,
}: TimeBasedGraphsProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    if (!baseline || loading) {
      setChartData(null);
      return;
    }

    // Get the airport local date string (not UTC date)
    const dateStr = getAirportLocalDateString(selectedTime, airportCode, baseline);
    const dayOfWeek = getDayOfWeekName(dateStr);
    const timeSlot = getTimeSlotKey(selectedTime, airportCode, baseline);
    const dayOfWeekDisplay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

    // Use the airport local date for season calculation
    const localDateForSeason = utcToAirportLocal(selectedTime, airportCode, baseline);
    const season = getAirportSeason(localDateForSeason, baseline);
    const seasonDisplay = season.charAt(0).toUpperCase() + season.slice(1);

    const dayData = baseline[season]?.dayOfWeekTimeSlots?.[dayOfWeek];

    if (!dayData) {
      console.warn(`No data found for ${dayOfWeek} in ${season}`);
      setChartData(null);
      return;
    }

    const dayTimeSlots = Object.keys(dayData).sort();
    const dayCounts = dayTimeSlots.map(ts => dayData[ts].averageCount || 0);
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
          fill: true,
          tension: 0.4,
          pointRadius: (ctx: any) => {
            if (alignedDayCounts[ctx.dataIndex] === null) return 0;
            return ctx.dataIndex === currentTimeSlotIndex ? 8 : 2;
          },
          pointBackgroundColor: (ctx: any) => {
            if (alignedDayCounts[ctx.dataIndex] === null) return 'transparent';
            return ctx.dataIndex === currentTimeSlotIndex ? '#ffffff' : '#3b82f6';
          },
          pointBorderColor: (ctx: any) => {
            if (alignedDayCounts[ctx.dataIndex] === null) return 'transparent';
            return ctx.dataIndex === currentTimeSlotIndex ? '#60a5fa' : '#3b82f6';
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
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: (ctx: any) => alignedSeasonalCounts[ctx.dataIndex] !== null ? 1 : 0,
          pointBackgroundColor: (ctx: any) => alignedSeasonalCounts[ctx.dataIndex] !== null ? '#10b981' : 'transparent',
          pointBorderColor: (ctx: any) => alignedSeasonalCounts[ctx.dataIndex] !== null ? '#10b981' : 'transparent',
          spanGaps: true
        }
      ],
      daySampleSizes,
      seasonalSampleSizes: seasonalAvg.sampleSizes,
      dayIndices: alignment.dayIndices,
      seasonalIndices: alignment.seasonalIndices,
      title: `Traffic Forecast - ${dayOfWeekDisplay}`,
      currentTimeSlotIndex,
      alignedTimeSlots: alignment.alignedTimeSlots,
    });
  }, [baseline, airportCode, selectedTime, loading]);

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
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#e2e8f0',
          font: {
            size: 11
          }
        }
      },
      title: {
        display: true,
        text: chartData.title,
        color: '#e2e8f0',
        font: {
          size: 13,
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
          text: 'Aircraft / 15min',
          color: '#94a3b8',
          font: {
            size: 10
          }
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 10
          }
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
            size: 10
          }
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 9
          },
          maxRotation: 45,
          minRotation: 45,
          maxTicksLimit: 12,
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        }
      }
    },
    onClick: (event: any, elements: any[]) => {
      if (onTimeClick && chartData.alignedTimeSlots && chartRef.current) {
        const chart = chartRef.current;
        const canvasPosition = ChartJS.helpers.getRelativePosition(event, chart);
        const xScale = chart.scales.x;
        const value = xScale.getValueForPixel(canvasPosition.x);

        if (value !== null && value !== undefined && isFinite(value)) {
          const timeSlotIndex = Math.round(value);
          if (timeSlotIndex >= 0 && timeSlotIndex < chartData.alignedTimeSlots.length) {
            const selectedTimeSlot = chartData.alignedTimeSlots[timeSlotIndex];
            if (selectedTimeSlot) {
              const [hours, minutes] = selectedTimeSlot.split(':').map(Number);
              const newTime = new Date(selectedTime);
              newTime.setHours(hours, minutes, 0, 0);
              onTimeClick(newTime);
            }
          }
        }
      }
    },
    onHover: (event: any, elements: any[]) => {
      const chart = chartRef.current;
      if (!chart) return;
      
      const canvas = chart.canvas;
      if (!canvas) return;
      
      if (elements && elements.length > 0) {
        canvas.style.cursor = 'default';
      } else {
        canvas.style.cursor = 'pointer';
      }
    },
  };

  return (
    <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
      <div style={{ height: '200px', position: 'relative' }}>
        <Line ref={chartRef} data={chartData} options={options} />
      </div>
    </div>
  );
}
