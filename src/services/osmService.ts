/**
 * OSM Service for Pilot App
 * =========================
 * 
 * This service fetches OSM data from the backend API for display on the pilot map.
 * It provides the same airport infrastructure data that the dashboard uses.
 */

import { OSMResponse, AirportOSMFeatures } from '@/types';

class PilotOSMService {
  private cache = new Map<string, { data: AirportOSMFeatures; timestamp: number }>();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  /**
   * Get OSM data for an airport from backend API
   */
  async getAirportOSMData(airportId: string): Promise<AirportOSMFeatures | null> {
    const cacheKey = airportId;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log(`[PilotOSMService] Using cached OSM data for ${airportId}`);
        return cached.data;
      }
    }

    try {
      console.log(`[PilotOSMService] Fetching OSM data for ${airportId} from backend API`);
      
      const response = await fetch(`${this.BACKEND_API_URL}/api/pilot/${airportId}/osm`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

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

      // Cache the data
      this.cache.set(cacheKey, {
        data: features,
        timestamp: Date.now()
      });

      console.log(`[PilotOSMService] Retrieved OSM data for ${airportId}:`, {
        taxiways: features.taxiways.length,
        terminals: features.terminals.length,
        gates: features.gates.length,
        aprons: features.aprons.length,
        hangars: features.hangars.length,
        controlTowers: features.controlTowers.length,
        parkingPositions: features.parkingPositions.length,
        runways: features.runways.length,
        other: features.other.length,
        total: data.osm.featureCount
      });

      return features;

    } catch (error) {
      console.error(`[PilotOSMService] Error fetching OSM data for ${airportId}:`, error);
      return null;
    }
  }

  /**
   * Clear cache for a specific airport or all airports
   */
  clearCache(airportId?: string): void {
    if (airportId) {
      this.cache.delete(airportId);
      console.log(`[PilotOSMService] Cleared cache for ${airportId}`);
    } else {
      this.cache.clear();
      console.log(`[PilotOSMService] Cleared all cache`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
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
