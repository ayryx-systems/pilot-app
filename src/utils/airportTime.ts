/**
 * Airport Time Utilities
 * =====================
 * Functions to work with airport local time (not user's machine time).
 * Uses Intl API for timezone/offset - DST handled automatically for all regions.
 */

const AIRPORT_TIMEZONES: Record<string, string> = {
  KORD: 'America/Chicago',
  KBNA: 'America/Chicago',
  KLGA: 'America/New_York',
  KJFK: 'America/New_York',
  KEWR: 'America/New_York',
  KBOS: 'America/New_York',
  KLAX: 'America/Los_Angeles',
  KSFO: 'America/Los_Angeles',
  KDEN: 'America/Denver',
  KSBA: 'America/Los_Angeles',
  KSMO: 'America/Los_Angeles',
};

export function getAirportTimezone(airportCode: string): string {
  const icao = (airportCode?.length === 3 && !airportCode?.startsWith('K'))
    ? `K${airportCode}`.toUpperCase()
    : (airportCode || '').toUpperCase();
  return AIRPORT_TIMEZONES[icao] || 'America/Chicago';
}

function getUTCOffsetHoursFromIntl(date: Date, ianaTimezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      timeZoneName: 'longOffset',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    if (!tzPart?.value?.startsWith('GMT')) return 0;
    const match = tzPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return 0;
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const mins = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (hours + mins / 60);
  } catch {
    return 0;
  }
}

export function getAirportUTCOffset(airportCode: string, date: Date, _baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): number {
  const ianaTimezone = getAirportTimezone(airportCode);
  return getUTCOffsetHoursFromIntl(date, ianaTimezone);
}

export function getSeason(date: Date, airportCode?: string): 'summer' | 'winter' {
  const icao = airportCode || 'KORD';
  const ianaTimezone = getAirportTimezone(icao);
  const year = date.getUTCFullYear();
  const janDate = new Date(Date.UTC(year, 0, 15));
  const winterOffset = getUTCOffsetHoursFromIntl(janDate, ianaTimezone);
  const currentOffset = getUTCOffsetHoursFromIntl(date, ianaTimezone);
  return currentOffset > winterOffset ? 'summer' : 'winter';
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
export function getAirportLocalTime(): Date {
  return getCurrentUTCTime();
}

/**
 * Convert a UTC Date to airport local time string (time only, HH:MM)
 * date should be a UTC Date object representing a moment in time
 */
export function formatAirportLocalTime(date: Date, airportCode: string, baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): string {
  const offsetHours = getAirportUTCOffset(airportCode, date, baseline);
  
  // Get UTC components
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  const utcSeconds = date.getUTCSeconds();
  
  // Calculate local time by adding offset
  let localHours = utcHours + offsetHours;
  const localMinutes = utcMinutes;
  const localSeconds = utcSeconds;
  
  // Calculate local date - start with UTC date and adjust for timezone
  let localYear = date.getUTCFullYear();
  let localMonth = date.getUTCMonth();
  let localDay = date.getUTCDate();
  
  // Handle day rollover when hours go negative or exceed 24
  if (localHours < 0) {
    localHours += 24;
    localDay -= 1;
    // Handle month/year rollover
    if (localDay < 1) {
      localMonth -= 1;
      if (localMonth < 0) {
        localMonth = 11;
        localYear -= 1;
      }
      // Get days in previous month
      const daysInMonth = new Date(localYear, localMonth + 1, 0).getDate();
      localDay = daysInMonth;
    }
  } else if (localHours >= 24) {
    localHours -= 24;
    localDay += 1;
    // Handle month/year rollover
    const daysInMonth = new Date(localYear, localMonth + 1, 0).getDate();
    if (localDay > daysInMonth) {
      localDay = 1;
      localMonth += 1;
      if (localMonth > 11) {
        localMonth = 0;
        localYear += 1;
      }
    }
  }
  
  return `${localMonth + 1}/${localDay} ${String(localHours).padStart(2, '0')}:${String(localMinutes).padStart(2, '0')}:${String(localSeconds).padStart(2, '0')}`;
}

/**
 * Format a UTC date/time string to airport local time (with date)
 * Overload: accepts string (ISO format) instead of Date object
 */
export function formatAirportLocalTimeFromString(utcTimeString: string, airportCode: string, baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): string {
  const date = new Date(utcTimeString);
  return formatAirportLocalTime(date, airportCode, baseline);
}


/**
 * Format a UTC date/time string to airport local time (short format, no seconds)
 */
export function formatAirportLocalTimeShort(utcTimeString: string, airportCode: string, baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): string {
  const date = new Date(utcTimeString);
  const offsetHours = getAirportUTCOffset(airportCode, date, baseline);
  
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  
  let localHours = utcHours + offsetHours;
  const localMinutes = utcMinutes;
  
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

/**
 * Get airport local date string in YYYY-MM-DD format
 * Converts a UTC Date to airport local date
 */
export function getAirportLocalDateString(utcDate: Date, airportCode: string, baseline?: { dstDatesByYear?: Record<string, { start: string; end: string }> }): string {
  const localDate = utcToAirportLocal(utcDate, airportCode, baseline);
  const year = localDate.getUTCFullYear();
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a UTC Date to UTC time string (time only, HH:MM:SS)
 * date should be a UTC Date object representing a moment in time
 */
export function formatUTCTime(date: Date): string {
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  const utcSeconds = date.getUTCSeconds();
  const utcMonth = date.getUTCMonth();
  const utcDay = date.getUTCDate();
  
  return `${utcMonth + 1}/${utcDay} ${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}:${String(utcSeconds).padStart(2, '0')}Z`;
}

/**
 * Format a UTC date/time string to UTC time (with date)
 * Overload: accepts string (ISO format) instead of Date object
 */
export function formatUTCTimeFromString(utcTimeString: string): string {
  const date = new Date(utcTimeString);
  return formatUTCTime(date);
}

/**
 * Format a UTC date/time string to UTC time (short format, no seconds)
 */
export function formatUTCTimeShort(utcTimeString: string): string {
  const date = new Date(utcTimeString);
  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();
  
  return `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}Z`;
}

/**
 * Get UTC date string in YYYY-MM-DD format
 * Returns the UTC date (not converted to local)
 */
export function getUTCDateString(utcDate: Date): string {
  const year = utcDate.getUTCFullYear();
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
