'use client';

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { PilotMap } from './PilotMap';
import { AirportSelector } from './AirportSelector';
import { ConnectionStatus } from './ConnectionStatus';
import { SituationOverview } from './SituationOverview';
import { FAAStatus } from './FAAStatus';
import { PirepsList } from './PirepsList';
import { ArrivalTimeline } from './ArrivalTimeline';
import { deriveWeatherCategoryFromTAF } from './WeatherOutlook';
import { ETASelector } from './ETASelector';
import { Arrival, ArrivalSituationResponse, MatchedDaysResponse, FlightCategory } from '@/types';
import { MapControls } from './MapControls';
import { TimeBasedGraphs } from './TimeBasedGraphs';
import { usePilotData } from '@/hooks/usePilotData';
import { getCurrentUTCTime } from '@/utils/airportTime';
import { MapDisplayOptions } from '@/types';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Menu, X } from 'lucide-react';
import { SimpleDataAge } from './SimpleDataAge';
import { AppUpdateNotifier } from './AppUpdateNotifier';
import { DebugTimestamp } from './DebugTimestamp';
import { ClockDisplay } from './ClockDisplay';
import { pilotApi } from '@/services/api';

export function PilotDashboard() {
  const [mounted, setMounted] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date>(() => new Date());

  // Ensure component is only fully rendered after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    selectedAirport,
    setSelectedAirport,
    airports,
    airportOverview,
    pireps,
    tracks,
    arrivals,
    summary,
    baseline,
    baselineLoading,
    arrivalForecast,
    arrivalForecastLoading,
    connectionStatus,
    loading,
    error,
    pirepsMetadata,
    tracksMetadata,
    summaryMetadata,
    refreshData
  } = usePilotData();

  // Update selectedTime to current airport time when airport changes
  useEffect(() => {
    if (selectedAirport) {
      // Initialize to current UTC time (will be converted to airport local time by TimeSlider)
      setSelectedTime(getCurrentUTCTime());
    }
  }, [selectedAirport]);


  // Load map display options from localStorage or use defaults
  const [mapDisplayOptions, setMapDisplayOptions] = useState<MapDisplayOptions>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pilotApp_mapDisplayOptions');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.warn('Failed to parse saved map display options:', e);
        }
      }
    }
    return {
      showRunways: false, // Disabled - now handled by OSM features
      showDmeRings: true,
      showWaypoints: true,
      showExtendedCenterlines: true,
      showPireps: true,
      showWeatherPireps: false, // Default to off - separate from ATC PIREPs
      showMetars: false, // Default to off - METAR stations
      showGroundTracks: true,
      showOSMFeatures: true, // This includes runways from OSM
      showWeatherRadar: true,
      showWeatherAlerts: false,
      showVisibility: false,
      showSigmetAirmet: false,
      showWindsAloft: false,
      showIcing: false,
      showTurbulence: false,
    };
  });

  const [showPirepPanel, setShowPirepPanel] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [arrivalSituation, setArrivalSituation] = useState<ArrivalSituationResponse | null>(null);
  const [arrivalSituationLoading, setArrivalSituationLoading] = useState(false);
  const [arrivalSituationError, setArrivalSituationError] = useState<string | null>(null);
  const lastSituationFetchRef = useRef<{ airport: string; time: number; conditions?: string } | null>(null);
  const situationAbortControllerRef = useRef<AbortController | null>(null);
  
  const [matchedDaysData, setMatchedDaysData] = useState<MatchedDaysResponse | null>(null);
  const [matchedDaysLoading, setMatchedDaysLoading] = useState(false);
  const [weatherCategory, setWeatherCategory] = useState<FlightCategory>('VFR');
  const [isManualWeather, setIsManualWeather] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    weather: false,
    pireps: true,
  });
  const lastMatchedDaysFetchRef = useRef<{ airport: string; time: number; category: string } | null>(null);
  const matchedDaysAbortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSelectedTimeRef = useRef<number>(selectedTime.getTime());
  const prevWeatherCategoryRef = useRef<FlightCategory>(weatherCategory);

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const tafCategory = deriveWeatherCategoryFromTAF(airportOverview?.weather, selectedTime);
  
  const activeWeatherCategory = isManualWeather ? weatherCategory : tafCategory;
  
  useEffect(() => {
    if (!isManualWeather) {
      setWeatherCategory(tafCategory);
    }
  }, [tafCategory, isManualWeather]);

  const fetchArrivalSituation = useCallback(async (
    airportId: string, 
    eta: Date, 
    weather?: { visibilitySM?: number; ceilingFt?: number; windKt?: number; precipitation?: string; hadIFR?: boolean; trend?: string; },
    forceRefresh?: boolean,
    signal?: AbortSignal
  ) => {
    const conditionsKey = weather ? JSON.stringify(weather) : '';
    const lastFetch = lastSituationFetchRef.current;
    if (!forceRefresh && lastFetch && lastFetch.airport === airportId && 
        Math.abs(lastFetch.time - eta.getTime()) < 5 * 60 * 1000 &&
        lastFetch.conditions === conditionsKey) {
      return;
    }
    
    setArrivalSituationLoading(true);
    setArrivalSituationError(null);
    
    try {
      const situation = await pilotApi.getArrivalSituation(airportId, eta, weather, signal);
      if (!signal?.aborted) {
        setArrivalSituation(situation);
        lastSituationFetchRef.current = { airport: airportId, time: eta.getTime(), conditions: conditionsKey };
      }
    } catch (err) {
      if (signal?.aborted) {
        return;
      }
      console.error('Failed to fetch arrival situation:', err);
      setArrivalSituationError(err instanceof Error ? err.message : 'Failed to load arrival situation');
      setArrivalSituation(null);
    } finally {
      if (!signal?.aborted) {
        setArrivalSituationLoading(false);
      }
    }
  }, []);

  const fetchMatchedDays = useCallback(async (
    airportId: string,
    eta: Date,
    category: FlightCategory,
    signal?: AbortSignal
  ) => {
    const lastFetch = lastMatchedDaysFetchRef.current;
    if (lastFetch && lastFetch.airport === airportId && 
        Math.abs(lastFetch.time - eta.getTime()) < 5 * 60 * 1000 &&
        lastFetch.category === category) {
      return;
    }
    
    setMatchedDaysLoading(true);
    
    try {
      const data = await pilotApi.getMatchedDaysArrivals(airportId, eta, category, { maxDays: 10 }, signal);
      if (!signal?.aborted) {
        setMatchedDaysData(data);
        lastMatchedDaysFetchRef.current = { airport: airportId, time: eta.getTime(), category };
      }
    } catch (err) {
      if (signal?.aborted) {
        return;
      }
      console.error('Failed to fetch matched days:', err);
      setMatchedDaysData(null);
    } finally {
      if (!signal?.aborted) {
        setMatchedDaysLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedAirport || !connectionStatus.connected) return;
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    if (situationAbortControllerRef.current) {
      situationAbortControllerRef.current.abort();
    }
    if (matchedDaysAbortControllerRef.current) {
      matchedDaysAbortControllerRef.current.abort();
    }
    
    const timeChanged = Math.abs(selectedTime.getTime() - prevSelectedTimeRef.current) > 60000;
    const categoryChanged = activeWeatherCategory !== prevWeatherCategoryRef.current;
    
    if (timeChanged || categoryChanged) {
      setMatchedDaysData(null);
      prevSelectedTimeRef.current = selectedTime.getTime();
      prevWeatherCategoryRef.current = activeWeatherCategory;
    }
    
    const isNow = Math.abs(selectedTime.getTime() - Date.now()) < 60000;
    if (isNow) {
      setArrivalSituation(null);
      setMatchedDaysData(null);
      lastSituationFetchRef.current = null;
      lastMatchedDaysFetchRef.current = null;
      return;
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      const weather = airportOverview?.weather ? {
        visibilitySM: typeof airportOverview.weather.visibility === 'number' ? airportOverview.weather.visibility : undefined,
        ceilingFt: airportOverview.weather.ceiling || undefined,
        windKt: airportOverview.weather.wind?.speed,
      } : undefined;
      
      const situationController = new AbortController();
      const matchedDaysController = new AbortController();
      situationAbortControllerRef.current = situationController;
      matchedDaysAbortControllerRef.current = matchedDaysController;
      
      fetchArrivalSituation(selectedAirport, selectedTime, weather, false, situationController.signal);
      fetchMatchedDays(selectedAirport, selectedTime, activeWeatherCategory, matchedDaysController.signal);
    }, 400);
    
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (situationAbortControllerRef.current) {
        situationAbortControllerRef.current.abort();
      }
      if (matchedDaysAbortControllerRef.current) {
        matchedDaysAbortControllerRef.current.abort();
      }
    };
  }, [selectedAirport, selectedTime, connectionStatus.connected, fetchArrivalSituation, fetchMatchedDays, airportOverview?.weather, activeWeatherCategory]);

  // Save map display options to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pilotApp_mapDisplayOptions', JSON.stringify(mapDisplayOptions));
    }
  }, [mapDisplayOptions]);

  // Preserve scroll position when data updates
  const scrollPositionRef = useRef<number>(0);
  const isRestoringRef = useRef<boolean>(false);
  const restoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUserScrollTimeRef = useRef<number>(0);
  
  // Save scroll position continuously and watch for DOM changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!isRestoringRef.current) {
        scrollPositionRef.current = container.scrollTop;
        lastUserScrollTimeRef.current = Date.now();
      }
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Watch for DOM mutations (content changes) and restore scroll if it was reset
    const observer = new MutationObserver(() => {
      if (!isRestoringRef.current && scrollPositionRef.current > 0) {
        const timeSinceLastScroll = Date.now() - lastUserScrollTimeRef.current;
        // Only restore if user hasn't scrolled recently (within last 500ms)
        if (timeSinceLastScroll > 500) {
          const currentScroll = container.scrollTop;
          const savedScroll = scrollPositionRef.current;
          
          // If scroll was reset (significantly less than saved), restore it
          if (currentScroll < savedScroll - 10) {
            isRestoringRef.current = true;
            requestAnimationFrame(() => {
              if (container && scrollPositionRef.current > 0) {
                container.scrollTop = scrollPositionRef.current;
              }
              setTimeout(() => {
                isRestoringRef.current = false;
              }, 100);
            });
          }
        }
      }
    });
    
    // Observe child list and subtree changes
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  // Restore scroll position after EVERY render
  // This is more aggressive but ensures scroll position is preserved even if React re-renders
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const savedPosition = scrollPositionRef.current;
    if (savedPosition <= 0) return;

    // Don't restore if user just scrolled (within last 300ms) to avoid jank
    const timeSinceLastScroll = Date.now() - lastUserScrollTimeRef.current;
    if (timeSinceLastScroll < 300) {
      return;
    }

    const currentScroll = container.scrollTop;
    
    // If scroll was reset to top (or significantly reduced), restore it
    // Check if scroll is significantly less than saved (more than 10px difference)
    const scrollDiff = savedPosition - currentScroll;
    if (scrollDiff < 10) {
      // Scroll position is close enough, no need to restore
      return;
    }

    // Clear any pending restore
    if (restoreTimeoutRef.current) {
      clearTimeout(restoreTimeoutRef.current);
    }

    isRestoringRef.current = true;

    // Immediate restore using requestAnimationFrame
    requestAnimationFrame(() => {
      if (container && scrollPositionRef.current > 0) {
        container.scrollTop = scrollPositionRef.current;
      }
      
      // Also restore after multiple delays to catch any late resets from React re-renders
      restoreTimeoutRef.current = setTimeout(() => {
        if (container && scrollPositionRef.current > 0) {
          container.scrollTop = scrollPositionRef.current;
        }
        // Additional delayed restore for stubborn cases
        setTimeout(() => {
          if (container && scrollPositionRef.current > 0) {
            container.scrollTop = scrollPositionRef.current;
          }
          // Final delayed restore
          setTimeout(() => {
            if (container && scrollPositionRef.current > 0) {
              container.scrollTop = scrollPositionRef.current;
            }
            isRestoringRef.current = false;
          }, 100);
        }, 50);
      }, 10);
    });

    return () => {
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current);
      }
    };
  }); // No dependencies - runs after every render

  // Continuous monitor to catch any scroll resets
  // This is a safety net to catch scroll resets that slip through the useLayoutEffect
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const monitor = setInterval(() => {
      if (!isRestoringRef.current && scrollPositionRef.current > 0) {
        const currentScroll = container.scrollTop;
        const savedScroll = scrollPositionRef.current;
        
        // Don't restore if user just scrolled (within last 300ms) to avoid jank
        const timeSinceLastScroll = Date.now() - lastUserScrollTimeRef.current;
        if (timeSinceLastScroll < 300) {
          return;
        }
        
        // If scroll was reset (jumped to top or significantly changed), restore it
        // Be more aggressive - restore if scroll is significantly less than saved position
        if (currentScroll < savedScroll - 10) {
          isRestoringRef.current = true;
          requestAnimationFrame(() => {
            if (container && scrollPositionRef.current > 0) {
              container.scrollTop = scrollPositionRef.current;
            }
            setTimeout(() => {
              isRestoringRef.current = false;
            }, 100);
          });
        }
      }
    }, 50); // Check every 50ms for more responsive restoration

    return () => clearInterval(monitor);
  }, []);

  // Auto-refresh data every 30 seconds when connected
  useEffect(() => {
    if (connectionStatus.connected && selectedAirport) {
      const interval = setInterval(() => {
        // Preserve scroll position before refresh
        const container = scrollContainerRef.current;
        if (container) {
          scrollPositionRef.current = container.scrollTop;
        }
        refreshData();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [connectionStatus.connected, selectedAirport, refreshData]);

  // Smart refresh that always tries to get the best available data
  const handleRefresh = async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes

    // Preserve scroll position before refresh
    const container = scrollContainerRef.current;
    if (container) {
      scrollPositionRef.current = container.scrollTop;
    }

    console.log('[PilotDashboard] Starting manual refresh...');
    setIsRefreshing(true);
    try {
      await refreshData();
      console.log('[PilotDashboard] Manual refresh completed successfully');
    } catch (error) {
      console.error('[PilotDashboard] Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getConnectionStatusColor = () => {
    if (!connectionStatus.connected) return 'text-red-400';
    if (connectionStatus.latency && connectionStatus.latency > 2000) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getConnectionStatusIcon = () => {
    if (!connectionStatus.connected) {
      return <WifiOff className="w-4 h-4" />;
    }
    return <Wifi className="w-4 h-4" />;
  };

  // Get the most recent data timestamp
  const getDataStatus = (): { timestamp: Date; isLive: boolean } => {
    // Use actual data timestamps when available
    const dataTimestamp = airportOverview?.timestamp
      ? new Date(airportOverview.timestamp)
      : connectionStatus.lastUpdate;

    return {
      timestamp: dataTimestamp,
      isLive: connectionStatus.connected
    };
  };



  return (
    <div className="flex flex-col bg-slate-900 text-white overflow-hidden" style={{ height: '100dvh' }}>
      {/* Compact Header Bar */}
      <header className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <img
            src="/logo4.png"
            alt="AYRYX"
            className="h-6 w-6 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <AirportSelector
              airports={airports}
              selectedAirport={selectedAirport}
              onSelectAirport={setSelectedAirport}
              loading={loading}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          {mounted && <ClockDisplay airportCode={selectedAirport} baseline={baseline} />}
          
          {mounted && selectedAirport && (
            <SimpleDataAge
              timestamp={getDataStatus().timestamp}
              isLive={getDataStatus().isLive}
              offline={!connectionStatus.connected}
              size="sm"
            />
          )}

          <button
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            className="flex items-center space-x-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 
                     rounded text-xs transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading || isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading || isRefreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      {/* App Update Notifier */}
      <AppUpdateNotifier />

      {/* Refresh Notification */}
      {isRefreshing && (
        <div className="bg-blue-900/30 border-blue-500/40 border-l-4 p-1.5 mx-3 mt-1 rounded text-xs">
          <div className="flex items-center text-blue-200">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            <span className="font-medium">Refreshing data...</span>
          </div>
        </div>
      )}

      {/* Demo Disclaimer */}
      <div className="bg-blue-900/30 border-blue-500/40 border-l-4 p-1.5 mx-3 mt-1 rounded text-xs">
        <div className="flex items-center text-blue-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          <span className="font-medium">DEMO ONLY - NOT FOR FLIGHT OPERATIONS</span>
        </div>
      </div>

      {/* Demo Mode Notification */}
      {selectedAirport === 'KDEN' && (
        <div className="bg-orange-900/30 border-orange-500/40 border-l-4 p-2 mx-3 mt-1 rounded text-sm">
          <div className="flex items-center text-orange-200">
            <AlertTriangle className="w-4 h-4 mr-2" />
            <span className="font-medium">STORM DEMO MODE</span>
            <span className="ml-2 text-orange-300">Denver International - Simulating severe weather conditions</span>
          </div>
        </div>
      )}

      {/* Status Notifications */}
      {!connectionStatus.connected && (
        <div className="bg-red-900/30 border-red-500/40 border-l-4 p-2 mx-3 mt-1 rounded text-sm">
          <div className="flex items-center text-red-200">
            <WifiOff className="w-4 h-4 mr-2" />
            <span>Offline - no data available</span>
          </div>
        </div>
      )}

      {error && error.includes('No data available') && (
        <div className="bg-red-900/30 border-red-500/40 border-l-4 p-2 mx-3 mt-1 rounded text-sm">
          <div className="flex items-center text-red-200">
            <AlertTriangle className="w-4 h-4 mr-2" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Content: Split Screen Layout for Landscape */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map Section - Left Side (full width on mobile, flexible on desktop) */}
        <div className="flex-1 relative min-w-0 md:flex-[0_0_55%] md:max-w-[55%]" style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}>
          <PilotMap
            airport={airportOverview?.airport}
            airportData={airportOverview || undefined}
            pireps={pireps}
            tracks={tracks}
            arrivals={arrivals}
            displayOptions={mapDisplayOptions}
            onFullscreenChange={setMapFullscreen}
            isDemo={selectedAirport === 'KDEN'}
            loading={loading}
            selectedAirport={selectedAirport}
            selectedTrackId={selectedTrackId}
            baseline={baseline}
          />

          {/* Map Controls - Top Right of Map Area */}
          {mounted && selectedAirport && (
            <div className="absolute top-2 right-2" style={{ zIndex: 1001 }}>
              <MapControls
                displayOptions={mapDisplayOptions}
                onOptionsChange={setMapDisplayOptions}
                isDemo={selectedAirport === 'KDEN'}
              />
            </div>
          )}
        </div>

        {/* Right Panel - Graphs and Info (hidden on mobile when fullscreen, visible on tablet/desktop) */}
        {!mapFullscreen && (
          <div key="right-panel" className="hidden md:flex md:w-[45%] md:min-w-[400px] md:max-w-[45%] bg-slate-800/95 backdrop-blur-sm border-l border-slate-700/50 flex-col overflow-hidden" style={{ zIndex: 1000 }}>
            {/* Scrollable Content Area */}
            <div 
              ref={scrollContainerRef} 
              className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3"
              onScroll={(e) => {
                const target = e.currentTarget;
                if (!isRestoringRef.current) {
                  scrollPositionRef.current = target.scrollTop;
                  lastUserScrollTimeRef.current = Date.now();
                }
              }}
            >
              {/* ETA Selector with integrated weather scenario */}
              {selectedAirport && (
                <ETASelector
                  airportCode={selectedAirport}
                  selectedTime={selectedTime}
                  onTimeChange={setSelectedTime}
                  maxHoursAhead={24}
                  baseline={baseline}
                  tafCategory={tafCategory}
                  isManualWeather={isManualWeather}
                  onManualWeatherChange={setIsManualWeather}
                  manualCategory={weatherCategory}
                  onCategoryChange={setWeatherCategory}
                />
              )}

              {/* ARRIVAL FORECAST SECTION */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-slate-700"></div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Arrival Forecast
                  </span>
                  <div className="h-px flex-1 bg-slate-700"></div>
                </div>

                {/* Traffic Forecast */}
                {selectedAirport && baseline && (
                  <TimeBasedGraphs
                    key={`traffic-${selectedAirport}`}
                    baseline={baseline}
                    arrivalForecast={arrivalForecast}
                    airportCode={selectedAirport}
                    selectedTime={selectedTime}
                    loading={baselineLoading || arrivalForecastLoading || loading}
                    onTimeClick={setSelectedTime}
                  />
                )}

                {/* Unified Arrival Timeline */}
                {selectedAirport && (
                  <div className="bg-slate-800 rounded-lg border border-slate-700 p-3">
                    <ArrivalTimeline
                      arrivals={arrivals || []}
                      airportCode={selectedAirport}
                      baseline={baseline}
                      matchedDaysData={matchedDaysData}
                      selectedTime={selectedTime}
                      weatherCategory={activeWeatherCategory}
                      onPointClick={(arrival) => {
                        const landingTime = new Date(arrival.timestampLanding);
                        const matchingTrack = tracks.find(track => {
                          const trackLandingTime = track.createdAt ? new Date(track.createdAt) : null;
                          return track.callsign === arrival.callsign && 
                                 trackLandingTime && 
                                 Math.abs(trackLandingTime.getTime() - landingTime.getTime()) < 60000;
                        });
                        
                        if (matchingTrack) {
                          setSelectedTrackId(matchingTrack.id);
                          setTimeout(() => {
                            const mapElement = document.querySelector('[data-map-container]');
                            if (mapElement) {
                              mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 100);
                        }
                      }}
                      onHistoricalPointClick={(historical) => {
                        console.log('[PilotDashboard] Historical arrival clicked:', historical);
                      }}
                    />
                    {matchedDaysLoading && (
                      <div className="mt-2 text-center text-sm text-gray-400">
                        Loading historical data...
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Situation Overview */}
              <SituationOverview
                key={`situation-${selectedAirport}`}
                summary={summary}
                weather={airportOverview?.weather}
                loading={loading}
                connectionStatus={connectionStatus}
                airportCode={selectedAirport || undefined}
                summaryMetadata={summaryMetadata}
                baseline={baseline}
                baselineLoading={baselineLoading}
                isDemo={selectedAirport === 'KDEN'}
                selectedTime={selectedTime}
              />

              {/* FAA NAS Status */}
              {selectedAirport && (
                <FAAStatus airportId={selectedAirport} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* PIREP Panel Backdrop - Click outside to close */}
      {showPirepPanel && (
        <div
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          style={{ zIndex: 999 }}
          onClick={() => setShowPirepPanel(false)}
        />
      )}

      {/* Left Side Panel - PIREPs (Collapsible, Fixed Width) */}
      <div className={`absolute left-0 top-0 bottom-12 lg:bottom-0 w-80 max-w-[85vw] bg-slate-800/95 backdrop-blur-sm border-r border-slate-700/50 
                      transform transition-transform duration-200 ease-in-out ${showPirepPanel ? 'translate-x-0' : '-translate-x-full'
        }`} style={{ zIndex: 1000 }}>
        <div className="p-2 sm:p-3 h-full">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-gray-300">PIREPs</h3>
              {selectedAirport === 'KDEN' && (
                <span className="px-1.5 py-0.5 bg-orange-600 text-white text-xs rounded-full font-medium">
                  STORM DEMO
                </span>
              )}
            </div>
            <button
              onClick={() => setShowPirepPanel(false)}
              className="p-1 hover:bg-slate-700/50 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="h-full overflow-y-auto">
            <PirepsList
              pireps={pireps}
              connectionStatus={connectionStatus}
              pirepsMetadata={pirepsMetadata}
              isDemo={selectedAirport === 'KDEN'}
            />
          </div>
        </div>
      </div>

      {/* PIREP Panel Toggle Button (when panel is closed) - Bottom left position */}
      {!showPirepPanel && (
        <button
          onClick={() => setShowPirepPanel(true)}
          className={`absolute left-2 bottom-16 lg:bottom-14 px-3 py-2 rounded-lg 
                   hover:bg-slate-700/95 transition-colors flex items-center space-x-2 backdrop-blur-sm border
                   ${pireps && pireps.length > 0
              ? 'bg-yellow-900/80 border-yellow-500/60 text-yellow-200'
              : 'bg-slate-800/95 border-slate-700/50 text-gray-300'}`}
          style={{ zIndex: 1000 }}
        >
          <Menu className={`w-4 h-4 ${pireps && pireps.length > 0 ? 'text-yellow-300' : 'text-gray-300'}`} />
          <div className="flex flex-col items-start">
            <span className="text-xs font-medium">PIREPs</span>
            <span className="text-xs opacity-80">
              {mounted && pireps && pireps.length > 0 ? `${pireps.length} available` : 'None available'}
            </span>
          </div>
          {selectedAirport === 'KDEN' && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full border border-white"></div>
          )}
        </button>
      )}

      {/* Storm Demo Button - Bottom left position, to the right of PIREP button */}
      {selectedAirport === 'KDEN' && !showPirepPanel && (
        <button
          className="absolute left-2 bottom-16 lg:bottom-14 ml-32 px-3 py-2 rounded-lg 
                   bg-orange-600/90 hover:bg-orange-700/90 transition-colors flex items-center space-x-2 
                   backdrop-blur-sm border border-orange-500/60 text-white"
          style={{ zIndex: 1000 }}
        >
          <AlertTriangle className="w-4 h-4 text-orange-200" />
          <div className="flex flex-col items-start">
            <span className="text-xs font-medium">STORM DEMO</span>
            <span className="text-xs opacity-80">
              Denver Weather
            </span>
          </div>
        </button>
      )}


      {/* Bottom Status Bar - Airport Info (only on map side) */}
      {airportOverview && !mapFullscreen && (
        <div className="absolute left-0 md:right-[45%] right-0 bg-slate-800/95 backdrop-blur-sm border-t border-slate-700/50 px-3 py-2" style={{ bottom: 'env(safe-area-inset-bottom)', zIndex: 1000 }}>
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center space-x-4">
              <span className="text-gray-400 font-medium">{airportOverview.airport.code}</span>
              <span>{airportOverview.runways.length} Runways</span>
              <span className={`flex items-center space-x-1 ${airportOverview.operational.active ? 'text-green-400' : 'text-red-400'}`}>
                <span>●</span>
                <span>{airportOverview.operational.active ? 'Active' : 'Inactive'}</span>
              </span>
            </div>

            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <DebugTimestamp
                serverTimestamp={airportOverview.timestamp}
                source="live data"
                className="opacity-60"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
