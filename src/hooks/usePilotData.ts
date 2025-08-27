'use client';

import { useState, useEffect, useCallback } from 'react';
import { pilotApi, ApiError } from '@/services/api';
import {
  Airport,
  AirportOverview,
  PiRep,
  GroundTrack,
  SituationSummary,
  ConnectionStatus,
  PilotAppState
} from '@/types';

export function usePilotData() {
  const [state, setState] = useState<PilotAppState>({
    selectedAirport: null,
    airports: [],
    airportOverview: null,
    pireps: [],
    tracks: [],
    summary: null,
    connectionStatus: {
      connected: false,
      lastUpdate: new Date(),
    },
    loading: false,
    error: null,
    pirepsMetadata: undefined,
    tracksMetadata: undefined,
    summaryMetadata: undefined,
  });

  // Test connection and update status
  const testConnection = useCallback(async () => {
    try {
      const result = await pilotApi.testConnection();
      setState(prev => ({
        ...prev,
        connectionStatus: {
          connected: result.connected,
          lastUpdate: new Date(),
          latency: result.latency,
        },
        error: result.connected ? null : (result.error || 'Connection failed'),
      }));
      return result.connected;
    } catch (error) {
      setState(prev => ({
        ...prev,
        connectionStatus: {
          connected: false,
          lastUpdate: new Date(),
        },
        error: error instanceof Error ? error.message : 'Connection test failed',
      }));
      return false;
    }
  }, []);

  // Load airports list
  const loadAirports = useCallback(async () => {
    try {
      const response = await pilotApi.getAirports();
      setState(prev => ({
        ...prev,
        airports: response.airports,
        error: null,
      }));

      // Auto-select first active airport if none selected
      if (!state.selectedAirport && response.airports.length > 0) {
        const firstActive = response.airports.find(a => a.active) || response.airports[0];
        setState(prev => ({
          ...prev,
          selectedAirport: firstActive.id,
        }));
        return firstActive.id;
      }
    } catch (error) {
      console.error('Failed to load airports:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof ApiError ? error.message : 'Failed to load airports',
      }));
    }
    return null;
  }, [state.selectedAirport]);

  // Load data for specific airport
  const loadAirportData = useCallback(async (airportId: string) => {
    if (!airportId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Load all data in parallel
      const [overviewResponse, pirepsResponse, tracksResponse, summaryResponse] = await Promise.allSettled([
        pilotApi.getAirportOverview(airportId),
        pilotApi.getPireps(airportId),
        pilotApi.getGroundTracks(airportId),
        pilotApi.getSituationSummary(airportId),
      ]);

      const updates: Partial<PilotAppState> = { loading: false };

      // Process results and handle failures
      if (overviewResponse.status === 'fulfilled') {
        updates.airportOverview = overviewResponse.value;
      } else {
        console.error('Failed to load airport overview:', overviewResponse.reason);
        updates.airportOverview = null;
      }

      if (pirepsResponse.status === 'fulfilled') {
        updates.pireps = pirepsResponse.value.pireps;
        updates.pirepsMetadata = {
          active: pirepsResponse.value.active ?? true,
          message: pirepsResponse.value.message,
          serverTimestamp: pirepsResponse.value.timestamp
        };
      } else {
        console.error('Failed to load PIREPs:', pirepsResponse.reason);
        updates.pireps = [];
        updates.pirepsMetadata = {
          active: false,
          message: pirepsResponse.reason instanceof Error && pirepsResponse.reason.message.includes('offline')
            ? 'PIREPs unavailable - check internet connection'
            : 'Failed to load PIREPs'
        };
      }

      if (tracksResponse.status === 'fulfilled') {
        updates.tracks = tracksResponse.value.tracks;
        updates.tracksMetadata = {
          active: tracksResponse.value.active ?? true,
          message: tracksResponse.value.message
        };
      } else {
        console.error('Failed to load ground tracks:', tracksResponse.reason);
        updates.tracks = [];
        updates.tracksMetadata = {
          active: false,
          message: tracksResponse.reason instanceof Error && tracksResponse.reason.message.includes('offline')
            ? 'Ground tracks unavailable - check internet connection'
            : 'Failed to load ground tracks'
        };
      }

      if (summaryResponse.status === 'fulfilled') {
        updates.summary = summaryResponse.value.summary;
        updates.summaryMetadata = {
          active: summaryResponse.value.active ?? true,
          generated: summaryResponse.value.generated
        };
      } else {
        console.error('Failed to load situation summary:', summaryResponse.reason);
        updates.summary = null;
        updates.summaryMetadata = {
          active: false,
          generated: false,
          message: summaryResponse.reason instanceof Error && summaryResponse.reason.message.includes('offline')
            ? 'Situation summary unavailable - check internet connection'
            : undefined
        };
      }

      // Set error message based on failed requests
      const failedRequests = [overviewResponse, pirepsResponse, tracksResponse, summaryResponse]
        .filter(response => response.status === 'rejected');

      const successfulRequests = [overviewResponse, pirepsResponse, tracksResponse, summaryResponse]
        .filter(response => response.status === 'fulfilled');

      const hasNoData = successfulRequests.length === 0;

      // Set error message based on data availability
      if (hasNoData && failedRequests.length > 0) {
        const offlineErrors = failedRequests.filter(req =>
          req.reason instanceof Error && req.reason.message.includes('offline')
        );

        if (offlineErrors.length > 0) {
          updates.error = 'No data available - check your internet connection and try again';
        } else {
          updates.error = 'No data available - server error occurred';
        }
      } else if (failedRequests.length > 0) {
        updates.error = `${failedRequests.length} of ${failedRequests.length + successfulRequests.length} data sources failed to load`;
      } else {
        updates.error = null;
      }

      setState(prev => ({ ...prev, ...updates }));
    } catch (error) {
      console.error('Failed to load airport data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof ApiError ? error.message : 'Failed to load airport data',
      }));
    }
  }, []);

  // Set selected airport
  const setSelectedAirport = useCallback((airportId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedAirport: airportId,
      // Clear previous airport data
      airportOverview: null,
      pireps: [],
      tracks: [],
      summary: null,
      pirepsMetadata: undefined,
      tracksMetadata: undefined,
      summaryMetadata: undefined,
    }));
  }, []);

  // Smart refresh - always tries to get the best available data
  const refreshData = useCallback(async () => {
    const connected = await testConnection();
    if (connected) {
      if (!state.airports.length) {
        const selectedId = await loadAirports();
        if (selectedId) {
          await loadAirportData(selectedId);
        }
      } else if (state.selectedAirport) {
        await loadAirportData(state.selectedAirport);
      }
    }
  }, [state.airports.length, state.selectedAirport, testConnection, loadAirports, loadAirportData]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, []);

  // Load airport data when selection changes
  useEffect(() => {
    if (state.selectedAirport && state.connectionStatus.connected) {
      loadAirportData(state.selectedAirport);
    }
  }, [state.selectedAirport, state.connectionStatus.connected, loadAirportData]);

  // Periodic connection test
  useEffect(() => {
    const interval = setInterval(testConnection, 10000); // Test every 10 seconds
    return () => clearInterval(interval);
  }, [testConnection]);

  return {
    selectedAirport: state.selectedAirport,
    setSelectedAirport,
    airports: state.airports,
    airportOverview: state.airportOverview,
    pireps: state.pireps,
    tracks: state.tracks,
    summary: state.summary,
    connectionStatus: state.connectionStatus,
    loading: state.loading,
    error: state.error,
    pirepsMetadata: state.pirepsMetadata,
    tracksMetadata: state.tracksMetadata,
    summaryMetadata: state.summaryMetadata,
    refreshData,
  };
}
