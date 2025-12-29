// Weather Service
// ===============
// Handles weather data from NOAA and NWS APIs

import { WeatherLayer, WeatherAlert } from '@/types';

export interface SigmetAirmet {
  id: string;
  type: 'SIGMET' | 'AIRMET';
  event: string;
  severity: 'LIGHT' | 'MODERATE' | 'SEVERE' | 'EXTREME';
  validTimeFrom: string;
  validTimeTo: string;
  geometry: Array<{ lat: number; lon: number }>; // Polygon coordinates
  description: string;
}

export interface WeatherForecast {
  id: string;
  type: string;
  hazard: string;
  severity: 'LIGHT' | 'MODERATE' | 'SEVERE' | 'EXTREME';
  validTimeFrom: string;
  validTimeTo: string;
  geometry: Array<{ lat: number; lon: number }>;
  description: string;
  altitudeLow1?: number;
  altitudeHi1?: number;
  altitudeLow2?: number;
  altitudeHi2?: number;
}

class WeatherApiError extends Error {
  constructor(message: string, public status?: number, public response?: unknown) {
    super(message);
    this.name = 'WeatherApiError';
  }
}

class WeatherService {
  private cache = new Map<string, { data: any; timestamp: number; expiry: number }>();

  // NOTE: Weather data services are now proxied through the backend API
  // The following object documents the original external services for reference:
  // - NOWCOAST_RADAR: NOAA NowCoast WMS (not currently used)
  // - NDFD_FORECAST: NOAA Digital Forecast WMS (not currently used)
  // - RIDGE_RADAR: NOAA RIDGE Radar WMS (not currently used)
  // - NWS_ALERTS: NWS REST API (proxied through /api/pilot/weather-alerts)
  // All weather data requests should go through backend endpoints in /api/pilot/*

  /**
   * Get available weather layers for aviation use
   * All weather data now goes through the backend API
   */
  getWeatherLayers(): WeatherLayer[] {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    
    return [
      {
        id: 'radar',
        name: 'Weather Radar (Real-time)',
        url: `${apiBaseUrl}/api/pilot/weather-radar`, // Backend proxy endpoint
        layers: 'nexrad-n0r', // NEXRAD Base Reflectivity
        format: 'image/png',
        transparent: true,
        opacity: 0.15,
        crs: 'EPSG:4326'
      },
      {
        id: 'radar_composite',
        name: 'Weather Radar (Composite)',
        url: `${apiBaseUrl}/api/pilot/weather-radar`, // Backend proxy endpoint
        layers: 'nexrad-n0r', // Same layer for now
        format: 'image/png',
        transparent: true,
        opacity: 0.15,
        crs: 'EPSG:4326'
      }
    ];
  }

  /**
   * Get weather alerts for a specific area
   * Now uses backend API proxy instead of direct NWS calls
   */
  async getWeatherAlerts(bounds: { north: number; south: number; east: number; west: number }): Promise<WeatherAlert[]> {
    const cacheKey = `alerts_${bounds.north}_${bounds.south}_${bounds.east}_${bounds.west}`;
    const cached = this.getCachedData(cacheKey, 5); // Cache for 5 minutes

    if (cached) {
      return cached;
    }

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const url = `${apiBaseUrl}/api/pilot/weather-alerts?area=us&status=actual`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new WeatherApiError(`Weather alerts API error: ${response.status} ${response.statusText}`, response.status);
      }

      const data = await response.json();

      // Filter alerts by bounding box and relevance to aviation
      const relevantAlerts = (data.alerts || [])
        .filter((alert: any) => {
          const geometry = alert.geometry;
          if (!geometry || !geometry.coordinates) return false;

          // Simple bounding box check (could be improved with proper geo intersection)
          const coords = geometry.coordinates[0]?.[0];
          if (!coords || !Array.isArray(coords)) return false;

          return coords.some((coord: [number, number]) => {
            const [lon, lat] = coord;
            return lat >= bounds.south && lat <= bounds.north &&
              lon >= bounds.west && lon <= bounds.east;
          });
        })
        .map((alert: any) => ({
          id: alert.id,
          title: alert.title,
          description: alert.description,
          severity: alert.severity,
          urgency: alert.urgency,
          certainty: alert.certainty,
          areas: alert.areas,
          effective: alert.effective,
          expires: alert.expires,
          status: alert.status
        } as WeatherAlert));

      this.setCachedData(cacheKey, relevantAlerts, 5);
      return relevantAlerts;

    } catch (error) {
      console.error('Failed to fetch weather alerts:', error);

      if (error instanceof WeatherApiError) {
        throw error;
      }

      throw new WeatherApiError(
        `Failed to fetch weather alerts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0
      );
    }
  }

  /**
   * Validate WMS layer availability
   */
  async validateWeatherLayer(layer: WeatherLayer): Promise<boolean> {
    const cacheKey = `validate_${layer.id}`;
    const cached = this.getCachedData(cacheKey, 60); // Cache validation for 1 hour

    if (cached !== undefined) {
      return cached;
    }

    try {
      // Test GetCapabilities request
      const capabilitiesUrl = `${layer.url}?REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.3.0`;

      const response = await fetch(capabilitiesUrl, {
        headers: {
          'User-Agent': 'AYRYX-PilotApp/1.0 (https://github.com/ayryx/pilot-app)'
        }
      });

      const isValid = response.ok && (response.headers.get('content-type')?.includes('xml') ?? false);

      this.setCachedData(cacheKey, isValid, 60);
      return isValid;

    } catch (error) {
      console.warn(`Failed to validate weather layer ${layer.id}:`, error);
      this.setCachedData(cacheKey, false, 60);
      return false;
    }
  }

  /**
   * Get weather layer WMS URL for Leaflet
   */
  getWMSUrl(layer: WeatherLayer, bbox: string, width: number, height: number): string {
    const params = new URLSearchParams({
      REQUEST: 'GetMap',
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      LAYERS: layer.layers,
      STYLES: '',
      FORMAT: layer.format,
      TRANSPARENT: layer.transparent.toString(),
      CRS: layer.crs || 'EPSG:3857',
      BBOX: bbox,
      WIDTH: width.toString(),
      HEIGHT: height.toString()
    });

    return `${layer.url}?${params.toString()}`;
  }

  /**
   * Get all SIGMETs and AIRMETs from the backend API (no bounds - shows all active advisories)
   */
  async getSigmetAirmet(): Promise<SigmetAirmet[]> {
    const cacheKey = 'sigmet_airmet_all';
    const cached = this.getCachedData(cacheKey, 2); // Cache for 2 minutes (matches backend refresh)

    if (cached) {
      return cached;
    }

    try {
      // Call backend API which returns ALL active SIGMETs/AIRMETs (no bounds)
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const url = `${apiBaseUrl}/api/pilot/sigmet-airmet`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new WeatherApiError(`SIGMET/AIRMET API error: ${response.status} ${response.statusText}`, response.status);
      }

      const data = await response.json();

      // Backend returns all active SIGMETs/AIRMETs
      const sigmetAirmets: SigmetAirmet[] = data.sigmetAirmets || [];

      this.setCachedData(cacheKey, sigmetAirmets, 2);
      return sigmetAirmets;

    } catch (error) {
      console.error('[WeatherService] Failed to fetch SIGMETs/AIRMETs:', error);
      return [];
    }
  }

  /**
   * Get Winds Aloft data from backend
   */
  async getWindsAloft(airportCode?: string) {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    const url = airportCode 
      ? `${apiBaseUrl}/api/pilot/winds-aloft?airport=${airportCode}`
      : `${apiBaseUrl}/api/pilot/winds-aloft`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('[WeatherService] Failed to fetch winds aloft:', error);
      return [];
    }
  }

  /**
   * Get Icing Forecast data from backend
   */
  async getIcing(): Promise<WeatherForecast[]> {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    const url = `${apiBaseUrl}/api/pilot/icing`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('[WeatherService] Failed to fetch icing:', error);
      return [];
    }
  }

  /**
   * Get Turbulence Forecast data from backend
   */
  async getTurbulence(): Promise<WeatherForecast[]> {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    const url = `${apiBaseUrl}/api/pilot/turbulence`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('[WeatherService] Failed to fetch turbulence:', error);
      return [];
    }
  }

  /**
   * Get PIREPs (Pilot Reports) from Aviation Weather API via backend
   */
  async getWeatherPireps() {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    const url = `${apiBaseUrl}/api/pilot/pireps-weather`;
    
    const cacheKey = 'weather_pireps';
    const cached = this.getCachedData(cacheKey, 5); // Cache for 5 minutes (matches backend refresh)
    
    if (cached) {
      return cached;
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new WeatherApiError(`PIREP API error: ${response.status} ${response.statusText}`, response.status);
      }
      
      const data = await response.json();
      const pireps = data.data || [];
      
      this.setCachedData(cacheKey, pireps, 5);
      return pireps;
    } catch (error) {
      console.error('[WeatherService] Failed to fetch weather PIREPs:', error);
      return [];
    }
  }

  /**
   * Get METAR stations (weather observations) from backend
   */
  async getMetars() {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    const url = `${apiBaseUrl}/api/pilot/metars`;
    
    const cacheKey = 'metars';
    const cached = this.getCachedData(cacheKey, 15); // Cache for 15 minutes (matches backend refresh)
    
    if (cached) {
      return cached;
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new WeatherApiError(`METAR API error: ${response.status} ${response.statusText}`, response.status);
      }
      
      const data = await response.json();
      const metars = data.data || [];
      
      this.setCachedData(cacheKey, metars, 15);
      return metars;
    } catch (error) {
      console.error('[WeatherService] Failed to fetch METARs:', error);
      return [];
    }
  }

  /**
   * Clear weather data cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cached weather data
   */
  private getCachedData(key: string, maxAgeMinutes: number): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now > cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached weather data
   */
  private setCachedData(key: string, data: any, maxAgeMinutes: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + (maxAgeMinutes * 60 * 1000)
    });
  }

  /**
   * Map NWS severity to our severity levels
   */
  private mapSeverity(severity?: string): 'minor' | 'moderate' | 'severe' | 'extreme' {
    if (!severity) return 'minor';

    const sev = severity.toLowerCase();
    if (sev.includes('extreme')) return 'extreme';
    if (sev.includes('severe')) return 'severe';
    if (sev.includes('moderate')) return 'moderate';
    return 'minor';
  }

  /**
   * Get cached weather radar animation frames
   * Returns cached frames from backend
   */
  async getWeatherRadarAnimation(): Promise<Array<{ timestamp: number; timestampISO: string; imageData: string }>> {
    const cacheKey = 'radar_animation';
    const cached = this.getCachedData(cacheKey, 1); // Cache for 1 minute

    if (cached) {
      return cached;
    }

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const url = `${apiBaseUrl}/api/pilot/weather-radar/animation`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new WeatherApiError(`Weather radar animation API error: ${response.status} ${response.statusText}`, response.status);
      }

      const frames = await response.json();

      this.setCachedData(cacheKey, frames, 1);
      return frames;

    } catch (error) {
      console.error('[WeatherService] Failed to fetch weather radar animation:', error);

      if (error instanceof WeatherApiError) {
        throw error;
      }

      throw new WeatherApiError(
        `Failed to fetch weather radar animation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0
      );
    }
  }
}

export const weatherService = new WeatherService();
export { WeatherApiError };