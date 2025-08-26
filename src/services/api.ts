// Pilot App API Service
// ====================
// Handles communication with the ATC backend pilot APIs

import { 
  AirportsResponse, 
  AirportOverview, 
  PirepsResponse, 
  TracksResponse, 
  SummaryResponse,
  CachedData
} from '@/types';
import { cacheService, CACHE_CONFIGS } from './cache';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

class ApiError extends Error {
  constructor(message: string, public status?: number, public response?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

class PilotApiService {
  private async fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408);
      }
      throw error;
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    return response.json();
  }

  /**
   * Get cached data or return null if expired/unavailable
   */
  private getCachedData<T>(config: typeof CACHE_CONFIGS[keyof typeof CACHE_CONFIGS], id?: string): CachedData<T> | null {
    return cacheService.get<T>(config, id);
  }

  /**
   * Cache data with appropriate config
   */
  private setCachedData<T>(config: typeof CACHE_CONFIGS[keyof typeof CACHE_CONFIGS], data: T, id?: string): void {
    cacheService.set(config, data, id);
  }

  /**
   * Get list of available airports (with caching)
   */
  async getAirports(useCache: boolean = true): Promise<AirportsResponse> {
    // Try cache first if requested
    if (useCache) {
      const cached = this.getCachedData<AirportsResponse>(CACHE_CONFIGS.airports);
      if (cached) {
        console.log('Using cached airports data');
        return { ...cached.data, source: 'cache' };
      }
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/airports`);
      const data = await this.handleResponse<AirportsResponse>(response);
      
      // Cache the response
      this.setCachedData(CACHE_CONFIGS.airports, data);
      console.log('Cached fresh airports data');
      
      return data;
    } catch (error) {
      // If network fails, try to return stale cache
      const staleCache = this.getCachedData<AirportsResponse>(CACHE_CONFIGS.airports);
      if (staleCache) {
        console.log('Using stale cached airports data due to network error');
        return { ...staleCache.data, source: 'stale-cache' };
      }
      throw error;
    }
  }

  /**
   * Get airport overview (weather, runways, operational data) with caching
   */
  async getAirportOverview(airportId: string, useCache: boolean = true): Promise<AirportOverview> {
    if (useCache) {
      const cached = this.getCachedData<AirportOverview>(CACHE_CONFIGS.airportOverview, airportId);
      if (cached) {
        console.log(`Using cached airport overview for ${airportId}`);
        return { ...cached.data, source: 'cache' };
      }
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/overview`);
      const data = await this.handleResponse<AirportOverview>(response);
      
      this.setCachedData(CACHE_CONFIGS.airportOverview, data, airportId);
      console.log(`Cached airport overview for ${airportId}`);
      
      return data;
    } catch (error) {
      const staleCache = this.getCachedData<AirportOverview>(CACHE_CONFIGS.airportOverview, airportId);
      if (staleCache) {
        console.log(`Using stale cached airport overview for ${airportId}`);
        return { ...staleCache.data, source: 'stale-cache' };
      }
      throw error;
    }
  }

  /**
   * Get PIREPs for an airport with caching
   */
  async getPireps(airportId: string, useCache: boolean = true): Promise<PirepsResponse> {
    if (useCache) {
      const cached = this.getCachedData<PirepsResponse>(CACHE_CONFIGS.pireps, airportId);
      if (cached) {
        console.log(`Using cached PIREPs for ${airportId}`);
        return { ...cached.data, source: 'cache' };
      }
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/pireps`);
      const data = await this.handleResponse<PirepsResponse>(response);
      
      this.setCachedData(CACHE_CONFIGS.pireps, data, airportId);
      console.log(`Cached PIREPs for ${airportId}`);
      
      return data;
    } catch (error) {
      const staleCache = this.getCachedData<PirepsResponse>(CACHE_CONFIGS.pireps, airportId);
      if (staleCache) {
        console.log(`Using stale cached PIREPs for ${airportId}`);
        return { ...staleCache.data, source: 'stale-cache' };
      }
      throw error;
    }
  }

  /**
   * Get ground tracks for an airport with caching
   */
  async getGroundTracks(airportId: string, useCache: boolean = true): Promise<TracksResponse> {
    if (useCache) {
      const cached = this.getCachedData<TracksResponse>(CACHE_CONFIGS.tracks, airportId);
      if (cached) {
        console.log(`Using cached ground tracks for ${airportId}`);
        return { ...cached.data, source: 'cache' };
      }
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/tracks`);
      const data = await this.handleResponse<TracksResponse>(response);
      
      this.setCachedData(CACHE_CONFIGS.tracks, data, airportId);
      console.log(`Cached ground tracks for ${airportId}`);
      
      return data;
    } catch (error) {
      const staleCache = this.getCachedData<TracksResponse>(CACHE_CONFIGS.tracks, airportId);
      if (staleCache) {
        console.log(`Using stale cached ground tracks for ${airportId}`);
        return { ...staleCache.data, source: 'stale-cache' };
      }
      throw error;
    }
  }

  /**
   * Get situation summary for an airport with caching
   */
  async getSituationSummary(airportId: string, useCache: boolean = true): Promise<SummaryResponse> {
    if (useCache) {
      const cached = this.getCachedData<SummaryResponse>(CACHE_CONFIGS.summary, airportId);
      if (cached) {
        console.log(`Using cached situation summary for ${airportId}`);
        return { ...cached.data, source: 'cache' };
      }
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/summary`);
      const data = await this.handleResponse<SummaryResponse>(response);
      
      this.setCachedData(CACHE_CONFIGS.summary, data, airportId);
      console.log(`Cached situation summary for ${airportId}`);
      
      return data;
    } catch (error) {
      const staleCache = this.getCachedData<SummaryResponse>(CACHE_CONFIGS.summary, airportId);
      if (staleCache) {
        console.log(`Using stale cached situation summary for ${airportId}`);
        return { ...staleCache.data, source: 'stale-cache' };
      }
      throw error;
    }
  }

  /**
   * Clear cache for specific airport
   */
  clearAirportCache(airportId: string): void {
    cacheService.clear(CACHE_CONFIGS.airportOverview, airportId);
    cacheService.clear(CACHE_CONFIGS.pireps, airportId);
    cacheService.clear(CACHE_CONFIGS.tracks, airportId);
    cacheService.clear(CACHE_CONFIGS.summary, airportId);
    console.log(`Cleared cache for ${airportId}`);
  }

  /**
   * Clear all cached data
   */
  clearAllCache(): void {
    cacheService.clearAll();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheService.getStats();
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/health`);
    return this.handleResponse<{ status: string; timestamp: string }>(response);
  }

  /**
   * Test connection and measure latency
   */
  async testConnection(): Promise<{ connected: boolean; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.checkHealth();
      const latency = Date.now() - startTime;
      return { connected: true, latency };
    } catch (error) {
      const latency = Date.now() - startTime;
      return { 
        connected: false, 
        latency,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }
}

export const pilotApi = new PilotApiService();
export { ApiError };
