/**
 * Waypoint Service for Pilot App
 * ===============================
 * 
 * Service to fetch FAA waypoint data from the backend API.
 */

import { WaypointAPIResponse, WaypointAirportsResponse, FormattedWaypoint } from '@/types/waypoints';
import { getApiBaseUrl } from '@/lib/apiConfig';

const API_BASE_URL = getApiBaseUrl();

export class WaypointService {
  private cache = new Map<string, { data: WaypointAPIResponse; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get waypoints for a specific airport
   */
  async getWaypointsForAirport(airportId: string): Promise<WaypointAPIResponse> {
    const cacheKey = airportId.toUpperCase();
    const cached = this.cache.get(cacheKey);
    
    // Check cache first
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/pilot/${airportId}/waypoints`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Waypoint data not found for airport ${airportId}`);
        }
        throw new Error(`Failed to fetch waypoints: ${response.statusText}`);
      }

      const data: WaypointAPIResponse = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      
      return data;
      
    } catch (error) {
      console.error(`[WaypointService] Error loading waypoints for ${airportId}:`, error);
      throw error;
    }
  }

  /**
   * Get list of airports with available waypoint data
   */
  async getAvailableAirports(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/pilot/waypoints/airports`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch airports with waypoints: ${response.statusText}`);
      }

      const data: WaypointAirportsResponse = await response.json();
      return data.airports;
      
    } catch (error) {
      console.error('[WaypointService] Error loading airports with waypoints:', error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific airport or all airports
   */
  clearCache(airportId?: string): void {
    if (airportId) {
      this.cache.delete(airportId.toUpperCase());
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalCached: number; validEntries: number; expiredEntries: number } {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const [, cached] of this.cache.entries()) {
      if (now - cached.timestamp < this.CACHE_DURATION) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }
    
    return {
      totalCached: this.cache.size,
      validEntries,
      expiredEntries
    };
  }

  /**
   * Filter waypoints by type
   */
  filterWaypointsByType(waypoints: FormattedWaypoint[], type: string): FormattedWaypoint[] {
    return waypoints.filter(waypoint => waypoint.type === type);
  }

  /**
   * Filter waypoints by usage
   */
  filterWaypointsByUsage(waypoints: FormattedWaypoint[], usage: string): FormattedWaypoint[] {
    return waypoints.filter(waypoint => waypoint.usage === usage);
  }

  /**
   * Get waypoints within a certain distance of a point
   */
  getWaypointsWithinDistance(
    waypoints: FormattedWaypoint[], 
    centerLat: number, 
    centerLon: number, 
    maxDistanceNM: number
  ): FormattedWaypoint[] {
    return waypoints.filter(waypoint => {
      const distance = this.calculateDistance(
        centerLat, centerLon,
        waypoint.position[0], waypoint.position[1]
      );
      return distance <= maxDistanceNM;
    });
  }

  /**
   * Calculate distance between two points in nautical miles
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3440.065; // Earth's radius in nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

// Create singleton instance
export const waypointService = new WaypointService();
