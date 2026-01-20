import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { weatherService } from '../services/weatherService';
import { formatAirportLocalTimeShort } from '../utils/airportTime';
import { BaselineData } from '../types';

interface WeatherRadarFrame {
  timestamp: number;
  timestampISO: string;
  imageData: string;
}

interface UseWeatherRadarAnimationProps {
  mapInstance: L.Map | null;
  displayOptions: { showWeatherRadar: boolean };
  weatherLayers: Array<{ id: string; url?: string; layers?: string; format?: string; transparent?: boolean; opacity?: number }>;
  layerGroupsRef: React.RefObject<Record<string, L.LayerGroup>>;
  mapRef: React.RefObject<HTMLDivElement | null>;
  setActiveWeatherLayers: React.Dispatch<React.SetStateAction<Map<string, L.TileLayer>>>;
  airportCode?: string | null;
  baseline?: BaselineData | null;
  mapReady?: boolean;
}

export function useWeatherRadarAnimation({
  mapInstance,
  displayOptions,
  weatherLayers,
  layerGroupsRef,
  mapRef,
  setActiveWeatherLayers,
  airportCode,
  baseline,
  mapReady = false
}: UseWeatherRadarAnimationProps) {
  const [radarFrames, setRadarFrames] = useState<WeatherRadarFrame[]>([]);
  const [currentRadarFrameIndex, setCurrentRadarFrameIndex] = useState(0);
  const radarAnimationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const radarOverlaysMapRef = useRef<Map<number, L.ImageOverlay>>(new Map());
  const radarTimeIndicatorRef = useRef<HTMLDivElement | null>(null);
  const radarFramesRef = useRef<WeatherRadarFrame[]>([]);
  const fadeAnimationFrameRef = useRef<number | null>(null);
  const currentTimestampRef = useRef<number | null>(null);
  const previousAirportCodeRef = useRef<string | null | undefined>(undefined);
  const isLoadingRef = useRef<boolean>(false);

  const startAnimation = useCallback(() => {
    const sortedTimestamps = Array.from(radarOverlaysMapRef.current.keys()).sort((a, b) => a - b);
    if (sortedTimestamps.length <= 1) return;
    
    if (radarAnimationIntervalRef.current) {
      clearTimeout(radarAnimationIntervalRef.current as any);
      clearInterval(radarAnimationIntervalRef.current as any);
      radarAnimationIntervalRef.current = null;
    }
    if (fadeAnimationFrameRef.current !== null) {
      cancelAnimationFrame(fadeAnimationFrameRef.current);
      fadeAnimationFrameRef.current = null;
    }

    if (currentTimestampRef.current === null) {
      currentTimestampRef.current = sortedTimestamps[0];
    }

    const animateFrame = () => {
      if (!displayOptions.showWeatherRadar) {
        if (radarAnimationIntervalRef.current) {
          clearTimeout(radarAnimationIntervalRef.current as any);
          radarAnimationIntervalRef.current = null;
        }
        if (fadeAnimationFrameRef.current !== null) {
          cancelAnimationFrame(fadeAnimationFrameRef.current);
          fadeAnimationFrameRef.current = null;
        }
        return;
      }

      const sortedTimestamps = Array.from(radarOverlaysMapRef.current.keys()).sort((a, b) => a - b);
      if (sortedTimestamps.length === 0) return;
      
      const currentIndex = sortedTimestamps.indexOf(currentTimestampRef.current!);
      const nextIndex = currentIndex === sortedTimestamps.length - 1 ? 0 : currentIndex + 1;
      const nextTimestamp = sortedTimestamps[nextIndex];
      const previousTimestamp = currentIndex === 0 ? sortedTimestamps[sortedTimestamps.length - 1] : sortedTimestamps[currentIndex - 1];
      
      currentTimestampRef.current = nextTimestamp;
      const currentOverlay = radarOverlaysMapRef.current.get(nextTimestamp);
      const previousOverlay = radarOverlaysMapRef.current.get(previousTimestamp);
      
      if (!currentOverlay) return;

      const frameIndex = radarFramesRef.current.findIndex(f => f.timestamp === nextTimestamp);
      if (frameIndex !== -1) {
        setCurrentRadarFrameIndex(frameIndex);
      }

      const fadeDuration = 400;
      const startTime = performance.now();
      
      const easeInOutCubic = (t: number): number => {
        return t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };
      
      const fadeStep = (currentTime: number) => {
        if (!displayOptions.showWeatherRadar) {
          fadeAnimationFrameRef.current = null;
          return;
        }
        
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / fadeDuration, 1);
        const easedProgress = easeInOutCubic(progress);
        
        if (previousOverlay) {
          const oldOpacity = 0.3 * (1 - easedProgress);
          previousOverlay.setOpacity(oldOpacity);
        }
        
        const newOpacity = 0.3 * easedProgress;
        currentOverlay.setOpacity(newOpacity);
        
        if (progress < 1) {
          fadeAnimationFrameRef.current = requestAnimationFrame(fadeStep);
        } else {
          fadeAnimationFrameRef.current = null;
          currentOverlay.setOpacity(0.3);
          if (previousOverlay) {
            previousOverlay.setOpacity(0);
          }
        }
      };
      
      fadeAnimationFrameRef.current = requestAnimationFrame(fadeStep);

      const currentFrame = radarFramesRef.current.find(f => f.timestamp === nextTimestamp);
      if (radarTimeIndicatorRef.current && currentFrame) {
        const frameTime = airportCode 
          ? formatAirportLocalTimeShort(currentFrame.timestampISO || new Date(currentFrame.timestamp).toISOString(), airportCode, baseline || undefined)
          : new Date(currentFrame.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        radarTimeIndicatorRef.current.textContent = `Radar: ${frameTime}`;
      }
      
      const isLastFrame = nextIndex === sortedTimestamps.length - 1;
      const delay = isLastFrame ? 3000 : 300;
      
      if (radarAnimationIntervalRef.current) {
        clearTimeout(radarAnimationIntervalRef.current as any);
      }
      radarAnimationIntervalRef.current = setTimeout(animateFrame, delay) as any;
    };
    
    radarAnimationIntervalRef.current = setTimeout(animateFrame, 200) as any;
  }, [displayOptions.showWeatherRadar, airportCode, baseline]);

  useEffect(() => {
    const airportChanged = previousAirportCodeRef.current !== undefined && 
                          previousAirportCodeRef.current !== airportCode;
    
    if (airportChanged) {
      isLoadingRef.current = false;
      radarOverlaysMapRef.current.clear();
      if (layerGroupsRef.current?.weather) {
        layerGroupsRef.current.weather.clearLayers();
      }

      if (radarTimeIndicatorRef.current && mapRef.current) {
        radarTimeIndicatorRef.current.remove();
        radarTimeIndicatorRef.current = null;
      }

      if (radarAnimationIntervalRef.current) {
        clearTimeout(radarAnimationIntervalRef.current as any);
        clearInterval(radarAnimationIntervalRef.current as any);
        radarAnimationIntervalRef.current = null;
      }
      if (fadeAnimationFrameRef.current !== null) {
        cancelAnimationFrame(fadeAnimationFrameRef.current);
        fadeAnimationFrameRef.current = null;
      }

      setRadarFrames([]);
      radarFramesRef.current = [];
      currentTimestampRef.current = null;
      setCurrentRadarFrameIndex(0);
    }
    
    previousAirportCodeRef.current = airportCode;

    const updateWeatherRadar = async () => {
      if (!displayOptions.showWeatherRadar) {
        if (layerGroupsRef.current?.weather) {
          setActiveWeatherLayers(prev => {
            const newMap = new Map(prev);
            newMap.delete('radar');
            return newMap;
          });
          radarOverlaysMapRef.current.forEach(overlay => {
            try {
              layerGroupsRef.current?.weather?.removeLayer(overlay);
            } catch {}
          });
          radarOverlaysMapRef.current.clear();
        }

        if (radarTimeIndicatorRef.current && mapRef.current) {
          radarTimeIndicatorRef.current.remove();
          radarTimeIndicatorRef.current = null;
        }

        if (radarAnimationIntervalRef.current) {
          clearInterval(radarAnimationIntervalRef.current);
          radarAnimationIntervalRef.current = null;
        }

        setRadarFrames([]);
        radarFramesRef.current = [];
        currentTimestampRef.current = null;
        return;
      }

      if (!mapInstance || !layerGroupsRef.current?.weather) {
        return;
      }

      const radarLayer = weatherLayers.find(layer => layer.id === 'radar') ||
                        weatherLayers.find(layer => layer.id === 'radar_composite');

      if (!radarLayer || isLoadingRef.current) {
        return;
      }

      isLoadingRef.current = true;
      
      try {
        const frames = await weatherService.getWeatherRadarAnimation();
        isLoadingRef.current = false;

        if (!Array.isArray(frames)) {
          console.error('[WeatherRadarAnimation] Invalid frames format:', frames);
          return;
        }

        if (frames.length === 0) {
          console.warn('[WeatherRadarAnimation] No radar animation frames available');
          return;
        }

        const existingTimestamps = Array.from(radarOverlaysMapRef.current.keys()).sort();
        const newTimestamps = frames.map(f => f.timestamp).sort();
        const framesUnchanged = existingTimestamps.length === newTimestamps.length &&
          existingTimestamps.every((ts, i) => ts === newTimestamps[i]);

        if (framesUnchanged && radarOverlaysMapRef.current.size > 0) {
          const overlaysStillExist = Array.from(radarOverlaysMapRef.current.values()).every(overlay => 
            mapInstance.hasLayer(overlay) && layerGroupsRef.current?.weather?.hasLayer(overlay)
          );
          
          if (overlaysStillExist) {
            if (radarOverlaysMapRef.current.size > 1) {
              startAnimation();
            }
            return;
          }
          radarOverlaysMapRef.current.clear();
        }

        if (radarOverlaysMapRef.current.size > 0) {
          radarOverlaysMapRef.current.forEach(overlay => {
            try {
              layerGroupsRef.current?.weather?.removeLayer(overlay);
            } catch {}
          });
          radarOverlaysMapRef.current.clear();
        }

        setRadarFrames(frames);
        radarFramesRef.current = frames;
        currentTimestampRef.current = frames.length > 0 ? frames[0].timestamp : null;
        setCurrentRadarFrameIndex(0);

        const bounds: [[number, number], [number, number]] = [
          [20, -130],
          [50, -60]
        ];

        for (const frame of frames) {
          try {
            const overlay = L.imageOverlay(frame.imageData, bounds, {
              opacity: frame === frames[0] ? 0.3 : 0,
              interactive: false,
              crossOrigin: 'anonymous',
              alt: 'NOAA Weather Radar',
              pane: 'overlayPane'
            });
            
            if (layerGroupsRef.current?.weather) {
              layerGroupsRef.current.weather.addLayer(overlay);
              overlay.bringToFront();
              radarOverlaysMapRef.current.set(frame.timestamp, overlay);
            }
          } catch (error) {
            console.warn(`[WeatherRadarAnimation] Failed to load frame ${frame.timestamp}:`, error);
          }
        }

        if (radarOverlaysMapRef.current.size === 0) {
          return;
        }

        const formatFrameTime = (frame: WeatherRadarFrame) => {
          return airportCode 
            ? formatAirportLocalTimeShort(frame.timestampISO || new Date(frame.timestamp).toISOString(), airportCode, baseline || undefined)
            : new Date(frame.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };

        const timeIndicatorExists = radarTimeIndicatorRef.current && 
                                   mapRef.current?.contains(radarTimeIndicatorRef.current);

        if (!timeIndicatorExists && mapRef.current) {
          if (radarTimeIndicatorRef.current) {
            try {
              radarTimeIndicatorRef.current.remove();
            } catch {}
            radarTimeIndicatorRef.current = null;
          }

          const timeIndicatorDiv = document.createElement('div');
          timeIndicatorDiv.id = 'radar-time-indicator';
          timeIndicatorDiv.style.cssText = `
            position: absolute;
            top: 10px;
            left: 50px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            border: 1px solid rgba(255, 255, 255, 0.3);
            white-space: nowrap;
            z-index: 1000;
            pointer-events: none;
          `;
          timeIndicatorDiv.textContent = `Radar: ${formatFrameTime(frames[0])}`;
          mapRef.current.appendChild(timeIndicatorDiv);
          radarTimeIndicatorRef.current = timeIndicatorDiv;
        } else if (radarTimeIndicatorRef.current) {
          radarTimeIndicatorRef.current.textContent = `Radar: ${formatFrameTime(frames[0])}`;
        }

        if (radarOverlaysMapRef.current.size === 1) {
          const singleOverlay = Array.from(radarOverlaysMapRef.current.values())[0];
          singleOverlay.setOpacity(0.3);
          currentTimestampRef.current = frames[0].timestamp;
          setCurrentRadarFrameIndex(0);
          
          if (radarTimeIndicatorRef.current && frames[0]) {
            radarTimeIndicatorRef.current.textContent = `Radar: ${formatFrameTime(frames[0])}`;
          }
          return;
        }
        
        startAnimation();

        } catch (error) {
          isLoadingRef.current = false;
          console.error('[WeatherRadarAnimation] Failed to add animated weather radar:', error);
        }
    };

    if (!mapInstance || !mapReady || !displayOptions.showWeatherRadar) {
      return;
    }

    if (!layerGroupsRef.current?.weather) {
      const retryCheck = setInterval(() => {
        if (layerGroupsRef.current?.weather && displayOptions.showWeatherRadar) {
          clearInterval(retryCheck);
          updateWeatherRadar();
        }
      }, 50);
      
      return () => clearInterval(retryCheck);
    }

    updateWeatherRadar();

    return () => {
      if (radarAnimationIntervalRef.current) {
        clearTimeout(radarAnimationIntervalRef.current as any);
        clearInterval(radarAnimationIntervalRef.current as any);
        radarAnimationIntervalRef.current = null;
      }
      if (fadeAnimationFrameRef.current !== null) {
        cancelAnimationFrame(fadeAnimationFrameRef.current);
        fadeAnimationFrameRef.current = null;
      }
    };
  }, [mapInstance, mapReady, displayOptions.showWeatherRadar, weatherLayers, airportCode, baseline, layerGroupsRef, mapRef, setActiveWeatherLayers, startAnimation]);

  useEffect(() => {
    if (!mapInstance || !displayOptions.showWeatherRadar) return;
    if (radarFrames.length === 0) return;
    if (!layerGroupsRef.current?.weather) return;

    const refreshInterval = setInterval(async () => {
      try {
        const radarLayer = weatherLayers.find(layer => layer.id === 'radar') || 
                          weatherLayers.find(layer => layer.id === 'radar_composite');
        
        if (!radarLayer || isLoadingRef.current) return;

        const frames = await weatherService.getWeatherRadarAnimation();

        if (!Array.isArray(frames) || frames.length === 0) {
          return;
        }

        const existingTimestamps = Array.from(radarOverlaysMapRef.current.keys()).sort();
        const newTimestamps = frames.map(f => f.timestamp).sort();
        
        const framesUnchanged = existingTimestamps.length === newTimestamps.length &&
          existingTimestamps.every((ts, i) => ts === newTimestamps[i]);

        if (framesUnchanged) {
          return;
        }

        const existingTimestampSet = new Set(existingTimestamps);
        const newTimestampSet = new Set(newTimestamps);
        
        const framesToRemove = existingTimestamps.filter(ts => !newTimestampSet.has(ts));
        const framesToAdd = frames.filter(f => !existingTimestampSet.has(f.timestamp));

        if (framesToRemove.length > 0) {
          for (const timestamp of framesToRemove) {
            const overlay = radarOverlaysMapRef.current.get(timestamp);
            if (overlay) {
              try {
                layerGroupsRef.current?.weather?.removeLayer(overlay);
              } catch {}
              radarOverlaysMapRef.current.delete(timestamp);
            }
          }
        }

        if (framesToAdd.length > 0) {
          const bounds: [[number, number], [number, number]] = [
            [20, -130],
            [50, -60]
          ];

          for (const frame of framesToAdd) {
            try {
              const overlay = L.imageOverlay(frame.imageData, bounds, {
                opacity: 0,
                interactive: false,
                crossOrigin: 'anonymous',
                alt: 'NOAA Weather Radar',
                pane: 'overlayPane'
              });
              
              if (layerGroupsRef.current?.weather) {
                layerGroupsRef.current.weather.addLayer(overlay);
                overlay.bringToFront();
                radarOverlaysMapRef.current.set(frame.timestamp, overlay);
              }
            } catch (error) {
              console.warn(`[WeatherRadarAnimation] Failed to add new frame ${frame.timestamp}:`, error);
            }
          }

          radarFramesRef.current = frames;
          setRadarFrames(frames);

          if (radarOverlaysMapRef.current.size > 1 && !radarAnimationIntervalRef.current) {
            startAnimation();
          }
        }
      } catch (error) {
        console.error('[WeatherRadarAnimation] Failed to refresh radar frames:', error);
      }
    }, 2 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [mapInstance, displayOptions.showWeatherRadar, weatherLayers, radarFrames.length, layerGroupsRef, startAnimation]);

  return {
    radarFrames,
    currentRadarFrameIndex
  };
}
