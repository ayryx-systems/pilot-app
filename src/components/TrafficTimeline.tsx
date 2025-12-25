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
import { BaselineData, BaselineTimeSlot } from '@/types';
import { getAirportLocalDateString, utcToAirportLocal, getCurrentUTCTime } from '@/utils/airportTime';

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

  const yearStr = year;
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

function getThanksgivingDate(year: number): Date {
  const november = new Date(year, 10, 1);
  const dayOfWeek = november.getDay();
  const daysUntilFirstThursday = (4 - dayOfWeek + 7) % 7;
  const firstThursday = 1 + daysUntilFirstThursday;
  const fourthThursday = firstThursday + 21;
  return new Date(year, 10, fourthThursday);
}

function getIndependenceDay(year: number): Date {
  return new Date(year, 6, 4);
}

function getDaysDifference(date1: { year: number; month: number; day: number }, date2: { year: number; month: number; day: number }): number {
  const d1 = new Date(Date.UTC(date1.year, date1.month - 1, date1.day));
  const d2 = new Date(Date.UTC(date2.year, date2.month - 1, date2.day));
  const diffMs = d1.getTime() - d2.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getHolidayKey(dateStr: string): string | null {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = { year, month, day };
  
  if (month === 12) {
    const christmasDay = { year, month: 12, day: 25 };
    const daysDiff = getDaysDifference(date, christmasDay);
    
    if (daysDiff === -1) return 'christmas_-1';
    if (daysDiff === 0) return 'christmas_0';
    if (daysDiff === 1) return 'christmas_1';
  }
  
  if (month === 1 && day === 1) return 'new_years_day_0';
  if (month === 1 && day === 2) return 'new_years_day_1';
  if (month === 1 && day === 3) return 'new_years_day_2';
  
  const thanksgiving = getThanksgivingDate(year);
  const thanksgivingDate = { year, month: 11, day: thanksgiving.getDate() };
  const thanksgivingDaysDiff = getDaysDifference(date, thanksgivingDate);
  
  if (thanksgivingDaysDiff === -1) return 'thanksgiving_-1';
  if (thanksgivingDaysDiff === 0) return 'thanksgiving_0';
  if (thanksgivingDaysDiff === 1) return 'thanksgiving_1';
  
  const independenceDay = getIndependenceDay(year);
  const independenceDate = { year, month: 7, day: independenceDay.getDate() };
  const independenceDaysDiff = getDaysDifference(date, independenceDate);
  
  if (independenceDaysDiff === -1) return 'independence_day_-1';
  if (independenceDaysDiff === 0) return 'independence_day_0';
  if (independenceDaysDiff === 1) return 'independence_day_1';
  
  return null;
}

function getHolidayDisplayName(holidayKey: string): string {
  const names: Record<string, string> = {
    'christmas_-1': 'Christmas Eve',
    'christmas_0': 'Christmas Day',
    'christmas_1': 'Boxing Day',
    'thanksgiving_-1': 'Thanksgiving Eve',
    'thanksgiving_0': 'Thanksgiving Day',
    'thanksgiving_1': 'Day After Thanksgiving',
    'independence_day_-1': 'Independence Day Eve',
    'independence_day_0': 'Independence Day',
    'independence_day_1': 'Day After Independence Day',
    'new_years_day_0': 'New Year\'s Day',
    'new_years_day_1': 'Day After New Year\'s',
    'new_years_day_2': '2 Days After New Year\'s',
  };
  return names[holidayKey] || holidayKey;
}

export function TrafficTimeline({ baseline, airportCode, date, currentTime, loading }: TrafficTimelineProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    if (!baseline || loading) {
      setChartData(null);
      return;
    }

    const displayDate = date || getCurrentUTCTime();
    const dateStr = getAirportLocalDateString(displayDate, airportCode, baseline);
    const dayOfWeek = getDayOfWeekName(dateStr);
    const timeSlot = currentTime ? getTimeSlotKey(currentTime) : getTimeSlotKey(new Date());
    const dayOfWeekDisplay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

    const [year] = dateStr.split('-');
    const season = getSeason(dateStr, baseline, year);
    const seasonDisplay = season.charAt(0).toUpperCase() + season.slice(1);

    const holidayKey = getHolidayKey(dateStr);
    const seasonalData = baseline[season];
    
    console.log('[TrafficTimeline] Date calculation:', {
      displayDate: displayDate.toISOString(),
      dateStr,
      dayOfWeek,
      holidayKey,
      season,
      hasSeasonalData: !!seasonalData,
      hasHolidayTimeSlots: !!seasonalData?.holidayTimeSlots,
      holidayTimeSlotsKeys: seasonalData?.holidayTimeSlots ? Object.keys(seasonalData.holidayTimeSlots).slice(0, 10) : [],
      hasDayOfWeekTimeSlots: !!seasonalData?.dayOfWeekTimeSlots,
      dayOfWeekKeys: seasonalData?.dayOfWeekTimeSlots ? Object.keys(seasonalData.dayOfWeekTimeSlots) : []
    });
    
    let dayData: Record<string, BaselineTimeSlot> | undefined;
    let dayLabel: string;
    let isHoliday = false;

    if (holidayKey) {
      const currentSeasonData = baseline[season];
      const otherSeason = season === 'summer' ? 'winter' : 'summer';
      const otherSeasonData = baseline[otherSeason];
      
      if (currentSeasonData?.holidayTimeSlots?.[holidayKey]) {
        dayData = currentSeasonData.holidayTimeSlots[holidayKey];
        dayLabel = getHolidayDisplayName(holidayKey);
        isHoliday = true;
        console.log('[TrafficTimeline] Using holiday data from', season, ':', { holidayKey, dayLabel, timeSlotCount: Object.keys(dayData).length });
      } else if (otherSeasonData?.holidayTimeSlots?.[holidayKey]) {
        dayData = otherSeasonData.holidayTimeSlots[holidayKey];
        dayLabel = getHolidayDisplayName(holidayKey);
        isHoliday = true;
        console.log('[TrafficTimeline] Using holiday data from', otherSeason, ':', { holidayKey, dayLabel, timeSlotCount: Object.keys(dayData).length });
      } else {
        console.warn('[TrafficTimeline] Holiday key found but no data in either season:', { 
          holidayKey, 
          currentSeason: season,
          currentSeasonKeys: currentSeasonData?.holidayTimeSlots ? Object.keys(currentSeasonData.holidayTimeSlots).slice(0, 10) : [],
          otherSeason: otherSeason,
          otherSeasonKeys: otherSeasonData?.holidayTimeSlots ? Object.keys(otherSeasonData.holidayTimeSlots).slice(0, 10) : []
        });
        dayData = seasonalData?.dayOfWeekTimeSlots?.[dayOfWeek];
        dayLabel = `${dayOfWeekDisplay} Average`;
      }
    } else {
      dayData = seasonalData?.dayOfWeekTimeSlots?.[dayOfWeek];
      dayLabel = `${dayOfWeekDisplay} Average`;
    }

    if (!dayData) {
      console.warn(`No data found for ${isHoliday ? holidayKey : dayOfWeek} in ${season}`);
      setChartData(null);
      return;
    }

    const dayTimeSlots = Object.keys(dayData).sort();
    const dayCounts = dayTimeSlots.map(ts => dayData![ts].averageCount || dayData![ts].averageArrivals || 0);
    const daySampleSizes = dayTimeSlots.map(ts => dayData![ts].sampleSize?.days || 0);

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
          label: dayLabel,
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
      title: `Aircraft Passing 50nm Threshold - ${dayLabel} vs ${seasonDisplay} Average`
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
            if (value === null) return undefined;
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
