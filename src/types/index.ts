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
      status: 'normal' | 'caution' | 'warning' | 'unavailable';
    };
    approach?: {
      description: string;
      status: 'normal' | 'caution' | 'warning' | 'unavailable';
    };
    runway?: {
      description: string;
      status: 'normal' | 'caution' | 'warning' | 'unavailable';
    };
    ground?: {
      description: string;
      status: 'normal' | 'caution' | 'warning';
    };
    special?: {
      description: string;
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

export interface CachedData<T> {
  data: T;
  timestamp: Date;
  maxAge: number; // in seconds
  source: 'cache' | 'network';
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
