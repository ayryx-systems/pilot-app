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
    visibility?: number | string;
    clouds?: Array<{ coverage: string; altitude: number }>;
    ceiling?: number | null;
    cloudbase?: number | null;
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
          visibility?: number | string;
          weather?: string;
          clouds?: Array<{ coverage: string; altitude: number }>;
          ceiling?: number | null;
    cloudbase?: number | null;
        }>;
        summary?: string;
      };
    };
    graph?: {
      timeSlots: string[];
      visibility: (number | null)[];
      ceiling: (number | null)[];
      cloudbase?: (number | null)[];
      wind: (number | null)[];
      metarRaw: string | null;
      tafRaw: string | null;
    } | null;
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
  createdAt?: string; // Landing time (when the track was created)
  endTime?: string;
}

export interface Arrival {
  icao: string;
  callsign: string;
  aircraftType: string | null;
  aircraftCategory: 'light' | 'small' | 'large' | 'heavy' | 'other' | null; // OpenSky category-based classification
  timestamp50nm: string;
  timestampLanding: string;
  durationSeconds: number;
  durationMinutes: number;
  runway: string | null;
  airportId: string;
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
  arrivals: Arrival[];
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
  arrivalsMetadata?: {
    active: boolean;
    message?: string;
  };
  summaryMetadata?: {
    active: boolean;
    generated: boolean;
  };
  baseline?: BaselineData | null;
  baselineLoading?: boolean;
  arrivalForecast?: ArrivalForecast | null;
  arrivalForecastLoading?: boolean;
}

// Map display options
export interface MapDisplayOptions {
  showRunways: boolean;
  showDmeRings: boolean;
  showWaypoints: boolean;
  showExtendedCenterlines: boolean;
  showPireps: boolean;
  showWeatherPireps: boolean;
  showMetars: boolean;
  showGroundTracks: boolean;
  showWeatherRadar: boolean;
  showWeatherAlerts: boolean;
  showVisibility: boolean;
  showOSMFeatures: boolean;
  showSigmetAirmet: boolean;
  showWindsAloft: boolean;
  showIcing: boolean;
  showTurbulence: boolean;
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

export interface ArrivalsResponse {
  airportId: string;
  arrivals: Arrival[];
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

export interface BaselineTimeSlot {
  averageArrivals?: number;
  averageCount?: number;
  medianTimeFrom50nm?: number;
  sampleSize?: {
    days: number;
  };
}

export interface BaselineSeason {
  seasonalTimeSlots?: Record<string, BaselineTimeSlot>;
  dayOfWeekTimeSlots?: Record<string, Record<string, BaselineTimeSlot>>;
  holidayTimeSlots?: Record<string, Record<string, BaselineTimeSlot>>;
}

export interface BaselineData {
  airport: string;
  yearRange?: string;
  summer: BaselineSeason;
  winter: BaselineSeason;
  dstDatesByYear?: Record<string, { start: string; end: string }>;
}

export interface BaselineResponse {
  airportId: string;
  baseline: BaselineData;
  timestamp: string;
  cacheMaxAge: number;
  source: string;
}

export interface ArrivalForecast {
  airportCode: string;
  timestamp: string;
  timeSlots: string[]; // Array of time slots in HH:MM format
  arrivalCounts: (number | null)[]; // Array of arrival counts per time slot (null for slots without FAA data)
  slotDates?: string[]; // Array of date strings (YYYY-MM-DD) corresponding to each time slot
  totalArrivals: number;
  source: string;
  error?: string;
  unavailable?: boolean;
}

export interface ArrivalForecastResponse {
  airportId: string;
  forecast: ArrivalForecast;
  timestamp: string;
  cacheMaxAge: number;
  source: string;
}

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'unlimited' | 'unknown';
export type WindCategory = 'calm' | 'light' | 'moderate' | 'strong' | 'unknown';
export type PrecipitationType = 'none' | 'rain' | 'snow' | 'fog' | 'mist' | 'thunderstorm' | 'freezing';
export type WeatherTrend = 'improving' | 'steady' | 'deteriorating';
export type TimeOfDay = 'earlyMorning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
export type DayType = 'weekday' | 'weekend' | 'holiday';
export type Season = 'summer' | 'winter';

export interface ArrivalConditions {
  visibility: FlightCategory;
  ceiling: FlightCategory;
  wind: WindCategory;
  flightCategory: FlightCategory;
  precipitation: PrecipitationType;
  hadIFR: boolean;
  trend: WeatherTrend;
  timeOfDay: TimeOfDay;
  season: Season;
  dayType: DayType;
}

export interface ArrivalDurationDistribution {
  baseline: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export interface ExtendedApproachProbability {
  over5min: number;
  over10min: number;
  over15min: number;
  over20min: number;
}

export interface ReferenceDay {
  date: string;
  timeSlot: string;
  matchScore: number;
  p50?: number;
  p90?: number;
  max?: number;
  arrivals: number;
  goArounds?: number;
  conditions: {
    visibility: FlightCategory;
    ceiling: FlightCategory;
    flightCategory: FlightCategory;
  };
}

export interface ArrivalSituation {
  airport: string;
  eta: string;
  timeSlot: string;
  conditions: ArrivalConditions;
  matchCount: number;
  totalHistoricalArrivals: number;
  distribution: ArrivalDurationDistribution;
  goAroundRate: number;
  extendedApproachProbability: ExtendedApproachProbability;
  referenceDays: {
    typical: ReferenceDay | null;
    worstCase: ReferenceDay | null;
  };
  explanation: string;
  timestamp: string;
  insufficientData?: boolean;
  message?: string;
  error?: string;
}

export interface ArrivalSituationResponse {
  airportId: string;
  airport: string;
  eta: string;
  timeSlot: string;
  conditions: ArrivalConditions;
  matchCount: number;
  totalHistoricalArrivals: number;
  distribution: ArrivalDurationDistribution;
  goAroundRate: number;
  extendedApproachProbability: ExtendedApproachProbability;
  referenceDays: {
    typical: ReferenceDay | null;
    worstCase: ReferenceDay | null;
  };
  explanation: string;
  timestamp: string;
  insufficientData?: boolean;
  message?: string;
  error?: string;
  source: string;
}

export interface HistoricalArrival {
  time: string;
  duration: number;
  callsign: string;
  category: string;
  goAround: boolean;
  sourceDate: string;
}

export interface MatchedDayStats {
  count: number;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  goArounds: number;
}

export interface MatchedDay {
  date: string;
  arrivalCount: number;
  stats: MatchedDayStats;
  conditions: Record<string, FlightCategory>;
  season: Season;
  dayOfWeek: number;
}

export interface MatchedDaysResponse {
  airportId: string;
  airport: string;
  eta: string;
  timeSlot: string;
  category: FlightCategory;
  matchCount: number;
  totalArrivals: number;
  baselineMinutes: number;
  aggregatedStats: {
    count: number;
    p10: number | null;
    p25: number | null;
    p50: number | null;
    p75: number | null;
    p90: number | null;
    min: number | null;
    max: number | null;
  } | null;
  matchedDays: MatchedDay[];
  arrivals: HistoricalArrival[];
  timestamp: string;
  insufficientData?: boolean;
  message?: string;
  error?: string;
  source: string;
}
