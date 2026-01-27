'use client';

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { PilotMap } from './PilotMap';
import { AirportSelector } from './AirportSelector';
import { SituationOverview } from './SituationOverview';
import { FAAStatus } from './FAAStatus';
import { PirepsList } from './PirepsList';
import { ArrivalTimeline } from './ArrivalTimeline';
import { deriveWeatherCategoryFromTAF } from './WeatherOutlook';
import { computeFlightCategory } from '@/utils/weatherCategory';

function deriveWeatherCategoryFromTimeline(summary: SituationSummary | null, targetTime: Date): FlightCategory {
  if (!summary || !summary.timeSegments || summary.timeSegments.length === 0) {
    return 'VFR';
  }

  const targetTimeMs = targetTime.getTime();

  for (const segment of summary.timeSegments) {
    const segmentStart = new Date(segment.timeFrom).getTime();
    const segmentEnd = new Date(segment.timeTo).getTime();

    if (targetTimeMs >= segmentStart && targetTimeMs < segmentEnd) {
      return segment.flightCategory || 'VFR';
    }
  }

  return summary.timeSegments[0].flightCategory || 'VFR';
}
import { ETASelector } from './ETASelector';
import { ArrivalSituationResponse, MatchedDaysResponse, FlightCategory, SituationSummary } from '@/types';
import { MapControls } from './MapControls';
import { TimeBasedGraphs } from './TimeBasedGraphs';
import { usePilotData } from '@/hooks/usePilotData';
import { getCurrentUTCTime, formatUTCTimeShort, getAirportUTCOffset, utcToAirportLocal } from '@/utils/airportTime';
import { MapDisplayOptions } from '@/types';
import { WifiOff, AlertTriangle, Menu, X, Map, BarChart3 } from 'lucide-react';
import { SimpleDataAge } from './SimpleDataAge';
import { AppUpdateNotifier } from './AppUpdateNotifier';
import { ClockDisplay } from './ClockDisplay';
import { pilotApi } from '@/services/api';
import { HelpButton } from './HelpButton';
import { CollapsibleSection } from './CollapsibleSection';
import { CollapsibleCard } from './CollapsibleCard';
import { TrendingUp, Plane as PlaneIcon, Sliders } from 'lucide-react';
import { FeedbackButton } from './FeedbackButton';
import { WeatherScenarioToggle } from './WeatherScenarioToggle';
import { useTimezonePreference } from '@/hooks/useTimezonePreference';

export function PilotDashboard() {
  const { isUTC } = useTimezonePreference();
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
    tracksMetadata: _tracksMetadata,
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
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [mobileActiveTab, setMobileActiveTab] = useState<'map' | 'planning'>('map');
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [_arrivalSituation, setArrivalSituation] = useState<ArrivalSituationResponse | null>(null);
  const [_arrivalSituationLoading, setArrivalSituationLoading] = useState(false);
  const [_arrivalSituationError, setArrivalSituationError] = useState<string | null>(null);
  const lastSituationFetchRef = useRef<{ airport: string; time: number; conditions?: string } | null>(null);
  const situationAbortControllerRef = useRef<AbortController | null>(null);
  
  const [matchedDaysData, setMatchedDaysData] = useState<MatchedDaysResponse | null>(null);
  const [matchedDaysLoading, setMatchedDaysLoading] = useState(false);
  const [weatherCategory, setWeatherCategory] = useState<FlightCategory>('VFR');
  const [isManualWeather, setIsManualWeather] = useState(false);
  const [_collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    weather: false,
    pireps: true,
  });
  const lastMatchedDaysFetchRef = useRef<{ airport: string; time: number; category: string } | null>(null);
  const matchedDaysAbortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevSelectedTimeRef = useRef<number>(selectedTime.getTime());
  const prevWeatherCategoryRef = useRef<FlightCategory>(weatherCategory);

  const _toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Derive weather category from unified timeline (NOW uses METAR, future uses TAF)
  const timelineCategory = deriveWeatherCategoryFromTimeline(summary, selectedTime);
  
  // Fallback to old TAF-based method if timeline not available
  const tafCategory = timelineCategory === 'VFR' && !summary?.timeSegments?.length
    ? deriveWeatherCategoryFromTAF(airportOverview?.weather, selectedTime)
    : timelineCategory;
  
  // Compute METAR category from current weather conditions
  const metarCategory = (() => {
    if (!airportOverview?.weather) return 'VFR';
    const visSM = typeof airportOverview.weather.visibility === 'number' 
      ? airportOverview.weather.visibility 
      : typeof airportOverview.weather.visibility === 'string'
        ? parseFloat(airportOverview.weather.visibility)
        : null;
    const visKM = visSM !== null ? visSM * 1.60934 : null;
    const ceiling = airportOverview.weather.ceiling || airportOverview.weather.cloudbase || null;
    return computeFlightCategory(visKM, ceiling);
  })();
  
  const activeWeatherCategory = isManualWeather ? weatherCategory : tafCategory;
  
  useEffect(() => {
    if (!isManualWeather) {
      setWeatherCategory(tafCategory);
    }
  }, [tafCategory, isManualWeather]);

  useEffect(() => {
    const isNow = Math.abs(selectedTime.getTime() - Date.now()) < 60000;
    if (isNow && isManualWeather) {
      setIsManualWeather(false);
      setWeatherCategory(tafCategory);
    }
  }, [selectedTime, isManualWeather, tafCategory]);

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
      <header className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0" style={{ zIndex: 5000 }}>
        <div className="flex items-center space-x-2 min-w-0 flex-1" style={{ overflow: 'visible' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ayryx_with_star_white.png"
            alt="AYRYX"
            className="h-6 w-auto flex-shrink-0"
          />
          <div className="flex items-center gap-2 min-w-0" style={{ overflow: 'visible' }}>
            <AirportSelector
              airports={airports}
              selectedAirport={selectedAirport}
              onSelectAirport={setSelectedAirport}
              loading={loading}
            />
            <HelpButton
              title="AYRYX Pilot"
              size="md"
              content={
                <div className="space-y-2">
                  <p>
                    A <strong>situational awareness system</strong> providing precise operational information about your destination airport, including how current operations are responding to conditions and how they&apos;re expected to evolve.
                  </p>
                  <p>
                    <strong>Key Features:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Traffic forecast and historical arrival times</li>
                    <li>Weather conditions and TAF forecasts</li>
                    <li>Ground tracks showing recent arrival paths</li>
                    <li>PIREPs from live ATC communications</li>
                    <li>What-if weather scenarios to explore how arrival patterns change under different conditions</li>
                  </ul>
                  <div className="bg-orange-900/30 border border-orange-500/50 rounded p-2 mt-2">
                    <p className="text-orange-200 font-medium">
                      ⚠️ DEMO ONLY - NOT FOR FLIGHT OPERATIONS
                    </p>
                    <p className="text-orange-300/80 text-xs mt-1">
                      This is a demonstration system. Always use official aviation authorities for flight planning.
                    </p>
                  </div>
                </div>
              }
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
        </div>
      </header>

      {/* Yellow Accent Bar */}
      <div className="h-1 flex-shrink-0" style={{ backgroundColor: '#fee000ff' }}></div>

      {/* App Update Notifier */}
      <AppUpdateNotifier />

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

      {/* Main Content: Split Screen Layout for Landscape, Tab-switched for Mobile */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map Section - Always visible on desktop, tab-controlled on mobile */}
        <div 
          className="flex-1 relative min-w-0 md:flex-[0_0_55%] md:max-w-[55%]"
          style={!isDesktop && mobileActiveTab !== 'map' ? { display: 'none' } : undefined}
        >
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
                selectedAirport={selectedAirport}
              />
            </div>
          )}
        </div>

        {/* Right Panel - Always visible on desktop, tab-controlled on mobile */}
        {!mapFullscreen && (
          <div 
            key="right-panel" 
            className={`md:w-[45%] md:min-w-[400px] md:max-w-[45%] bg-slate-800/95 backdrop-blur-sm md:border-l border-slate-700/50 flex-col overflow-hidden ${
              isDesktop || mobileActiveTab === 'planning' ? 'flex flex-1' : 'hidden'
            }`} 
            style={{ zIndex: 1000, paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Scrollable Content Area */}
            <div 
              ref={scrollContainerRef} 
              className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 pb-20 md:pb-24"
              style={{ scrollPaddingBottom: '80px' }}
              onScroll={(e) => {
                const target = e.currentTarget;
                if (!isRestoringRef.current) {
                  scrollPositionRef.current = target.scrollTop;
                  lastUserScrollTimeRef.current = Date.now();
                }
              }}
            >
              {/* ETA Selector - Sticky at top, acts as mode switch */}
              {selectedAirport && (
                <div className="sticky top-0 z-10 bg-slate-800 rounded-lg border border-slate-700 p-3 shadow-lg">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Select Arrival Time ({selectedAirport} local)</h3>
                  <ETASelector
                    airportCode={selectedAirport}
                    selectedTime={selectedTime}
                    onTimeChange={setSelectedTime}
                    maxHoursAhead={24}
                    baseline={baseline}
                    tafCategory={tafCategory}
                    metarCategory={metarCategory}
                    weather={airportOverview?.weather}
                    summary={summary}
                  />
                </div>
              )}

              {/* Mode-aware content layout */}
              {(() => {
                const isNowMode = Math.abs(selectedTime.getTime() - Date.now()) < 60000;
                
                const arrivalTimelineContent = (
                  <ArrivalTimeline
                    arrivals={arrivals || []}
                    airportCode={selectedAirport || ''}
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
                );

                // UNIFIED LAYOUT: Same structure for NOW and FUTURE
                return (
                  <div className="space-y-3">
                    {/* Situation Overview - Always at top, adapts to time selection */}
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
                      arrivalForecast={arrivalForecast}
                    />

                    {/* Traffic Forecast - Collapsible */}
                    {selectedAirport && baseline && (() => {
                      const now = new Date();
                      const isNowMode = Math.abs(selectedTime.getTime() - now.getTime()) < 60000;
                      
                      const timeLabel = isNowMode 
                        ? 'Now'
                        : isUTC
                          ? `at ${selectedTime.getUTCHours().toString().padStart(2, '0')}:${selectedTime.getUTCMinutes().toString().padStart(2, '0')}Z`
                          : (() => {
                              if (!selectedAirport) {
                                const hours = selectedTime.getUTCHours();
                                const minutes = selectedTime.getUTCMinutes();
                                return `at ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                              }
                              const localTime = utcToAirportLocal(selectedTime, selectedAirport, baseline);
                              return `at ${localTime.getUTCHours().toString().padStart(2, '0')}:${localTime.getUTCMinutes().toString().padStart(2, '0')}`;
                            })();
                      
                      // Get airport-specific traffic thresholds
                      const currentAirport = airports.find(a => a.id === selectedAirport);
                      const thresholds = currentAirport?.trafficThresholds || { heavy: 30, light: 15 };
                      
                      const trafficSummary = (() => {
                        if (!arrivalForecast || arrivalForecast.arrivalCounts.length === 0) {
                          return 'Loading traffic forecast...';
                        }
                        
                        // Helper functions
                        const getUTCOffsetHours = (airportCode: string, date: Date, baseline: any) => {
                          const offsets: Record<string, { winter: number; summer: number }> = {
                            'KORD': { winter: -6, summer: -5 },
                            'ORD': { winter: -6, summer: -5 },
                            'KLGA': { winter: -5, summer: -4 },
                            'LGA': { winter: -5, summer: -4 },
                            'KJFK': { winter: -5, summer: -4 },
                            'JFK': { winter: -5, summer: -4 },
                            'KLAX': { winter: -8, summer: -7 },
                            'LAX': { winter: -8, summer: -7 },
                            'KSFO': { winter: -8, summer: -7 },
                            'SFO': { winter: -8, summer: -7 },
                          };
                          const offset = offsets[airportCode] || { winter: -6, summer: -5 };
                          if (!baseline?.dstDatesByYear) return offset.winter;
                          const year = date.getUTCFullYear();
                          const dstDates = baseline.dstDatesByYear[year];
                          if (!dstDates) return offset.winter;
                          const dstStart = new Date(dstDates.start);
                          const dstEnd = new Date(dstDates.end);
                          return (date >= dstStart && date < dstEnd) ? offset.summer : offset.winter;
                        };
                        
                        const getAirportLocalDateString = (date: Date) => {
                          const offset = getUTCOffsetHours(selectedAirport, date, baseline);
                          const localDate = new Date(date.getTime() + offset * 60 * 60 * 1000);
                          const year = localDate.getUTCFullYear();
                          const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
                          const day = String(localDate.getUTCDate()).padStart(2, '0');
                          return `${year}-${month}-${day}`;
                        };
                        
                        const getDayOfWeek = (dateStr: string) => {
                          const date = new Date(dateStr + 'T00:00:00Z');
                          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                          return days[date.getUTCDay()];
                        };
                        
                        const getSeason = (date: Date) => {
                          const offset = getUTCOffsetHours(selectedAirport, date, baseline);
                          const localDate = new Date(date.getTime() + offset * 60 * 60 * 1000);
                          const month = localDate.getUTCMonth();
                          return (month >= 3 && month <= 9) ? 'summer' : 'winter';
                        };
                        
                        // Always get local time slot for matching forecast data (forecast uses local time slots)
                        const getTimeSlot = (date: Date) => {
                          const offset = getUTCOffsetHours(selectedAirport, date, baseline);
                          const localTime = new Date(date.getTime() + offset * 60 * 60 * 1000);
                          const hours = localTime.getUTCHours();
                          const minutes = localTime.getUTCMinutes();
                          const slotMinutes = Math.floor(minutes / 15) * 15;
                          return `${String(hours).padStart(2, '0')}:${String(slotMinutes).padStart(2, '0')}`;
                        };
                        
                        // Convert local time slot to UTC time slot for display
                        const getUTCTimeSlot = (date: Date) => {
                          const hours = date.getUTCHours();
                          const minutes = date.getUTCMinutes();
                          const slotMinutes = Math.floor(minutes / 15) * 15;
                          return `${String(hours).padStart(2, '0')}:${String(slotMinutes).padStart(2, '0')}`;
                        };
                        
                        const getTimeSlotRange = (timeSlot: string, displayDate?: Date) => {
                          let displayTimeSlot = timeSlot;
                          
                          // If UTC mode and we have a date, convert the local time slot to UTC for display
                          if (isUTC && displayDate) {
                            displayTimeSlot = getUTCTimeSlot(displayDate);
                          }
                          
                          const [hours, minutes] = displayTimeSlot.split(':').map(Number);
                          const endMinutes = minutes + 15;
                          const endHours = endMinutes >= 60 ? hours + 1 : hours;
                          const finalEndMinutes = endMinutes >= 60 ? endMinutes - 60 : endMinutes;
                          const endHoursStr = endHours >= 24 ? String(endHours - 24).padStart(2, '0') : String(endHours).padStart(2, '0');
                          const endMinutesStr = String(finalEndMinutes).padStart(2, '0');
                          return `${displayTimeSlot} - ${endHoursStr}:${endMinutesStr}`;
                        };
                        
                        const getDateString = (date: Date) => {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          return `${year}-${month}-${day}`;
                        };
                        
                        const referenceTime = selectedTime;
                        // Always use local date string for matching forecast data (forecast uses local dates)
                        // But display times in UTC when isUTC is true
                        const selectedDateStr = getAirportLocalDateString(referenceTime);
                        const offset = getUTCOffsetHours(selectedAirport, referenceTime, baseline);
                        const referenceLocal = new Date(referenceTime.getTime() + offset * 60 * 60 * 1000);
                        const referenceLocalTime = new Date(
                          referenceLocal.getUTCFullYear(),
                          referenceLocal.getUTCMonth(),
                          referenceLocal.getUTCDate(),
                          referenceLocal.getUTCHours(),
                          referenceLocal.getUTCMinutes(),
                          0,
                          0
                        );
                        const oneHourFromReference = new Date(referenceLocalTime.getTime() + 60 * 60 * 1000);
                        
                        let nextHourCount = 0;
                        let hasForecastData = false;
                        
                        // Sum up FAA forecast data for next hour (filtered by date)
                        arrivalForecast.timeSlots.forEach((slot, idx) => {
                          // Require slotDates to properly match slots
                          if (!arrivalForecast.slotDates || !arrivalForecast.slotDates[idx]) {
                            return;
                          }
                          
                          // Check if this slot matches the selected date
                          const slotDateStr = arrivalForecast.slotDates[idx];
                          if (slotDateStr !== selectedDateStr) {
                            return;
                          }
                          
                          const [hours, minutes] = slot.split(':').map(Number);
                          
                          // Construct slot date using the actual date from slotDates
                          const [year, month, day] = slotDateStr.split('-').map(Number);
                          const slotDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
                          
                          // Check if slot is within the next hour window
                          if (slotDate.getTime() >= referenceLocalTime.getTime() && 
                              slotDate.getTime() < oneHourFromReference.getTime()) {
                            const count = arrivalForecast.arrivalCounts[idx];
                            if (count !== null && count !== undefined) {
                              nextHourCount += count;
                              hasForecastData = true;
                            }
                          }
                        });
                        
                        // If no FAA forecast data for this time, fall back to baseline day-of-week average
                        if (!hasForecastData && baseline) {
                          const dateStr = getAirportLocalDateString(referenceTime);
                          const dayOfWeek = getDayOfWeek(dateStr);
                          const season = getSeason(referenceTime);
                          const seasonalData = baseline[season];
                          const dayData = seasonalData?.dayOfWeekTimeSlots?.[dayOfWeek];
                          
                          if (dayData) {
                            // Sum up baseline averages for the next hour
                            const offset = getUTCOffsetHours(selectedAirport, referenceTime, baseline);
                            const localTime = new Date(referenceTime.getTime() + offset * 60 * 60 * 1000);
                            const localHours = localTime.getUTCHours();
                            const localMinutes = localTime.getUTCMinutes();
                            
                            // Look at all 15-minute slots in the next hour
                            for (let i = 0; i < 4; i++) {
                              const slotMinutes = Math.floor(localMinutes / 15) * 15 + (i * 15);
                              let slotHours = localHours;
                              let finalMinutes = slotMinutes;
                              
                              if (slotMinutes >= 60) {
                                slotHours++;
                                finalMinutes = slotMinutes - 60;
                              }
                              if (slotHours >= 24) slotHours -= 24;
                              
                              const timeSlot = `${String(slotHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
                              const slotData = dayData[timeSlot];
                              
                              if (slotData && (slotData.averageCount || slotData.averageArrivals)) {
                                nextHourCount += (slotData.averageCount || slotData.averageArrivals);
                              }
                            }
                          }
                        }
                        
                        // Determine traffic level using airport-specific thresholds
                        // Heavy: >= heavy threshold (e.g., >= 80)
                        // Light: < light threshold (e.g., < 40)
                        // Moderate: >= light threshold and < heavy threshold (e.g., 40-79)
                        let trafficLevel = 'Moderate';
                        if (nextHourCount >= thresholds.heavy) trafficLevel = 'Heavy';
                        else if (nextHourCount < thresholds.light) trafficLevel = 'Light';
                        
                        const timePhrase = isNowMode ? 'next hour' : 'following hour';
                        const dataSource = hasForecastData ? ' (flight plans)' : ' (baseline avg)';
                        
                        // Calculate expected arrivals for the specific 15-minute timeslot
                        let timeslotArrivals: number | null = null;
                        const timeslot = getTimeSlot(referenceTime);
                        
                        // Try to get forecast data first
                        if (arrivalForecast && arrivalForecast.timeSlots) {
                          const slotIndex = arrivalForecast.timeSlots.findIndex((slot, idx) => {
                            const slotMatches = slot === timeslot;
                            const dateMatches = !arrivalForecast.slotDates || arrivalForecast.slotDates[idx] === selectedDateStr;
                            return slotMatches && dateMatches;
                          });
                          
                          if (slotIndex >= 0 && arrivalForecast.arrivalCounts[slotIndex] !== null && arrivalForecast.arrivalCounts[slotIndex] !== undefined) {
                            timeslotArrivals = arrivalForecast.arrivalCounts[slotIndex];
                          }
                        }
                        
                        // Fall back to baseline if no forecast data
                        if (timeslotArrivals === null && baseline) {
                          const dateStr = getAirportLocalDateString(referenceTime);
                          const dayOfWeek = getDayOfWeek(dateStr);
                          const season = getSeason(referenceTime);
                          const seasonalData = baseline[season];
                          const dayData = seasonalData?.dayOfWeekTimeSlots?.[dayOfWeek];
                          
                          if (dayData && dayData[timeslot]) {
                            const slotData = dayData[timeslot];
                            timeslotArrivals = slotData.averageCount || slotData.averageArrivals || null;
                          }
                        }
                        
                        const summaryLine1 = `${trafficLevel}: ${Math.round(nextHourCount)} arrivals expected ${timePhrase}${dataSource}`;
                        const summaryLine2 = timeslotArrivals !== null 
                          ? `${Math.round(timeslotArrivals)} arrivals during the ${getTimeSlotRange(timeslot, referenceTime)} timeslot.`
                          : null;
                        
                        if (summaryLine2) {
                          return (
                            <>
                              <div>{summaryLine1}</div>
                              <div>{summaryLine2}</div>
                            </>
                          );
                        }
                        return summaryLine1;
                      })();
                      
                      return (
                        <CollapsibleCard
                          key={`traffic-${selectedAirport}`}
                          title={`Arrival Traffic (${timeLabel})`}
                          icon={TrendingUp}
                          summary={trafficSummary}
                          defaultExpanded={false}
                        >
                          <TimeBasedGraphs
                            baseline={baseline}
                            arrivalForecast={arrivalForecast}
                            airportCode={selectedAirport}
                            selectedTime={selectedTime}
                            loading={baselineLoading || arrivalForecastLoading || loading}
                          />
                        </CollapsibleCard>
                      );
                    })()}

                    {/* Arrival Timeline - Collapsible */}
                    {selectedAirport && (() => {
                      const now = new Date();
                      const isNowMode = Math.abs(selectedTime.getTime() - now.getTime()) < 60000;
                      
                      const timeLabel = isNowMode 
                        ? 'Now'
                        : isUTC
                          ? `at ${selectedTime.getUTCHours().toString().padStart(2, '0')}:${selectedTime.getUTCMinutes().toString().padStart(2, '0')}Z`
                          : (() => {
                              if (!selectedAirport) {
                                const hours = selectedTime.getUTCHours();
                                const minutes = selectedTime.getUTCMinutes();
                                return `at ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                              }
                              const localTime = utcToAirportLocal(selectedTime, selectedAirport, baseline);
                              return `at ${localTime.getUTCHours().toString().padStart(2, '0')}:${localTime.getUTCMinutes().toString().padStart(2, '0')}`;
                            })();
                      
                      const arrivalsSummary = (() => {
                        if (isNowMode) {
                          if (!arrivals || arrivals.length === 0) {
                            return 'No recent arrivals in last 15 minutes';
                          }
                          
                          const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
                          const recentArrivals = arrivals.filter(arrival => {
                            const landingTime = new Date(arrival.timestampLanding).getTime();
                            return landingTime >= fifteenMinutesAgo;
                          });
                          
                          if (recentArrivals.length === 0) {
                            return 'No recent arrivals in last 15 minutes';
                          }
                          
                          const durations = recentArrivals
                            .map(a => a.durationMinutes)
                            .sort((a, b) => a - b);
                          const median = durations[Math.floor(durations.length / 2)];
                          
                          return `Median arrival time: ${Math.round(median)}min from 50nm (${recentArrivals.length} recent)`;
                        } else {
                          if (!matchedDaysData?.aggregatedStats) {
                            return 'Loading historical data...';
                          }
                          
                          const stats = matchedDaysData.aggregatedStats;
                          const baselineMinutes = matchedDaysData.baselineMinutes || 0;
                          const typical = stats.p50 || 0;
                          const extended = stats.p90 || 0;
                          const extreme = stats.p95 || 0;
                          
                          const typicalAboveBaseline = typical - baselineMinutes;
                          const isDelayed = typicalAboveBaseline > 5;
                          
                          const delayNote = isDelayed 
                            ? ` (${Math.round(typicalAboveBaseline)}min longer than usual)`
                            : '';
                          
                          return `Typical: ${Math.round(typical)}min, Extended: ${Math.round(extended)}min, Extreme: ${Math.round(extreme)}min${delayNote}`;
                        }
                      })();
                      
                      return (
                        <CollapsibleCard
                          title={`Arrival Durations (${timeLabel})`}
                          icon={PlaneIcon}
                          summary={arrivalsSummary}
                          defaultExpanded={false}
                        >
                          {isNowMode ? (
                            <div className="mb-4 pb-3 border-b border-slate-600/50">
                              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                <Sliders className="w-4 h-4 text-blue-400" />
                                <p className="text-sm text-gray-300">
                                  <span className="text-blue-400 font-medium">Explore ETAs:</span> Use the main time slider above to see arrival durations for different times and weather scenarios.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="mb-4 pb-3 border-b border-slate-600/50">
                              <WeatherScenarioToggle
                                isManual={isManualWeather}
                                onManualChange={setIsManualWeather}
                                manualCategory={weatherCategory}
                                onCategoryChange={setWeatherCategory}
                                tafCategory={tafCategory}
                              />
                            </div>
                          )}
                          {arrivalTimelineContent}
                          {matchedDaysLoading && (
                            <div className="mt-2 text-center text-sm text-gray-400">
                              Loading historical data...
                            </div>
                          )}
                        </CollapsibleCard>
                      );
                    })()}

                    {/* FAA NAS Status - Always visible */}
                    {selectedAirport && (
                      <FAAStatus airportId={selectedAirport} />
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Tab Bar - Only visible on narrow screens */}
      <div className="md:hidden flex items-center justify-around bg-slate-800 border-t border-slate-700 px-4 py-2 safe-area-bottom" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => setMobileActiveTab('map')}
          className={`flex flex-col items-center gap-1 px-6 py-1.5 rounded-lg transition-colors ${
            mobileActiveTab === 'map' 
              ? 'bg-blue-500/20 text-blue-400' 
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Map className="w-5 h-5" />
          <span className="text-[10px] font-medium">Map</span>
        </button>
        <button
          onClick={() => setMobileActiveTab('planning')}
          className={`flex flex-col items-center gap-1 px-6 py-1.5 rounded-lg transition-colors ${
            mobileActiveTab === 'planning' 
              ? 'bg-blue-500/20 text-blue-400' 
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Planning</span>
        </button>
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
      <div className={`absolute left-0 top-0 bottom-14 md:bottom-0 w-80 max-w-[85vw] bg-slate-800/95 backdrop-blur-sm border-r border-slate-700/50 
                      transform transition-transform duration-200 ease-in-out ${showPirepPanel ? 'translate-x-0' : '-translate-x-full'
        }`} style={{ zIndex: 1000 }}>
        <div className="p-2 sm:p-3 h-full">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-gray-300">PIREPs</h3>
              <HelpButton
                title="Pilot Reports (PIREPs)"
                size="sm"
                content={
                  <div className="space-y-2">
                    <p>
                      Real-time pilot weather reports extracted from ATC communications using AI.
                    </p>
                    <p>
                      <strong className="text-red-400">🔴 Urgent:</strong> Critical conditions (severe turbulence, icing)
                    </p>
                    <p>
                      <strong className="text-yellow-400">🟡 High:</strong> Significant conditions (moderate turbulence, icing)
                    </p>
                    <p>
                      <strong className="text-blue-400">🔵 Normal:</strong> Standard reports (smooth ride, light chop)
                    </p>
                    <div className="bg-orange-900/30 border border-orange-500/50 rounded p-2 mt-2">
                      <p className="text-orange-200 text-xs">
                        ⚠️ These are AI-extracted from ATC audio and are NOT official FAA PIREPs.
                      </p>
                    </div>
                    <p className="text-blue-300">
                      💡 PIREPs are shown on the map with their approximate location.
                    </p>
                  </div>
                }
              />
              {selectedAirport === 'KDEN' && (
                <span className="px-1.5 py-0.5 bg-orange-600 text-white text-xs rounded-full font-medium">
                  STORM DEMO
                </span>
              )}
            </div>
            <button
              onClick={() => setShowPirepPanel(false)}
              className="p-1 rounded transition-colors"
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
      {!showPirepPanel && mobileActiveTab === 'map' && (
        <button
          onClick={() => setShowPirepPanel(true)}
          className={`absolute left-2 bottom-16 md:bottom-4 px-3 py-2 rounded-lg 
                   transition-colors flex items-center space-x-2 backdrop-blur-sm border
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
      {selectedAirport === 'KDEN' && !showPirepPanel && mobileActiveTab === 'map' && (
        <button
          className="absolute left-2 bottom-16 md:bottom-4 ml-32 px-3 py-2 rounded-lg 
                   bg-orange-600/90 transition-colors flex items-center space-x-2 
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

      <FeedbackButton 
        appVersion="0.1.0"
        airportContext={selectedAirport || undefined}
      />

    </div>
  );
}
