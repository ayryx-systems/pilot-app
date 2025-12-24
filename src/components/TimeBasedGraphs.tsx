'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
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
import { BaselineData, ArrivalForecast } from '@/types';
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
  arrivalForecast?: ArrivalForecast | null;
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
  
  return timeSlot;
}

export const TimeBasedGraphs = React.memo(function TimeBasedGraphs({
  baseline,
  arrivalForecast,
  airportCode,
  selectedTime,
  loading,
  onTimeClick,
}: TimeBasedGraphsProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const [chartData, setChartData] = useState<any>(null);
  const prevBaselineRef = useRef<BaselineData | null>(null);
  const prevSelectedTimeRef = useRef<Date | null>(null);
  const prevChartDataRef = useRef<any>(null);
  
  // Memoize selectedTime to prevent unnecessary recalculations
  const selectedTimeKey = useMemo(() => {
    // Round to nearest minute to prevent micro-changes from triggering updates
    const time = selectedTime.getTime();
    return Math.floor(time / 60000) * 60000; // Round to nearest minute
  }, [selectedTime]);

  useEffect(() => {
    const baselineChanged = prevBaselineRef.current !== baseline;
    const timeChanged = !prevSelectedTimeRef.current || 
      Math.abs(prevSelectedTimeRef.current.getTime() - selectedTime.getTime()) > 1000;
    const loadingChanged = loading !== undefined;

    // Don't clear chart data if we're just loading other data (not baseline)
    // Only clear if baseline is missing or we're actually loading baseline
    if (!baseline) {
      if (chartData) {
        setChartData(null);
      }
      prevBaselineRef.current = null;
      prevSelectedTimeRef.current = null;
      return;
    }

    // Skip recalculation if baseline and selectedTime haven't actually changed
    // Use reference equality for baseline (should be stable if backend caching works)
    // Compare using selectedTimeKey (rounded to minute) to prevent micro-updates
    const timeKeyChanged = !prevSelectedTimeRef.current || 
      Math.abs(prevSelectedTimeRef.current.getTime() - selectedTimeKey) > 60000; // 1 minute threshold
    
    if (!baselineChanged && !timeKeyChanged && chartData) {
      return; // No need to recalculate - data hasn't meaningfully changed
    }

    prevBaselineRef.current = baseline;
    prevSelectedTimeRef.current = new Date(selectedTimeKey);

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

    // Align forecast data with baseline time slots if available
    // Filter forecast slots to only include those for the selected date
    let alignedForecastCounts: (number | null)[] = [];
    if (arrivalForecast && arrivalForecast.timeSlots && arrivalForecast.arrivalCounts) {
      // Validate data structure
      if (arrivalForecast.timeSlots.length !== arrivalForecast.arrivalCounts.length) {
        console.error('[TimeBasedGraphs] Forecast data mismatch:', {
          timeSlotsLength: arrivalForecast.timeSlots.length,
          arrivalCountsLength: arrivalForecast.arrivalCounts.length
        });
      }
      
      // Get current local time and selected date to filter forecast slots
      const nowLocal = utcToAirportLocal(new Date(), airportCode, baseline);
      const selectedLocal = utcToAirportLocal(selectedTime, airportCode, baseline);
      const selectedDateStr = getAirportLocalDateString(selectedTime, airportCode, baseline);
      const todayDateStr = getAirportLocalDateString(new Date(), airportCode, baseline);
      const isToday = selectedDateStr === todayDateStr;
      
      // Filter forecast slots based on selected date
      // Backend sends: today's slots first (17:00-23:45), then tomorrow's slots (00:00-08:45)
      const filteredForecastSlots: string[] = [];
      const filteredForecastCounts: number[] = [];
      
      arrivalForecast.timeSlots.forEach((slot, idx) => {
        const count = arrivalForecast.arrivalCounts[idx];
        if (count === undefined || count === null) return;
        
        const [hours, minutes] = slot.split(':').map(Number);
        const slotMinutes = hours * 60 + minutes;
        const currentMinutes = nowLocal.getUTCHours() * 60 + nowLocal.getUTCMinutes();
        const fourHoursAgoMinutes = currentMinutes - 4 * 60;
        
        if (isToday) {
          // For today: include slots >= (current time - 4 hours)
          // This naturally excludes tomorrow's early morning slots (00:00-08:00) since they're < fourHoursAgo
          if (slotMinutes >= fourHoursAgoMinutes) {
            filteredForecastSlots.push(slot);
            filteredForecastCounts.push(count);
          }
        } else {
          // For tomorrow: only include early morning slots (00:00-09:45)
          // Backend sends tomorrow's slots as 00:00-08:45
          if (hours >= 0 && hours <= 9) {
            filteredForecastSlots.push(slot);
            filteredForecastCounts.push(count);
          }
        }
      });
      
      const forecastMap = new Map<string, number>();
      filteredForecastSlots.forEach((slot, idx) => {
        forecastMap.set(slot, filteredForecastCounts[idx]);
      });
      
      alignedForecastCounts = alignment.alignedTimeSlots.map(slot => {
        const count = forecastMap.get(slot);
        return count !== undefined ? count : null;
      });
    }

    const datasets: any[] = [
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
    ];

    // Add FAA forecast dataset if available
    if (alignedForecastCounts.length > 0 && arrivalForecast) {
      // Ensure we're using the aligned counts, not the raw data
      const forecastData = alignedForecastCounts.map(count => count !== null ? count : null);
      
      datasets.push({
        label: 'FAA Arrival Forecast',
        data: forecastData,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        borderDash: [3, 3],
        fill: false,
        tension: 0.4,
        pointRadius: (ctx: any) => {
          const value = forecastData[ctx.dataIndex];
          return value !== null && value !== undefined ? 2 : 0;
        },
        pointBackgroundColor: (ctx: any) => {
          const value = forecastData[ctx.dataIndex];
          return value !== null && value !== undefined ? '#f59e0b' : 'transparent';
        },
        pointBorderColor: (ctx: any) => {
          const value = forecastData[ctx.dataIndex];
          return value !== null && value !== undefined ? '#f59e0b' : 'transparent';
        },
        spanGaps: true
      });
    }

    const newChartData = {
      labels: alignment.alignedTimeSlots,
      datasets,
      daySampleSizes,
      seasonalSampleSizes: seasonalAvg.sampleSizes,
      dayIndices: alignment.dayIndices,
      seasonalIndices: alignment.seasonalIndices,
      title: `Traffic Forecast - ${dayOfWeekDisplay}`,
      currentTimeSlotIndex,
      alignedTimeSlots: alignment.alignedTimeSlots,
    };

    // Only update chartData if it's actually different to prevent unnecessary Chart.js updates
    const shouldUpdate = !prevChartDataRef.current || 
        JSON.stringify(prevChartDataRef.current.labels) !== JSON.stringify(newChartData.labels) ||
        JSON.stringify(prevChartDataRef.current.datasets?.[0]?.data) !== JSON.stringify(newChartData.datasets[0]?.data) ||
        JSON.stringify(prevChartDataRef.current.datasets?.[1]?.data) !== JSON.stringify(newChartData.datasets[1]?.data) ||
        prevChartDataRef.current.currentTimeSlotIndex !== newChartData.currentTimeSlotIndex;
    
    if (shouldUpdate) {
      setChartData(newChartData);
      prevChartDataRef.current = newChartData;
    }
  }, [baseline, airportCode, selectedTimeKey]);

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
}, (prevProps, nextProps) => {
  // Custom comparison function: return true if props are equal (skip re-render)
  // Return false if props differ (re-render)
  
  // Baseline reference changed - need to re-render
  if (prevProps.baseline !== nextProps.baseline) return false;
  
  // Forecast reference changed - need to re-render
  if (prevProps.arrivalForecast !== nextProps.arrivalForecast) return false;
  
  // Airport changed - need to re-render
  if (prevProps.airportCode !== nextProps.airportCode) return false;
  
  // SelectedTime changed significantly (> 1 second) - need to re-render
  const timeDiff = Math.abs(prevProps.selectedTime.getTime() - nextProps.selectedTime.getTime());
  if (timeDiff > 1000) return false;
  
  // Loading state: only re-render if going from not-loading to loading
  // Skip re-render when loading completes (prevents flicker)
  if (prevProps.loading !== nextProps.loading) {
    // Only re-render if we're starting to load (not finishing)
    return nextProps.loading === false && prevProps.loading === true;
  }
  
  // All props are effectively equal - skip re-render
  return true;
});
