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
    try {
      const result = await pilotApi.testConnection();
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
  }, [mounted]);

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

  // Load data for specific airport
  const loadAirportData = useCallback(async (airportId: string, options?: { skipBaseline?: boolean; forceRefreshForecast?: boolean }) => {
    if (!airportId) return;

    let currentBaseline: BaselineData | null = null;
    let currentForecast: ArrivalForecast | null = null;
    setState(prev => {
      currentBaseline = prev.baseline;
      currentForecast = prev.arrivalForecast;
      // Only set baselineLoading if we're actually going to fetch baseline
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

    try {
      // Only fetch baseline if we don't already have it for this airport
      // If skipping, don't include it in Promise.allSettled to avoid unnecessary state updates
      const shouldFetchBaseline = !options?.skipBaseline && !currentBaseline;
      const baselinePromise = shouldFetchBaseline
        ? pilotApi.getBaseline(airportId).catch(() => ({ status: 'rejected' as const, reason: new Error('Baseline not available') }))
        : null;

      const shouldFetchForecast = !currentForecast || options?.forceRefreshForecast;
      const forecastPromise = shouldFetchForecast
        ? pilotApi.getArrivalForecast(airportId).catch(() => ({ status: 'rejected' as const, reason: new Error('Forecast not available') }))
        : null;

      // Load all data in parallel (only include baseline/forecast if we're actually fetching them)
      const promises = [
        pilotApi.getAirportOverview(airportId),
        pilotApi.getPireps(airportId),
        pilotApi.getGroundTracks(airportId),
        pilotApi.getArrivals(airportId),
        pilotApi.getSituationSummary(airportId),
      ];
      
      if (baselinePromise) {
        promises.push(baselinePromise);
      }
      if (forecastPromise) {
        promises.push(forecastPromise);
      }

      const responses = await Promise.allSettled(promises);
      
      // Properly destructure responses based on what we actually fetched
      // Base responses are always: overview, pireps, tracks, arrivals, summary (5 total)
      const [overviewResponse, pirepsResponse, tracksResponse, arrivalsResponse, summaryResponse] = responses.slice(0, 5);
      
      // Get baseline and forecast responses if they were fetched
      let baselineResponse: PromiseSettledResult<unknown> | null = null;
      let forecastResponse: PromiseSettledResult<unknown> | null = null;
      
      let responseIndex = 5;
      if (shouldFetchBaseline) {
        baselineResponse = responses[responseIndex];
        responseIndex++;
      }
      if (shouldFetchForecast) {
        forecastResponse = responses[responseIndex];
        responseIndex++;
      }
      
      // Create dummy responses for skipped items to maintain compatibility with existing code
      if (!baselineResponse) {
        baselineResponse = { status: 'fulfilled' as const, value: { baseline: currentBaseline } };
      }
      if (!forecastResponse) {
        forecastResponse = { status: 'fulfilled' as const, value: { forecast: currentForecast } };
      }

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
          message: pirepsResponse.value.message
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

      if (arrivalsResponse.status === 'fulfilled') {
        updates.arrivals = arrivalsResponse.value.arrivals;
        updates.arrivalsMetadata = {
          active: arrivalsResponse.value.active ?? true,
          message: arrivalsResponse.value.message
        };
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
        updates.summaryMetadata = {
          active: summaryResponse.value.active ?? true,
          generated: summaryResponse.value.generated
        };
      } else {
        console.error('Failed to load situation summary:', summaryResponse.reason);
        updates.summary = null;
        updates.summaryMetadata = {
          active: false,
          generated: false
        };
      }

      // Only process baseline response if we actually fetched it
      if (shouldFetchBaseline) {
        if (baselineResponse.status === 'fulfilled') {
          const newBaseline = baselineResponse.value.baseline;
          if (newBaseline !== undefined && newBaseline !== currentBaseline) {
            updates.baseline = newBaseline;
          }
          updates.baselineLoading = false;
        } else {
          // Baseline fetch failed
          if (!currentBaseline) {
            console.warn('Baseline data not available:', baselineResponse.reason);
            updates.baseline = null;
          }
          updates.baselineLoading = false;
        }
      }
      // If we skipped baseline, don't touch baseline or baselineLoading in updates
      // This prevents unnecessary state changes and re-renders

      // Only process forecast response if we actually fetched it
      if (shouldFetchForecast) {
        if (forecastResponse.status === 'fulfilled') {
          const newForecast = forecastResponse.value.forecast;
          // Always update if force-refreshing, otherwise only update if data changed
          if (newForecast !== undefined && (options?.forceRefreshForecast || newForecast !== currentForecast)) {
            updates.arrivalForecast = newForecast;
          }
          updates.arrivalForecastLoading = false;
        } else {
          // Forecast fetch failed
          if (!currentForecast) {
            console.warn('Arrival forecast not available:', forecastResponse.reason);
            updates.arrivalForecast = null;
          }
          updates.arrivalForecastLoading = false;
        }
      }
      // If we skipped forecast, don't touch forecast or forecastLoading in updates
      // This prevents unnecessary state changes and re-renders

      // Merge actualCounts from arrivals into arrivalForecast after both are processed
      // This handles the race condition where arrivals loads before forecast
      const finalForecast = updates.arrivalForecast ?? currentForecast;
      if (arrivalsResponse.status === 'fulfilled' && arrivalsResponse.value.actualCounts && finalForecast) {
        const actualCountsMap = new Map<string, number>();
        arrivalsResponse.value.actualCounts.timeSlots.forEach((slot, idx) => {
          actualCountsMap.set(slot, arrivalsResponse.value.actualCounts!.counts[idx]);
        });
        
        updates.arrivalForecast = {
          ...finalForecast,
          actualCounts: finalForecast.timeSlots.map(slot => 
            actualCountsMap.get(slot) ?? null
          )
        };
      }

      // Set error message based on failed requests
      const failedRequests = [overviewResponse, pirepsResponse, tracksResponse, arrivalsResponse, summaryResponse]
        .filter(response => response.status === 'rejected');

      const successfulRequests = [overviewResponse, pirepsResponse, tracksResponse, arrivalsResponse, summaryResponse]
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

      // Only update state if there are actual changes
      // This prevents unnecessary re-renders when data hasn't changed
      setState(prev => {
        // Check if any meaningful updates exist
        const hasUpdates = Object.keys(updates).length > 0 && (
          updates.airportOverview !== undefined ||
          updates.pireps !== undefined ||
          updates.tracks !== undefined ||
          updates.arrivals !== undefined ||
          updates.summary !== undefined ||
          updates.baseline !== undefined ||
          updates.baselineLoading !== undefined ||
          updates.arrivalForecast !== undefined ||
          updates.arrivalForecastLoading !== undefined ||
          updates.loading !== undefined ||
          updates.error !== undefined ||
          updates.pirepsMetadata !== undefined ||
          updates.tracksMetadata !== undefined ||
          updates.arrivalsMetadata !== undefined ||
          updates.summaryMetadata !== undefined
        );
        
        if (!hasUpdates) {
          return prev; // No changes, return previous state to prevent re-render
        }
        
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
    testConnection();
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
