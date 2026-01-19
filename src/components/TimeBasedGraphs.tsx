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
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';
import { BaselineData, ArrivalForecast } from '@/types';
import { utcToAirportLocal, getAirportLocalDateString, getSeason as getAirportSeason, getCurrentUTCTime } from '@/utils/airportTime';
import { HelpButton } from './HelpButton';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

interface TimeBasedGraphsProps {
  baseline: BaselineData | null;
  arrivalForecast?: ArrivalForecast | null;
  airportCode: string;
  selectedTime: Date;
  loading?: boolean;
}

function getDayOfWeekName(dateStr: string): string {
  // dateStr is in YYYY-MM-DD format (airport local date)
  // Parse it as a local date (not UTC)
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
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

function getHoursFromNow(timeSlot: string, nowLocal: Date, airportCode: string, baseline?: BaselineData | null, slotDate?: string, todayDateStr?: string): number {
  const [slotHours, slotMinutes] = timeSlot.split(':').map(Number);
  const nowHours = nowLocal.getUTCHours();
  const nowMinutes = nowLocal.getUTCMinutes();
  
  const slotTotalMinutes = slotHours * 60 + slotMinutes;
  const nowTotalMinutes = nowHours * 60 + nowMinutes;
  
  let hoursFromNow = (slotTotalMinutes - nowTotalMinutes) / 60;
  
  // Handle day wrap-around: if we have date info, use it; otherwise assume same day
  if (slotDate && todayDateStr) {
    if (slotDate !== todayDateStr) {
      // Different day - add/subtract 24 hours
      const slotDateObj = new Date(slotDate + 'T00:00:00Z');
      const todayDateObj = new Date(todayDateStr + 'T00:00:00Z');
      const daysDiff = Math.round((slotDateObj.getTime() - todayDateObj.getTime()) / (1000 * 60 * 60 * 24));
      hoursFromNow += daysDiff * 24;
    }
  } else {
    // Legacy: handle wrap-around for same-day slots
    if (hoursFromNow > 12) hoursFromNow -= 24;
    if (hoursFromNow < -12) hoursFromNow += 24;
  }
  
  return hoursFromNow;
}

function formatLocalTime(timeSlot: string, dateStr: string): string {
  // timeSlot is in HH:MM format, dateStr is YYYY-MM-DD
  // Return just the time portion for display
  return timeSlot;
}

export const TimeBasedGraphs = React.memo(function TimeBasedGraphs({
  baseline,
  arrivalForecast,
  airportCode,
  selectedTime,
  loading,
}: TimeBasedGraphsProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [chartData, setChartData] = useState<any>(null);
  const prevBaselineRef = useRef<BaselineData | null>(null);
  const prevSelectedTimeRef = useRef<Date | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevChartDataRef = useRef<any>(null);
  
  // Memoize selectedTime to prevent unnecessary recalculations
  const selectedTimeKey = useMemo(() => {
    // Round to nearest minute to prevent micro-changes from triggering updates
    const time = selectedTime.getTime();
    return Math.floor(time / 60000) * 60000; // Round to nearest minute
  }, [selectedTime]);

  useEffect(() => {
    const baselineChanged = prevBaselineRef.current !== baseline;
    
    // Check if arrivalForecast reference changed (but data might be the same)
    const forecastChanged = prevChartDataRef.current?.arrivalForecastRef !== arrivalForecast;

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

    // Skip recalculation if baseline, selectedTime, and arrivalForecast haven't actually changed
    // Use reference equality for baseline (should be stable if backend caching works)
    // Compare using selectedTimeKey (rounded to minute) to prevent micro-updates
    const timeKeyChanged = !prevSelectedTimeRef.current || 
      Math.abs(prevSelectedTimeRef.current.getTime() - selectedTimeKey) > 60000; // 1 minute threshold
    
    if (!baselineChanged && !timeKeyChanged && !forecastChanged && chartData) {
      return; // No need to recalculate - data hasn't meaningfully changed
    }

    prevBaselineRef.current = baseline;
    prevSelectedTimeRef.current = new Date(selectedTimeKey);

    // Calculate NOW in airport local time
    const nowUTC = getCurrentUTCTime();
    const nowLocal = utcToAirportLocal(nowUTC, airportCode, baseline);
    const todayDateStr = getAirportLocalDateString(nowUTC, airportCode, baseline);
    
    // Calculate time window: -2 hours history, extend forward based on ETA
    const isNow = Math.abs(selectedTime.getTime() - nowUTC.getTime()) <= 60000;
    const hoursAhead = (selectedTime.getTime() - nowUTC.getTime()) / (1000 * 60 * 60);
    const windowStartHours = -2; // 2 hours history
    const windowEndHours = isNow ? 2 : Math.max(hoursAhead + 2, 2); // Extend 2 hours past ETA, minimum 2 hours
    
    // Get the airport local date string for selected time
    const selectedDateStr = getAirportLocalDateString(selectedTime, airportCode, baseline);
    const dayOfWeek = getDayOfWeekName(selectedDateStr);
    const timeSlot = getTimeSlotKey(selectedTime, airportCode, baseline);
    const dayOfWeekDisplay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

    // Use the airport local date for season calculation
    const localDateForSeason = utcToAirportLocal(selectedTime, airportCode, baseline);
    const season = getAirportSeason(localDateForSeason, baseline);
    const seasonDisplay = season.charAt(0).toUpperCase() + season.slice(1);

    const holidayKey = getHolidayKey(selectedDateStr);
    const seasonalData = baseline[season];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dayData: Record<string, any> | undefined;
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
      } else if (otherSeasonData?.holidayTimeSlots?.[holidayKey]) {
        dayData = otherSeasonData.holidayTimeSlots[holidayKey];
        dayLabel = getHolidayDisplayName(holidayKey);
        isHoliday = true;
      } else {
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
    const dayCounts = dayTimeSlots.map(ts => dayData[ts].averageCount || dayData[ts].averageArrivals || 0);
    const daySampleSizes = dayTimeSlots.map(ts => dayData[ts].sampleSize?.days || 0);

    const seasonalAvg = getSeasonalAverageData(baseline, season);
    if (!seasonalAvg) {
      console.warn(`Could not get ${season} seasonal average data`);
      setChartData(null);
      return;
    }

    const alignment = alignTimeSlots(dayTimeSlots, seasonalAvg.timeSlots);

    // Build relative time slots and filter to window
    // We need to consider both today and tomorrow's slots when ETA is in the future
    const relativeTimeSlots: Array<{ hoursFromNow: number; timeSlot: string; label: string; dateStr: string }> = [];
    
    // Add today's slots
    alignment.alignedTimeSlots.forEach((ts) => {
      const hoursFromNow = getHoursFromNow(ts, nowLocal, airportCode, baseline, todayDateStr, todayDateStr);
      if (hoursFromNow >= windowStartHours && hoursFromNow <= windowEndHours) {
        relativeTimeSlots.push({
          hoursFromNow,
          timeSlot: ts,
          label: formatLocalTime(ts, todayDateStr),
          dateStr: todayDateStr,
        });
      }
    });
    
    // If ETA is tomorrow, also add tomorrow's slots
    if (selectedDateStr !== todayDateStr) {
      alignment.alignedTimeSlots.forEach((ts) => {
        const hoursFromNow = getHoursFromNow(ts, nowLocal, airportCode, baseline, selectedDateStr, todayDateStr);
        if (hoursFromNow >= windowStartHours && hoursFromNow <= windowEndHours) {
          // Only add if not already present (avoid duplicates)
          const exists = relativeTimeSlots.some(rt => rt.timeSlot === ts && rt.dateStr === selectedDateStr);
          if (!exists) {
            relativeTimeSlots.push({
              hoursFromNow,
              timeSlot: ts,
              label: formatLocalTime(ts, selectedDateStr),
              dateStr: selectedDateStr,
            });
          }
        }
      });
    }
    
    // Sort by hoursFromNow
    relativeTimeSlots.sort((a, b) => a.hoursFromNow - b.hoursFromNow);

    // Map data to relative time slots
    // For slots on different days, we need to look up the correct day-of-week baseline
    const alignedDayCounts = relativeTimeSlots.map((rt) => {
      const slotDateStr = rt.dateStr || todayDateStr;
      const slotDayOfWeek = getDayOfWeekName(slotDateStr);
      
      // Get baseline data for this specific date
      let slotDayData: Record<string, any> | undefined;
      
      // If this slot is for the selected date, use dayData (already loaded)
      if (slotDateStr === selectedDateStr) {
        slotDayData = dayData;
      } else {
        // Different day - need to get its baseline
        const slotHolidayKey = getHolidayKey(slotDateStr);
        if (slotHolidayKey) {
          const currentSeasonData = baseline[season];
          const otherSeason = season === 'summer' ? 'winter' : 'summer';
          const otherSeasonData = baseline[otherSeason];
          
          if (currentSeasonData?.holidayTimeSlots?.[slotHolidayKey]) {
            slotDayData = currentSeasonData.holidayTimeSlots[slotHolidayKey];
          } else if (otherSeasonData?.holidayTimeSlots?.[slotHolidayKey]) {
            slotDayData = otherSeasonData.holidayTimeSlots[slotHolidayKey];
          } else {
            slotDayData = seasonalData?.dayOfWeekTimeSlots?.[slotDayOfWeek];
          }
        } else {
          slotDayData = seasonalData?.dayOfWeekTimeSlots?.[slotDayOfWeek];
        }
      }
      
      if (!slotDayData) return null;
      const slotValue = slotDayData[rt.timeSlot];
      return slotValue ? (slotValue.averageCount || slotValue.averageArrivals || 0) : null;
    });

    const alignedSeasonalCounts = relativeTimeSlots.map((rt) => {
      const idx = alignment.alignedTimeSlots.indexOf(rt.timeSlot);
      if (idx < 0) return null;
      const seasonalIdx = alignment.seasonalIndices[idx];
      return seasonalIdx !== undefined ? seasonalAvg.counts[seasonalIdx] : null;
    });

    // Find indices for NOW and ETA in relative time slots
    // NOW is always for today's date
    const nowTimeSlot = getTimeSlotKey(nowUTC, airportCode, baseline);
    const nowRelativeIndex = relativeTimeSlots.findIndex(rt => rt.timeSlot === nowTimeSlot && rt.dateStr === todayDateStr);
    
    // ETA is for the selected date
    const etaRelativeIndex = relativeTimeSlots.findIndex(rt => rt.timeSlot === timeSlot && rt.dateStr === selectedDateStr);

    // Align forecast data with relative time slots
    // Only include forecast slots for today (fixes bug where forecast appears on tomorrow)
    let alignedForecastCounts: (number | null)[] = [];
    let alignedRecentActuals: (number | null)[] = [];
    
    if (arrivalForecast && arrivalForecast.timeSlots && arrivalForecast.arrivalCounts) {
      // Validate data structure
      if (arrivalForecast.timeSlots.length !== arrivalForecast.arrivalCounts.length) {
        console.error('[TimeBasedGraphs] Forecast data mismatch:', {
          timeSlotsLength: arrivalForecast.timeSlots.length,
          arrivalCountsLength: arrivalForecast.arrivalCounts.length
        });
      }
      
      const hasSlotDates = arrivalForecast.slotDates && arrivalForecast.slotDates.length === arrivalForecast.timeSlots.length;
      // Use date-aware keys to prevent cross-day contamination
      const forecastMap = new Map<string, number>(); // key: "dateStr|timeSlot"
      const actualsMap = new Map<string, number>(); // key: "dateStr|timeSlot"
      
      arrivalForecast.timeSlots.forEach((slot, idx) => {
        const count = arrivalForecast.arrivalCounts[idx];
        if (count === undefined || count === null) return;
        
        let slotDateStr: string | null = null;
        let shouldIncludeForecast = false;
        let shouldIncludeActuals = false;
        
        if (hasSlotDates) {
          slotDateStr = arrivalForecast.slotDates![idx];
          // Include forecast for today and selected date (for future ETAs)
          shouldIncludeForecast = slotDateStr === todayDateStr || slotDateStr === selectedDateStr;
          // Actuals only for today (fixes bug)
          shouldIncludeActuals = slotDateStr === todayDateStr;
        } else {
          // Legacy: check if slot is within window
          const hoursFromNow = getHoursFromNow(slot, nowLocal, airportCode, baseline);
          shouldIncludeForecast = hoursFromNow >= windowStartHours && hoursFromNow <= windowEndHours;
          // For actuals, only include if it's in the past (today)
          shouldIncludeActuals = hoursFromNow < 0 && hoursFromNow >= windowStartHours;
          // In legacy mode, assume slots are for today
          slotDateStr = todayDateStr;
        }
        
        if (shouldIncludeForecast && slotDateStr) {
          // Use date-aware key to prevent cross-day contamination
          forecastMap.set(`${slotDateStr}|${slot}`, count);
        }
        
        // Recent actuals only for today (fixes bug where they appear on tomorrow)
        if (shouldIncludeActuals && slotDateStr && arrivalForecast.actualCounts && arrivalForecast.actualCounts[idx] !== null && arrivalForecast.actualCounts[idx] !== undefined) {
          actualsMap.set(`${slotDateStr}|${slot}`, arrivalForecast.actualCounts[idx]!);
        }
      });
      
      // Map forecast and actuals to relative time slots
      // Match by both timeSlot AND date to avoid cross-day contamination
      alignedForecastCounts = relativeTimeSlots.map(rt => {
        // For forecast, check if this slot matches today or selected date
        if (rt.dateStr === todayDateStr || rt.dateStr === selectedDateStr) {
          const key = `${rt.dateStr}|${rt.timeSlot}`;
          const count = forecastMap.get(key);
          return count !== undefined ? count : null;
        }
        return null;
      });
      
      alignedRecentActuals = relativeTimeSlots.map(rt => {
        // Actuals only for today's slots (fixes bug where they appear on tomorrow)
        if (rt.dateStr === todayDateStr) {
          const key = `${rt.dateStr}|${rt.timeSlot}`;
          const count = actualsMap.get(key);
          return count !== undefined ? count : null;
        }
        return null;
      });
    }

    // Calculate expected arrivals for NOW and ETA (FAA forecast or baseline)
    const getExpectedArrivals = (relativeIdx: number): number | null => {
      if (relativeIdx < 0 || relativeIdx >= relativeTimeSlots.length) return null;
      
      // Try FAA forecast first
      if (alignedForecastCounts.length > 0 && alignedForecastCounts[relativeIdx] !== null) {
        return alignedForecastCounts[relativeIdx];
      }
      
      // Fall back to baseline
      if (alignedDayCounts[relativeIdx] !== null) {
        return alignedDayCounts[relativeIdx];
      }
      
      return null;
    };
    
    const nowExpectedArrivals = nowRelativeIndex >= 0 ? getExpectedArrivals(nowRelativeIndex) : null;
    const etaExpectedArrivals = etaRelativeIndex >= 0 ? getExpectedArrivals(etaRelativeIndex) : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = [
      {
        label: dayLabel,
        data: alignedDayCounts,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        order: 2, // Below forecast and recent actuals
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pointRadius: (ctx: any) => {
          if (alignedDayCounts[ctx.dataIndex] === null) return 0;
          return 2;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pointBackgroundColor: (ctx: any) => {
          if (alignedDayCounts[ctx.dataIndex] === null) return 'transparent';
          return '#3b82f6';
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pointBorderColor: (ctx: any) => {
          if (alignedDayCounts[ctx.dataIndex] === null) return 'transparent';
          return '#3b82f6';
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pointBorderWidth: (ctx: any) => {
          if (alignedDayCounts[ctx.dataIndex] === null) return 0;
          return 1;
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
        order: 3, // Background layer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pointRadius: (ctx: any) => alignedSeasonalCounts[ctx.dataIndex] !== null ? 1 : 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pointBackgroundColor: (ctx: any) => alignedSeasonalCounts[ctx.dataIndex] !== null ? '#10b981' : 'transparent',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pointBorderColor: (ctx: any) => alignedSeasonalCounts[ctx.dataIndex] !== null ? '#10b981' : 'transparent',
        spanGaps: true
      }
    ];

    // Add FAA forecast dataset if available
    if (alignedForecastCounts.length > 0 && arrivalForecast) {
      // Ensure we're using the aligned counts, not the raw data
      const forecastData = alignedForecastCounts.map(count => count !== null ? count : null);
      
      datasets.push({
        label: 'Flight Plans',
        data: forecastData,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        borderDash: [3, 3],
        fill: false,
        tension: 0.4,
        order: 1, // Above baseline, below recent actuals
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pointRadius: (ctx: any) => {
          const value = forecastData[ctx.dataIndex];
          return value !== null && value !== undefined ? 2 : 0;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pointBackgroundColor: (ctx: any) => {
          const value = forecastData[ctx.dataIndex];
          return value !== null && value !== undefined ? '#f59e0b' : 'transparent';
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pointBorderColor: (ctx: any) => {
          const value = forecastData[ctx.dataIndex];
          return value !== null && value !== undefined ? '#f59e0b' : 'transparent';
        },
        spanGaps: true
      });

      // Add recent actuals overlay (actual ADSB-detected arrivals)
      // Only show for today's slots (already filtered above)
      const hasRecentActuals = alignedRecentActuals.some(v => v !== null);
      if (hasRecentActuals) {
        datasets.push({
          label: 'Actual Arrivals',
          data: alignedRecentActuals,
          borderColor: '#a855f7', // Purple (for legend)
          backgroundColor: '#a855f7', // Purple (for legend)
          borderWidth: 2,
          fill: false,
          showLine: false, // Only show points, no line
          pointRadius: 5, // Slightly larger for visibility
          pointBackgroundColor: '#a855f7', // Purple
          pointBorderColor: '#ffffff', // White border for contrast
          pointBorderWidth: 2,
          pointStyle: 'circle',
          pointHoverRadius: 7, // Larger on hover
          order: 0, // Render on top (lower order = higher z-index)
          spanGaps: false
        });
      }
    }

    const newChartData = {
      labels: relativeTimeSlots.map(rt => rt.label),
      datasets,
      title: `Traffic Forecast - ${dayLabel}`,
      nowRelativeIndex,
      etaRelativeIndex,
      nowExpectedArrivals,
      etaExpectedArrivals,
      relativeTimeSlots,
      arrivalForecastRef: arrivalForecast, // Store reference to detect changes
    };

    // Only update chartData if it's actually different to prevent unnecessary Chart.js updates
    const shouldUpdate = !prevChartDataRef.current || 
        JSON.stringify(prevChartDataRef.current.labels) !== JSON.stringify(newChartData.labels) ||
        JSON.stringify(prevChartDataRef.current.datasets?.[0]?.data) !== JSON.stringify(newChartData.datasets[0]?.data) ||
        JSON.stringify(prevChartDataRef.current.datasets?.[1]?.data) !== JSON.stringify(newChartData.datasets[1]?.data) ||
        prevChartDataRef.current.nowRelativeIndex !== newChartData.nowRelativeIndex ||
        prevChartDataRef.current.etaRelativeIndex !== newChartData.etaRelativeIndex;
    
    if (shouldUpdate) {
      setChartData(newChartData);
      prevChartDataRef.current = newChartData;
    }
  }, [baseline, airportCode, selectedTimeKey, arrivalForecast, selectedTime]);

  // Show loading state only if we don't have chart data yet
  // If we have chart data, keep showing it even during refresh to prevent flashing
  if (loading && !chartData) {
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

  // Build annotations for NOW and ETA lines
  // NOW line shows whenever NOW is in the visible window (not just when viewing today)
  const annotations: Record<string, unknown> = {};
  
  if (chartData.nowRelativeIndex >= 0 && chartData.nowExpectedArrivals !== null) {
    const nowValue = chartData.nowExpectedArrivals;
    annotations['nowLine'] = {
      type: 'line',
      xMin: chartData.nowRelativeIndex,
      xMax: chartData.nowRelativeIndex,
      borderColor: 'rgba(239, 68, 68, 0.8)',
      borderWidth: 2,
      borderDash: [6, 3],
      label: {
        display: true,
        content: `NOW: ${Math.round(nowValue)}`,
        position: 'end',
        backgroundColor: 'rgba(239, 68, 68, 1)',
        color: 'white',
        font: { size: 12, weight: 'bold' },
        padding: 4,
      },
    };
  }
  
  const isNow = Math.abs(selectedTime.getTime() - getCurrentUTCTime().getTime()) <= 60000;
  if (!isNow && chartData.etaRelativeIndex >= 0 && chartData.etaExpectedArrivals !== null) {
    const etaValue = chartData.etaExpectedArrivals;
    annotations['etaLine'] = {
      type: 'line',
      xMin: chartData.etaRelativeIndex,
      xMax: chartData.etaRelativeIndex,
      borderColor: 'rgba(59, 130, 246, 0.8)',
      borderWidth: 2,
      label: {
        display: true,
        content: `ETA: ${Math.round(etaValue)}`,
        position: 'end',
        backgroundColor: 'rgba(59, 130, 246, 1)',
        color: 'white',
        font: { size: 12, weight: 'bold' },
        padding: 4,
      },
    };
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
        display: false,
      },
      tooltip: {
        enabled: false
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      annotation: {
        annotations: annotations as any,
      },
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
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        }
      }
    },
  };

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-2">
        <HelpButton
          title="Traffic Forecast Graph"
          size="sm"
          content={
            <div className="space-y-2">
              <p>
                Shows expected arrival traffic at your selected time based on historical patterns and FAA forecasts. All values shown are per 15-minute time slot.
              </p>
              <p>
                <strong className="text-blue-400">Blue Line:</strong> Average for this day of the week (e.g., Thursday average)
              </p>
              <p>
                <strong className="text-green-400">Green Line:</strong> Seasonal average across all days
              </p>
              <p>
                <strong className="text-orange-400">Orange Line:</strong> Flight Plans - FAA forecast based on filed flight plans with arrival times during each 15-minute time slot
              </p>
              <p>
                <strong className="text-purple-400">Purple Dots:</strong> Actual Arrivals - Real ADSB-detected landings from the last 12 hours, shown as completed 15-minute time slots.
              </p>
              <p>
                <strong className="text-red-400">Red Vertical Line:</strong> Expected arrivals NOW (FAA forecast or baseline)
              </p>
              <p>
                <strong className="text-blue-400">Blue Vertical Line:</strong> Expected arrivals at your selected ETA (FAA forecast or baseline)
              </p>
            </div>
          }
        />
      </div>
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
