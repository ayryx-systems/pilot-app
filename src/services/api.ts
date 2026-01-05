// Pilot App API Service
// ====================
// Handles communication with the ATC backend pilot APIs

import {
  AirportsResponse,
  AirportOverview,
  PirepsResponse,
  TracksResponse,
  ArrivalsResponse,
  SummaryResponse,
  BaselineResponse,
  ArrivalForecastResponse,
  ArrivalSituationResponse,
} from '@/types';
import { demoService } from './demoService';
import { getApiBaseUrl } from '@/lib/apiConfig';

const API_BASE_URL = getApiBaseUrl();

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

    const externalSignal = options.signal;
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort());
    }

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

      if (externalSignal?.aborted) {
        throw new ApiError('Request cancelled', 0);
      }

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
      let errorData: Record<string, unknown> = {};
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
   * Get list of available airports
   */
  async getAirports(): Promise<AirportsResponse> {
    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/airports?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      return await this.handleResponse<AirportsResponse>(response);
    } catch (error) {
      console.error('Failed to fetch airports:', error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError('Cannot connect to server - check your internet connection and try again', 0);
      }

      throw error;
    }
  }

  /**
   * Get FAA NAS status for an airport
   */
  async getFAAStatus(airportId: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/faa-status/${airportId}?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }, 8000);
      return await this.handleResponse<Record<string, unknown>>(response);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return { status: null };
      }
      console.error(`Failed to fetch FAA status for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Get airport overview (weather, runways, operational data)
   */
  async getAirportOverview(airportId: string): Promise<AirportOverview> {
    // Check if demo mode should be used for this airport
    if (demoService.shouldUseDemo(airportId)) {
      demoService.enableDemo();
      return demoService.getDemoAirportOverviewResponse();
    }

    try {
      // Backend now responds within 2-3 seconds max, but use 8 seconds timeout for safety
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/overview?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }, 8000); // 8 second timeout (backend responds within 2-3 seconds)
      return await this.handleResponse<AirportOverview>(response);
    } catch (error) {
      console.error(`Failed to fetch airport overview for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError('Cannot connect to server - airport overview unavailable while offline', 0);
      }

      throw error;
    }
  }

  /**
   * Get PIREPs for an airport
   */
  async getPireps(airportId: string): Promise<PirepsResponse> {
    // Check if demo mode should be used for this airport
    if (demoService.shouldUseDemo(airportId)) {
      demoService.enableDemo();
      return demoService.getDemoPirepsResponse();
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/pireps?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      return await this.handleResponse<PirepsResponse>(response);
    } catch (error) {
      console.error(`Failed to fetch PIREPs for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError('Cannot connect to server - PIREPs unavailable while offline', 0);
      }

      throw error;
    }
  }

  /**
   * Get ground tracks for an airport
   */
  async getGroundTracks(airportId: string): Promise<TracksResponse> {
    // Check if demo mode should be used for this airport
    if (demoService.shouldUseDemo(airportId)) {
      demoService.enableDemo();
      return demoService.getDemoTracksResponse();
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/tracks?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      return await this.handleResponse<TracksResponse>(response);
    } catch (error) {
      console.error(`Failed to fetch ground tracks for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError('Cannot connect to server - ground tracks unavailable while offline', 0);
      }

      throw error;
    }
  }

  /**
   * Get arrivals for an airport (last hour)
   */
  async getArrivals(airportId: string): Promise<ArrivalsResponse> {
    // Check if demo mode should be used for this airport
    if (demoService.shouldUseDemo(airportId)) {
      demoService.enableDemo();
      return {
        airportId,
        arrivals: [],
        count: 0,
        timestamp: new Date().toISOString(),
        cacheMaxAge: 30,
        source: 'demo',
        active: false,
        message: 'Demo mode - no arrival data available'
      };
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/arrivals?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      return await this.handleResponse<ArrivalsResponse>(response);
    } catch (error) {
      console.error(`Failed to fetch arrivals for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError('Cannot connect to server - arrivals unavailable while offline', 0);
      }

      throw error;
    }
  }

  /**
   * Get situation summary for an airport
   */
  async getSituationSummary(airportId: string): Promise<SummaryResponse> {
    // Check if demo mode should be used for this airport
    if (demoService.shouldUseDemo(airportId)) {
      demoService.enableDemo();
      return demoService.getDemoSummaryResponse();
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/summary?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      return await this.handleResponse<SummaryResponse>(response);
    } catch (error) {
      console.error(`Failed to fetch situation summary for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError('Cannot connect to server - situation summary unavailable while offline', 0);
      }

      throw error;
    }
  }



  /**
   * Get baseline traffic data for an airport
   */
  async getBaseline(airportId: string): Promise<BaselineResponse> {
    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/baseline?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      return await this.handleResponse<BaselineResponse>(response);
    } catch (error) {
      console.error(`Failed to fetch baseline for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError('Cannot connect to server - baseline data unavailable while offline', 0);
      }

      throw error;
    }
  }

  /**
   * Get FAA arrival forecast for an airport
   */
  async getArrivalForecast(airportId: string): Promise<ArrivalForecastResponse> {
    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/arrival-forecast?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      return await this.handleResponse<ArrivalForecastResponse>(response);
    } catch (error) {
      console.error(`Failed to fetch arrival forecast for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError('Cannot connect to server - arrival forecast unavailable while offline', 0);
      }

      throw error;
    }
  }

  /**
   * Get arrival situation forecast based on historical pattern matching
   * 
   * @param airportId - Airport ICAO code
   * @param eta - Expected arrival time (ISO timestamp)
   * @param weatherData - Optional weather conditions for matching
   * @param signal - Optional AbortSignal to cancel the request
   */
  async getArrivalSituation(
    airportId: string,
    eta: Date,
    weatherData?: {
      visibilitySM?: number;
      ceilingFt?: number;
      windKt?: number;
      precipitation?: string;
      hadIFR?: boolean;
      trend?: string;
    },
    signal?: AbortSignal
  ): Promise<ArrivalSituationResponse> {
    try {
      const params = new URLSearchParams({
        eta: eta.toISOString(),
        t: Date.now().toString(),
      });

      if (weatherData?.visibilitySM !== undefined) {
        params.append('visibilitySM', weatherData.visibilitySM.toString());
      }
      if (weatherData?.ceilingFt !== undefined) {
        params.append('ceilingFt', weatherData.ceilingFt.toString());
      }
      if (weatherData?.windKt !== undefined) {
        params.append('windKt', weatherData.windKt.toString());
      }
      if (weatherData?.precipitation) {
        params.append('precipitation', weatherData.precipitation);
      }
      if (weatherData?.hadIFR !== undefined) {
        params.append('hadIFR', weatherData.hadIFR.toString());
      }
      if (weatherData?.trend) {
        params.append('trend', weatherData.trend);
      }

      const response = await this.fetchWithTimeout(
        `${API_BASE_URL}/api/pilot/${airportId}/arrival-situation?${params.toString()}`,
        {
          cache: 'no-cache',
          signal,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        }
      );
      return await this.handleResponse<ArrivalSituationResponse>(response);
    } catch (error) {
      if (signal?.aborted || 
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof ApiError && error.message === 'Request cancelled')) {
        throw new ApiError('Request cancelled', 0);
      }

      console.error(`Failed to fetch arrival situation for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError('Cannot connect to server - arrival situation unavailable while offline', 0);
      }

      throw error;
    }
  }

  /**
   * Get matched historical days arrivals for timeline overlay
   * 
   * @param airportId - Airport ICAO code  
   * @param eta - Expected arrival time
   * @param category - Flight category (VFR, MVFR, IFR, LIFR)
   * @param options - Additional options (maxDays, matchSeason)
   * @param signal - Optional AbortSignal to cancel the request
   */
  async getMatchedDaysArrivals(
    airportId: string,
    eta: Date,
    category: FlightCategory = 'VFR',
    options?: {
      maxDays?: number;
      matchSeason?: boolean;
    },
    signal?: AbortSignal
  ): Promise<MatchedDaysResponse> {
    try {
      const params = new URLSearchParams({
        eta: eta.toISOString(),
        category,
        t: Date.now().toString(),
      });

      if (options?.maxDays) {
        params.append('maxDays', options.maxDays.toString());
      }
      if (options?.matchSeason) {
        params.append('matchSeason', 'true');
      }

      const response = await this.fetchWithTimeout(
        `${API_BASE_URL}/api/pilot/${airportId}/matched-days?${params.toString()}`,
        {
          cache: 'no-cache',
          signal,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        }
      );
      return await this.handleResponse<MatchedDaysResponse>(response);
    } catch (error) {
      if (signal?.aborted || 
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof ApiError && error.message === 'Request cancelled')) {
        throw new ApiError('Request cancelled', 0);
      }

      console.error(`Failed to fetch matched days for ${airportId}:`, error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof ApiError && error.status === 0) {
        throw new ApiError('Cannot connect to server - matched days unavailable while offline', 0);
      }

      throw error;
    }
  }

  /**
   * Fetch historical day data for example day drilldown
   * @param airportId - Airport ICAO code
   * @param date - Date in YYYY-MM-DD format
   */
  async getHistoricalDayData(
    airportId: string,
    date: string
  ): Promise<{
    date: string;
    airport: string;
    totalArrivals: number;
    arrivals: Array<{ hour: number; duration: number; type: string | null }>;
    weatherTimeline?: Record<string, string>;
    timestamp: string;
  }> {
    try {
      const response = await this.fetchWithTimeout(
        `${API_BASE_URL}/api/pilot/${airportId}/historical-day/${date}`,
        { cache: 'default' }
      );
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`Failed to fetch historical day data for ${date}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Health check
   */
  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/health`);
    return this.handleResponse<{ status: string; timestamp: string }>(response);
  }

  /**
   * Test connection and measure latency (bypasses service worker cache)
   */
  async testConnection(): Promise<{ connected: boolean; latency: number; error?: string }> {
    const startTime = Date.now();

    try {
      // Use a cache-busting parameter and no-cache headers to ensure real connection test
      const timestamp = Date.now();
      const response = await this.fetchWithTimeout(
        `${API_BASE_URL}/api/pilot/health?t=${timestamp}`,
        {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        },
        5000 // Shorter timeout for connection test
      );

      await this.handleResponse<{ status: string; timestamp: string }>(response);
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

