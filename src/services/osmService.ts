/**
 * Unified OSM Service for Pilot App
 * ==================================
 * 
 * Simplified OSM service that fetches data from the backend API.
 * Uses the same unified API endpoint as the dashboard.
 */

import { AirportOSMFeatures } from '@/types';

interface OSMFeature {
  type: string;
  coordinates: unknown;
  properties?: Record<string, unknown>;
}

interface OSMResponse {
  airportId: string;
  osm: {
    taxiways: OSMFeature[];
    terminals: OSMFeature[];
    gates: OSMFeature[];
    aprons: OSMFeature[];
    hangars: OSMFeature[];
    controlTowers: OSMFeature[];
    parkingPositions: OSMFeature[];
    runways: OSMFeature[];
    other: OSMFeature[];
    featureCount: number;
  };
  timestamp: string;
  cacheMaxAge: number;
  source: string;
}

import { getApiBaseUrl } from '@/lib/apiConfig';

class PilotOSMService {
  private readonly BACKEND_API_URL = getApiBaseUrl();

  /**
   * Get OSM data for an airport from backend API
   * Relies on browser caching (backend sets 1-hour cache)
   */
  async getAirportOSMData(airportId: string, forceRefresh = false): Promise<AirportOSMFeatures | null> {
    try {
      const cacheBuster = forceRefresh ? `?t=${Date.now()}` : '';
      
      const response = await fetch(
        `${this.BACKEND_API_URL}/api/airports/${airportId}/osm${cacheBuster}`,
        {
          method: 'GET',
          cache: forceRefresh ? 'reload' : 'default',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[PilotOSMService] Airport ${airportId} not found`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OSMResponse = await response.json();
      
      // Convert response to AirportOSMFeatures format
      const features: AirportOSMFeatures = {
        taxiways: data.osm.taxiways || [],
        terminals: data.osm.terminals || [],
        gates: data.osm.gates || [],
        aprons: data.osm.aprons || [],
        hangars: data.osm.hangars || [],
        controlTowers: data.osm.controlTowers || [],
        parkingPositions: data.osm.parkingPositions || [],
        runways: data.osm.runways || [],
        other: data.osm.other || [],
      };

      return features;

    } catch (error) {
      console.error(`[PilotOSMService] Error fetching OSM data for ${airportId}:`, error);
      return null;
    }
  }

  /**
   * Check if backend is available
   */
  async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.BACKEND_API_URL}/api/pilot/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const health = await response.json();
        return health.services?.osmService === true;
      }
      
      return false;
    } catch (error) {
      console.error(`[PilotOSMService] Backend health check failed:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const pilotOSMService = new PilotOSMService();
