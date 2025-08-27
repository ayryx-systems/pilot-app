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
  constructor(message: string, public status?: number, public response?: unknown) {
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

      // Enhanced error classification
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Request timeout - server took too long to respond', 408);
        }

        // Network connection errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new ApiError('Network connection failed - check your internet connection', 0);
        }

        // DNS resolution errors
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new ApiError('Connection failed - server may be unreachable', 0);
        }

        // Rethrow with better context
        throw new ApiError(`Network error: ${error.message}`, 0, { originalError: error.name });
      }

      throw new ApiError('Unknown network error occurred', 0);
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorData: any = {};
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const text = await response.text();
        if (text) {
          try {
            errorData = JSON.parse(text);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // If JSON parsing fails, use the text as error message
            errorMessage = text.length > 200 ? `${text.substring(0, 200)}...` : text;
          }
        }
      } catch {
        // If reading response fails, use default message
        errorMessage = `Network error: Failed to read response (${response.status})`;
      }

      throw new ApiError(errorMessage, response.status, errorData);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ApiError(
        'Invalid response format: Expected JSON',
        response.status,
        { originalError: error instanceof Error ? error.message : 'Unknown parsing error' }
      );
    }
  }

  /**
   * Get cached data or return null if expired/unavailable
   */
  private getCachedData<T>(config: typeof CACHE_CONFIGS[keyof typeof CACHE_CONFIGS], id?: string): CachedData<T> | null {
    return cacheService.get<T>(config, id);
  }

  /**
   * Get stale cached data (even if expired)
   */
  private getStaleCachedData<T>(config: typeof CACHE_CONFIGS[keyof typeof CACHE_CONFIGS], id?: string): CachedData<T> | null {
    return cacheService.getStale<T>(config, id);
  }

  /**
   * Cache data with appropriate config
   */
  private setCachedData<T>(config: typeof CACHE_CONFIGS[keyof typeof CACHE_CONFIGS], data: T, id?: string): void {
    cacheService.set(config, data, id);
  }

  /**
   * Get list of available airports (with smart caching)
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
      console.warn('Failed to fetch airports:', error instanceof Error ? error.message : 'Unknown error');

      // If network fails, try to return stale cache
      const staleCache = this.getStaleCachedData<AirportsResponse>(CACHE_CONFIGS.airports);
      if (staleCache) {
        console.log(`Using stale cached airports data (${Math.floor((Date.now() - staleCache.timestamp.getTime()) / 1000)}s old)`);
        return { ...staleCache.data, source: 'stale-cache' };
      }

      // If no cache available, provide meaningful error
      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError(`Airports list unavailable: ${error.message}`, 0);
      }

      throw error;
    }
  }

  /**
   * Get airport overview (weather, runways, operational data) with smart caching
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
      console.warn(`Failed to fetch airport overview for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      // Try to use stale cache first
      const staleCache = this.getStaleCachedData<AirportOverview>(CACHE_CONFIGS.airportOverview, airportId);
      if (staleCache) {
        console.log(`Using stale cached airport overview for ${airportId} (${Math.floor((Date.now() - staleCache.timestamp.getTime()) / 1000)}s old)`);
        return { ...staleCache.data, source: 'stale-cache' };
      }

      // If no cache available, provide meaningful error
      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError(`Airport overview unavailable: ${error.message}`, 0);
      }

      throw error;
    }
  }

  /**
   * Get PIREPs for an airport with smart caching
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
      console.warn(`Failed to fetch PIREPs for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      const staleCache = this.getStaleCachedData<PirepsResponse>(CACHE_CONFIGS.pireps, airportId);
      if (staleCache) {
        console.log(`Using stale cached PIREPs for ${airportId} (${Math.floor((Date.now() - staleCache.timestamp.getTime()) / 1000)}s old)`);
        return { ...staleCache.data, source: 'stale-cache' };
      }

      // If no cache available, provide meaningful error
      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError(`PIREPs unavailable: ${error.message}`, 0);
      }

      throw error;
    }
  }

  /**
   * Get ground tracks for an airport with smart caching
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
      console.warn(`Failed to fetch ground tracks for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      const staleCache = this.getStaleCachedData<TracksResponse>(CACHE_CONFIGS.tracks, airportId);
      if (staleCache) {
        console.log(`Using stale cached ground tracks for ${airportId} (${Math.floor((Date.now() - staleCache.timestamp.getTime()) / 1000)}s old)`);
        return { ...staleCache.data, source: 'stale-cache' };
      }

      // If no cache available, provide meaningful error
      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError(`Ground tracks unavailable: ${error.message}`, 0);
      }

      throw error;
    }
  }

  /**
   * Get situation summary for an airport with smart caching
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
      console.warn(`Failed to fetch situation summary for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      const staleCache = this.getStaleCachedData<SummaryResponse>(CACHE_CONFIGS.summary, airportId);
      if (staleCache) {
        console.log(`Using stale cached situation summary for ${airportId} (${Math.floor((Date.now() - staleCache.timestamp.getTime()) / 1000)}s old)`);
        return { ...staleCache.data, source: 'stale-cache' };
      }

      // If no cache available, provide meaningful error
      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError(`Situation summary unavailable: ${error.message}`, 0);
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
      let errorMessage = 'Connection failed';

      if (error instanceof ApiError) {
        errorMessage = error.status === 0 ? 'Network unreachable' : error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        connected: false,
        latency,
        error: errorMessage
      };
    }
  }

  /**
   * Test connection with automatic retry
   */
  async testConnectionWithRetry(maxRetries: number = 3, delayMs: number = 1000): Promise<{ connected: boolean; latency: number; error?: string; retries: number }> {
    let lastError: string = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.testConnection();
        return { ...result, retries: attempt - 1 };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Connection failed';

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
      }
    }

    return {
      connected: false,
      latency: 0,
      error: `Failed after ${maxRetries} attempts: ${lastError}`,
      retries: maxRetries
    };
  }
}

export const pilotApi = new PilotApiService();
export { ApiError };
