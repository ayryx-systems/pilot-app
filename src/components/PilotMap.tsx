'use client';

import React, { useRef, useEffect, useState } from 'react';
import type * as L from 'leaflet';
import { Airport, AirportOverview, PiRep, GroundTrack, MapDisplayOptions, WeatherLayer } from '@/types';
import { AIRPORTS } from '@/constants/airports';
import { weatherService } from '@/services/weatherService';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';

interface PilotMapProps {
  airport?: Airport;
  airportData?: AirportOverview;
  pireps: PiRep[];
  tracks: GroundTrack[];
  displayOptions: MapDisplayOptions;
  onDismissPirep: (id: string) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  isDemo?: boolean;
  onWeatherRefresh?: () => void;
}

export function PilotMap({
  airport,
  airportData,
  pireps,
  tracks,
  displayOptions,
  onDismissPirep,
  onFullscreenChange,
  isDemo,
  onWeatherRefresh
}: PilotMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Weather layers state
  const [weatherLayers, setWeatherLayers] = useState<WeatherLayer[]>([]);
  const [activeWeatherLayers, setActiveWeatherLayers] = useState<Map<string, L.TileLayer>>(new Map());
  
  // Weather refresh function
  const refreshWeatherLayer = () => {
    const radarLayer = activeWeatherLayers.get('radar');
    if (radarLayer && mapInstance) {
      console.log('[🌦️ WEATHER API] 🔄 MANUAL REFRESH TRIGGERED - This will force new API calls to NOAA');
      console.log('[🌦️ WEATHER API] ⚠️  Manual refresh should be used sparingly to respect NOAA servers');
      radarLayer.redraw(); // Force reload of all tiles
      
      // Optional: Add timestamp to force fresh requests (use sparingly)
      const currentTime = Date.now();
      if (radarLayer.options && typeof radarLayer.options === 'object') {
        (radarLayer.options as any).timestamp = currentTime;
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
          background-color: rgba(0, 0, 0, 0.8);
          color: white;
          border-radius: 4px;
        }
        
        .leaflet-popup-tip {
          background-color: rgba(0, 0, 0, 0.8);
        }
        
        .leaflet-popup-close-button {
          color: white;
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
        runways: L.layerGroup().addTo(map),
        dmeRings: L.layerGroup().addTo(map),
        waypoints: L.layerGroup().addTo(map),
        approachRoutes: L.layerGroup().addTo(map),
        extendedCenterlines: L.layerGroup().addTo(map),
        pireps: L.layerGroup().addTo(map),
        tracks: L.layerGroup().addTo(map),
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

  // Update runway display
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.runways) return;

    const updateRunways = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing runways
      layerGroupsRef.current.runways.clearLayers();

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
    if (!mapInstance || !layerGroupsRef.current.approachRoutes) return;

    const updateApproachRoutes = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing approach routes
      layerGroupsRef.current.approachRoutes.clearLayers();

      if (displayOptions.showApproachRoutes) {
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
    if (!mapInstance || !layerGroupsRef.current.extendedCenterlines) return;

    const updateExtendedCenterlines = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing extended centerlines
      layerGroupsRef.current.extendedCenterlines.clearLayers();

      if (displayOptions.showExtendedCenterlines) {
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
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4 style="margin: 0; color: ${color};"><strong>PIREP</strong></h4>
                <button 
                  onclick="window.dismissPirep('${pirep.id}')"
                  style="background: #f3f4f6; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;"
                >Dismiss</button>
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

        // Make dismiss function globally available
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).dismissPirep = (pirepId: string) => {
          onDismissPirep(pirepId);
        };
      }
    };

    updatePireps();
  }, [mapInstance, pireps, displayOptions.showPireps, onDismissPirep]);

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

          // Create polyline with styling
          const polyline = L.polyline(latLngs, {
            color: color,
            weight: 3,
            opacity: 0.8,
            dashArray: track.status === 'COMPLETED' ? '5, 5' : undefined // Dashed for completed flights
          });

          if (layerGroupsRef.current.tracks) {
            layerGroupsRef.current.tracks.addLayer(polyline);
          }

          // Add start marker (takeoff)
          if (latLngs.length > 0 && track.coordinates && track.coordinates.length > 0) {
            const startCoord = track.coordinates[0];
            if (!startCoord || typeof startCoord.lat !== 'number' || typeof startCoord.lon !== 'number') {
              console.warn('[PilotMap] Invalid start coordinate for track:', track.id || track.callsign);
              return;
            }
            const startIcon = L.divIcon({
              html: `<div style="
                width: 12px;
                height: 12px;
                background: ${color};
                border: 2px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              "></div>`,
              className: 'track-start-marker',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });

            const popupContent = `
              <div class="track-popup" style="color: white; background: rgba(0, 0, 0, 0.8); padding: 8px; border-radius: 4px;">
                <h4 style="margin: 0 0 4px 0; color: white;"><strong>${track.callsign || 'No Callsign'}</strong></h4>
                <p style="margin: 2px 0; font-size: 12px; color: #e5e5e5;"><strong>Aircraft:</strong> ${track.aircraft !== 'Unknown' ? track.aircraft : 'Unknown Type'}</p>
              </div>
            `;

            const startMarker = L.marker([startCoord.lat, startCoord.lon], { icon: startIcon })
              .bindPopup(popupContent);

            if (layerGroupsRef.current.tracks) {
              layerGroupsRef.current.tracks.addLayer(startMarker);
            }
          }

          // Add end marker (current position or landing) - simple circle marker
          if (latLngs.length > 1 && track.coordinates && track.coordinates.length > 1) {
            const endCoord = track.coordinates[track.coordinates.length - 1];
            if (!endCoord || typeof endCoord.lat !== 'number' || typeof endCoord.lon !== 'number') {
              console.warn('[PilotMap] Invalid end coordinate for track:', track.id || track.callsign);
              return;
            }
            const isCompleted = track.status === 'COMPLETED';

            const endIcon = L.divIcon({
              html: `<div style="
                width: 12px;
                height: 12px;
                background: ${color};
                border: 2px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                ${!isCompleted ? 'animation: pulse 2s infinite;' : ''}
              "></div>
              <style>
                @keyframes pulse {
                  0% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.7; transform: scale(1.1); }
                  100% { opacity: 1; transform: scale(1); }
                }
              </style>`,
              className: 'track-end-marker',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });

            const endPopupContent = `
              <div class="track-popup" style="color: white; background: rgba(0, 0, 0, 0.8); padding: 8px; border-radius: 4px;">
                <h4 style="margin: 0 0 4px 0; color: white;"><strong>${track.callsign || 'No Callsign'}</strong></h4>
                <p style="margin: 2px 0; font-size: 12px; color: #e5e5e5;"><strong>Aircraft:</strong> ${track.aircraft !== 'Unknown' ? track.aircraft : 'Unknown Type'}</p>
              </div>
            `;

            const endMarker = L.marker([endCoord.lat, endCoord.lon], { icon: endIcon })
              .bindPopup(endPopupContent);

            if (layerGroupsRef.current.tracks) {
              layerGroupsRef.current.tracks.addLayer(endMarker);
            }
          }
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
        let radarLayer = weatherLayers.find(layer => layer.id === 'radar');
        
        // Fallback to composite radar if primary not available
        if (!radarLayer) {
          radarLayer = weatherLayers.find(layer => layer.id === 'radar_composite');
          console.log('[PilotMap] Using composite radar as fallback');
        }
        
        if (radarLayer) {
          try {
            console.log('[🌦️ WEATHER API] ✅ Weather radar ENABLED - API calls to NOAA will start');
            console.log('[🌦️ WEATHER API] 📊 Settings: 10min auto-refresh, max zoom 10, geographic bounds limited');
            
            // Create WMS tile layer with API-friendly settings for multiple users
            const crs = radarLayer.crs === 'EPSG:4326' ? L.CRS.EPSG4326 : L.CRS.EPSG3857;
            const wmsLayer = L.tileLayer.wms(radarLayer.url, {
              layers: radarLayer.layers,
              format: radarLayer.format,
              transparent: radarLayer.transparent,
              opacity: radarLayer.opacity,
              version: '1.3.0',
              crs: crs,
              attribution: 'NOAA/NWS Weather Radar',
              
              // AGGRESSIVE caching and throttling to be API-friendly
              updateWhenIdle: true,     // Only update when map stops moving
              updateWhenZooming: false, // Don't update during zoom animations
              updateInterval: 600,      // 10-minute minimum between updates (radar updates every 5-10min anyway)
              keepBuffer: 2,            // Keep more tiles cached (2 screens worth)
              maxZoom: 10,              // Limit zoom to reduce tile count (was 12)
              minZoom: 3,               // Set minimum zoom
              bounds: [                 // Limit to CONUS to avoid unnecessary requests
                [20.0, -130.0],         // Southwest corner 
                [50.0, -60.0]           // Northeast corner
              ],
              
              // Tile request optimizations
              styles: '',
              detectRetina: false,      // Disable retina to reduce requests
              subdomains: [],           // No subdomains to avoid spreading requests
              
              // Custom cache headers
              tileLoadTimeout: 10000,   // 10s timeout per tile
              crossOrigin: false        // Avoid CORS preflight requests
            });

            // Add to weather layer group
            layerGroupsRef.current.weather.addLayer(wmsLayer);
            setActiveWeatherLayers(prev => {
              const newMap = new Map(prev);
              newMap.set('radar', wmsLayer);
              return newMap;
            });

            // Enable browser caching for tiles to reduce API calls across sessions
            wmsLayer.on('tileloadstart', function(e: any) {
              // Add cache headers to tile requests if possible
              const tileUrl = e.tile.src;
              if (tileUrl && !tileUrl.includes('cache-control')) {
                // Browser will cache tiles for 10 minutes
                e.tile.crossOrigin = 'anonymous';
              }
            });

            console.log('[PilotMap] Weather radar overlay added successfully with API-friendly settings:', {
              updateInterval: '10 minutes',
              maxZoom: 10,
              boundsLimited: true,
              aggressiveCaching: true
            });
            
            // Add debugging: test a sample tile request
            const testUrl = wmsLayer._url;
            console.log('[PilotMap] WMS Service URL:', testUrl);
            console.log('[PilotMap] WMS Layers:', radarLayer.layers);
            
            // Test if the WMS service responds
            const sampleTileUrl = `${radarLayer.url}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&BBOX=-180,-90,180,90&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&LAYERS=${radarLayer.layers}&STYLES=&FORMAT=${radarLayer.format}&TRANSPARENT=true`;
            console.log('[PilotMap] Sample tile URL for testing:', sampleTileUrl);
            
            // Add comprehensive API monitoring
            let tileRequestCount = 0;
            let lastRequestTime = Date.now();
            
            wmsLayer.on('loading', () => {
              console.log('[🌦️ WEATHER API] Loading batch started - Multiple tile requests incoming...');
            });
            
            wmsLayer.on('load', () => {
              console.log('[🌦️ WEATHER API] Loading batch completed');
            });
            
            // Monitor individual tile requests
            wmsLayer.on('tileloadstart', (e: any) => {
              tileRequestCount++;
              const currentTime = Date.now();
              const timeSinceLastRequest = currentTime - lastRequestTime;
              lastRequestTime = currentTime;
              
              console.log(`[🌦️ WEATHER API CALL #${tileRequestCount}] TILE REQUEST:`, {
                url: e.url || 'URL not available',
                timeGap: `${timeSinceLastRequest}ms since last request`,
                timestamp: new Date().toLocaleTimeString(),
                coords: e.coords || 'coordinates not available'
              });
            });
            
            wmsLayer.on('tileload', (e: any) => {
              console.log(`[🌦️ WEATHER API] TILE SUCCESS:`, {
                url: e.url || 'URL not available',
                timestamp: new Date().toLocaleTimeString()
              });
            });
            
            wmsLayer.on('tileerror', (e: any) => {
              console.error(`[🌦️ WEATHER API] TILE ERROR:`, {
                url: e.url || 'URL not available',
                error: e.error || 'Unknown error',
                timestamp: new Date().toLocaleTimeString()
              });
            });

            // Log total request count periodically
            setInterval(() => {
              if (tileRequestCount > 0) {
                console.log(`[🌦️ WEATHER API SUMMARY] Total API calls in session: ${tileRequestCount}`);
              }
            }, 60000); // Log summary every minute
          } catch (error) {
            console.error('[PilotMap] Failed to add weather radar:', error);
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
          <p>Select an airport to view map</p>
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
