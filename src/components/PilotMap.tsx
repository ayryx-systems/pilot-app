'use client';

import React, { useRef, useEffect, useState } from 'react';
import type * as L from 'leaflet';
import { Airport, AirportOverview, PiRep, GroundTrack, MapDisplayOptions, WeatherLayer, AirportOSMFeatures } from '@/types';
import { AIRPORTS } from '@/constants/airports';
import { weatherService } from '@/services/weatherService';
import { pilotOSMService } from '@/services/osmService';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';

interface PilotMapProps {
  airport?: Airport;
  airportData?: AirportOverview;
  pireps: PiRep[];
  tracks: GroundTrack[];
  displayOptions: MapDisplayOptions;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  isDemo?: boolean;
  onWeatherRefresh?: () => void;
  loading?: boolean;
  selectedAirport?: string | null;
}

export function PilotMap({
  airport,
  airportData,
  pireps,
  tracks,
  displayOptions,
  onFullscreenChange,
  isDemo,
  onWeatherRefresh,
  loading,
  selectedAirport
}: PilotMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure consistent rendering between server and client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Weather layers state
  const [weatherLayers, setWeatherLayers] = useState<WeatherLayer[]>([]);
  const [activeWeatherLayers, setActiveWeatherLayers] = useState<Map<string, L.TileLayer>>(new Map());

  // OSM data state
  const [osmData, setOsmData] = useState<AirportOSMFeatures | null>(null);
  const [osmLoading, setOsmLoading] = useState(false);

  // Weather refresh function - works with static overlay
  const refreshWeatherLayer = () => {
    const radarLayer = activeWeatherLayers.get('radar');
    if (radarLayer && mapInstance) {
      console.log('[🌦️ WEATHER API] 🔄 MANUAL REFRESH TRIGGERED - Refreshing static weather image');
      console.log('[🌦️ WEATHER API] 🎉 STATIC MODE: Only 1 API call per refresh (not hundreds!)');

      // For image overlay, we need to update the URL with a cache-busting parameter
      const imageOverlay = radarLayer as any;
      if (imageOverlay._url && imageOverlay.setUrl) {
        const baseUrl = imageOverlay._url.split('&t=')[0]; // Remove old timestamp
        const freshUrl = `${baseUrl}&t=${Date.now()}`; // Add new timestamp
        imageOverlay.setUrl(freshUrl);
        console.log('[🌦️ WEATHER API] 📡 Static weather image URL refreshed');
      }
    } else {
      console.log('[🌦️ WEATHER API] Manual refresh ignored - no active weather layer');
    }
  };

  // Expose refresh function to parent
  useEffect(() => {
    if (onWeatherRefresh) {
      (window as any).refreshWeatherLayer = refreshWeatherLayer;
    }
    return () => {
      if ((window as any).refreshWeatherLayer) {
        delete (window as any).refreshWeatherLayer;
      }
    };
  }, [onWeatherRefresh, activeWeatherLayers, mapInstance]);

  // Layer group references for easy cleanup
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Get airport configuration from constants
  const airportConfig = airport ? AIRPORTS[airport.code] : null;

  // Inject custom CSS for map elements
  useEffect(() => {
    if (!document.getElementById("pilot-map-custom-styles")) {
      const style = document.createElement("style");
      style.id = "pilot-map-custom-styles";
      style.innerHTML = `
        .leaflet-popup-content-wrapper {
          background-color: transparent !important;
          color: white;
          border-radius: 4px;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
        }
        
        .leaflet-popup-tip {
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
          display: none !important;
        }
        
        .leaflet-popup-close-button {
          color: white;
          background: transparent !important;
        }
        
        .leaflet-popup {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        
        .leaflet-popup-content {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        .runway-popup h4 {
          margin: 0 0 4px 0;
          color: #ffffff;
        }
        
        .runway-popup p {
          margin: 2px 0;
          font-size: 12px;
        }
        
        .waypoint-popup h4 {
          margin: 0 0 4px 0;
          color: #8b5cf6;
        }
        
        .pirep-popup {
          min-width: 200px;
        }
        
        /* Ensure PIREP popups render above all map elements */
        .leaflet-popup-pane {
          z-index: 2000 !important;
        }
        
        .leaflet-popup {
          z-index: 2000 !important;
        }
        
        .track-popup h4 {
          margin: 0 0 4px 0;
          color: #ffffff;
        }
        
        .track-popup p {
          margin: 2px 0;
          font-size: 12px;
        }
        
        /* Ensure map container doesn't interfere with overlaid controls */
        .leaflet-container {
          position: relative;
        }
        
        /* Ensure map container doesn't interfere with overlaid controls */
        .leaflet-container {
          position: relative;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Load Leaflet library once
  useEffect(() => {
    if (typeof window === 'undefined' || leafletLoaded) return;

    const loadLeaflet = async () => {
      try {
        const leafletModule = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        const L = leafletModule.default;

        // Fix Leaflet default icon path issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        setLeafletLoaded(true);
        console.log('[PilotMap] Leaflet loaded');
      } catch (error) {
        console.error('[PilotMap] Failed to load Leaflet:', error);
      }
    };

    loadLeaflet();
  }, [leafletLoaded]);

  // Load weather layers on component mount
  useEffect(() => {
    const loadWeatherLayers = async () => {
      try {
        const layers = weatherService.getWeatherLayers();
        setWeatherLayers(layers);
        console.log('[PilotMap] Weather layers loaded:', layers.length);
      } catch (error) {
        console.error('[PilotMap] Failed to load weather layers:', error);
      }
    };

    loadWeatherLayers();
  }, []);

  // Load OSM data when airport changes
  useEffect(() => {
    const loadOSMData = async () => {
      if (!airport?.id) {
        setOsmData(null);
        return;
      }

      setOsmLoading(true);
      try {
        const data = await pilotOSMService.getAirportOSMData(airport.id);
        setOsmData(data);
        console.log('[PilotMap] OSM data loaded for', airport.id, data ? `${Object.values(data).flat().length} features` : 'no data');
        if (data?.runways) {
          console.log('[PilotMap] OSM runways found:', data.runways.length, data.runways.map(r => r.tags?.ref));
          console.log('[PilotMap] First runway structure:', data.runways[0]);
        }
        console.log('[PilotMap] Full OSM data structure:', data);
      } catch (error) {
        console.error('[PilotMap] Failed to load OSM data:', error);
        setOsmData(null);
      } finally {
        setOsmLoading(false);
      }
    };

    loadOSMData();
  }, [airport?.id]);

  // Create/destroy map when airport changes
  useEffect(() => {
    if (!leafletLoaded || !airport) {
      if (mapInstance) {
        mapInstance.remove();
        setMapInstance(null);
        setMapReady(false);
      }
      return;
    }

    // Clean up existing map
    if (mapInstance) {
      mapInstance.remove();
      setMapInstance(null);
      setMapReady(false);
    }

    const createMap = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      if (!mapRef.current) return;

      console.log('[PilotMap] Creating map for', airport.code);

      // Convert position format - API uses {lat, lon}, constants use [lat, lon]
      const mapCenter: [number, number] = airport.position
        ? [airport.position.lat, airport.position.lon]
        : airportConfig?.position || [34.0522, -118.2437]; // Default to LAX if no position available

      // Create map
      const map = L.map(mapRef.current, {
        center: mapCenter,
        zoom: 9, // Set to zoom level 9 to show approximately 40nm radius around airport
        zoomControl: true,
        attributionControl: false, // Add custom attribution later
      });

      // Add dark aviation-focused tile layer (similar to ATC dashboard)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 20,
          subdomains: 'abcd',
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }
      ).addTo(map);

      // Initialize layer groups - weather group needs higher z-index
      const weatherGroup = L.layerGroup().addTo(map);

      layerGroupsRef.current = {
        // runways: DISABLED - now using OSM data
        dmeRings: L.layerGroup().addTo(map),
        waypoints: L.layerGroup().addTo(map),
        // approachRoutes: DISABLED - now using OSM data  
        // extendedCenterlines: DISABLED - now using OSM data
        pireps: L.layerGroup().addTo(map),
        tracks: L.layerGroup().addTo(map),
        osm: L.layerGroup().addTo(map),
        weather: weatherGroup,
      };

      // Set weather layer group to render above base tiles
      const weatherGroupElement = weatherGroup.getPane ? weatherGroup.getPane() : null;
      if (weatherGroupElement) {
        weatherGroupElement.style.zIndex = '1000';
      }
      console.log('[PilotMap] Weather layer group initialized with high z-index');

      // Add scale control (similar to ATC dashboard)
      L.control
        .scale({
          maxWidth: 100,
          metric: false,
          imperial: true,
          position: "bottomleft",
        })
        .addTo(map);

      // Add attribution control  
      L.control
        .attribution({
          position: "bottomright",
          prefix: false,
        })
        .addAttribution(
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | <a href="https://carto.com/attributions">CARTO</a>'
        )
        .addTo(map);

      setMapInstance(map);
      setMapReady(true);
      console.log('[PilotMap] Map created successfully');
    };

    createMap();

    return () => {
      if (mapInstance) {
        mapInstance.remove();
        setMapInstance(null);
        setMapReady(false);
      }
      layerGroupsRef.current = {};
    };
  }, [leafletLoaded, airport?.code, airportConfig]);

  // Update runway display (DISABLED - now using OSM data)
  useEffect(() => {
    if (!mapInstance) return;
    // Runways are now handled by OSM data, no need to process FAA data
    return;

    const updateRunways = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing runways
      layerGroupsRef.current.runways.clearLayers();

      // DISABLED: Using OSM runway data instead of FAA calculations
      // The OSM data is more accurate and includes proper runway geometry
      return; // Early return to skip FAA runway rendering

      // Always show runways - they are now permanently enabled
      // Use runways from airportConfig (static constants with correct coordinates) first, fallback to airportData
      const runways = airportConfig?.runways || airportData?.runways || [];
      runways.forEach(runway => {
        if (runway.threshold && runway.oppositeEnd) {
          const runwayLine = L.polyline([
            [runway.threshold.lat, runway.threshold.lon],
            [runway.oppositeEnd.lat, runway.oppositeEnd.lon]
          ], {
            color: '#22d3ee', // Bright cyan color for better visibility
            weight: 4, // Thinner than before (was 8)
            opacity: 0.95
          }).bindPopup(
            `<div class="runway-popup">
              <h4><strong>Runway ${runway.name}/${runway.oppositeEnd.name}</strong></h4>
              <p><strong>Length:</strong> ${runway.length.toLocaleString()} ft</p>
              <p><strong>Heading:</strong> ${runway.heading}°/${runway.oppositeHeading}°</p>
            </div>`
          );

          layerGroupsRef.current.runways.addLayer(runwayLine);

          // Add runway labels at both ends (no threshold boxes)
          const runwayLabelStyle = `
            background: none;
            color: #22d3ee;
            font-size: 12px;
            font-weight: bold;
            padding: 0;
            border: none;
            text-shadow: 0px 0px 3px rgba(0,0,0,0.9);
          `;

          // Label at threshold end
          const thresholdLabel = L.divIcon({
            html: `<div style="${runwayLabelStyle}">${runway.name}</div>`,
            className: 'runway-label',
            iconAnchor: [15, 10]
          });

          const thresholdMarker = L.marker([runway.threshold.lat, runway.threshold.lon], { icon: thresholdLabel });
          layerGroupsRef.current.runways.addLayer(thresholdMarker);

          // Label at opposite end
          const oppositeLabel = L.divIcon({
            html: `<div style="${runwayLabelStyle}">${runway.oppositeEnd.name}</div>`,
            className: 'runway-label',
            iconAnchor: [15, 10]
          });

          const oppositeMarker = L.marker([runway.oppositeEnd.lat, runway.oppositeEnd.lon], { icon: oppositeLabel });
          layerGroupsRef.current.runways.addLayer(oppositeMarker);
        }
      });
    };

    updateRunways();
  }, [mapInstance, displayOptions.showRunways, airportConfig]);

  // Update DME rings display
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.dmeRings) return;

    const updateDmeRings = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing DME rings
      layerGroupsRef.current.dmeRings.clearLayers();

      if (displayOptions.showDmeRings) {
        // Use airport's defined DME rings if available, otherwise use default distances
        const dmeDistances = airportConfig?.dmeRings || [5, 10, 15, 20, 30];
        // Use the same center as the map
        const dmeCenter: [number, number] = airport.position
          ? [airport.position.lat, airport.position.lon]
          : airportConfig?.position || [34.0522, -118.2437];

        dmeDistances.forEach(distance => {
          const dmeRing = L.circle(dmeCenter, {
            radius: distance * 1852, // Convert NM to meters
            fill: false,
            color: distance % 10 === 0 ? '#3b82f6' : '#94a3b8',
            weight: distance % 10 === 0 ? 1.2 : 0.8,
            opacity: distance % 10 === 0 ? 0.5 : 0.3,
            dashArray: distance % 10 === 0 ? undefined : "3,3",
            interactive: false,
          });

          layerGroupsRef.current.dmeRings.addLayer(dmeRing);

          // Helper function to calculate point at distance and bearing
          const getPointAtDistanceAndBearing = (
            lat: number,
            lng: number,
            distanceNM: number,
            bearingDeg: number
          ): { lat: number; lng: number } => {
            const R = 6371; // Earth's radius in km
            const d = distanceNM * 1.852; // Convert NM to km

            const lat1 = (lat * Math.PI) / 180;
            const lng1 = (lng * Math.PI) / 180;
            const brng = (bearingDeg * Math.PI) / 180;

            const lat2 = Math.asin(
              Math.sin(lat1) * Math.cos(d / R) +
              Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng)
            );

            const lng2 =
              lng1 +
              Math.atan2(
                Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1),
                Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
              );

            return {
              lat: (lat2 * 180) / Math.PI,
              lng: (lng2 * 180) / Math.PI,
            };
          };

          // Add DME distance labels at lower left and top right of each circle
          const lowerLeftBearing = 225; // Lower left (SW)
          const topRightBearing = 45;   // Top right (NE)

          // Lower left label
          const lowerLeftPoint = getPointAtDistanceAndBearing(
            dmeCenter[0],
            dmeCenter[1],
            distance,
            lowerLeftBearing
          );

          const lowerLeftLabel = L.marker([lowerLeftPoint.lat, lowerLeftPoint.lng], {
            icon: L.divIcon({
              className: "dme-label",
              html: `<div style="
                color: ${distance % 10 === 0 ? "#3b82f6" : "#94a3b8"};
                font-size: 11px;
                font-weight: 600;
                text-shadow: 0px 0px 3px rgba(0,0,0,0.9);
                background: none;
                padding: 0;
                transform: rotate(45deg);
                opacity: 0.8;
              ">${distance} NM</div>`,
              iconSize: [50, 20],
              iconAnchor: [25, 10],
            }),
            interactive: false,
          });

          layerGroupsRef.current.dmeRings.addLayer(lowerLeftLabel);

          // Top right label
          const topRightPoint = getPointAtDistanceAndBearing(
            dmeCenter[0],
            dmeCenter[1],
            distance,
            topRightBearing
          );

          const topRightLabel = L.marker([topRightPoint.lat, topRightPoint.lng], {
            icon: L.divIcon({
              className: "dme-label",
              html: `<div style="
                color: ${distance % 10 === 0 ? "#3b82f6" : "#94a3b8"};
                font-size: 11px;
                font-weight: 600;
                text-shadow: 0px 0px 3px rgba(0,0,0,0.9);
                background: none;
                padding: 0;
                transform: rotate(45deg);
                opacity: 0.8;
              ">${distance} NM</div>`,
              iconSize: [50, 20],
              iconAnchor: [25, 10],
            }),
            interactive: false,
          });

          layerGroupsRef.current.dmeRings.addLayer(topRightLabel);
        });
      }
    };

    updateDmeRings();
  }, [mapInstance, displayOptions.showDmeRings, airportConfig]);

  // Update waypoints display
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.waypoints) return;

    const updateWaypoints = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing waypoints
      layerGroupsRef.current.waypoints.clearLayers();

      if (displayOptions.showWaypoints && airportConfig?.waypoints) {
        airportConfig.waypoints.forEach(waypoint => {
          // Draw waypoint marker - using smaller, less prominent purple dot
          const waypointMarker = L.marker([waypoint.lat, waypoint.lon], {
            icon: L.divIcon({
              className: "waypoint-marker",
              html: `<div style="width: 6px; height: 6px; background-color: #8b5cf6; border-radius: 50%; border: 1px solid #fff;"></div>`,
              iconSize: [8, 8],
              iconAnchor: [4, 4],
            }),
            interactive: true,
          });

          // Add waypoint information tooltip
          waypointMarker.bindTooltip(
            `${waypoint.name}: ${waypoint.description || "Waypoint"}`,
            {
              permanent: false,
              direction: "top",
              className: "distance-tooltip",
            }
          );

          // Add waypoint label - smaller and less prominent
          const waypointLabel = L.marker([waypoint.lat, waypoint.lon], {
            icon: L.divIcon({
              className: "waypoint-label",
              html: `<div style="color: #8b5cf6; font-size: 10px; font-weight: bold; text-shadow: 0px 0px 2px rgba(0,0,0,1)">${waypoint.name}</div>`,
              iconSize: [40, 20],
              iconAnchor: [20, -6], // Place the label above the marker
            }),
            interactive: false,
          });

          layerGroupsRef.current.waypoints.addLayer(waypointMarker);
          layerGroupsRef.current.waypoints.addLayer(waypointLabel);
        });
      }
    };

    updateWaypoints();
  }, [mapInstance, displayOptions.showWaypoints, airportConfig]);

  // Update approach routes display
  useEffect(() => {
    if (!mapInstance) return;
    // Approach routes are now handled by OSM data, no need to process FAA data
    return;

    const updateApproachRoutes = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing approach routes
      layerGroupsRef.current.approachRoutes.clearLayers();

      if (displayOptions.showApproachRoutes) {
        // DISABLED: Using OSM data instead of FAA runway calculations
        // Approach routes will be handled by OSM features
        return; // Early return to skip FAA approach route rendering
        
        // Use runways from airportConfig (static constants with correct coordinates) first, fallback to airportData
        const runways = airportConfig?.runways || airportData?.runways || [];
        runways.forEach(runway => {
          if (runway.approaches) {
            runway.approaches.forEach(approach => {
              // Calculate waypoint positions along approach path
              const approachWaypoints: [number, number][] = [];
              const runwayHeading = runway.heading;
              const threshold = runway.threshold;

              approach.waypoints.forEach(waypoint => {
                if (waypoint.position) {
                  approachWaypoints.push(waypoint.position);
                } else {
                  // Calculate position based on distance and heading
                  const distanceNm = waypoint.distanceFromThreshold;
                  const distanceMeters = distanceNm * 1852;

                  // Convert runway heading to approach heading (opposite direction)
                  const approachHeading = (runwayHeading + 180) % 360;
                  const headingRad = (approachHeading * Math.PI) / 180;

                  // Calculate position
                  const lat = threshold.lat + (distanceMeters / 111320) * Math.cos(headingRad);
                  const lon = threshold.lon + (distanceMeters / (111320 * Math.cos(threshold.lat * Math.PI / 180))) * Math.sin(headingRad);

                  approachWaypoints.push([lat, lon]);
                }
              });

              if (approachWaypoints.length > 1) {
                // Skip adding approach path line - only show waypoints

                // Add approach waypoint markers - using similar style to regular waypoints
                approach.waypoints.forEach((waypoint, index) => {
                  if (index < approachWaypoints.length) {
                    // Draw approach waypoint marker with a different color
                    const waypointMarker = L.marker(approachWaypoints[index], {
                      icon: L.divIcon({
                        className: "approach-waypoint-marker",
                        html: `<div style="width: 6px; height: 6px; background-color: #14b8a6; border-radius: 50%; border: 1px solid #fff;"></div>`,
                        iconSize: [8, 8],
                        iconAnchor: [4, 4],
                      }),
                      interactive: true,
                    });

                    // Add waypoint information tooltip
                    waypointMarker.bindTooltip(
                      `${waypoint.name}: ${approach.name} approach waypoint for RWY ${runway.name} (${waypoint.distanceFromThreshold}nm from threshold)`,
                      {
                        permanent: false,
                        direction: "top",
                        className: "distance-tooltip",
                      }
                    );

                    // Add waypoint label - use teal color
                    const waypointLabel = L.marker(approachWaypoints[index], {
                      icon: L.divIcon({
                        className: "approach-waypoint-label",
                        html: `<div style="color: #14b8a6; font-size: 10px; font-weight: bold; text-shadow: 0px 0px 2px rgba(0,0,0,1)">${waypoint.name}</div>`,
                        iconSize: [40, 20],
                        iconAnchor: [20, -6], // Place the label above the marker
                      }),
                      interactive: false,
                    });

                    layerGroupsRef.current.approachRoutes.addLayer(waypointMarker);
                    layerGroupsRef.current.approachRoutes.addLayer(waypointLabel);
                  }
                });
              }
            });
          }
        });
      }
    };

    updateApproachRoutes();
  }, [mapInstance, displayOptions.showApproachRoutes, airportConfig, airportData]);

  // Update extended centerlines display
  useEffect(() => {
    if (!mapInstance) return;
    // Extended centerlines are now handled by OSM data, no need to process FAA data
    return;

    const updateExtendedCenterlines = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing extended centerlines
      layerGroupsRef.current.extendedCenterlines.clearLayers();

      if (displayOptions.showExtendedCenterlines) {
        // DISABLED: Using OSM data instead of FAA runway calculations
        // Extended centerlines will be handled by OSM features
        return; // Early return to skip FAA extended centerline rendering
        
        // Use runways from airportConfig (static constants with correct coordinates) first, fallback to airportData
        const runways = airportConfig?.runways || airportData?.runways || [];

        runways.forEach(runway => {
          if (runway.threshold && runway.oppositeEnd) {
            // Calculate extended centerline points (extend 20 NM from each end)
            const extensionDistanceNm = 20;
            const extensionDistanceMeters = extensionDistanceNm * 1852;

            // Calculate runway bearing
            const lat1 = runway.threshold.lat * Math.PI / 180;
            const lon1 = runway.threshold.lon * Math.PI / 180;
            const lat2 = runway.oppositeEnd.lat * Math.PI / 180;
            const lon2 = runway.oppositeEnd.lon * Math.PI / 180;

            const deltaLon = lon2 - lon1;
            const y = Math.sin(deltaLon) * Math.cos(lat2);
            const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
            const bearing = Math.atan2(y, x);

            // Extend from threshold
            const extLat1 = runway.threshold.lat - (extensionDistanceMeters / 111320) * Math.cos(bearing);
            const extLon1 = runway.threshold.lon - (extensionDistanceMeters / (111320 * Math.cos(runway.threshold.lat * Math.PI / 180))) * Math.sin(bearing);

            // Extend from opposite end
            const extLat2 = runway.oppositeEnd.lat + (extensionDistanceMeters / 111320) * Math.cos(bearing);
            const extLon2 = runway.oppositeEnd.lon + (extensionDistanceMeters / (111320 * Math.cos(runway.oppositeEnd.lat * Math.PI / 180))) * Math.sin(bearing);

            // Draw the actual runway line that connects the thresholds
            const runwayLine = L.polyline([
              [runway.threshold.lat, runway.threshold.lon],
              [runway.oppositeEnd.lat, runway.oppositeEnd.lon]
            ], {
              color: '#3b82f6', // Blue color
              weight: 2,
              opacity: 0.9,
            });
            layerGroupsRef.current.extendedCenterlines.addLayer(runwayLine);

            // Create extended centerline for first direction (from threshold outward)
            const centerline1 = L.polyline([
              [runway.threshold.lat, runway.threshold.lon],
              [extLat1, extLon1]
            ], {
              color: '#06b6d4', // Bright cyan-blue for extended centerlines
              weight: 2,
              opacity: 0.7,
              dashArray: '10,10', // Longer dashes for distinction from approaches
              interactive: false,
            });

            // Create extended centerline for opposite direction (from opposite end outward)
            const centerline2 = L.polyline([
              [runway.oppositeEnd.lat, runway.oppositeEnd.lon],
              [extLat2, extLon2]
            ], {
              color: '#06b6d4', // Bright cyan-blue for extended centerlines
              weight: 2,
              opacity: 0.7,
              dashArray: '10,10', // Longer dashes for distinction from approaches
              interactive: false,
            });

            layerGroupsRef.current.extendedCenterlines.addLayer(centerline1);
            layerGroupsRef.current.extendedCenterlines.addLayer(centerline2);
          }
        });
      }
    };

    updateExtendedCenterlines();
  }, [mapInstance, displayOptions.showExtendedCenterlines, airportConfig, airportData]);

  // Update PIREP markers
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.pireps) return;

    const updatePireps = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing PIREPs
      layerGroupsRef.current.pireps.clearLayers();

      if (displayOptions.showPireps && pireps && Array.isArray(pireps)) {
        pireps.forEach(pirep => {
          // Defensive checks for PIREP data integrity
          if (!pirep || !pirep.location || typeof pirep.location.lat !== 'number' || typeof pirep.location.lon !== 'number') {
            console.warn('[PilotMap] Invalid PIREP data:', pirep);
            return;
          }
          // Determine priority styling based on conditions
          const isUrgent = pirep.conditions?.some(c =>
            c.type === 'TURBULENCE' && (c.severity === 'SEVERE' || c.severity === 'EXTREME') ||
            c.type === 'ICING' && (c.severity === 'SEVERE' || c.severity === 'TRACE')
          ) || false;

          const hasModerate = pirep.conditions?.some(c => c.severity === 'MODERATE') || false;

          // Choose color based on priority
          let color = '#10b981'; // Green for light/normal conditions
          if (isUrgent) {
            color = '#ef4444'; // Red for urgent
          } else if (hasModerate) {
            color = '#f59e0b'; // Amber for moderate
          }

          // Create custom PIREP icon with warning triangle - more prominent
          const pirepIcon = L.divIcon({
            html: `<div style="
              width: 24px;
              height: 24px;
              background: ${color};
              border: 3px solid #ffffff;
              border-radius: 4px;
              box-shadow: 0 3px 6px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              font-weight: bold;
              color: white;
              position: relative;
            ">⚠</div>`,
            className: 'custom-pirep-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });

          const marker = L.marker([pirep.location.lat, pirep.location.lon], { icon: pirepIcon });

          // Create popup content
          const conditionsHtml = (pirep.conditions && Array.isArray(pirep.conditions))
            ? pirep.conditions.map(c =>
              `<li><strong>${c?.type || 'Unknown'}:</strong> ${c?.severity || 'Unknown'} ${c?.description ? `- ${c.description}` : ''}</li>`
            ).join('')
            : '<li>No specific conditions reported</li>';

          const popupContent = `
            <div class="pirep-popup" style="min-width: 200px;">
              <div style="margin-bottom: 8px;">
                <h4 style="margin: 0; color: ${color};"><strong>PIREP</strong></h4>
              </div>
              <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
                ${pirep.timestamp ? new Date(pirep.timestamp).toLocaleString() : 'Unknown time'}<br/>
                ${pirep.aircraft || 'Unknown aircraft'} at ${pirep.altitude?.toLocaleString() || 'Unknown'} ft
              </p>
              ${pirep.message ? `<p style="margin: 8px 0; font-size: 13px;"><strong>Message:</strong> ${pirep.message}</p>` : ''}
              <ul style="margin: 8px 0; padding-left: 16px; font-size: 13px;">
                ${conditionsHtml}
              </ul>
              ${pirep.remarks ? `<p style="margin: 8px 0; font-size: 12px; font-style: italic;">${pirep.remarks}</p>` : ''}
            </div>
          `;

          marker.bindPopup(popupContent);
          layerGroupsRef.current.pireps.addLayer(marker);
        });
      }
    };

    updatePireps();
  }, [mapInstance, pireps, displayOptions.showPireps]);

  // Update ground tracks
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.tracks) return;

    const updateTracks = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing tracks - add defensive check
      if (!layerGroupsRef.current.tracks) {
        console.warn('[PilotMap] Tracks layer group not available');
        return;
      }
      layerGroupsRef.current.tracks.clearLayers();

      if (displayOptions.showGroundTracks && tracks && Array.isArray(tracks)) {
        tracks.forEach(track => {

          // Defensive checks for track data integrity
          if (!track || !track.coordinates || !Array.isArray(track.coordinates)) {
            console.warn('[PilotMap] Invalid track data:', track);
            return;
          }

          if (track.coordinates.length < 2) return; // Need at least 2 points for a line

          // Calculate track age based on the most recent coordinate timestamp
          const now = new Date();
          const mostRecentCoord = track.coordinates[track.coordinates.length - 1];
          const trackAge = mostRecentCoord?.timestamp
            ? (now.getTime() - new Date(mostRecentCoord.timestamp).getTime()) / (1000 * 60) // Age in minutes
            : 0;

          // Hide tracks over 30 minutes old
          if (trackAge > 30) {
            return;
          }

          // Convert coordinates to Leaflet LatLng format with additional safety checks
          const latLngs: [number, number][] = track.coordinates
            .filter(coord => coord && typeof coord.lat === 'number' && typeof coord.lon === 'number')
            .map(coord => [coord.lat, coord.lon]);

          // Skip if we don't have enough valid coordinates after filtering
          if (latLngs.length < 2) {
            console.warn('[PilotMap] Track has insufficient valid coordinates:', track.id || track.callsign);
            return;
          }

          // Determine track color based on status and callsign
          let color = '#a855f7'; // Purple for active ground tracks (distinct from runways/approaches)
          if (track.status === 'COMPLETED') {
            color = '#64748b'; // Muted slate for completed flights
          } else if (track.status === 'EMERGENCY') {
            color = '#ef4444'; // Red for emergency
          } else if (track.callsign?.includes('UAL')) {
            color = '#8b5cf6'; // Violet for United
          } else if (track.callsign?.includes('AAL')) {
            color = '#10b981'; // Emerald for American
          } else {
            // Use a hash of the callsign for consistent coloring per flight
            const hash = track.callsign ? track.callsign.split('').reduce((a, b) => {
              a = ((a << 5) - a) + b.charCodeAt(0);
              return a & a;
            }, 0) : 0;
            const colors = ['#a855f7', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
            color = colors[Math.abs(hash) % colors.length];
          }

          // Calculate opacity based on track age (fade out over 30 minutes)
          let opacity = 0.8; // Default opacity
          if (trackAge > 20) {
            // Start fading at 20 minutes, completely transparent at 30 minutes
            const fadeStart = 20; // minutes
            const fadeEnd = 30; // minutes
            const fadeProgress = Math.min((trackAge - fadeStart) / (fadeEnd - fadeStart), 1);
            opacity = 0.8 * (1 - fadeProgress); // Fade from 0.8 to 0
          }

          // Create invisible thick line for easier clicking
          const clickableLine = L.polyline(latLngs, {
            color: 'transparent',
            weight: 8, // Thick invisible line for easy clicking
            opacity: 0,
            interactive: true
          });

          // Create visible thin dashed line for display
          const visibleLine = L.polyline(latLngs, {
            color: color,
            weight: 1.5, // Thin visual line
            opacity: opacity, // Keep the existing fade-out logic intact
            dashArray: '8, 4', // Dashed for all tracks to make them less prominent
            interactive: false // Not clickable, just visual
          });

          // Add popup to clickable line showing aircraft type
          const trackPopupContent = `
            <div style="
              background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,20,0.95));
              border: 1px solid ${color};
              border-radius: 8px;
              padding: 8px 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1);
              backdrop-filter: blur(4px);
              color: #ffffff;
              font-size: 13px;
              font-weight: 500;
              text-align: center;
              min-width: 120px;
            ">
              <div style="color: ${color}; font-weight: 600; margin-bottom: 2px;">AIRCRAFT</div>
              <div style="color: #e5e7eb; font-size: 12px;">${track.aircraft !== 'Unknown' ? track.aircraft : 'Unknown Type'}</div>
            </div>
          `;
          
          clickableLine.bindPopup(trackPopupContent, {
            autoClose: true,
            closeOnClick: true,
            autoPan: false
          });

          // Auto-dismiss popup after 3 seconds
          clickableLine.on('popupopen', () => {
            setTimeout(() => {
              if (clickableLine.isPopupOpen()) {
                clickableLine.closePopup();
              }
            }, 3000);
          });

          if (layerGroupsRef.current.tracks) {
            layerGroupsRef.current.tracks.addLayer(clickableLine);
            layerGroupsRef.current.tracks.addLayer(visibleLine);
          }

          // Start markers removed - track line will be clickable instead

          // End markers removed to prevent accumulation on runways
        });
      }
    };

    updateTracks();
  }, [mapInstance, tracks, displayOptions.showGroundTracks]);

  // Update weather radar display - FIXED with conservative approach
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.weather) return;

    const updateWeatherRadar = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing radar layer from weather layer group
      const existingRadarLayer = activeWeatherLayers.get('radar');
      if (existingRadarLayer && layerGroupsRef.current.weather) {
        console.log('[🌦️ WEATHER API] 🛑 Weather radar DISABLED - Stopping all weather API calls');
        layerGroupsRef.current.weather.removeLayer(existingRadarLayer);
        setActiveWeatherLayers(prev => {
          const newMap = new Map(prev);
          newMap.delete('radar');
          return newMap;
        });
      }

      if (displayOptions.showWeatherRadar) {
        console.log('[🌦️ WEATHER API] 🎯 WEATHER RADAR TOGGLE: ON - Starting weather overlay');
        console.log('[🌦️ WEATHER API] 📋 Available weather layers:', weatherLayers.length);

        let radarLayer = weatherLayers.find(layer => layer.id === 'radar');

        // Fallback to composite radar if primary not available
        if (!radarLayer) {
          radarLayer = weatherLayers.find(layer => layer.id === 'radar_composite');
          console.log('[PilotMap] Using composite radar as fallback');
        }

        if (radarLayer) {
          try {
            console.log('[🌦️ WEATHER API] ✅ Weather radar ENABLED - STATIC OVERLAY MODE');
            console.log('[🌦️ WEATHER API] 🎯 STATIC MODE: ONE image for entire US, cached in 10min buckets');
            console.log('[🌦️ WEATHER API] 🚀 UNLIMITED ZOOM: No additional requests when zooming!');

            // STATIC WEATHER OVERLAY - Single image for entire CONUS
            console.log('[🌦️ WEATHER API] 🗺️  Using STATIC weather overlay - ONE request for entire US');

            // Get a single static weather image for the entire CONUS at fixed zoom
            const conus_bbox = "-130,20,-60,50"; // Entire Continental US
            const image_width = 1024;
            const image_height = 512;

            // Generate single weather image URL with caching (ONLY ONE API CALL!)
            const cacheTimestamp = Math.floor(Date.now() / (10 * 60 * 1000)) * (10 * 60 * 1000); // 10-minute cache buckets

            // Iowa Mesonet uses WMS 1.1.1, different parameter format
            const staticWeatherUrl = `${radarLayer.url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${radarLayer.layers}&BBOX=${conus_bbox}&WIDTH=${image_width}&HEIGHT=${image_height}&SRS=EPSG:4326&FORMAT=image/png&TRANSPARENT=true&t=${cacheTimestamp}`;

            console.log('[🌦️ WEATHER API] 📡 Single weather request URL (Iowa Mesonet):', staticWeatherUrl);

            // Create image overlay instead of tiled layer
            const bounds: [[number, number], [number, number]] = [
              [20, -130], // Southwest corner of CONUS
              [50, -60]   // Northeast corner of CONUS
            ];

            // Create image overlay that scales with zoom
            const imageOverlay = L.imageOverlay(staticWeatherUrl, bounds, {
              opacity: 0.8, // Increased from 0.7 for better visibility
              interactive: false,
              crossOrigin: 'anonymous',
              alt: 'NOAA Weather Radar',
              pane: 'overlayPane' // Ensure it renders on top of base tiles
            });

            // Add event listeners for the single image request
            imageOverlay.on('load', () => {
              console.log('[🌦️ WEATHER API] ✅ Static weather image loaded successfully - NO MORE REQUESTS NEEDED!');
              console.log('[🌦️ WEATHER API] 🎯 Weather overlay should now be VISIBLE across entire US');
              console.log('[🌦️ WEATHER API] 📊 Image bounds:', bounds);
              console.log('[🌦️ WEATHER API] 🎨 Opacity:', 0.8);
            });

            imageOverlay.on('error', (e) => {
              console.error('[🌦️ WEATHER API] ❌ Static weather image failed to load:', e);
              console.error('[🌦️ WEATHER API] 🔗 Failed URL:', staticWeatherUrl);
            });

            // Add static image overlay to weather layer group
            layerGroupsRef.current.weather.addLayer(imageOverlay);
            setActiveWeatherLayers(prev => {
              const newMap = new Map(prev);
              newMap.set('radar', imageOverlay as any); // Type assertion for image overlay
              return newMap;
            });

            // Force the weather layer to the top
            imageOverlay.bringToFront();

            console.log('[🌦️ WEATHER API] 🎉 Static weather overlay added - ZERO additional requests on zoom/pan!');
            console.log('[🌦️ WEATHER API] 🔍 DEBUG: Weather layer group has', layerGroupsRef.current.weather.getLayers().length, 'layers');
            console.log('[🌦️ WEATHER API] 🔍 DEBUG: Image overlay bounds:', imageOverlay.getBounds());

            // Add browser caching headers to the single image request
            if (staticWeatherUrl) {
              console.log('[🌦️ WEATHER API] 💾 Browser will cache the static weather image');
            }
          } catch (error) {
            console.error('[PilotMap] Failed to add static weather overlay:', error);
          }
        } else {
          console.warn('[PilotMap] No radar layer available');
        }
      }
    };

    updateWeatherRadar();
  }, [mapInstance, displayOptions.showWeatherRadar, weatherLayers]);

  // Update weather alerts display - TEMPORARILY DISABLED
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.weather) return;

    // DISABLED - preventing API spam
    return;

    const updateWeatherAlerts = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Remove existing alert layers from weather layer group
      const existingAlertLayer = activeWeatherLayers.get('weather_warnings');
      if (existingAlertLayer && layerGroupsRef.current.weather) {
        layerGroupsRef.current.weather.removeLayer(existingAlertLayer);
      }

      if (displayOptions.showWeatherAlerts) {
        const alertLayer = weatherLayers.find(layer => layer.id === 'weather_warnings');
        if (alertLayer) {
          try {
            const wmsLayer = L.tileLayer.wms(alertLayer.url, {
              layers: alertLayer.layers,
              format: alertLayer.format,
              transparent: alertLayer.transparent,
              opacity: alertLayer.opacity,
              crs: L.CRS.EPSG4326,
              attribution: 'NOAA/NWS Weather Warnings',
              zIndex: 1001 // Weather alerts above radar
            });

            layerGroupsRef.current.weather.addLayer(wmsLayer);
            setActiveWeatherLayers(prev => {
              const newMap = new Map(prev);
              newMap.set('weather_warnings', wmsLayer);
              return newMap;
            });

            console.log('[PilotMap] Weather alerts overlay added');
          } catch (error) {
            console.error('[PilotMap] Failed to add weather alerts:', error);
          }
        }
      }
    };

    updateWeatherAlerts();
  }, [mapInstance, displayOptions.showWeatherAlerts, weatherLayers]);

  // Update visibility display - TEMPORARILY DISABLED
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.weather) return;

    // DISABLED - preventing API spam
    return;

    const updateVisibility = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Remove existing visibility layer from weather layer group
      const existingVisLayer = activeWeatherLayers.get('visibility');
      if (existingVisLayer && layerGroupsRef.current.weather) {
        layerGroupsRef.current.weather.removeLayer(existingVisLayer);
      }

      if (displayOptions.showVisibility) {
        const visLayer = weatherLayers.find(layer => layer.id === 'visibility');
        if (visLayer) {
          try {
            const wmsLayer = L.tileLayer.wms(visLayer.url, {
              layers: visLayer.layers,
              format: visLayer.format,
              transparent: visLayer.transparent,
              opacity: visLayer.opacity,
              crs: L.CRS.EPSG4326,
              attribution: 'NOAA/NWS Visibility Data',
              zIndex: 999 // Visibility below radar but above base tiles
            });

            layerGroupsRef.current.weather.addLayer(wmsLayer);
            setActiveWeatherLayers(prev => {
              const newMap = new Map(prev);
              newMap.set('visibility', wmsLayer);
              return newMap;
            });

            console.log('[PilotMap] Visibility overlay added');
          } catch (error) {
            console.error('[PilotMap] Failed to add visibility overlay:', error);
          }
        }
      }
    };

    updateVisibility();
  }, [mapInstance, displayOptions.showVisibility, weatherLayers]);

  // Update OSM features display
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.osm) return;

    const updateOSMFeatures = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing OSM features
      layerGroupsRef.current.osm.clearLayers();

      if (displayOptions.showOSMFeatures && osmData) {
        console.log('[PilotMap] Rendering OSM features:', {
          taxiways: osmData.taxiways.length,
          terminals: osmData.terminals.length,
          gates: osmData.gates.length,
          aprons: osmData.aprons.length,
          hangars: osmData.hangars.length,
          controlTowers: osmData.controlTowers.length,
          parkingPositions: osmData.parkingPositions.length,
          runways: osmData.runways.length,
          other: osmData.other.length
        });
        console.log('[PilotMap] OSM data object:', osmData);
        console.log('[PilotMap] First runway data:', osmData.runways[0]);

        // Render taxiways
        osmData.taxiways.forEach(way => {
          if (way.geometry && way.geometry.length > 1) {
            const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
            const taxiway = L.polyline(coordinates, {
              color: '#8b5cf6', // Purple color for taxiways
              weight: 2,
              opacity: 0.8,
              interactive: false,
              pane: 'overlayPane'
            });
            taxiway.addTo(mapInstance); // Add directly to map
          }
        });

        // Render terminals
        osmData.terminals.forEach(way => {
          if (way.geometry && way.geometry.length > 2) {
            const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
            const terminal = L.polygon(coordinates, {
              color: '#3b82f6', // Blue color for terminals
              weight: 1,
              opacity: 0.6,
              fillOpacity: 0.2,
              interactive: false,
              pane: 'overlayPane'
            });
            terminal.addTo(mapInstance); // Add directly to map
          }
        });

        // Render aprons
        osmData.aprons.forEach(way => {
          if (way.geometry && way.geometry.length > 2) {
            const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
            const apron = L.polygon(coordinates, {
              color: '#64748b', // Gray color for aprons
              weight: 1,
              opacity: 0.5,
              fillOpacity: 0.1,
              interactive: false
            });
            layerGroupsRef.current.osm.addLayer(apron);
          }
        });

        // Render hangars
        osmData.hangars.forEach(way => {
          if (way.geometry && way.geometry.length > 2) {
            const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
            const hangar = L.polygon(coordinates, {
              color: '#f59e0b', // Orange color for hangars
              weight: 1,
              opacity: 0.7,
              fillOpacity: 0.3,
              interactive: false
            });
            layerGroupsRef.current.osm.addLayer(hangar);
          }
        });

        // Render gates
        osmData.gates.forEach(node => {
          console.log('[PilotMap] Gate node:', node);
          
          // Handle different OSM data structures
          let lat, lon;
          if (node.lat && node.lon) {
            // Direct lat/lon properties
            lat = node.lat;
            lon = node.lon;
          } else if (node.geometry && node.geometry.length > 0) {
            // Geometry array structure
            const point = node.geometry[0];
            lat = point.lat;
            lon = point.lon;
          }
          
          if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
            console.warn('[PilotMap] Gate node missing or invalid coordinates:', node);
            return;
          }
          
          const gate = L.circleMarker([lat, lon], {
            radius: 3,
            color: '#10b981', // Green color for gates
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6,
            interactive: false
          });
          layerGroupsRef.current.osm.addLayer(gate);
        });

        // Render control towers
        osmData.controlTowers.forEach(node => {
          // Handle different OSM data structures
          let lat, lon;
          if (node.lat && node.lon) {
            // Direct lat/lon properties
            lat = node.lat;
            lon = node.lon;
          } else if (node.geometry && node.geometry.length > 0) {
            // Geometry array structure
            const point = node.geometry[0];
            lat = point.lat;
            lon = point.lon;
          }
          
          if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
            console.warn('[PilotMap] Control tower missing or invalid coordinates:', node);
            return;
          }
          
          const tower = L.circleMarker([lat, lon], {
            radius: 4,
            color: '#ef4444', // Red color for control towers
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.7,
            interactive: false
          });
          layerGroupsRef.current.osm.addLayer(tower);
        });

        // Render parking positions
        osmData.parkingPositions.forEach(node => {
          // Handle different OSM data structures
          let lat, lon;
          if (node.lat && node.lon) {
            // Direct lat/lon properties
            lat = node.lat;
            lon = node.lon;
          } else if (node.geometry && node.geometry.length > 0) {
            // Geometry array structure
            const point = node.geometry[0];
            lat = point.lat;
            lon = point.lon;
          }
          
          if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
            console.warn('[PilotMap] Parking position missing or invalid coordinates:', node);
            return;
          }
          
          const parking = L.circleMarker([lat, lon], {
            radius: 2,
            color: '#6b7280', // Gray color for parking positions
            weight: 1,
            opacity: 0.6,
            fillOpacity: 0.4,
            interactive: false
          });
          layerGroupsRef.current.osm.addLayer(parking);
        });

        // Render runways with labels (following dashboard approach)
        console.log('[PilotMap] Rendering OSM runways:', osmData.runways.length);
        console.log('[PilotMap] OSM layer group exists:', !!layerGroupsRef.current.osm);
        osmData.runways.forEach((way, index) => {
          console.log(`[PilotMap] Rendering runway ${index + 1}:`, way.tags?.ref, way.geometry?.length, 'points');
          console.log('[PilotMap] Runway way object:', way);
          if (way.geometry && way.geometry.length > 1) {
            console.log('[PilotMap] Runway geometry:', way.geometry);
            const coordinates = way.geometry.map(point => {
              console.log('[PilotMap] Geometry point:', point);
              if (!point || !point.lat || !point.lon || isNaN(point.lat) || isNaN(point.lon)) {
                console.warn('[PilotMap] Invalid geometry point:', point);
                return null;
              }
              return [point.lat, point.lon] as [number, number];
            }).filter(coord => coord !== null);
            
            if (coordinates.length < 2) {
              console.warn('[PilotMap] Not enough valid coordinates for runway:', way.tags?.ref);
              return;
            }
            const runway = L.polyline(coordinates, {
              color: '#0ea5e9', // Blue color for runways
              weight: 8, // Increased weight for better visibility
              opacity: 1.0,
              interactive: false,
              pane: 'overlayPane' // Use overlay pane like dashboard
            });
            console.log(`[PilotMap] Adding runway ${index + 1} directly to map`);
            runway.addTo(mapInstance); // Add directly to map like dashboard

            // Add runway labels at each end (following dashboard approach)
            const runwayRef = way.tags?.ref;
            if (runwayRef && runwayRef.includes('/')) {
              const runwayNumbers = runwayRef.split('/');
              const startPoint = coordinates[0];
              const endPoint = coordinates[coordinates.length - 1];
              const startRunwayNumber = runwayNumbers[0];
              const endRunwayNumber = runwayNumbers[1];

              // Start label
              const startLabel = L.marker(startPoint, {
                icon: L.divIcon({
                  className: "runway-label",
                  html: `<div style="
                    color: #000000;
                    font-size: 10px;
                    font-weight: 700;
                    text-shadow: 0px 0px 2px rgba(255,255,255,0.8);
                    background: rgba(255,255,255,0.95);
                    padding: 1px 3px;
                    border-radius: 2px;
                    border: 1px solid rgba(0,0,0,0.2);
                    white-space: nowrap;
                    text-align: center;
                    line-height: 1;
                    min-width: 16px;
                    display: inline-block;
                  ">${startRunwayNumber}</div>`,
                  iconSize: [20, 14],
                  iconAnchor: [10, 7],
                }),
                interactive: false,
              });
              startLabel.addTo(mapInstance); // Add directly to map

              // End label
              const endLabel = L.marker(endPoint, {
                icon: L.divIcon({
                  className: "runway-label",
                  html: `<div style="
                    color: #000000;
                    font-size: 10px;
                    font-weight: 700;
                    text-shadow: 0px 0px 2px rgba(255,255,255,0.8);
                    background: rgba(255,255,255,0.95);
                    padding: 1px 3px;
                    border-radius: 2px;
                    border: 1px solid rgba(0,0,0,0.2);
                    white-space: nowrap;
                    text-align: center;
                    line-height: 1;
                    min-width: 16px;
                    display: inline-block;
                  ">${endRunwayNumber}</div>`,
                  iconSize: [20, 14],
                  iconAnchor: [10, 7],
                }),
                interactive: false,
              });
              endLabel.addTo(mapInstance); // Add directly to map
            }
          }
        });

        // Render other features
        osmData.other.forEach(way => {
          if (way.geometry && way.geometry.length > 1) {
            const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
            const other = L.polyline(coordinates, {
              color: '#a78bfa', // Light purple for other features
              weight: 1,
              opacity: 0.5,
              interactive: false
            });
            layerGroupsRef.current.osm.addLayer(other);
          }
        });
      }
    };

    updateOSMFeatures();
  }, [mapInstance, displayOptions.showOSMFeatures, osmData]);

  // Handle recenter events (similar to ATC dashboard)
  useEffect(() => {
    const handleRecenter = () => {
      if (mapInstance && airport) {
        const mapCenter: [number, number] = airport.position
          ? [airport.position.lat, airport.position.lon]
          : airportConfig?.position || [0, 0];
        mapInstance.flyTo(mapCenter, 9, { duration: 1.5 }); // Use zoom level 9 for 40nm radius view
      }
    };

    window.addEventListener('map-recenter', handleRecenter);
    return () => {
      window.removeEventListener('map-recenter', handleRecenter);
    };
  }, [mapInstance, airport, airportConfig]);

  // Add fullscreen change handler (similar to ATC dashboard) 
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (mapInstance) {
        setTimeout(() => {
          mapInstance.invalidateSize();
          if (airport) {
            const mapCenter: [number, number] = airport.position
              ? [airport.position.lat, airport.position.lon]
              : airportConfig?.position || [0, 0];
            mapInstance.setView(mapCenter, mapInstance.getZoom());
            mapInstance.fire('resize');
          }
        }, 150);
      }
    };

    window.addEventListener('map-fullscreen-change', handleFullscreenChange as EventListener);
    return () => {
      window.removeEventListener('map-fullscreen-change', handleFullscreenChange as EventListener);
    };
  }, [mapInstance, airport, airportConfig]);

  // Fullscreen toggle function
  const toggleFullscreen = () => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);

    // Call the parent callback if provided
    if (onFullscreenChange) {
      onFullscreenChange(newFullscreenState);
    }

    // Notify about fullscreen state change
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('map-fullscreen-change', {
        detail: { isFullscreen: newFullscreenState }
      }));
    }, 100);
  };

  if (!airport) {
    return (
      <div className="h-full bg-slate-800 flex items-center justify-center">
        <div className="text-center text-gray-400">
          {!mounted ? (
            // Show generic message during SSR to prevent hydration mismatch
            <p>Select an airport to view map</p>
          ) : selectedAirport && loading ? (
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p>Loading airport data...</p>
            </div>
          ) : selectedAirport ? (
            <p>No data available for this airport</p>
          ) : (
            <p>Select an airport to view map</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen
      ? 'fixed inset-0 z-50 bg-slate-900'
      : 'h-full rounded-xl overflow-hidden border relative'
      }`}>
      {/* Fullscreen and Recenter buttons */}
      <div className="absolute bottom-4 right-2 flex flex-col gap-2" style={{ zIndex: 1000 }}>
        {/* Fullscreen toggle button */}
        <button
          onClick={toggleFullscreen}
          className="bg-gray-800/80 hover:bg-gray-700/80 text-white border border-gray-600 
                   px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors"
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="h-4 w-4" />
              Exit Fullscreen
            </>
          ) : (
            <>
              <Maximize2 className="h-4 w-4" />
              Fullscreen
            </>
          )}
        </button>

        {/* Recenter button */}
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('map-recenter'));
          }}
          className="bg-gray-800/80 hover:bg-gray-700/80 text-white border border-gray-600 
                   px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          Recenter
        </button>
      </div>

      {/* Airport info overlay */}
      <div className="absolute z-10 bottom-2 left-2 bg-black/60 text-white p-1 px-2 text-xs rounded">
        {airport.name} ({airport.code})
      </div>

      {!mapReady && (
        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center z-10">
          <div className="text-center text-gray-400">
            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p>Loading map for {airport.code}...</p>
          </div>
        </div>
      )}

      <div
        ref={mapRef}
        className="w-full h-full"
      />
    </div>
  );
}
