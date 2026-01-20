import { FlightCategory } from '@/types';

export function computeFlightCategory(
  visibilityKm: number | null | undefined,
  ceilingFt: number | null | undefined
): FlightCategory {
  const visibility = visibilityKm ?? 10;
  const ceiling = ceilingFt ?? 99999;

  const visibilityMiles = visibility * 0.621371;

  if (visibilityMiles < 1 || ceiling < 500) {
    return 'LIFR';
  } else if (visibilityMiles < 3 || ceiling < 1000) {
    return 'IFR';
  } else if (visibilityMiles <= 5 || ceiling <= 3000) {
    return 'MVFR';
  } else {
    return 'VFR';
  }
}

export const FLIGHT_CATEGORY_COLORS: Record<FlightCategory, { color: string; bg: string; border: string }> = {
  VFR: {
    color: 'rgb(34, 197, 94)',
    bg: 'rgba(34, 197, 94, 0.15)',
    border: 'rgba(34, 197, 94, 0.6)',
  },
  MVFR: {
    color: 'rgb(234, 179, 8)',
    bg: 'rgba(234, 179, 8, 0.15)',
    border: 'rgba(234, 179, 8, 0.6)',
  },
  IFR: {
    color: 'rgb(234, 88, 12)',
    bg: 'rgba(234, 88, 12, 0.15)',
    border: 'rgba(234, 88, 12, 0.6)',
  },
  LIFR: {
    color: 'rgb(220, 38, 38)',
    bg: 'rgba(220, 38, 38, 0.15)',
    border: 'rgba(220, 38, 38, 0.6)',
  },
  unlimited: {
    color: 'rgb(34, 197, 94)',
    bg: 'rgba(34, 197, 94, 0.15)',
    border: 'rgba(34, 197, 94, 0.6)',
  },
  unknown: {
    color: 'rgb(156, 163, 175)',
    bg: 'rgba(156, 163, 175, 0.15)',
    border: 'rgba(156, 163, 175, 0.6)',
  },
};

export const FLIGHT_CATEGORY_DESCRIPTIONS: Record<FlightCategory, string> = {
  VFR: 'Clear: >5mi vis, >3000ft ceiling',
  MVFR: 'Marginal: 3-5mi vis, 1000-3000ft',
  IFR: 'Poor: 1-3mi vis, 500-1000ft',
  LIFR: 'Very poor: <1mi vis, <500ft',
  unlimited: 'Clear conditions',
  unknown: 'Unknown conditions',
};

export function getFlightCategoryColor(category: FlightCategory): string {
  return FLIGHT_CATEGORY_COLORS[category]?.color || FLIGHT_CATEGORY_COLORS.unknown.color;
}

