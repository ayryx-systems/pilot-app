// Pilot App Types
// ==============
// Simplified types for pilot-focused data

export interface Airport {
  id: string;
  name: string;
  code: string;
  position: {
    lat: number;
    lon: number;
  };
  active: boolean;
  lastUpdate: string;
}

export interface AirportOverview {
  airport: Airport;
  weather: {
    metar: string;
    metarFriendly: string;
    conditions: string;
    temperature?: string;
    wind?: {
      direction: number;
      speed: number;
      gust?: number;
    };
    visibility?: string;
    timestamp: string;
    taf?: {
      rawTAF: string;
      tafFriendly?: string;
      forecast?: {
        periods: Array<{
          timeFrom: string;
          timeTo: string;
          changeType: string;
          wind?: { direction: number; speed: number; gust?: number };
          visibility?: string;
          weather?: string;
          clouds?: Array<{ coverage: string; altitude: number }>;
        }>;
        summary?: string;
      };
    };
  };
  runways: Array<{
    name: string;
    heading: number;
    oppositeHeading: number;
    length: number;
    threshold: {
      lat: number;
      lon: number;
    };
    oppositeEnd: {
      name: string;
      lat: number;
      lon: number;
    };
    rightHandPattern: boolean;
    approaches?: Array<{
      name: string;
      waypoints: Array<{
        name: string;
        distanceFromThreshold: number;
        position?: [number, number];
      }>;
    }>;
  }>;
  operational: {
    active: boolean;
    lastUpdate: string;
  };
  osm?: {
    taxiways: OSMWay[];
    terminals: OSMWay[];
    gates: OSMNode[];
    aprons: OSMWay[];
    hangars: OSMWay[];
    controlTowers: OSMNode[];
    parkingPositions: OSMNode[];
    runways: OSMWay[];
    other: OSMWay[];
    featureCount: number;
  };
  timestamp: string;
  cacheMaxAge: number;
}

export interface PiRep {
  id: string;
  aircraft: string;
  message: string;
  location: {
    lat: number;
    lon: number;
  };
  altitude: number;
  timestamp: string;
  ageMinutes: number;
  priority: 'normal' | 'high' | 'urgent';
  conditions: Array<{
    type: string;
    severity: 'LIGHT' | 'MODERATE' | 'SEVERE' | 'EXTREME' | 'TRACE';
    description?: string;
  }>;
  remarks?: string;
  dismissed?: boolean;
}

export interface GroundTrack {
  id: string;
  callsign: string;
  aircraft: string;
  coordinates: Array<{
    lat: number;
    lon: number;
    altitude?: number;
    timestamp: string;
  }>;
  runway?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EMERGENCY';
  startTime: string;
  endTime?: string;
}

export interface SituationSummary {
  situation_overview: string;
  conditions: {
    processing?: {
      description: string;
      status: 'active' | 'inactive';
      reason?: string;
    };
    weather?: {
      description: string;
      short_summary: string;
      long_summary: string;
      status: 'normal' | 'caution' | 'warning' | 'check-overview' | 'unavailable';
    };
    traffic?: {
      description: string;
      short_summary: string;
      long_summary: string;
      status: 'normal' | 'caution' | 'warning' | 'unavailable';
    };
    approach?: {
      description: string;
      short_summary: string;
      long_summary: string;
      status: 'normal' | 'caution' | 'warning' | 'unavailable';
    };
    runway?: {
      description: string;
      short_summary: string;
      long_summary: string;
      status: 'normal' | 'caution' | 'warning' | 'unavailable';
    };
    ground?: {
      description: string;
      short_summary: string;
      long_summary: string;
      status: 'normal' | 'caution' | 'warning';
    };
    special?: {
      description: string;
      short_summary: string;
      long_summary: string;
      status: 'normal' | 'caution' | 'warning';
    };
  };
  active?: boolean;
  processingAvailable?: boolean;
  fallback?: boolean;
}

export interface ConnectionStatus {
  connected: boolean;
  lastUpdate: Date;
  latency?: number;
}



export interface PilotAppState {
  selectedAirport: string | null;
  airports: Airport[];
  airportOverview: AirportOverview | null;
  pireps: PiRep[];
  tracks: GroundTrack[];
  summary: SituationSummary | null;
  connectionStatus: ConnectionStatus;
  loading: boolean;
  error: string | null;
  pirepsMetadata?: {
    active: boolean;
    message?: string;
  };
  tracksMetadata?: {
    active: boolean;
    message?: string;
  };
  summaryMetadata?: {
    active: boolean;
    generated: boolean;
  };
}

// Map display options
export interface MapDisplayOptions {
  showRunways: boolean;
  showDmeRings: boolean;
  showWaypoints: boolean;
  showApproachRoutes: boolean;
  showExtendedCenterlines: boolean;
  showPireps: boolean;
  showGroundTracks: boolean;
  showWeatherRadar: boolean;
  showWeatherAlerts: boolean;
  showVisibility: boolean;
  showOSMFeatures: boolean;
}

// Weather-related types
export interface WeatherLayer {
  id: string;
  name: string;
  url: string;
  layers: string;
  format: string;
  transparent: boolean;
  opacity: number;
  crs?: string;
}

export interface WeatherService {
  id: string;
  name: string;
  baseUrl: string;
  type: 'WMS' | 'WFS' | 'REST';
  updateFrequency: number; // minutes
}

export interface WeatherAlert {
  id: string;
  title: string;
  description: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  urgency: 'immediate' | 'expected' | 'future' | 'past';
  certainty: 'observed' | 'likely' | 'possible' | 'unlikely' | 'unknown';
  areas: string[];
  effective: string;
  expires: string;
  status: 'actual' | 'exercise' | 'system' | 'test' | 'draft';
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  timestamp: string;
  source: string;
  cacheMaxAge?: number;
}

export interface AirportsResponse {
  airports: Airport[];
  timestamp: string;
  cacheMaxAge: number;
  source: string;
}

export interface PirepsResponse {
  airportId: string;
  pireps: PiRep[];
  count: number;
  timestamp: string;
  cacheMaxAge: number;
  source: string;
  active?: boolean;
  message?: string;
}

export interface TracksResponse {
  airportId: string;
  tracks: GroundTrack[];
  count: number;
  timestamp: string;
  cacheMaxAge: number;
  source: string;
  active?: boolean;
  message?: string;
}

export interface SummaryResponse {
  airportId: string;
  summary: SituationSummary;
  timestamp: string;
  cacheMaxAge: number;
  source: string;
  generated: boolean;
  active?: boolean;
}

// OSM Data Types
export interface OSMNode {
  id: number;
  lat?: number;
  lon?: number;
  geometry?: Array<{ lat: number; lon: number }>;
  tags: Record<string, string>;
}

export interface OSMWay {
  id: number;
  nodes: number[];
  tags: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

export interface AirportOSMFeatures {
  taxiways: OSMWay[];
  terminals: OSMWay[];
  gates: OSMNode[];
  aprons: OSMWay[];
  hangars: OSMWay[];
  controlTowers: OSMNode[];
  parkingPositions: OSMNode[];
  runways: OSMWay[];
  other: OSMWay[];
}

export interface OSMResponse {
  airportId: string;
  osm: AirportOSMFeatures & { featureCount: number };
  timestamp: string;
  cacheMaxAge: number;
  source: string;
}
