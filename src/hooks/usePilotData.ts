'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { pilotApi, ApiError } from '@/services/api';
import {
  PilotAppState,
  BaselineData,
  ArrivalForecast
} from '@/types';

export function usePilotData() {
  const [mounted, setMounted] = useState(false);
  const offlineStartTimeRef = useRef<number | null>(null);
  const wasConnectedRef = useRef<boolean>(false);

  const [state, setState] = useState<PilotAppState>(() => {
    // Initialize with saved airport from localStorage
    const savedAirport = typeof window !== 'undefined' ? localStorage.getItem('pilotApp_selectedAirport') : null;

    return {
      selectedAirport: savedAirport || null,
      airports: [],
      airportOverview: null,
      pireps: [],
      tracks: [],
      arrivals: [],
      summary: null,
      connectionStatus: {
        connected: false,
        lastUpdate: new Date(0), // Use epoch time for SSR consistency
      },
      loading: false,
      error: null,
      pirepsMetadata: undefined,
      tracksMetadata: undefined,
      arrivalsMetadata: undefined,
      summaryMetadata: undefined,
      baseline: null,
      baselineLoading: false,
      arrivalForecast: null,
      arrivalForecastLoading: false,
    };
  });

  // Set mounted state after hydration
  useEffect(() => {
    setMounted(true);
    // Update the lastUpdate to current time after mount
    setState(prev => ({
      ...prev,
      connectionStatus: {
        ...prev.connectionStatus,
        lastUpdate: new Date(),
      }
    }));
  }, []);

  // Test connection and update status
  const testConnection = useCallback(async () => {
    const wasOffline = offlineStartTimeRef.current !== null;
    const offlineDuration = wasOffline && offlineStartTimeRef.current 
      ? Date.now() - offlineStartTimeRef.current 
      : 0;

    // Only count offline time if app was actively being used (has airports loaded)
    const activeOfflineDuration = wasOffline && state.airports.length > 0 
      ? offlineDuration 
      : 0;

    try {
      const result = await pilotApi.testConnection(activeOfflineDuration);
      
      if (result.connected) {
        // Connection restored - clear offline tracking
        if (offlineStartTimeRef.current !== null) {
          offlineStartTimeRef.current = null;
        }
        wasConnectedRef.current = true;
      } else {
        // Connection lost - start tracking offline time
        if (offlineStartTimeRef.current === null && wasConnectedRef.current) {
          offlineStartTimeRef.current = Date.now();
        }
      }

      setState(prev => ({
        ...prev,
        connectionStatus: {
          connected: result.connected,
          lastUpdate: mounted ? new Date() : prev.connectionStatus.lastUpdate,
          latency: result.latency,
        },
        error: result.connected ? null : (result.error || 'Connection failed'),
      }));
      return result.connected;
    } catch (error) {
      // Connection failed - start tracking offline time if we were connected
      if (offlineStartTimeRef.current === null && wasConnectedRef.current) {
        offlineStartTimeRef.current = Date.now();
      }

      setState(prev => ({
        ...prev,
        connectionStatus: {
          connected: false,
          lastUpdate: mounted ? new Date() : prev.connectionStatus.lastUpdate,
        },
        error: error instanceof Error ? error.message : 'Connection test failed',
      }));
      return false;
    }
  }, [mounted, state.airports.length]);

  // Load airports list
  const loadAirports = useCallback(async () => {
    try {
      const response = await pilotApi.getAirports();
      // Filter to only show airports with active backend processing
      const activeAirports = response.airports.filter(a => a.active);
      
      setState(prev => ({
        ...prev,
        airports: activeAirports,
        error: null,
      }));

      // Auto-select first active airport if none selected
      if (!state.selectedAirport && activeAirports.length > 0) {
        const firstActive = activeAirports[0];
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

  // Load data for specific airport.
  // Phase 1 (critical): overview + tracks — show map as soon as these complete.
  // Phase 2 (background): pireps, arrivals, summary, baseline, forecast — fill in when ready.
  const loadAirportData = useCallback(async (airportId: string, options?: { skipBaseline?: boolean; forceRefreshForecast?: boolean }) => {
    if (!airportId) return;

    let currentBaseline: BaselineData | null = null;
    let currentForecast: ArrivalForecast | null = null;
    setState(prev => {
      currentBaseline = prev.baseline;
      currentForecast = prev.arrivalForecast;
      const willFetchBaseline = !options?.skipBaseline && !prev.baseline;
      const willFetchForecast = !prev.arrivalForecast || options?.forceRefreshForecast;
      return {
        ...prev,
        loading: true,
        baselineLoading: willFetchBaseline,
        arrivalForecastLoading: willFetchForecast,
        error: null
      };
    });

    const shouldFetchBaseline = !options?.skipBaseline && !currentBaseline;
    const shouldFetchForecast = !currentForecast || options?.forceRefreshForecast;

    try {
      const criticalResponses = await Promise.allSettled([
        pilotApi.getAirportOverview(airportId),
        pilotApi.getGroundTracks(airportId),
      ]);
      const [overviewResponse, tracksResponse] = criticalResponses;

      const criticalUpdates: Partial<PilotAppState> = { loading: false };

      if (overviewResponse.status === 'fulfilled') {
        criticalUpdates.airportOverview = overviewResponse.value;
      } else {
        console.error('Failed to load airport overview:', overviewResponse.reason);
        criticalUpdates.airportOverview = null;
      }

      if (tracksResponse.status === 'fulfilled') {
        criticalUpdates.tracks = tracksResponse.value.tracks;
        criticalUpdates.tracksMetadata = {
          active: tracksResponse.value.active ?? true,
          message: tracksResponse.value.message
        };
      } else {
        console.error('Failed to load ground tracks:', tracksResponse.reason);
        criticalUpdates.tracks = [];
        criticalUpdates.tracksMetadata = {
          active: false,
          message: tracksResponse.reason instanceof Error && tracksResponse.reason.message.includes('offline')
            ? 'Ground tracks unavailable - check internet connection'
            : 'Failed to load ground tracks'
        };
      }

      const criticalFailed = overviewResponse.status === 'rejected' && tracksResponse.status === 'rejected';
      if (criticalFailed) {
        const offline = [overviewResponse, tracksResponse].every(r =>
          r.status === 'rejected' && r.reason instanceof Error && r.reason.message.includes('offline')
        );
        criticalUpdates.error = offline
          ? 'No data available - check your internet connection and try again'
          : 'No data available - server error occurred';
      }

      setState(prev => (prev.selectedAirport !== airportId ? prev : { ...prev, ...criticalUpdates }));

      const baselinePromise = shouldFetchBaseline
        ? pilotApi.getBaseline(airportId).catch(() => ({ status: 'rejected' as const, reason: new Error('Baseline not available') }))
        : null;
      const forecastPromise = shouldFetchForecast
        ? pilotApi.getArrivalForecast(airportId).catch(() => ({ status: 'rejected' as const, reason: new Error('Forecast not available') }))
        : null;

      const backgroundPromises: Promise<unknown>[] = [
        pilotApi.getPireps(airportId),
        pilotApi.getArrivals(airportId),
        pilotApi.getSituationSummary(airportId),
      ];
      if (baselinePromise) backgroundPromises.push(baselinePromise);
      if (forecastPromise) backgroundPromises.push(forecastPromise);

      const backgroundResponses = await Promise.allSettled(backgroundPromises);
      const [pirepsResponse, arrivalsResponse, summaryResponse] = backgroundResponses.slice(0, 3);
      const baselineResponse: PromiseSettledResult<unknown> = shouldFetchBaseline && backgroundResponses[3] != null
        ? backgroundResponses[3]
        : { status: 'fulfilled' as const, value: { baseline: currentBaseline } };
      const forecastResponse: PromiseSettledResult<unknown> = shouldFetchForecast && backgroundResponses[shouldFetchBaseline ? 4 : 3] != null
        ? backgroundResponses[shouldFetchBaseline ? 4 : 3]
        : { status: 'fulfilled' as const, value: { forecast: currentForecast } };

      const updates: Partial<PilotAppState> = {};

      if (pirepsResponse.status === 'fulfilled') {
        updates.pireps = pirepsResponse.value.pireps;
        updates.pirepsMetadata = { active: pirepsResponse.value.active ?? true, message: pirepsResponse.value.message };
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

      if (arrivalsResponse.status === 'fulfilled') {
        updates.arrivals = arrivalsResponse.value.arrivals;
        updates.arrivalsMetadata = { active: arrivalsResponse.value.active ?? true, message: arrivalsResponse.value.message };
      } else {
        console.error('Failed to load arrivals:', arrivalsResponse.reason);
        updates.arrivals = [];
        updates.arrivalsMetadata = {
          active: false,
          message: arrivalsResponse.reason instanceof Error && arrivalsResponse.reason.message.includes('offline')
            ? 'Arrivals unavailable - check internet connection'
            : 'Failed to load arrivals'
        };
      }

      if (summaryResponse.status === 'fulfilled') {
        updates.summary = summaryResponse.value.summary;
        updates.summaryMetadata = { active: summaryResponse.value.active ?? true, generated: summaryResponse.value.generated };
      } else {
        console.error('Failed to load situation summary:', summaryResponse.reason);
        updates.summary = null;
        updates.summaryMetadata = { active: false, generated: false };
      }

      if (shouldFetchBaseline) {
        if (baselineResponse.status === 'fulfilled') {
          const newBaseline = baselineResponse.value.baseline;
          if (newBaseline !== undefined && newBaseline !== currentBaseline) updates.baseline = newBaseline;
          updates.baselineLoading = false;
        } else {
          if (!currentBaseline) {
            console.warn('Baseline data not available:', baselineResponse.reason);
            updates.baseline = null;
          }
          updates.baselineLoading = false;
        }
      }

      if (shouldFetchForecast) {
        if (forecastResponse.status === 'fulfilled') {
          const newForecast = forecastResponse.value.forecast;
          if (newForecast !== undefined && (options?.forceRefreshForecast || newForecast !== currentForecast)) {
            updates.arrivalForecast = newForecast;
          }
          updates.arrivalForecastLoading = false;
        } else {
          if (!currentForecast) {
            console.warn('Arrival forecast not available:', forecastResponse.reason);
            updates.arrivalForecast = null;
          }
          updates.arrivalForecastLoading = false;
        }
      }

      const finalForecast = updates.arrivalForecast ?? currentForecast;
      if (arrivalsResponse.status === 'fulfilled' && arrivalsResponse.value.actualCounts && finalForecast) {
        const actualCountsMap = new Map<string, number>();
        arrivalsResponse.value.actualCounts.timeSlots.forEach((slot, idx) => {
          actualCountsMap.set(slot, arrivalsResponse.value.actualCounts!.counts[idx]);
        });
        updates.arrivalForecast = {
          ...finalForecast,
          actualCounts: finalForecast.timeSlots.map(slot => actualCountsMap.get(slot) ?? null)
        };
      }

      const failed = [pirepsResponse, arrivalsResponse, summaryResponse].filter(r => r.status === 'rejected');
      const succeeded = [pirepsResponse, arrivalsResponse, summaryResponse].filter(r => r.status === 'fulfilled');
      if (failed.length > 0 && !criticalUpdates.error) {
        updates.error = `${failed.length} of ${failed.length + succeeded.length} data sources failed to load`;
      } else if (failed.length === 0 && criticalUpdates.error) {
        updates.error = null;
      }

      setState(prev => {
        if (prev.selectedAirport !== airportId) return prev;
        const hasUpdates = Object.keys(updates).length > 0;
        if (!hasUpdates) return prev;
        return { ...prev, ...updates };
      });
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
    // Save to localStorage
    if (typeof window !== 'undefined') {
      if (airportId) {
        localStorage.setItem('pilotApp_selectedAirport', airportId);
      } else {
        localStorage.removeItem('pilotApp_selectedAirport');
      }
    }

    setState(prev => ({
      ...prev,
      selectedAirport: airportId,
      // Clear previous airport data (but keep baseline/forecast if same airport)
      airportOverview: null,
      pireps: [],
      tracks: [],
      summary: null,
      pirepsMetadata: undefined,
      tracksMetadata: undefined,
      summaryMetadata: undefined,
      // Only clear baseline if switching to a different airport
      baseline: airportId === prev.selectedAirport ? prev.baseline : null,
      baselineLoading: false,
      // Only clear forecast if switching to a different airport
      arrivalForecast: airportId === prev.selectedAirport ? prev.arrivalForecast : null,
      arrivalForecastLoading: false,
    }));
  }, []);

  // Smart refresh - always tries to get the best available data
  // Uses refs to access current state without causing effect dependencies
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Track currently loading airport to prevent duplicate calls
  const loadingAirportRef = useRef<string | null>(null);

  const refreshData = useCallback(async () => {
    const connected = await testConnection();
    if (connected) {
      const currentState = stateRef.current;
      if (!currentState.airports.length) {
        // Initial load: just load airports, don't load airport data here
        // The effect watching selectedAirport will handle loading data when airport is auto-selected
        await loadAirports();
      } else if (currentState.selectedAirport) {
        // Manual refresh: reload data for current airport
        const skipBaseline = currentState.baseline !== null;
        await loadAirportData(currentState.selectedAirport, { skipBaseline });
      }
    }
  }, [testConnection, loadAirports, loadAirportData]);

  // Initial connection test on mount
  useEffect(() => {
    testConnection().then(connected => {
      wasConnectedRef.current = connected;
    });
  }, []); // Only run on mount

  // Handle initial load when connection is established
  useEffect(() => {
    if (!state.connectionStatus.connected || state.airports.length > 0) return;
    
    // Connection established but no airports loaded yet - load them
    refreshData();
  }, [state.connectionStatus.connected, state.airports.length, refreshData]);

  // Handle airport selection changes (after airports are loaded)
  // This handles both initial auto-selection and user selection changes
  useEffect(() => {
    // Only proceed if we're connected and have airports loaded
    if (!state.connectionStatus.connected || !state.airports.length) return;

    if (state.selectedAirport) {
      // Prevent duplicate calls for the same airport
      if (loadingAirportRef.current === state.selectedAirport) {
        return;
      }

      // Track that we're loading this airport
      loadingAirportRef.current = state.selectedAirport;
      
      // Get baseline state from current state (not from dependency)
      const currentBaseline = stateRef.current.baseline;
      const skipBaseline = currentBaseline !== null;
      
      // Load data for the selected airport
      loadAirportData(state.selectedAirport, { skipBaseline }).finally(() => {
        // Clear loading ref when done (only if still the same airport)
        if (loadingAirportRef.current === state.selectedAirport) {
          loadingAirportRef.current = null;
        }
      });
    } else {
      // No airport selected, clear loading ref
      loadingAirportRef.current = null;
    }
  }, [state.connectionStatus.connected, state.airports.length, state.selectedAirport, loadAirportData]);

  // Periodic connection test
  useEffect(() => {
    const interval = setInterval(testConnection, 10000); // Test every 10 seconds
    return () => clearInterval(interval);
  }, [testConnection]);

  // Periodic weather refresh (every 3 minutes to keep METAR/TAF current)
  useEffect(() => {
    if (!state.connectionStatus.connected || !state.selectedAirport) return;
    
    const interval = setInterval(() => {
      // Refresh weather data for selected airport
      loadAirportData(state.selectedAirport, { skipBaseline: true });
    }, 3 * 60 * 1000); // Every 3 minutes
    
    return () => clearInterval(interval);
  }, [state.connectionStatus.connected, state.selectedAirport, loadAirportData]);

  // Periodic forecast refresh (every 5 minutes to match backend cache TTL)
  // The backend caches FAA forecast data for 5 minutes, so we refresh slightly after
  // to ensure we get fresh data when the cache expires
  useEffect(() => {
    if (!state.connectionStatus.connected || !state.selectedAirport) return;
    
    const interval = setInterval(() => {
      // Force refresh forecast data to get latest FAA flight plan updates
      loadAirportData(state.selectedAirport, { skipBaseline: true, forceRefreshForecast: true });
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(interval);
  }, [state.connectionStatus.connected, state.selectedAirport, loadAirportData]);

  return {
    selectedAirport: state.selectedAirport,
    setSelectedAirport,
    airports: state.airports,
    airportOverview: state.airportOverview,
    pireps: state.pireps,
    tracks: state.tracks,
    arrivals: state.arrivals,
    summary: state.summary,
    baseline: state.baseline,
    baselineLoading: state.baselineLoading,
    arrivalForecast: state.arrivalForecast,
    arrivalForecastLoading: state.arrivalForecastLoading,
    connectionStatus: state.connectionStatus,
    loading: state.loading,
    error: state.error,
    pirepsMetadata: state.pirepsMetadata,
    tracksMetadata: state.tracksMetadata,
    arrivalsMetadata: state.arrivalsMetadata,
    summaryMetadata: state.summaryMetadata,
    refreshData,
  };
}
