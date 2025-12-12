/**
 * Airport Time Utilities
 * =====================
 * Functions to work with airport local time (not user's machine time)
 */

/**
 * Airport timezone mappings
 * Maps airport codes to IANA timezone identifiers
 */
const AIRPORT_TIMEZONES: Record<string, string> = {
  KORD: 'America/Chicago',
  KLGA: 'America/New_York',
  KJFK: 'America/New_York',
  KEWR: 'America/New_York',
  KLAX: 'America/Los_Angeles',
  KSFO: 'America/Los_Angeles',
  KDEN: 'America/Denver',
  KSBA: 'America/Los_Angeles',
  KSMO: 'America/Los_Angeles',
};

/**
 * UTC offset mappings by timezone (winter/summer)
 * Winter = standard time, Summer = daylight saving time
 */
const UTC_OFFSETS: Record<string, { winter: number; summer: number }> = {
  'America/Los_Angeles': { winter: -8, summer: -7 },
  'America/Denver': { winter: -7, summer: -6 },
  'America/Chicago': { winter: -6, summer: -5 },
  'America/New_York': { winter: -5, summer: -4 },
};

/**
 * Get the timezone for an airport code
 */
export function getAirportTimezone(airportCode: string): string {
  return AIRPORT_TIMEZONES[airportCode] || 'America/Chicago';
}

/**
 * Determine if a date is in summer (DST) or winter (standard time)
 * Uses DST dates from baseline data if available, otherwise estimates
 */
export function getSeason(date: Date, baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): 'summer' | 'winter' {
  if (baseline?.dstDatesByYear) {
    const year = date.getFullYear().toString();
    const dstDates = baseline.dstDatesByYear[year];
    
    if (dstDates) {
      const [dstStartYear, dstStartMonth, dstStartDay] = dstDates.start.split('-').map(Number);
      const [dstEndYear, dstEndMonth, dstEndDay] = dstDates.end.split('-').map(Number);
      const dstStart = new Date(dstStartYear, dstStartMonth - 1, dstStartDay);
      const dstEnd = new Date(dstEndYear, dstEndMonth - 1, dstEndDay);
      
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dstStartOnly = new Date(dstStart.getFullYear(), dstStart.getMonth(), dstStart.getDate());
      const dstEndOnly = new Date(dstEnd.getFullYear(), dstEnd.getMonth(), dstEnd.getDate());
      
      if (dateOnly >= dstStartOnly && dateOnly < dstEndOnly) {
        return 'summer';
      }
    }
  }
  
  // Fallback: estimate based on month (rough approximation)
  // DST typically: March-November in US
  const month = date.getMonth() + 1; // 1-12
  if (month >= 3 && month < 11) {
    return 'summer';
  }
  return 'winter';
}

/**
 * Get UTC offset in hours for an airport at a specific date
 * date should be a UTC Date object
 */
export function getAirportUTCOffset(airportCode: string, date: Date, baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): number {
  const timezone = getAirportTimezone(airportCode);
  const season = getSeason(date, baseline);
  const offset = UTC_OFFSETS[timezone] || { winter: -6, summer: -5 };
  const offsetHours = season === 'summer' ? offset.summer : offset.winter;
  
  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('[airportTime] getAirportUTCOffset:', {
      airportCode,
      dateUTC: date.toISOString(),
      timezone,
      season,
      offsetHours
    });
  }
  
  return offsetHours;
}

/**
 * Get the current UTC time as a Date object
 * This is used as the reference point for "NOW"
 * Note: new Date() already returns UTC time internally
 */
export function getCurrentUTCTime(): Date {
  return new Date();
}

/**
 * Convert UTC Date to airport local time (as a Date object with local time components)
 * Returns a Date object where getHours(), getMinutes() etc. represent airport local time
 */
export function utcToAirportLocal(utcDate: Date, airportCode: string, baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): Date {
  const offsetHours = getAirportUTCOffset(airportCode, utcDate, baseline);
  const utcTime = utcDate.getTime();
  const localTimeMs = utcTime + offsetHours * 60 * 60 * 1000;
  return new Date(localTimeMs);
}

/**
 * Convert airport local time (as Date with local components) back to UTC
 */
export function airportLocalToUTC(localDate: Date, airportCode: string, baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): Date {
  const offsetHours = getAirportUTCOffset(airportCode, localDate, baseline);
  const localTimeMs = localDate.getTime();
  const utcTimeMs = localTimeMs - offsetHours * 60 * 60 * 1000;
  return new Date(utcTimeMs);
}

/**
 * Get the current time at an airport (returns UTC Date representing current moment)
 * For display purposes, use utcToAirportLocal() to convert to local time components
 */
export function getAirportLocalTime(airportCode: string, baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): Date {
  return getCurrentUTCTime();
}

/**
 * Convert a UTC Date to airport local time string
 * date should be a UTC Date object representing a moment in time
 */
export function formatAirportLocalTime(date: Date, airportCode: string, baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): string {
  const offsetHours = getAirportUTCOffset(airportCode, date, baseline);
  
  // Get UTC components
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  
  // Convert to local time by adding offset
  // Note: offset is negative for US timezones (e.g., -6 for Chicago)
  // So we add the negative offset, which effectively subtracts
  let localHours = utcHours + offsetHours;
  let localMinutes = utcMinutes;
  
  // Handle day rollover
  while (localHours < 0) {
    localHours += 24;
  }
  while (localHours >= 24) {
    localHours -= 24;
  }
  
  return `${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}`;
}

/**
 * Format a Date object that already represents local time (created by utcToAirportLocal)
 * This extracts the UTC components directly since they represent local time
 */
export function formatLocalTimeDate(localTimeDate: Date): string {
  const hours = localTimeDate.getUTCHours();
  const minutes = localTimeDate.getUTCMinutes();
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Convert airport local time to UTC Date
 */
export function airportLocalTimeToUTC(localTime: Date, airportCode: string, baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): Date {
  const offsetHours = getAirportUTCOffset(airportCode, localTime, baseline);
  const localTimeMs = localTime.getTime();
  const utcTime = new Date(localTimeMs - offsetHours * 60 * 60 * 1000);
  return utcTime;
}
