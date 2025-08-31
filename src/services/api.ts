// Pilot App API Service
// ====================
// Handles communication with the ATC backend pilot APIs

import {
  AirportsResponse,
  AirportOverview,
  PirepsResponse,
  TracksResponse,
  SummaryResponse
} from '@/types';
import { demoService } from './demoService';

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
   * Get list of available airports
   */
  async getAirports(): Promise<AirportsResponse> {
    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/airports`);
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
   * Get airport overview (weather, runways, operational data)
   */
  async getAirportOverview(airportId: string): Promise<AirportOverview> {
    // Check if demo mode should be used for this airport
    if (demoService.shouldUseDemo(airportId)) {
      demoService.enableDemo();
      return demoService.getDemoAirportOverviewResponse();
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/overview`);
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
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/pireps`);
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
    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/tracks`);
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
   * Get situation summary for an airport
   */
  async getSituationSummary(airportId: string): Promise<SummaryResponse> {
    // Check if demo mode should be used for this airport
    if (demoService.shouldUseDemo(airportId)) {
      demoService.enableDemo();
      return demoService.getDemoSummaryResponse();
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/summary`);
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

