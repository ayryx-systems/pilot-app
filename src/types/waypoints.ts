/**
 * FAA Waypoint Types
 * ==================
 * 
 * TypeScript interfaces for FAA waypoint data structure.
 * These types match the format returned by the backend waypoint service.
 */

export interface FAACoordinates {
  raw: {
    latitude: string;
    longitude: string;
  };
  decimal: {
    latitude: number;
    longitude: number;
  };
}

export interface FAAWaypoint {
  id: string;
  name: string;
  coordinates: FAACoordinates;
  region: string;
  type: string;
  usage: string;
  magnetic_variation: number | null;
}

export interface FAAWaypointData {
  airport: string;
  waypoint_count: number;
  waypoints: Record<string, FAAWaypoint>;
}

export interface FormattedWaypoint {
  id: string;
  name: string;
  position: [number, number]; // [lat, lon]
  type: string;
  usage: string;
  region: string;
  magneticVariation: number | null;
  rawCoordinates: {
    latitude: string;
    longitude: string;
  };
}

export interface FormattedWaypointData {
  airport: string;
  waypointCount: number;
  waypoints: FormattedWaypoint[];
  timestamp: string;
  cacheMaxAge?: number;
  source?: string;
}

export interface WaypointAPIResponse {
  airport: string;
  waypointCount: number;
  waypoints: FormattedWaypoint[];
  timestamp: string;
  cacheMaxAge: number;
  source: string;
}

export interface WaypointAirportsResponse {
  airports: string[];
  timestamp: string;
  cacheMaxAge: number;
  source: string;
}
