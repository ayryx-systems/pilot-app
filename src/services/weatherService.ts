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

  // NOAA Weather Data Services
  private readonly WEATHER_SERVICES = {
    NOWCOAST_RADAR: {
      id: 'nowcoast_radar',
      name: 'NOAA Real-time Radar',
      baseUrl: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WMSServer',
      type: 'WMS' as const,
      updateFrequency: 4 // Updates every 4 minutes
    },
    NDFD_FORECAST: {
      id: 'ndfd_forecast',
      name: 'NOAA Weather Forecast',
      baseUrl: 'https://digital.weather.gov/ndfd.conus/wms',
      type: 'WMS' as const,
      updateFrequency: 60 // Updates every hour
    },
    RIDGE_RADAR: {
      id: 'ridge_radar',
      name: 'NOAA RIDGE Radar',
      baseUrl: 'https://nowcoast.noaa.gov/geoserver/observations/weather_radar/ows',
      type: 'WMS' as const,
      updateFrequency: 5 // Updates every 5 minutes
    },
    NWS_ALERTS: {
      id: 'nws_alerts',
      name: 'NWS Weather Alerts',
      baseUrl: 'https://api.weather.gov/alerts',
      type: 'REST' as const,
      updateFrequency: 5 // Updates every 5 minutes
    }
  };

  /**
   * Get available weather layers for aviation use
   */
  getWeatherLayers(): WeatherLayer[] {
    // Using Iowa Environmental Mesonet - tested and working!
    return [
      {
        id: 'radar',
        name: 'Weather Radar (Real-time)',
        url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi',
        layers: 'nexrad-n0r', // NEXRAD Base Reflectivity (simplified layer name)
        format: 'image/png',
        transparent: true,
        opacity: 0.15,
        crs: 'EPSG:4326'
      },
      {
        id: 'radar_composite',
        name: 'Weather Radar (Composite)',
        url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi',
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
   */
  async getWeatherAlerts(bounds: { north: number; south: number; east: number; west: number }): Promise<WeatherAlert[]> {
    const cacheKey = `alerts_${bounds.north}_${bounds.south}_${bounds.east}_${bounds.west}`;
    const cached = this.getCachedData(cacheKey, 5); // Cache for 5 minutes

    if (cached) {
      return cached;
    }

    try {
      const url = `${this.WEATHER_SERVICES.NWS_ALERTS.baseUrl}/active?area=us&status=actual`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AYRYX-PilotApp/1.0 (https://github.com/ayryx/pilot-app)',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new WeatherApiError(`Weather alerts API error: ${response.status} ${response.statusText}`, response.status);
      }

      const data = await response.json();

      // Filter alerts by bounding box and relevance to aviation
      const relevantAlerts = data.features
        ?.filter((feature: any) => {
          const geometry = feature.geometry;
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
        ?.map((feature: any) => {
          const props = feature.properties;
          return {
            id: props.id || `alert_${Date.now()}_${Math.random()}`,
            title: props.headline || 'Weather Alert',
            description: props.description || props.event || 'No description available',
            severity: this.mapSeverity(props.severity),
            urgency: props.urgency?.toLowerCase() || 'unknown',
            certainty: props.certainty?.toLowerCase() || 'unknown',
            areas: props.areaDesc ? props.areaDesc.split(';').map((area: string) => area.trim()) : [],
            effective: props.effective || new Date().toISOString(),
            expires: props.expires || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            status: props.status?.toLowerCase() || 'actual'
          } as WeatherAlert;
        }) || [];

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

      const isValid = response.ok && response.headers.get('content-type')?.includes('xml');

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
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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
      console.log('[WeatherService] Retrieved', sigmetAirmets.length, 'SIGMETs/AIRMETs from backend (all active)');
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
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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
}

export const weatherService = new WeatherService();
export { WeatherApiError };