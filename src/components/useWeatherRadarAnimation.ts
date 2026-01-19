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
}

export function useWeatherRadarAnimation({
  mapInstance,
  displayOptions,
  weatherLayers,
  layerGroupsRef,
  mapRef,
  setActiveWeatherLayers,
  airportCode,
  baseline
}: UseWeatherRadarAnimationProps) {
  const [radarFrames, setRadarFrames] = useState<WeatherRadarFrame[]>([]);
  const [currentRadarFrameIndex, setCurrentRadarFrameIndex] = useState(0);
  const radarAnimationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const radarOverlaysRef = useRef<L.ImageOverlay[]>([]);
  const radarBlobUrlsRef = useRef<string[]>([]);
  const radarTimeIndicatorRef = useRef<HTMLDivElement | null>(null);
  const radarFramesRef = useRef<WeatherRadarFrame[]>([]);
  const fadeAnimationFrameRef = useRef<number | null>(null);
  const frameIndexRef = useRef<number>(0);
  const previousAirportCodeRef = useRef<string | null | undefined>(undefined);
  const [layerGroupReady, setLayerGroupReady] = useState(false);

  const startAnimation = useCallback(() => {
    if (radarOverlaysRef.current.length <= 1) return;
    
    if (radarAnimationIntervalRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clearTimeout(radarAnimationIntervalRef.current as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clearInterval(radarAnimationIntervalRef.current as any);
      radarAnimationIntervalRef.current = null;
    }
    if (fadeAnimationFrameRef.current !== null) {
      cancelAnimationFrame(fadeAnimationFrameRef.current);
      fadeAnimationFrameRef.current = null;
    }

    const animateFrame = () => {
      if (!displayOptions.showWeatherRadar) {
        if (radarAnimationIntervalRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          clearTimeout(radarAnimationIntervalRef.current as any);
          radarAnimationIntervalRef.current = null;
        }
        if (fadeAnimationFrameRef.current !== null) {
          cancelAnimationFrame(fadeAnimationFrameRef.current);
          fadeAnimationFrameRef.current = null;
        }
        return;
      }

      const overlays = radarOverlaysRef.current;
      if (overlays.length === 0) {
        return;
      }
      
      if (frameIndexRef.current === overlays.length - 1) {
        frameIndexRef.current = 0;
      } else {
        frameIndexRef.current = frameIndexRef.current + 1;
      }
      
      setCurrentRadarFrameIndex(frameIndexRef.current);

      const currentOverlay = overlays[frameIndexRef.current];
      const previousIndex = frameIndexRef.current === 0 ? overlays.length - 1 : frameIndexRef.current - 1;
      const previousOverlay = overlays[previousIndex];
      
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

      if (radarTimeIndicatorRef.current && radarFramesRef.current[frameIndexRef.current]) {
        const frameTime = airportCode 
          ? formatAirportLocalTimeShort(radarFramesRef.current[frameIndexRef.current].timestampISO || new Date(radarFramesRef.current[frameIndexRef.current].timestamp).toISOString(), airportCode, baseline || undefined)
          : new Date(radarFramesRef.current[frameIndexRef.current].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        radarTimeIndicatorRef.current.textContent = `Radar: ${frameTime}`;
      }
      
      const isLastFrame = frameIndexRef.current === overlays.length - 1;
      const delay = isLastFrame ? 3000 : 300;
      
      if (radarAnimationIntervalRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clearTimeout(radarAnimationIntervalRef.current as any);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      radarAnimationIntervalRef.current = setTimeout(animateFrame, delay) as any;
    };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    radarAnimationIntervalRef.current = setTimeout(animateFrame, 200) as any;
  }, [displayOptions.showWeatherRadar, airportCode, baseline]);

  useEffect(() => {
    const airportChanged = previousAirportCodeRef.current !== undefined && 
                          previousAirportCodeRef.current !== airportCode;
    
    if (airportChanged) {
      if (radarOverlaysRef.current.length > 0 && layerGroupsRef.current?.weather) {
        radarOverlaysRef.current.forEach(overlay => {
          try {
            if (layerGroupsRef.current?.weather) {
              layerGroupsRef.current.weather.removeLayer(overlay);
            }
            if (mapInstance && mapInstance.hasLayer(overlay)) {
              mapInstance.removeLayer(overlay);
            }
          } catch {
          }
        });
        radarOverlaysRef.current = [];
      }
      
      radarBlobUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch {
        }
      });
      radarBlobUrlsRef.current = [];

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
      frameIndexRef.current = 0;
      setCurrentRadarFrameIndex(0);
    }
    
    previousAirportCodeRef.current = airportCode;

    if (!mapInstance || !layerGroupsRef.current?.weather) {
      if (layerGroupReady) {
        setLayerGroupReady(false);
      }
      if (mapInstance && displayOptions.showWeatherRadar) {
        let retryCount = 0;
        const maxRetries = 20;
        const retryInterval = 100;
        
        const retryCheck = setInterval(() => {
          retryCount++;
          if (layerGroupsRef.current?.weather) {
            clearInterval(retryCheck);
            setLayerGroupReady(true);
          } else if (retryCount >= maxRetries) {
            clearInterval(retryCheck);
            console.warn('[WeatherRadarAnimation] Layer group not ready after retries');
          }
        }, retryInterval);
        
        return () => {
          clearInterval(retryCheck);
        };
      }
      return;
    }

    if (!layerGroupReady) {
      setLayerGroupReady(true);
    }

    const updateWeatherRadar = async () => {
      if (!displayOptions.showWeatherRadar) {
        if (layerGroupsRef.current?.weather) {
          setActiveWeatherLayers(prev => {
            const newMap = new Map(prev);
            newMap.delete('radar');
            return newMap;
          });
        }

        if (radarOverlaysRef.current.length > 0 && layerGroupsRef.current?.weather) {
          radarOverlaysRef.current.forEach(overlay => {
            try {
                if (layerGroupsRef.current?.weather) {
                  layerGroupsRef.current.weather.removeLayer(overlay);
                }
                if (mapInstance && mapInstance.hasLayer(overlay)) {
                  mapInstance.removeLayer(overlay);
                }
            } catch {
              // Layer might already be removed, ignore
            }
          });
          radarOverlaysRef.current = [];
        }
        
        radarBlobUrlsRef.current.forEach(url => {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // Ignore errors
          }
        });
        radarBlobUrlsRef.current = [];

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
        return;
      }

      const radarLayer = weatherLayers.find(layer => layer.id === 'radar') ||
                        weatherLayers.find(layer => layer.id === 'radar_composite');

      if (radarLayer) {
        try {
          const frames = await weatherService.getWeatherRadarAnimation();

          if (!Array.isArray(frames)) {
            console.error('[WeatherRadarAnimation] Invalid frames format:', frames);
            return;
          }

          if (frames.length === 0) {
            console.warn('[WeatherRadarAnimation] No radar animation frames available');
            return;
          }

          const existingFrames = radarFramesRef.current;
          const existingTimestamps = existingFrames.map(f => f.timestamp).sort();
          const newTimestamps = frames.map(f => f.timestamp).sort();

          const framesUnchanged = existingFrames.length === frames.length &&
            existingTimestamps.length === newTimestamps.length &&
            existingTimestamps.every((ts, i) => ts === newTimestamps[i]);

          if (framesUnchanged && radarOverlaysRef.current.length > 0) {
            // Always restart animation when frames are unchanged to ensure it keeps running
            // The cleanup function clears it when dependencies change, so we need to restart it
            if (radarOverlaysRef.current.length > 1) {
              startAnimation();
            }
            
            return;
          }

          if (radarOverlaysRef.current.length > 0 && layerGroupsRef.current.weather) {
            radarOverlaysRef.current.forEach(overlay => {
              try {
                layerGroupsRef.current.weather?.removeLayer(overlay);
              } catch {
                // Ignore
              }
            });
            radarOverlaysRef.current = [];
          }
          
          radarBlobUrlsRef.current.forEach(url => {
            try {
              URL.revokeObjectURL(url);
            } catch {
              // Ignore
            }
          });
          radarBlobUrlsRef.current = [];

          setRadarFrames(frames);
          radarFramesRef.current = frames;
          frameIndexRef.current = 0;
          setCurrentRadarFrameIndex(0);

          const bounds: [[number, number], [number, number]] = [
            [20, -130],
            [50, -60]
          ];

          console.log(`[WeatherRadarAnimation] Preloading ${frames.length} radar frames as overlays...`);

          const overlayPromises = frames.map(async (frame, index) => {
            const base64Data = frame.imageData.replace(/^data:image\/\w+;base64,/, '');
            const blob = new Blob([Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))], { type: 'image/png' });
            const blobUrl = URL.createObjectURL(blob);
            radarBlobUrlsRef.current.push(blobUrl);

            return new Promise<L.ImageOverlay>((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              const cleanup = () => {
                const urlIndex = radarBlobUrlsRef.current.indexOf(blobUrl);
                if (urlIndex !== -1) {
                  radarBlobUrlsRef.current.splice(urlIndex, 1);
                }
                try {
                  URL.revokeObjectURL(blobUrl);
                } catch {
                }
              };
              
              img.onload = () => {
                if (!layerGroupsRef.current?.weather) {
                  cleanup();
                  reject(new Error(`Weather layer group not available for frame ${index}`));
                  return;
                }
                
                const overlay = L.imageOverlay(blobUrl, bounds, {
                  opacity: index === 0 ? 0.3 : 0,
                  interactive: false,
                  crossOrigin: 'anonymous',
                  alt: 'NOAA Weather Radar',
                  pane: 'overlayPane'
                });
                
                try {
                  layerGroupsRef.current.weather.addLayer(overlay);
                  overlay.bringToFront();
                  resolve(overlay);
                } catch (error) {
                  cleanup();
                  reject(new Error(`Failed to add overlay for frame ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`));
                }
              };
              
              img.onerror = (error) => {
                cleanup();
                const errorMsg = `Failed to load frame ${index}`;
                console.warn(`[WeatherRadarAnimation] ${errorMsg}`, error);
                reject(new Error(errorMsg));
              };
              
              try {
                img.src = blobUrl;
              } catch (error) {
                cleanup();
                reject(new Error(`Failed to set image source for frame ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`));
              }
            });
          });

          const overlayResults = await Promise.allSettled(overlayPromises);
          const overlays: L.ImageOverlay[] = [];
          const errors: Error[] = [];
          
          overlayResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              overlays.push(result.value);
            } else {
              errors.push(result.reason instanceof Error ? result.reason : new Error(`Frame ${index} failed: ${String(result.reason)}`));
            }
          });
          
          if (errors.length > 0) {
            console.warn(`[WeatherRadarAnimation] ${errors.length} of ${frames.length} radar frames failed to load:`, errors);
          }
          
          if (overlays.length === 0) {
            console.error('[WeatherRadarAnimation] No radar overlays could be loaded');
            return;
          }
          
          radarOverlaysRef.current = overlays;

          console.log(`[WeatherRadarAnimation] ✅ All ${overlays.length} radar overlays preloaded`);

          // Check if time indicator exists and is still in the DOM
          const timeIndicatorExists = radarTimeIndicatorRef.current && 
                                     mapRef.current && 
                                     mapRef.current.contains(radarTimeIndicatorRef.current);

          if (!timeIndicatorExists && mapRef.current) {
            // Remove old indicator if it exists but is not in DOM
            if (radarTimeIndicatorRef.current) {
              try {
                radarTimeIndicatorRef.current.remove();
              } catch {
                // Element already removed, ignore
              }
              radarTimeIndicatorRef.current = null;
            }

            // Create new time indicator
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
            const frameTime = airportCode 
              ? formatAirportLocalTimeShort(frames[0].timestampISO || new Date(frames[0].timestamp).toISOString(), airportCode, baseline || undefined)
              : new Date(frames[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timeIndicatorDiv.textContent = `Radar: ${frameTime}`;
            mapRef.current.appendChild(timeIndicatorDiv);
            radarTimeIndicatorRef.current = timeIndicatorDiv;
          } else if (radarTimeIndicatorRef.current && timeIndicatorExists) {
            // Update existing indicator
            const frameTime = airportCode 
              ? formatAirportLocalTimeShort(frames[0].timestampISO || new Date(frames[0].timestamp).toISOString(), airportCode, baseline || undefined)
              : new Date(frames[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            radarTimeIndicatorRef.current.textContent = `Radar: ${frameTime}`;
          }

          // Special handling for single frame - show it statically without animation
          if (overlays.length === 1) {
            const singleOverlay = overlays[0];
            singleOverlay.setOpacity(0.3);
            frameIndexRef.current = 0;
            setCurrentRadarFrameIndex(0);
            
            if (radarTimeIndicatorRef.current && radarFramesRef.current[0]) {
              const frameTime = airportCode 
                ? formatAirportLocalTimeShort(radarFramesRef.current[0].timestampISO || new Date(radarFramesRef.current[0].timestamp).toISOString(), airportCode, baseline || undefined)
                : new Date(radarFramesRef.current[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              radarTimeIndicatorRef.current.textContent = `Radar: ${frameTime}`;
            }
            
            // Don't start animation loop for single frame
            return;
          }
          
          startAnimation();

        } catch (error) {
          console.error('[WeatherRadarAnimation] Failed to add animated weather radar:', error);
        }
      } else {
        console.warn('[WeatherRadarAnimation] No radar layer available');
      }
    };

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
  }, [mapInstance, displayOptions.showWeatherRadar, weatherLayers, airportCode, baseline, layerGroupsRef, mapRef, setActiveWeatherLayers, startAnimation, layerGroupReady]);

  useEffect(() => {
    if (!mapInstance || !displayOptions.showWeatherRadar) return;
    if (radarFrames.length === 0) return;

    const refreshInterval = setInterval(async () => {
      try {
        const radarLayer = weatherLayers.find(layer => layer.id === 'radar') || 
                          weatherLayers.find(layer => layer.id === 'radar_composite');
        
        if (!radarLayer) return;

        const frames = await weatherService.getWeatherRadarAnimation();

        if (Array.isArray(frames) && frames.length > 0) {
          const existingTimestamps = radarFramesRef.current.map(f => f.timestamp).sort();
          const newTimestamps = frames.map(f => f.timestamp).sort();
          
          const framesUnchanged = existingTimestamps.length === newTimestamps.length &&
            existingTimestamps.every((ts, i) => ts === newTimestamps[i]);

          if (!framesUnchanged) {
            setRadarFrames([]);
            setTimeout(() => {
              setRadarFrames(frames);
            }, 100);
          }
        }
      } catch (error) {
        console.error('[WeatherRadarAnimation] Failed to refresh radar frames:', error);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [mapInstance, displayOptions.showWeatherRadar, weatherLayers, radarFrames.length]);

  return {
    radarFrames,
    currentRadarFrameIndex
  };
}

