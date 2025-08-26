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

      // Process results
      if (overviewResponse.status === 'fulfilled') {
        updates.airportOverview = overviewResponse.value;
      } else {
        console.error('Failed to load airport overview:', overviewResponse.reason);
      }

      if (pirepsResponse.status === 'fulfilled') {
        updates.pireps = pirepsResponse.value.pireps;
      } else {
        console.error('Failed to load PIREPs:', pirepsResponse.reason);
        updates.pireps = [];
      }

      if (tracksResponse.status === 'fulfilled') {
        updates.tracks = tracksResponse.value.tracks;
      } else {
        console.error('Failed to load ground tracks:', tracksResponse.reason);
        updates.tracks = [];
      }

      if (summaryResponse.status === 'fulfilled') {
        updates.summary = summaryResponse.value.summary;
      } else {
        console.error('Failed to load situation summary:', summaryResponse.reason);
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
    }));
  }, []);

  // Refresh all data
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
    refreshData,
  };
}
