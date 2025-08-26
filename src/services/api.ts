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
   * Get list of available airports
   */
  async getAirports(): Promise<AirportsResponse> {
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/airports`);
    return this.handleResponse<AirportsResponse>(response);
  }

  /**
   * Get airport overview (weather, runways, operational data)
   */
  async getAirportOverview(airportId: string): Promise<AirportOverview> {
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/overview`);
    return this.handleResponse<AirportOverview>(response);
  }

  /**
   * Get PIREPs for an airport
   */
  async getPireps(airportId: string): Promise<PirepsResponse> {
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/pireps`);
    return this.handleResponse<PirepsResponse>(response);
  }

  /**
   * Get ground tracks for an airport
   */
  async getGroundTracks(airportId: string): Promise<TracksResponse> {
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/tracks`);
    return this.handleResponse<TracksResponse>(response);
  }

  /**
   * Get situation summary for an airport
   */
  async getSituationSummary(airportId: string): Promise<SummaryResponse> {
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/pilot/${airportId}/summary`);
    return this.handleResponse<SummaryResponse>(response);
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
