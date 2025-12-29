import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { weatherService } from '../services/weatherService';

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
}

export function useWeatherRadarAnimation({
  mapInstance,
  displayOptions,
  weatherLayers,
  layerGroupsRef,
  mapRef,
  setActiveWeatherLayers
}: UseWeatherRadarAnimationProps) {
  const [radarFrames, setRadarFrames] = useState<WeatherRadarFrame[]>([]);
  const [currentRadarFrameIndex, setCurrentRadarFrameIndex] = useState(0);
  const radarAnimationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const radarOverlaysRef = useRef<L.ImageOverlay[]>([]);
  const radarBlobUrlsRef = useRef<string[]>([]);
  const radarTimeIndicatorRef = useRef<HTMLDivElement | null>(null);
  const radarFramesRef = useRef<WeatherRadarFrame[]>([]);

  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current?.weather) return;

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
            } catch (error) {
              // Layer might already be removed, ignore
            }
          });
          radarOverlaysRef.current = [];
        }
        
        radarBlobUrlsRef.current.forEach(url => {
          try {
            URL.revokeObjectURL(url);
          } catch (error) {
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

          if (frames.length === 0) {
            console.warn('[WeatherRadarAnimation] No radar animation frames available');
            return;
          }

          if (radarOverlaysRef.current.length > 0 && layerGroupsRef.current.weather) {
            radarOverlaysRef.current.forEach(overlay => {
              try {
                layerGroupsRef.current.weather?.removeLayer(overlay);
              } catch (error) {
                // Ignore
              }
            });
            radarOverlaysRef.current = [];
          }
          
          radarBlobUrlsRef.current.forEach(url => {
            try {
              URL.revokeObjectURL(url);
            } catch (error) {
              // Ignore
            }
          });
          radarBlobUrlsRef.current = [];

          setRadarFrames(frames);
          radarFramesRef.current = frames;
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
              
              img.onload = () => {
                const overlay = L.imageOverlay(blobUrl, bounds, {
                  opacity: index === 0 ? 0.3 : 0,
                  interactive: false,
                  crossOrigin: 'anonymous',
                  alt: 'NOAA Weather Radar',
                  pane: 'overlayPane'
                });
                
                if (layerGroupsRef.current?.weather) {
                  layerGroupsRef.current.weather.addLayer(overlay);
                  overlay.bringToFront();
                }
                
                resolve(overlay);
              };
              
              img.onerror = () => {
                URL.revokeObjectURL(blobUrl);
                reject(new Error(`Failed to load frame ${index}`));
              };
              
              img.src = blobUrl;
            });
          });

          const overlays = await Promise.all(overlayPromises);
          radarOverlaysRef.current = overlays;

          console.log(`[WeatherRadarAnimation] ✅ All ${overlays.length} radar overlays preloaded`);

          if (!radarTimeIndicatorRef.current && mapRef.current) {
            const timeIndicatorDiv = document.createElement('div');
            timeIndicatorDiv.id = 'radar-time-indicator';
            timeIndicatorDiv.style.cssText = `
              position: absolute;
              top: 10px;
              left: 10px;
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
            timeIndicatorDiv.textContent = `Radar: ${new Date(frames[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            mapRef.current.appendChild(timeIndicatorDiv);
            radarTimeIndicatorRef.current = timeIndicatorDiv;
          } else if (radarTimeIndicatorRef.current) {
            radarTimeIndicatorRef.current.textContent = `Radar: ${new Date(frames[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          }

          let frameIndex = 0;
          
          const animateFrame = () => {
            if (!displayOptions.showWeatherRadar) {
              if (radarAnimationIntervalRef.current) {
                clearTimeout(radarAnimationIntervalRef.current as any);
                radarAnimationIntervalRef.current = null;
              }
              return;
            }

            const overlays = radarOverlaysRef.current;
            if (overlays.length === 0) {
              console.warn('[WeatherRadarAnimation] No overlays available for animation');
              return;
            }
            
            if (frameIndex === overlays.length - 1) {
              frameIndex = 0;
            } else {
              frameIndex = frameIndex + 1;
            }
            
            setCurrentRadarFrameIndex(frameIndex);

            const currentOverlay = overlays[frameIndex];
            const previousIndex = frameIndex === 0 ? overlays.length - 1 : frameIndex - 1;
            const previousOverlay = overlays[previousIndex];
            
            const fadeDuration = 200;
            const steps = 40;
            const stepDelay = fadeDuration / steps;
            
            let step = 0;
            const fadeInterval = setInterval(() => {
              step++;
              const progress = Math.min(step / steps, 1);
              
              const easedProgress = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
              
              if (previousOverlay) {
                const oldOpacity = 0.3 * (1 - easedProgress);
                previousOverlay.setOpacity(oldOpacity);
              }
              
              const newOpacity = 0.3 * easedProgress;
              currentOverlay.setOpacity(newOpacity);
              
              if (step >= steps) {
                clearInterval(fadeInterval);
                
                currentOverlay.setOpacity(0.3);
                if (previousOverlay) {
                  previousOverlay.setOpacity(0);
                }
              }
            }, stepDelay);

            if (radarTimeIndicatorRef.current && radarFramesRef.current[frameIndex]) {
              radarTimeIndicatorRef.current.textContent = `Radar: ${new Date(radarFramesRef.current[frameIndex].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }
            
            const isLastFrame = frameIndex === overlays.length - 1;
            const delay = isLastFrame ? 3000 : 200;
            
            if (radarAnimationIntervalRef.current) {
              clearTimeout(radarAnimationIntervalRef.current as any);
            }
            radarAnimationIntervalRef.current = setTimeout(animateFrame, delay) as any;
          };
          
          radarAnimationIntervalRef.current = setTimeout(animateFrame, 200) as any;

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
      }
      radarBlobUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          // Ignore
        }
      });
      radarBlobUrlsRef.current = [];
    };
  }, [mapInstance, displayOptions.showWeatherRadar, weatherLayers]);

  useEffect(() => {
    if (!mapInstance || !displayOptions.showWeatherRadar) return;
    if (radarFrames.length === 0) return;

    const refreshInterval = setInterval(async () => {
      try {
        const radarLayer = weatherLayers.find(layer => layer.id === 'radar') || 
                          weatherLayers.find(layer => layer.id === 'radar_composite');
        
        if (!radarLayer) return;

        const frames = await weatherService.getWeatherRadarAnimation();

        if (frames.length > 0) {
          setRadarFrames([]);
          setTimeout(() => {
            setRadarFrames(frames);
          }, 100);
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

