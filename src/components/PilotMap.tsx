'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as L from 'leaflet';
import { Airport, AirportOverview, PiRep, GroundTrack, Arrival, MapDisplayOptions, WeatherLayer, AirportOSMFeatures } from '@/types';
import { AIRPORTS } from '@/constants/airports';
import { weatherService, type SigmetAirmet, type WeatherForecast } from '@/services/weatherService';
import { pilotOSMService } from '@/services/osmService';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { FAAWaypointLayer } from './FAAWaypointLayer';
import { Z_INDEX_LAYERS } from '@/types/zIndexLayers';
import { getAircraftCategoryFromType, getAircraftColor, rgbaToHex, brightenColor } from '@/utils/aircraftColors';

// Helper function to calculate bearing between two points
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const toDegrees = (radians: number) => radians * (180 / Math.PI);
    
    const dLon = toRadians(lon2 - lon1);
    const lat1Rad = toRadians(lat1);
    const lat2Rad = toRadians(lat2);
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = toDegrees(Math.atan2(y, x));
    return (bearing + 360) % 360; // Normalize to 0-360
}

// Helper function to create wind barb icon
function createWindBarb(windDir: number, windSpeed: number, altitude: number): L.DivIcon {
  const speed = Math.round(windSpeed);
  const direction = Math.round(windDir);
  
  // Professional wind indicator with clear direction
  const windBarbHTML = `
    <div style="
      position: relative;
      width: 80px;
      height: 75px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, rgba(0,50,100,0.9), rgba(0,30,70,0.9));
      border-radius: 6px;
      border: 2px solid #4a9eff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.6);
      padding: 4px;
    ">
      <!-- Title -->
      <div style="
        color: #4a9eff;
        font-size: 8px;
        font-weight: bold;
        letter-spacing: 0.5px;
        text-align: center;
        line-height: 1;
      ">WINDS ALOFT</div>
      
      <!-- Wind direction - clear arrow pointing FROM wind source -->
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 16px solid #ffffff;
        transform: rotate(${direction}deg);
        transform-origin: center center;
      "></div>
      
      <!-- Altitude -->
      <div style="
        color: #4a9eff;
        font-size: 10px;
        font-weight: bold;
        text-align: center;
        line-height: 1;
      ">${altitude.toLocaleString()} FT</div>
      
      <!-- Wind speed -->
      <div style="
        color: #ffffff;
        font-size: 16px;
        font-weight: bold;
        text-shadow: 0 0 4px rgba(0,0,0,0.8);
        font-family: 'Courier New', monospace;
        text-align: center;
        line-height: 1;
      ">${speed} KT</div>
      
      <!-- Click indicator -->
      <div style="
        color: #4a9eff;
        font-size: 7px;
        font-weight: bold;
        text-align: center;
        line-height: 1;
        opacity: 0.8;
      ">CLICK FOR MORE</div>
    </div>
  `;
  
  return L.divIcon({
    html: windBarbHTML,
    className: 'wind-barb',
    iconSize: [80, 75],
    iconAnchor: [40, 37]
  });
}

interface PilotMapProps {
  airport?: Airport;
  airportData?: AirportOverview;
  pireps: PiRep[];
  tracks: GroundTrack[];
  arrivals?: Arrival[];
  displayOptions: MapDisplayOptions;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  isDemo?: boolean;
  loading?: boolean;
  selectedAirport?: string | null;
  selectedTrackId?: string | null;
}

export function PilotMap({
  airport,
  airportData,
  pireps,
  tracks,
  arrivals,
  displayOptions,
  onFullscreenChange,
  isDemo,
  loading,
  selectedAirport,
  selectedTrackId
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
  const [sigmetAirmetData, setSigmetAirmetData] = useState<any[]>([]);

  // Weather radar animation state
  const [radarFrames, setRadarFrames] = useState<Array<{ timestamp: number; timestampISO: string; imageData: string }>>([]);
  const [currentRadarFrameIndex, setCurrentRadarFrameIndex] = useState(0);
  const radarAnimationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const radarOverlaysRef = useRef<L.ImageOverlay[]>([]); // All preloaded overlays
  const radarBlobUrlsRef = useRef<string[]>([]); // Track blob URLs for cleanup
  const radarTimeIndicatorRef = useRef<HTMLDivElement | null>(null);
  const radarFramesRef = useRef<Array<{ timestamp: number; timestampISO: string; imageData: string }>>([]);

  // OSM data state
  const [osmData, setOsmData] = useState<AirportOSMFeatures | null>(null);
  const [osmLoading, setOsmLoading] = useState(false);



  // Layer group references for easy cleanup
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  
  // Track highlight overlay references for cleanup
  const highlightOverlaysRef = useRef<Map<string, L.Polyline>>(new Map());

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
          background-color: rgba(0, 0, 0, 0.85) !important;
          color: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.6) !important;
          border: 1px solid rgba(255,255,255,0.2) !important;
          padding: 8px !important;
        }
        
        .leaflet-popup-tip {
          background-color: rgba(0, 0, 0, 0.85) !important;
          border: 1px solid rgba(255,255,255,0.2) !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4) !important;
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
          z-index: 3500 !important;
        }
        
        .leaflet-popup {
          z-index: 3500 !important;
        }
        
        /* Ensure weather PIREP popups are above everything */
        .leaflet-popup-content-wrapper {
          z-index: 3501 !important;
          position: relative;
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
        
        /* Ensure runway labels appear above all other map elements */
        .runway-label {
          z-index: 2000 !important;
          position: relative !important;
        }
        
        .runway-label div {
          z-index: 2000 !important;
          position: relative !important;
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

      // Ensure popupPane has highest z-index so all popups appear on top
      const popupPane = map.getPane('popupPane');
      if (popupPane && popupPane.style) {
        popupPane.style.zIndex = '3500';
      }

      // Initialize layer groups
      const weatherGroup = L.layerGroup().addTo(map);
      const tracksGroup = L.layerGroup().addTo(map);
      const pirepsGroup = L.layerGroup().addTo(map);
      const waypointsGroup = L.layerGroup().addTo(map);

      layerGroupsRef.current = {
        // runways: DISABLED - now using OSM data
        dmeRings: L.layerGroup().addTo(map),
        waypoints: waypointsGroup,
        extendedCenterlines: L.layerGroup().addTo(map),
        pireps: pirepsGroup,
        tracks: tracksGroup,
        osm: L.layerGroup().addTo(map),
        weather: weatherGroup,
      };

      // Set layer group z-indexes to ensure proper layering
      // Using pane zIndex style for layer groups
      // Values match Z_INDEX_LAYERS constants (which get added to markerPane base of 600)
      const tracksPane = tracksGroup.getPane?.();
      const waypointsPane = waypointsGroup.getPane?.();
      const weatherPane = weatherGroup.getPane?.();
      const pirepsPane = pirepsGroup.getPane?.();
      const extendedCenterlinesPane = layerGroupsRef.current.extendedCenterlines.getPane?.();
      
      // GROUND_TRACKS: 30, waypoints go above at 35
      // Extended centerlines should be below tracks (z-index 610 = 10 + markerPane base 600)
      if (tracksPane && tracksPane.style) {
        tracksPane.style.zIndex = '630'; // GROUND_TRACKS (30) + markerPane base (600)
      }
      if (waypointsPane && waypointsPane.style) {
        waypointsPane.style.zIndex = '635'; // WAYPOINTS (35) + markerPane base (600)
      }
      if (weatherPane && weatherPane.style) {
        weatherPane.style.zIndex = '620'; // Weather (radar, SIGMETs) - below interactive elements
      }
      if (pirepsPane && pirepsPane.style) {
        pirepsPane.style.zIndex = '700'; // PIREPs above waypoints and tracks
      }
      if (extendedCenterlinesPane && extendedCenterlinesPane.style) {
        extendedCenterlinesPane.style.zIndex = '610'; // Extended centerlines below tracks (10 + markerPane base 600)
      }
      
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
      runways.forEach((runway: any) => {
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

      // Get current zoom level
      const currentZoom = mapInstance.getZoom();

      // Clear existing DME rings
      layerGroupsRef.current.dmeRings.clearLayers();

      if (displayOptions.showDmeRings) {
        // Use airport's defined DME rings if available, otherwise use default distances
        const dmeDistances = airportConfig?.dmeRings || [5, 10, 15, 20, 30];
        // Use the same center as the map
        const dmeCenter: [number, number] = airport?.position
          ? [airport.position.lat, airport.position.lon]
          : airportConfig?.position || [34.0522, -118.2437];

        dmeDistances.forEach((distance: number) => {
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

          // Only add labels if zoom level is 9 or higher
          if (currentZoom >= 9) {
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
          }
        });
      }
    };

    updateDmeRings();

    // Add zoom change handler to update labels
    const handleZoomEnd = () => {
      updateDmeRings();
    };

    mapInstance.on('zoomend', handleZoomEnd);

    return () => {
      mapInstance.off('zoomend', handleZoomEnd);
    };
  }, [mapInstance, displayOptions.showDmeRings, airportConfig]);

  // Update waypoints display
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.waypoints) return;

    const updateWaypoints = async () => {
      // Clear existing waypoints - FAAWaypointLayer will handle drawing
      layerGroupsRef.current.waypoints.clearLayers();
    };

    updateWaypoints();
  }, [mapInstance, displayOptions.showWaypoints, airportConfig]);

  // Extended centerlines are now handled in the OSM features update effect

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

          const marker = L.marker([pirep.location.lat, pirep.location.lon], { 
            icon: pirepIcon,
            pane: 'popupPane' // Use popup pane for highest z-index
          });

          // Set high z-index for PIREP marker to ensure it's above tracks
          marker.setZIndexOffset(2000);

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
              <p style="margin: 4px 0; font-size: 12px; color: #e5e7eb;">
                ${pirep.timestamp ? new Date(pirep.timestamp).toLocaleString() : 'Unknown time'}<br/>
                ${pirep.aircraft || 'Unknown aircraft'} at ${pirep.altitude?.toLocaleString() || 'Unknown'} ft
              </p>
              ${pirep.message ? `<p style="margin: 8px 0; font-size: 13px; color: #f3f4f6;"><strong>Message:</strong> ${pirep.message}</p>` : ''}
              <ul style="margin: 8px 0; padding-left: 16px; font-size: 13px; color: #f3f4f6;">
                ${conditionsHtml}
              </ul>
              ${pirep.remarks ? `<p style="margin: 8px 0; font-size: 12px; font-style: italic; color: #d1d5db;">${pirep.remarks}</p>` : ''}
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
      
      // Clean up all highlight overlays
      highlightOverlaysRef.current.forEach((highlight, trackId) => {
        if (layerGroupsRef.current.tracks) {
          layerGroupsRef.current.tracks.removeLayer(highlight);
        }
      });
      highlightOverlaysRef.current.clear();
      
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

          // Check if this track is selected
          const isSelected = selectedTrackId === track.id;

          // Determine track color based on status and aircraft category
          let color: string;
          if (isSelected) {
            color = '#fbbf24'; // Bright yellow/amber for selected track
          } else if (track.status === 'COMPLETED') {
            color = '#64748b'; // Muted slate for completed flights
          } else if (track.status === 'EMERGENCY') {
            color = '#ef4444'; // Red for emergency
          } else {
            // Use aircraft category color (matches arrival times graph)
            const category = getAircraftCategoryFromType(track.aircraft);
            const rgbaColor = getAircraftColor(category);
            color = rgbaToHex(rgbaColor);
          }

          // Calculate opacity based on track age (fade out over 30 minutes)
          // Selected tracks always have full opacity
          let opacity = isSelected ? 1.0 : 0.8; // Default opacity
          if (!isSelected && trackAge > 20) {
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
            interactive: true,
            pane: 'markerPane', // Use markerPane so zIndexOffset works correctly
            zIndexOffset: Z_INDEX_LAYERS.GROUND_TRACKS
          });

          // Create visible continuous line for display
          // Selected tracks are thicker
          const visibleLine = L.polyline(latLngs, {
            color: color,
            weight: isSelected ? 3.5 : 2, // Thicker for selected track, slightly thicker for all tracks
            opacity: opacity, // Keep the existing fade-out logic intact
            dashArray: undefined, // Continuous line for all tracks
            interactive: false, // Not clickable, just visual
            pane: 'markerPane', // Use markerPane so zIndexOffset works correctly
            zIndexOffset: isSelected ? Z_INDEX_LAYERS.GROUND_TRACKS + 100 : Z_INDEX_LAYERS.GROUND_TRACKS // Selected tracks on top
          });

          // Helper functions to format landing time
          const formatZulu = (dateString: string) => {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Unknown time';
            const hours = date.getUTCHours().toString().padStart(2, '0');
            const minutes = date.getUTCMinutes().toString().padStart(2, '0');
            const day = date.getUTCDate().toString().padStart(2, '0');
            const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
            const year = date.getUTCFullYear();
            return `${year}-${month}-${day} ${hours}${minutes}Z`;
          };

          const formatRelativeTime = (dateString: string) => {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Unknown';
            
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMinutes = Math.floor(diffMs / 60000);
            
            if (diffMinutes < 0) return 'Future';
            if (diffMinutes < 60) return `${diffMinutes} min ago`;
            
            const hours = Math.floor(diffMinutes / 60);
            const minutes = diffMinutes % 60;
            if (minutes === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
            return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} min ago`;
          };

          // Get landing time (prefer createdAt, fallback to startTime)
          const landingTime = track.createdAt || track.startTime;
          
          // Find matching arrival to get duration from 50nm
          const matchingArrival = arrivals?.find(arrival => {
            if (arrival.callsign !== track.callsign) return false;
            const arrivalLandingTime = new Date(arrival.timestampLanding);
            const trackLandingTime = landingTime ? new Date(landingTime) : null;
            if (!trackLandingTime) return false;
            return Math.abs(arrivalLandingTime.getTime() - trackLandingTime.getTime()) < 60000; // Within 1 minute
          });
          
          // Format duration from 50nm to landing
          const formatDuration = (minutes: number): string => {
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            if (hours > 0) {
              return `${hours}h ${mins}m`;
            }
            return `${mins}m`;
          };
          
          // Create a function to generate popup content with current relative time
          const createTrackPopupContent = () => {
            const zuluTimeStr = landingTime ? formatZulu(landingTime) : 'Unknown time';
            const currentRelativeTime = landingTime ? formatRelativeTime(landingTime) : 'Unknown';
            
            const durationFrom50nm = matchingArrival?.durationMinutes ? formatDuration(matchingArrival.durationMinutes) : null;
            
            return `
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
                min-width: 150px;
              ">
                <div style="color: ${color}; font-weight: 600; margin-bottom: 4px;">AIRCRAFT</div>
                <div style="color: #e5e7eb; font-size: 12px; margin-bottom: 4px;">${track.aircraft !== 'Unknown' ? track.aircraft : 'Unknown Type'}</div>
                ${durationFrom50nm ? `
                  <div style="color: #9ca3af; font-size: 11px; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
                    <div style="color: #e5e7eb; font-weight: 500;">Time from 50nm: ${durationFrom50nm}</div>
                  </div>
                ` : ''}
                ${landingTime ? `
                  <div style="color: #9ca3af; font-size: 11px; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
                    <div style="color: #e5e7eb; font-weight: 500;">Landed: ${zuluTimeStr}</div>
                    <div style="color: #9ca3af; font-size: 10px;">${currentRelativeTime}</div>
                  </div>
                ` : ''}
              </div>
            `;
          };
          
          clickableLine.bindPopup(createTrackPopupContent(), {
            className: 'track-popup',
            autoClose: true,
            closeOnClick: true,
            autoPan: false
          });

          // Create temporary highlight overlay for track visibility
          const createHighlightOverlay = () => {
            // Clean up any existing highlight for this track
            const existingHighlight = highlightOverlaysRef.current.get(track.id);
            if (existingHighlight && layerGroupsRef.current.tracks) {
              layerGroupsRef.current.tracks.removeLayer(existingHighlight);
              highlightOverlaysRef.current.delete(track.id);
            }

            // Use brighter version of the track color for highlight
            const highlightColor = brightenColor(color, 40); // Brighten by 40%

            const highlightLine = L.polyline(latLngs, {
              color: highlightColor,
              weight: 4, // Thicker than the base track weight of 2
              opacity: 1.0, // Full opacity
              dashArray: undefined, // Continuous line (no dashes)
              interactive: false,
              pane: 'markerPane', // Use markerPane to stay consistent
              zIndexOffset: Z_INDEX_LAYERS.GROUND_TRACKS + 200 // Above regular tracks
            });

            // Store reference for cleanup
            highlightOverlaysRef.current.set(track.id, highlightLine);

            // Add highlight overlay to tracks layer
            if (layerGroupsRef.current.tracks) {
              layerGroupsRef.current.tracks.addLayer(highlightLine);
            }

            // Fade out the highlight overlay over 12 seconds
            let fadeOpacity = 1.0;
            const fadeInterval = setInterval(() => {
              fadeOpacity -= 0.00833; // Fade by ~0.83% every 50ms (12 seconds total)
              if (fadeOpacity <= 0) {
                clearInterval(fadeInterval);
                if (layerGroupsRef.current.tracks) {
                  layerGroupsRef.current.tracks.removeLayer(highlightLine);
                }
                highlightOverlaysRef.current.delete(track.id);
              } else {
                highlightLine.setStyle({ opacity: fadeOpacity });
              }
            }, 50); // Update every 50ms for smooth fade
          };

          // Trigger highlight when track is selected (via selectedTrackId)
          if (isSelected) {
            // Small delay to ensure the track is rendered first
            setTimeout(() => {
              createHighlightOverlay();
            }, 50);
          }

          // Auto-dismiss popup and create highlight overlay after 3 seconds
          clickableLine.on('popupopen', () => {
            const popup = clickableLine.getPopup();
            if (popup && landingTime) {
              // Update popup content to refresh relative time
              popup.setContent(createTrackPopupContent());
              
              // Set up interval to update relative time every 30 seconds while popup is open
              const updateInterval = setInterval(() => {
                if (popup && popup.isOpen() && landingTime) {
                  popup.setContent(createTrackPopupContent());
                } else {
                  clearInterval(updateInterval);
                }
              }, 30000); // Update every 30 seconds
              
              // Clean up interval when popup closes
              clickableLine.once('popupclose', () => {
                clearInterval(updateInterval);
              });
            }
            
            // Create the highlight overlay immediately when popup opens
            createHighlightOverlay();
            
            setTimeout(() => {
              if (clickableLine.isPopupOpen()) {
                clickableLine.closePopup();
              }
            }, 3000);
          });

          if (layerGroupsRef.current.tracks) {
            layerGroupsRef.current.tracks.addLayer(clickableLine);
            layerGroupsRef.current.tracks.addLayer(visibleLine);
            // Ensure tracks appear above runways by bringing them to front
            visibleLine.bringToFront();
            clickableLine.bringToFront();
          }

          // Start markers removed - track line will be clickable instead

          // End markers removed to prevent accumulation on runways
        });
      }
    };

    updateTracks();
  }, [mapInstance, tracks, arrivals, displayOptions.showGroundTracks, selectedTrackId]);

  // Update weather radar display with animation
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.weather) return;

    const updateWeatherRadar = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing radar layer and animation
      // Remove from activeWeatherLayers map
      const existingRadarLayer = activeWeatherLayers.get('radar');
      if (existingRadarLayer && layerGroupsRef.current.weather) {
        try {
        layerGroupsRef.current.weather.removeLayer(existingRadarLayer);
        } catch (error) {
          // Layer might already be removed
        }
        setActiveWeatherLayers(prev => {
          const newMap = new Map(prev);
          newMap.delete('radar');
          return newMap;
        });
      }

      // Clean up all radar overlays
      if (radarOverlaysRef.current.length > 0 && layerGroupsRef.current.weather) {
        radarOverlaysRef.current.forEach(overlay => {
          try {
            if (layerGroupsRef.current.weather) {
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
      
      // Clean up all blob URLs
      radarBlobUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          // Ignore errors
        }
      });
      radarBlobUrlsRef.current = [];

      // Clear existing time indicator
      if (radarTimeIndicatorRef.current && mapRef.current) {
        radarTimeIndicatorRef.current.remove();
        radarTimeIndicatorRef.current = null;
      }

      // Clear animation interval
      if (radarAnimationIntervalRef.current) {
        clearInterval(radarAnimationIntervalRef.current);
        radarAnimationIntervalRef.current = null;
      }

      // Clear frames state
      setRadarFrames([]);
      radarFramesRef.current = [];

      if (displayOptions.showWeatherRadar) {
        let radarLayer = weatherLayers.find(layer => layer.id === 'radar');
        if (!radarLayer) {
          radarLayer = weatherLayers.find(layer => layer.id === 'radar_composite');
        }

        if (radarLayer) {
          try {
            // ANIMATED WEATHER RADAR - Last 45 minutes at 15-minute intervals
            const conus_bbox = "-130,20,-60,50"; // Entire Continental US (west,south,east,north)
            const image_width = 2048;
            const image_height = 1024;

            // Fetch cached animation frames from backend
            const frames = await weatherService.getWeatherRadarAnimation();

            if (frames.length === 0) {
              console.warn('[PilotMap] No radar animation frames available');
              return;
            }

            // Clean up any existing overlays before loading new ones
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
            
            // Clean up old blob URLs
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

            // Create bounds for CONUS
            const bounds: [[number, number], [number, number]] = [
              [20, -130], // Southwest corner of CONUS
              [50, -60]   // Northeast corner of CONUS
            ];

            console.log(`[PilotMap] Preloading ${frames.length} radar frames as overlays...`);

            // Preload ALL frames as overlays upfront
            const overlayPromises = frames.map(async (frame, index) => {
              // Convert base64 to blob URL
              const base64Data = frame.imageData.replace(/^data:image\/\w+;base64,/, '');
              const blob = new Blob([Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))], { type: 'image/png' });
              const blobUrl = URL.createObjectURL(blob);
              radarBlobUrlsRef.current.push(blobUrl);

              // Preload image
              return new Promise<L.ImageOverlay>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                  // Create overlay (start transparent except first one)
                  const overlay = L.imageOverlay(blobUrl, bounds, {
                    opacity: index === 0 ? 0.3 : 0, // First frame visible, others transparent
                    interactive: false,
                    crossOrigin: 'anonymous',
                    alt: 'NOAA Weather Radar',
                    pane: 'overlayPane'
                  });
                  
                  // Add to map
                  if (layerGroupsRef.current.weather) {
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

            // Wait for all overlays to load
            const overlays = await Promise.all(overlayPromises);
            radarOverlaysRef.current = overlays;

            console.log(`[PilotMap] ✅ All ${overlays.length} radar overlays preloaded`);

            // Create fixed time indicator element (if it doesn't exist)
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

            // Animate by fading between preloaded overlays
            let frameIndex = 0;
            
            const animateFrame = () => {
              // Check if radar is still enabled
              if (!displayOptions.showWeatherRadar) {
                if (radarAnimationIntervalRef.current) {
                  clearTimeout(radarAnimationIntervalRef.current as any);
                  radarAnimationIntervalRef.current = null;
                }
                return;
              }

              const overlays = radarOverlaysRef.current;
              if (overlays.length === 0) {
                console.warn('[PilotMap] No overlays available for animation');
                return;
              }
              
              // Move to next frame, or loop back to start if at end
              if (frameIndex === overlays.length - 1) {
                frameIndex = 0;
              } else {
                frameIndex = frameIndex + 1;
              }
              
              setCurrentRadarFrameIndex(frameIndex);

              const currentOverlay = overlays[frameIndex];
              const previousIndex = frameIndex === 0 ? overlays.length - 1 : frameIndex - 1;
              const previousOverlay = overlays[previousIndex];
              
              // Smooth crossfade between overlays
              const fadeDuration = 200; // 200ms crossfade
              const steps = 40; // Smooth interpolation
              const stepDelay = fadeDuration / steps;
              
              let step = 0;
              const fadeInterval = setInterval(() => {
                step++;
                const progress = Math.min(step / steps, 1);
                
                // Smooth easing function (ease-in-out cubic)
                const easedProgress = progress < 0.5
                  ? 4 * progress * progress * progress
                  : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                
                // Fade out previous overlay
                if (previousOverlay) {
                  const oldOpacity = 0.3 * (1 - easedProgress);
                  previousOverlay.setOpacity(oldOpacity);
                }
                
                // Fade in current overlay
                const newOpacity = 0.3 * easedProgress;
                currentOverlay.setOpacity(newOpacity);
                
                if (step >= steps) {
                  clearInterval(fadeInterval);
                  
                  // Ensure final opacity
                  currentOverlay.setOpacity(0.3);
                  if (previousOverlay) {
                    previousOverlay.setOpacity(0);
                  }
                }
              }, stepDelay);

              // Update time indicator
              if (radarTimeIndicatorRef.current && radarFramesRef.current[frameIndex]) {
                radarTimeIndicatorRef.current.textContent = `Radar: ${new Date(radarFramesRef.current[frameIndex].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              }
              
              // Schedule next frame: pause longer on last frame (3 seconds) to indicate current situation
              const isLastFrame = frameIndex === overlays.length - 1;
              const delay = isLastFrame ? 3000 : 200; // 3 seconds on last frame, 200ms otherwise
              
              if (radarAnimationIntervalRef.current) {
                clearTimeout(radarAnimationIntervalRef.current as any);
              }
              radarAnimationIntervalRef.current = setTimeout(animateFrame, delay) as any;
            };
            
            // Start animation after a brief delay to ensure overlays are ready
            radarAnimationIntervalRef.current = setTimeout(animateFrame, 200) as any;

          } catch (error) {
            console.error('[PilotMap] Failed to add animated weather radar:', error);
          }
        } else {
          console.warn('[PilotMap] No radar layer available');
        }
      }
    };

    updateWeatherRadar();

    // Cleanup on unmount
    return () => {
      if (radarAnimationIntervalRef.current) {
        // Clear both interval and timeout (we use setTimeout for animation)
        clearTimeout(radarAnimationIntervalRef.current as any);
        clearInterval(radarAnimationIntervalRef.current as any);
      }
      // Clean up blob URLs
      // Clean up all blob URLs
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

  // Auto-refresh weather radar animation frames (check every 5 minutes for new frames)
  useEffect(() => {
    if (!mapInstance || !displayOptions.showWeatherRadar) return;
    if (radarFrames.length === 0) return;

    const refreshInterval = setInterval(async () => {
      try {
        const radarLayer = weatherLayers.find(layer => layer.id === 'radar') || 
                          weatherLayers.find(layer => layer.id === 'radar_composite');
        
    if (!radarLayer) return;

        const conus_bbox = "-130,20,-60,50";
        const image_width = 2048;
        const image_height = 1024;

        // Fetch fresh cached frames from backend
        const frames = await weatherService.getWeatherRadarAnimation();

        if (frames.length > 0) {
          // Trigger full reload by clearing and resetting frames
          // This will cause updateWeatherRadar to reload all overlays
          setRadarFrames([]);
          setTimeout(() => {
            setRadarFrames(frames);
          }, 100);
        }
      } catch (error) {
        console.error('[PilotMap] Failed to refresh radar frames:', error);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(refreshInterval);
  }, [mapInstance, displayOptions.showWeatherRadar, radarFrames.length, weatherLayers]);

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

  // Update SIGMETs/AIRMETs display
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.weather) return;

    const updateSigmetAirmet = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Remove existing SIGMETs/AIRMETs layers
      const existingLayers = layerGroupsRef.current.weather.getLayers();
      existingLayers.forEach((layer: any) => {
        if (layer._sigmetAirmetId) {
          layerGroupsRef.current.weather.removeLayer(layer);
        }
      });

      if (displayOptions.showSigmetAirmet) {
        try {
          // Fetch ALL SIGMETs/AIRMETs (no bounds filtering - show all active advisories)
          const sigmetAirmets = await weatherService.getSigmetAirmet();
          
          // Render each SIGMET/AIRMET as a polygon
          sigmetAirmets.forEach(sigmet => {
            if (!sigmet.geometry || sigmet.geometry.length < 3) return; // Need at least 3 points for a polygon

            // Convert geometry to Leaflet coordinate format
            const coordinates = sigmet.geometry.map(coord => [coord.lat, coord.lon] as [number, number]);

            // Choose color and styling based on severity - stroke-focused with minimal fill
            let color = '#fbbf24'; // Default amber
            let strokeWidth = 2.5;
            let fillOpacity = 0.08; // Very minimal - just enough to hint at "inside"
            let strokeOpacity = 0.85;
            
            if (sigmet.severity === 'SEVERE' || sigmet.severity === 'EXTREME') {
              color = '#ef4444'; // Red
              strokeWidth = 3.5;
              fillOpacity = 0.1;
              strokeOpacity = 0.95;
            } else if (sigmet.severity === 'MODERATE') {
              color = '#f59e0b'; // Orange
              strokeWidth = 3;
              fillOpacity = 0.08;
              strokeOpacity = 0.9;
            }

            // Create polygon: non-interactive fill + clickable border
            const polygon = L.polygon(coordinates, {
              color: color,
              weight: strokeWidth,
              opacity: strokeOpacity,
              fillColor: color,
              fillOpacity: fillOpacity,
              interactive: false, // Make fill non-interactive
              pane: 'overlayPane',
              bubblingMouseEvents: false
            });

            // Create clickable border (polyline with same coordinates)
            const border = L.polyline(coordinates, {
              color: color,
              weight: strokeWidth,
              opacity: strokeOpacity,
              interactive: true, // Make border clickable
              pane: 'overlayPane'
            });

            // Store ID for cleanup on both elements
            (polygon as any)._sigmetAirmetId = sigmet.id;
            (border as any)._sigmetAirmetId = sigmet.id;

            // Format time in Zulu (UTC)
            const formatZulu = (dateString: string) => {
              const date = new Date(dateString);
              const hours = date.getUTCHours().toString().padStart(2, '0');
              const minutes = date.getUTCMinutes().toString().padStart(2, '0');
              return `${hours}${minutes}Z`;
            };

            // Format relative time (e.g., "2h 10min ago" or "in 1h 50min")
            const formatRelativeTime = (dateString: string) => {
              const date = new Date(dateString);
              const now = new Date();
              const diffMs = date.getTime() - now.getTime();
              const diffMinutes = Math.floor(diffMs / 60000);
              const absMinutes = Math.abs(diffMinutes);
              
              const hours = Math.floor(absMinutes / 60);
              const minutes = absMinutes % 60;
              
              if (diffMinutes < 0) {
                // Past time
                if (absMinutes < 60) {
                  return `${absMinutes}min ago`;
                } else if (minutes === 0) {
                  return `${hours}h ago`;
                } else {
                  return `${hours}h ${minutes}min ago`;
                }
              } else {
                // Future time
                if (absMinutes < 60) {
                  return `in ${absMinutes}min`;
                } else if (minutes === 0) {
                  return `in ${hours}h`;
                } else {
                  return `in ${hours}h ${minutes}min`;
                }
              }
            };

            // Create popup content
            const popupContent = `
              <div style="min-width: 200px;">
                <div style="color: ${color}; font-weight: 700; margin-bottom: 4px;">${sigmet.type}</div>
                <div style="margin-bottom: 4px; color: #e5e7eb;"><span style="font-weight: 600;">Event:</span> <span style="color: #f3f4f6;">${sigmet.event}</span></div>
                <div style="margin-bottom: 4px; color: #e5e7eb;"><span style="font-weight: 600;">Severity:</span> <span style="color: ${color};">${sigmet.severity}</span></div>
                <div style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">${sigmet.description}</div>
                <div style="font-size: 11px; color: #6b7280;">
                  <div>Valid: ${formatZulu(sigmet.validTimeFrom)} (${formatRelativeTime(sigmet.validTimeFrom)})</div>
                  <div>Expires: ${formatZulu(sigmet.validTimeTo)} (${formatRelativeTime(sigmet.validTimeTo)})</div>
                </div>
              </div>
            `;

            // Bind popup to the clickable border
            border.bindPopup(popupContent);
            
            // Add both polygon (fill) and border to the map
            layerGroupsRef.current.weather.addLayer(polygon);
            layerGroupsRef.current.weather.addLayer(border);
          });

        } catch (error) {
          console.error('[PilotMap] Failed to load SIGMETs/AIRMETs:', error);
        }
      }
    };

    updateSigmetAirmet();
  }, [mapInstance, displayOptions.showSigmetAirmet]);

  // Update Winds Aloft display
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.weather) return;

    const updateWindsAloft = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Remove existing wind layers
      const existingLayers = layerGroupsRef.current.weather.getLayers();
      existingLayers.forEach((layer: any) => {
        if (layer._windStationId) {
          layerGroupsRef.current.weather.removeLayer(layer);
        }
      });

      if (displayOptions.showWindsAloft) {
        // Get current zoom level for visibility decisions
        const currentZoom = mapInstance.getZoom();
        
        // Only show winds aloft at zoom level 8 or higher
        if (currentZoom < 8) {
          return;
        }
        
        try {
          // For now, get all wind data without airport filtering
          const windsData = await weatherService.getWindsAloft();
          
          // Group winds by station to avoid superimposition
          const stationGroups = new Map();
          windsData.forEach((wind: any) => {
            if (!wind.lat || !wind.lon || !wind.windDir || !wind.windSpeed) return;
            
            const stationKey = `${wind.station}_${wind.lat.toFixed(3)}_${wind.lon.toFixed(3)}`;
            if (!stationGroups.has(stationKey)) {
              stationGroups.set(stationKey, []);
            }
            stationGroups.get(stationKey).push(wind);
          });

          // Only show one wind barb per station (prefer lower altitude)
          stationGroups.forEach((stationWinds) => {
            // Sort by altitude and take the lowest one
            stationWinds.sort((a, b) => a.level - b.level);
            const wind = stationWinds[0];

            // Calculate offset away from airport to avoid masking airport info
            let offsetLat = wind.lat;
            let offsetLon = wind.lon;
            
            if (airport?.position) {
              // Calculate direction from airport to wind station
              const airportLat = airport.position.lat;
              const airportLon = airport.position.lon;
              
              // Calculate bearing from airport to wind station
              const bearing = calculateBearing(airportLat, airportLon, wind.lat, wind.lon);
              
              // Offset the wind barb further away from the airport
              const offsetDistance = 0.05; // ~3nm offset
              const bearingRad = (bearing * Math.PI) / 180;
              
              offsetLat = wind.lat + offsetDistance * Math.cos(bearingRad);
              offsetLon = wind.lon + offsetDistance * Math.sin(bearingRad);
            } else {
              // If no airport, add small random offset
              offsetLat = wind.lat + (Math.random() - 0.5) * 0.01;
              offsetLon = wind.lon + (Math.random() - 0.5) * 0.01;
            }

            // Create wind barb icon
            const windBarb = createWindBarb(wind.windDir, wind.windSpeed, wind.level);
            
            const windMarker = L.marker([offsetLat, offsetLon], {
              icon: windBarb,
              interactive: true,
              pane: 'overlayPane'
            });

            (windMarker as any)._windStationId = wind.id;

            // Create popup content showing all altitude levels for this station
            const allLevelsHTML = stationWinds.map(w => 
              `<div style="margin-bottom: 2px; color: #e5e7eb; font-size: 12px;">
                <span style="font-weight: 600;">${w.level.toLocaleString()}ft:</span> ${w.windDir}° at ${w.windSpeed}kt
                ${w.temperature !== null ? ` (${w.temperature}°C)` : ''}
              </div>`
            ).join('');

            const popupContent = `
              <div style="min-width: 200px;">
                <div style="color: #ffffff; font-weight: 700; margin-bottom: 6px; font-size: 14px;">WINDS ALOFT</div>
                <div style="margin-bottom: 4px; color: #e5e7eb;"><span style="font-weight: 600;">Station:</span> ${wind.station}</div>
                <div style="margin-bottom: 4px; color: #e5e7eb;"><span style="font-weight: 600;">All Levels:</span></div>
                ${allLevelsHTML}
                <div style="font-size: 10px; color: #9ca3af; margin-top: 4px;">Updated: ${new Date(wind.timestamp).toLocaleTimeString()}</div>
              </div>
            `;

            windMarker.bindPopup(popupContent);
            layerGroupsRef.current.weather.addLayer(windMarker);
          });

        } catch (error) {
          console.error('[PilotMap] Failed to load Winds Aloft:', error);
        }
      }
    };

    updateWindsAloft();
  }, [mapInstance, displayOptions.showWindsAloft]);

  // Update winds aloft visibility on zoom changes
  useEffect(() => {
    if (!mapInstance) return;

    const handleZoomEnd = () => {
      // Trigger winds aloft update on zoom change
      const updateWindsAloft = async () => {
        const leafletModule = await import('leaflet');
        const L = leafletModule.default;

        // Remove existing wind layers
        const existingLayers = layerGroupsRef.current.weather.getLayers();
        existingLayers.forEach((layer: any) => {
          if (layer._windStationId) {
            layerGroupsRef.current.weather.removeLayer(layer);
          }
        });

        if (displayOptions.showWindsAloft) {
          // Get current zoom level for visibility decisions
          const currentZoom = mapInstance.getZoom();
          
          // Only show winds aloft at zoom level 8 or higher
          if (currentZoom < 8) {
            return;
          }
          
          try {
            // For now, get all wind data without airport filtering
            const windsData = await weatherService.getWindsAloft();
            console.log('[PilotMap] Redrawing winds aloft on zoom change:', windsData.length, 'stations');
            
            // Group winds by station to avoid superimposition
            const stationGroups = new Map();
            windsData.forEach((wind: any) => {
              if (!wind.lat || !wind.lon || !wind.windDir || !wind.windSpeed) return;
              
              const stationKey = `${wind.station}_${wind.lat.toFixed(3)}_${wind.lon.toFixed(3)}`;
              if (!stationGroups.has(stationKey)) {
                stationGroups.set(stationKey, []);
              }
              stationGroups.get(stationKey).push(wind);
            });

            // Only show one wind barb per station (prefer lower altitude)
            stationGroups.forEach((stationWinds) => {
              // Sort by altitude and take the lowest one
              stationWinds.sort((a, b) => a.level - b.level);
              const wind = stationWinds[0];

              // Calculate offset away from airport to avoid masking airport info
              let offsetLat = wind.lat;
              let offsetLon = wind.lon;
              
              if (airport?.position) {
                // Calculate direction from airport to wind station
                const airportLat = airport.position.lat;
                const airportLon = airport.position.lon;
                
                // Calculate bearing from airport to wind station
                const bearing = calculateBearing(airportLat, airportLon, wind.lat, wind.lon);
                
                // Offset the wind barb further away from the airport
                const offsetDistance = 0.05; // ~3nm offset
                const bearingRad = (bearing * Math.PI) / 180;
                
                offsetLat = wind.lat + offsetDistance * Math.cos(bearingRad);
                offsetLon = wind.lon + offsetDistance * Math.sin(bearingRad);
              } else {
                // If no airport, add small random offset
                offsetLat = wind.lat + (Math.random() - 0.5) * 0.01;
                offsetLon = wind.lon + (Math.random() - 0.5) * 0.01;
              }

              // Create wind barb icon
              const windBarb = createWindBarb(wind.windDir, wind.windSpeed, wind.level);
              
              const windMarker = L.marker([offsetLat, offsetLon], {
                icon: windBarb,
                interactive: true,
                pane: 'overlayPane'
              });

              (windMarker as any)._windStationId = wind.id;

              // Create popup content showing all altitude levels for this station
              const allLevelsHTML = stationWinds.map(w => 
                `<div style="margin-bottom: 2px; color: #e5e7eb; font-size: 12px;">
                  <span style="font-weight: 600;">${w.level.toLocaleString()}ft:</span> ${w.windDir}° at ${w.windSpeed}kt
                  ${w.temperature !== null ? ` (${w.temperature}°C)` : ''}
                </div>`
              ).join('');

              const popupContent = `
                <div style="min-width: 200px;">
                  <div style="color: #ffffff; font-weight: 700; margin-bottom: 6px; font-size: 14px;">WINDS ALOFT</div>
                  <div style="margin-bottom: 4px; color: #e5e7eb;"><span style="font-weight: 600;">Station:</span> ${wind.station}</div>
                  <div style="margin-bottom: 4px; color: #e5e7eb;"><span style="font-weight: 600;">All Levels:</span></div>
                  ${allLevelsHTML}
                  <div style="font-size: 10px; color: #9ca3af; margin-top: 4px;">Updated: ${new Date(wind.timestamp).toLocaleTimeString()}</div>
                </div>
              `;

              windMarker.bindPopup(popupContent);
              layerGroupsRef.current.weather.addLayer(windMarker);
            });

          } catch (error) {
            console.error('[PilotMap] Failed to load Winds Aloft on zoom change:', error);
          }
        }
      };

      updateWindsAloft();
    };

    // Listen for zoom changes
    mapInstance.on('zoomend', handleZoomEnd);

    // Cleanup function
    return () => {
      mapInstance.off('zoomend', handleZoomEnd);
    };
  }, [mapInstance, displayOptions.showWindsAloft, airport]);

  // Update Icing Forecast display
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.weather) return;

    const updateIcing = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Remove existing Icing layers
      const existingLayers = layerGroupsRef.current.weather.getLayers();
      existingLayers.forEach((layer: any) => {
        if (layer._icingId) {
          layerGroupsRef.current.weather.removeLayer(layer);
        }
      });

      if (displayOptions.showIcing) {
        try {
          const icingForecasts = await weatherService.getIcing();
          
          icingForecasts.forEach((icing) => {
            if (!icing.geometry || icing.geometry.length < 3) return;

            const coordinates = icing.geometry.map((coord: { lat: number; lon: number }) => [coord.lat, coord.lon] as [number, number]);

            // Icing-specific colors (blue tones)
            let color = '#60a5fa'; // Light blue for moderate
            let strokeWidth = 4;
            let fillOpacity = 0.08;
            let strokeOpacity = 0.15; // Much less opacity for less distracting contour lines
            
            if (icing.severity === 'SEVERE' || icing.severity === 'EXTREME') {
              color = '#3b82f6'; // Blue
              strokeWidth = 5;
              fillOpacity = 0.1;
              strokeOpacity = 0.2; // Slightly more visible for severe/extreme
            } else if (icing.severity === 'MODERATE') {
              color = '#60a5fa'; // Lighter blue
              strokeWidth = 4.5;
              fillOpacity = 0.08;
              strokeOpacity = 0.18;
            }

            // Create polygon: non-interactive fill + clickable border
            const polygon = L.polygon(coordinates, {
              color: color,
              weight: strokeWidth,
              opacity: strokeOpacity,
              fillColor: color,
              fillOpacity: fillOpacity,
              interactive: false, // Make fill non-interactive
              pane: 'overlayPane',
              bubblingMouseEvents: false
            });

            // Create clickable border (polyline with same coordinates)
            const border = L.polyline(coordinates, {
              color: color,
              weight: strokeWidth,
              opacity: strokeOpacity,
              interactive: true, // Make border clickable
              pane: 'overlayPane'
            });

            // Store ID for cleanup on both elements
            (polygon as any)._icingId = icing.id;
            (border as any)._icingId = icing.id;

            const formatZulu = (dateString: string) => {
              const date = new Date(dateString);
              const hours = date.getUTCHours().toString().padStart(2, '0');
              const minutes = date.getUTCMinutes().toString().padStart(2, '0');
              return `${hours}${minutes}Z`;
            };

            const popupContent = `
              <div style="min-width: 200px;">
                <div style="color: ${color}; font-weight: 700; margin-bottom: 4px;">ICING FORECAST</div>
                <div style="margin-bottom: 4px; color: #e5e7eb;"><span style="font-weight: 600;">Severity:</span> <span style="color: ${color};">${icing.severity}</span></div>
                <div style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">${icing.description}</div>
                <div style="font-size: 11px; color: #6b7280;">
                  <div>Valid: ${formatZulu(icing.validTimeFrom)} - ${formatZulu(icing.validTimeTo)}</div>
                  ${icing.altitudeLow1 ? `<div>Altitude: ${icing.altitudeLow1}ft - ${icing.altitudeHi1}ft</div>` : ''}
                </div>
              </div>
            `;

            // Bind popup to the clickable border
            border.bindPopup(popupContent);
            
            // Add both polygon (fill) and border to the map
            layerGroupsRef.current.weather.addLayer(polygon);
            layerGroupsRef.current.weather.addLayer(border);
          });

        } catch (error) {
          console.error('[PilotMap] Failed to load Icing:', error);
        }
      }
    };

    updateIcing();
  }, [mapInstance, displayOptions.showIcing]);

  // Update Turbulence Forecast display
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.weather) return;

    const updateTurbulence = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Remove existing Turbulence layers
      const existingLayers = layerGroupsRef.current.weather.getLayers();
      existingLayers.forEach((layer: any) => {
        if (layer._turbulenceId) {
          layerGroupsRef.current.weather.removeLayer(layer);
        }
      });

      if (displayOptions.showTurbulence) {
        try {
          const turbulenceForecasts = await weatherService.getTurbulence();
          
          turbulenceForecasts.forEach((turbulence) => {
            if (!turbulence.geometry || turbulence.geometry.length < 3) return;

            const coordinates = turbulence.geometry.map((coord: { lat: number; lon: number }) => [coord.lat, coord.lon] as [number, number]);

            // Turbulence-specific colors (purple tones)
            let color = '#a78bfa'; // Light purple for moderate
            let strokeWidth = 4;
            let fillOpacity = 0.08;
            let strokeOpacity = 0.15; // Much less opacity for less distracting contour lines
            
            if (turbulence.severity === 'SEVERE' || turbulence.severity === 'EXTREME') {
              color = '#8b5cf6'; // Purple
              strokeWidth = 5;
              fillOpacity = 0.1;
              strokeOpacity = 0.2; // Slightly more visible for severe/extreme
            } else if (turbulence.severity === 'MODERATE') {
              color = '#a78bfa'; // Lighter purple
              strokeWidth = 4.5;
              fillOpacity = 0.08;
              strokeOpacity = 0.15;
            }

            // Create polygon: non-interactive fill + clickable border
            const polygon = L.polygon(coordinates, {
              color: color,
              weight: strokeWidth,
              opacity: strokeOpacity,
              fillColor: color,
              fillOpacity: fillOpacity,
              interactive: false, // Make fill non-interactive
              pane: 'overlayPane',
              bubblingMouseEvents: false
            });

            // Create clickable border (polyline with same coordinates)
            const border = L.polyline(coordinates, {
              color: color,
              weight: strokeWidth,
              opacity: strokeOpacity,
              interactive: true, // Make border clickable
              pane: 'overlayPane'
            });

            // Store ID for cleanup on both elements
            (polygon as any)._turbulenceId = turbulence.id;
            (border as any)._turbulenceId = turbulence.id;

            const formatZulu = (dateString: string) => {
              const date = new Date(dateString);
              const hours = date.getUTCHours().toString().padStart(2, '0');
              const minutes = date.getUTCMinutes().toString().padStart(2, '0');
              return `${hours}${minutes}Z`;
            };

            const popupContent = `
              <div style="min-width: 200px;">
                <div style="color: ${color}; font-weight: 700; margin-bottom: 4px;">TURBULENCE FORECAST</div>
                <div style="margin-bottom: 4px; color: #e5e7eb;"><span style="font-weight: 600;">Severity:</span> <span style="color: ${color};">${turbulence.severity}</span></div>
                <div style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">${turbulence.description}</div>
                <div style="font-size: 11px; color: #6b7280;">
                  <div>Valid: ${formatZulu(turbulence.validTimeFrom)} - ${formatZulu(turbulence.validTimeTo)}</div>
                  ${turbulence.altitudeLow1 ? `<div>Altitude: ${turbulence.altitudeLow1}ft - ${turbulence.altitudeHi1}ft</div>` : ''}
                </div>
              </div>
            `;

            // Bind popup to the clickable border
            border.bindPopup(popupContent);
            
            // Add both polygon (fill) and border to the map
            layerGroupsRef.current.weather.addLayer(polygon);
            layerGroupsRef.current.weather.addLayer(border);
          });

        } catch (error) {
          console.error('[PilotMap] Failed to load Turbulence:', error);
        }
      }
    };

    updateTurbulence();
  }, [mapInstance, displayOptions.showTurbulence]);

  // Update Weather PIREPs display
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.weather) return;

    const updateWeatherPireps = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Get current zoom level for visibility decisions
      const currentZoom = mapInstance.getZoom();

      // Remove existing weather PIREP layers
      const existingLayers = layerGroupsRef.current.weather.getLayers();
      existingLayers.forEach((layer: any) => {
        if (layer._weatherPirepId) {
          layerGroupsRef.current.weather.removeLayer(layer);
        }
      });

      if (displayOptions.showWeatherPireps) {
        // Only show weather PIREPs at zoom level 10 or higher (same as waypoints)
        if (currentZoom < 7) {
          return;
        }
        try {
          const weatherPireps = await weatherService.getWeatherPireps();
          
          weatherPireps.forEach((pirep: any) => {
            if (!pirep.lat || !pirep.lon || isNaN(pirep.lat) || isNaN(pirep.lon)) return;

            // Determine priority styling based on conditions
            const isUrgent = (pirep.tbInt1 && ['SEV', 'SEV-EXTM', 'EXTM'].includes(pirep.tbInt1)) ||
                           (pirep.icgInt1 && ['SEV'].includes(pirep.icgInt1)) ||
                           pirep.pirepType?.includes('Urgent') || false;

            const hasModerate = (pirep.tbInt1 && ['MOD', 'MOD-SEV'].includes(pirep.tbInt1)) ||
                              (pirep.icgInt1 && ['MOD', 'MOD-SEV'].includes(pirep.icgInt1)) || false;

            // Choose color based on priority
            let color = '#10b981'; // Green for light/normal conditions
            if (isUrgent) {
              color = '#ef4444'; // Red for urgent
            } else if (hasModerate) {
              color = '#f59e0b'; // Amber for moderate
            }

            // Create custom PIREP icon
            const pirepIcon = L.divIcon({
              html: `<div style="
                width: 22px;
                height: 22px;
                background: ${color};
                border: 2px solid #ffffff;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                color: white;
              ">W</div>`,
              className: 'custom-weather-pirep-marker',
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });

            const marker = L.marker([pirep.lat, pirep.lon], { 
              icon: pirepIcon,
              pane: 'markerPane' // Use markerPane for the marker itself
            });

            marker.setZIndexOffset(2000); // High z-index offset to match ATC PIREPs

            // Helper functions to format time in UTC (Zulu)
            const formatZulu = (date: Date) => {
              if (isNaN(date.getTime())) return 'Unknown time';
              const hours = date.getUTCHours().toString().padStart(2, '0');
              const minutes = date.getUTCMinutes().toString().padStart(2, '0');
              const day = date.getUTCDate().toString().padStart(2, '0');
              const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
              const year = date.getUTCFullYear();
              return `${year}-${month}-${day} ${hours}${minutes}Z`;
            };

            const formatRelativeTime = (date: Date) => {
              if (isNaN(date.getTime())) return 'Unknown';
              
              const now = new Date();
              const diffMs = now.getTime() - date.getTime();
              const diffMinutes = Math.floor(diffMs / 60000);
              
              if (diffMinutes < 0) {
                // Future time (shouldn't happen for PIREPs, but handle it)
                return 'Future';
              }
              
              // Format as "X min ago" or "X hours Y min ago"
              if (diffMinutes < 60) {
                return `${diffMinutes} min ago`;
              } else {
                const hours = Math.floor(diffMinutes / 60);
                const minutes = diffMinutes % 60;
                if (minutes === 0) {
                  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
                } else {
                  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} min ago`;
                }
              }
            };

            // Get the observation time (prefer obsTime, fallback to receiptTime)
            const obsTime = pirep.obsTime 
              ? new Date(pirep.obsTime)
              : pirep.receiptTime
              ? new Date(pirep.receiptTime)
              : null;
            
            // Create popup content
            const altitudeStr = pirep.fltLvlFt 
              ? `${pirep.fltLvlFt.toLocaleString()} ft`
              : pirep.fltLvl 
              ? `FL${pirep.fltLvl}`
              : 'Unknown altitude';

            const conditions = [];
            if (pirep.tbInt1 && pirep.tbType1) {
              conditions.push(`Turbulence: ${pirep.tbInt1} ${pirep.tbType1}${pirep.tbBas1 ? ` ${pirep.tbBas1}-${pirep.tbTop1}ft` : ''}`);
            }
            if (pirep.icgInt1 && pirep.icgType1) {
              conditions.push(`Icing: ${pirep.icgInt1} ${pirep.icgType1}${pirep.icgBas1 ? ` ${pirep.icgBas1}-${pirep.icgTop1}ft` : ''}`);
            }
            if (pirep.wxString) {
              conditions.push(`Weather: ${pirep.wxString}`);
            }
            if (pirep.clouds && Array.isArray(pirep.clouds) && pirep.clouds.length > 0) {
              const cloudDesc = pirep.clouds.map((c: any) => `${c.cover}${c.base ? ` ${c.base}ft` : ''}`).join(', ');
              conditions.push(`Clouds: ${cloudDesc}`);
            }

            const conditionsHtml = conditions.length > 0
              ? `<ul style="margin: 8px 0; padding-left: 16px; font-size: 12px; color: #f3f4f6;">
                  ${conditions.map(c => `<li>${c}</li>`).join('')}
                </ul>`
              : '<p style="margin: 4px 0; font-size: 12px; color: #9ca3af;">No specific conditions reported</p>';

            // Create a function to generate popup content with current relative time
            const createPopupContent = () => {
              // Recalculate relative time to keep it current
              const zuluTimeStr = obsTime ? formatZulu(obsTime) : 'Unknown time';
              const currentRelativeTime = obsTime ? formatRelativeTime(obsTime) : 'Unknown';
              
              return `
                <div style="min-width: 200px;">
                  <div style="margin-bottom: 8px;">
                    <h4 style="margin: 0; color: ${color};"><strong>WEATHER PIREP</strong></h4>
                  </div>
                  <p style="margin: 4px 0; font-size: 12px; color: #e5e7eb;">
                    ${zuluTimeStr} (${currentRelativeTime})<br/>
                    ${pirep.acType || 'Unknown aircraft'} at ${altitudeStr}
                    ${pirep.icaoId ? `<br/>Location: ${pirep.icaoId}` : ''}
                  </p>
                  ${conditionsHtml}
                  ${pirep.rawOb ? `<p style="margin: 8px 0; font-size: 11px; font-style: italic; color: #d1d5db; font-family: monospace;">${pirep.rawOb}</p>` : ''}
                </div>
              `;
            };

            // Bind popup with options to ensure it appears on top
            marker.bindPopup(createPopupContent(), {
              className: 'weather-pirep-popup', // Add specific class for styling
              maxWidth: 300,
              autoPan: true,
              keepInView: true
            });
            
            // Ensure popup appears on top when opened and update relative time
            marker.on('popupopen', () => {
              const popup = marker.getPopup();
              if (popup && popup.getElement()) {
                const popupElement = popup.getElement();
                if (popupElement) {
                  popupElement.style.zIndex = '3501';
                  // Also ensure the popupPane itself is on top
                  const popupPane = mapInstance.getPane('popupPane');
                  if (popupPane) {
                    popupPane.style.zIndex = '3500';
                  }
                }
              }
              
              // Update popup content to refresh relative time
              if (popup && obsTime) {
                popup.setContent(createPopupContent());
              }
              
              // Set up interval to update relative time every 30 seconds while popup is open
              const updateInterval = setInterval(() => {
                if (popup && popup.isOpen() && obsTime) {
                  popup.setContent(createPopupContent());
                } else {
                  clearInterval(updateInterval);
                }
              }, 30000); // Update every 30 seconds
              
              // Clean up interval when popup closes
              marker.once('popupclose', () => {
                clearInterval(updateInterval);
              });
            });
            
            (marker as any)._weatherPirepId = pirep.id;
            layerGroupsRef.current.weather.addLayer(marker);
          });

        } catch (error) {
          console.error('[PilotMap] Failed to load weather PIREPs:', error);
        }
      }
    };

    updateWeatherPireps();

    // Listen for zoom changes to update weather PIREPs visibility
    const handleZoomEnd = () => {
      updateWeatherPireps();
    };

    mapInstance.on('zoomend', handleZoomEnd);

    return () => {
      mapInstance.off('zoomend', handleZoomEnd);
    };
  }, [mapInstance, displayOptions.showWeatherPireps]);

  // Update METAR stations display
  useEffect(() => {
    if (!mapInstance || !layerGroupsRef.current.weather) return;

    const updateMetars = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Get current zoom level for visibility decisions
      const currentZoom = mapInstance.getZoom();

      // Remove existing METAR layers
      const existingLayers = layerGroupsRef.current.weather.getLayers();
      existingLayers.forEach((layer: any) => {
        if (layer._metarId) {
          layerGroupsRef.current.weather.removeLayer(layer);
        }
      });

      if (displayOptions.showMetars) {
        // Only show METARs at zoom level 8 or higher to prevent clutter
        if (currentZoom < 8) {
          return;
        }

        try {
          const metars = await weatherService.getMetars();
          
          metars.forEach((metar: any) => {
            if (!metar.lat || !metar.lon || isNaN(metar.lat) || isNaN(metar.lon)) return;

            // Determine color based on flight category
            let color = '#6b7280'; // Gray for unknown
            let borderColor = '#ffffff';
            
            switch (metar.flightCategory) {
              case 'LIFR':
                color = '#7c2d12'; // Dark red/brown
                break;
              case 'IFR':
                color = '#dc2626'; // Red
                break;
              case 'MVFR':
                color = '#f59e0b'; // Amber
                break;
              case 'VFR':
                color = '#10b981'; // Green
                break;
              default:
                color = '#6b7280'; // Gray for unknown
            }

            // Format time helpers
            const formatZulu = (dateString: string) => {
              const date = new Date(dateString);
              if (isNaN(date.getTime())) return 'Unknown';
              const hours = date.getUTCHours().toString().padStart(2, '0');
              const minutes = date.getUTCMinutes().toString().padStart(2, '0');
              const day = date.getUTCDate().toString().padStart(2, '0');
              const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
              const year = date.getUTCFullYear();
              return `${year}-${month}-${day} ${hours}${minutes}Z`;
            };

            const formatRelativeTime = (dateString: string) => {
              const date = new Date(dateString);
              if (isNaN(date.getTime())) return 'Unknown';
              
              const now = new Date();
              const diffMs = now.getTime() - date.getTime();
              const diffMinutes = Math.floor(diffMs / 60000);
              
              if (diffMinutes < 0) return 'Future';
              if (diffMinutes < 60) return `${diffMinutes} min ago`;
              
              const hours = Math.floor(diffMinutes / 60);
              const minutes = diffMinutes % 60;
              if (minutes === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
              return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} min ago`;
            };

            // Create METAR station icon (square with station ID)
            const metarIcon = L.divIcon({
              html: `<div style="
                width: 24px;
                height: 24px;
                background: ${color};
                border: 2px solid ${borderColor};
                border-radius: 3px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 9px;
                font-weight: bold;
                color: white;
                line-height: 1;
                text-align: center;
              ">${(metar.icaoId || metar.stationId || '?').substring(0, 4)}</div>`,
              className: 'custom-metar-marker',
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            });

            const marker = L.marker([metar.lat, metar.lon], {
              icon: metarIcon,
              pane: 'markerPane'
            });

            marker.setZIndexOffset(1900); // Below PIREPs but above other weather

            // Build popup content
            const obsTime = metar.observationTime;
            const zuluTime = obsTime ? formatZulu(obsTime) : 'Unknown';
            const relativeTime = obsTime ? formatRelativeTime(obsTime) : 'Unknown';

            const windStr = metar.windDir !== null && metar.windSpeed !== null
              ? `${metar.windDir}° at ${metar.windSpeed}${metar.windGust ? `G${metar.windGust}` : ''}kt`
              : 'Calm';

            const tempStr = metar.temperature !== null
              ? `${metar.temperature}°C${metar.dewpoint !== null ? `/${metar.dewpoint}°C` : ''}`
              : 'N/A';

            const visStr = metar.visibility !== null
              ? `${metar.visibility} SM`
              : 'N/A';

            const altStr = metar.altimeter !== null
              ? `${metar.altimeter.toFixed(2)} inHg`
              : 'N/A';

            const cloudsStr = metar.clouds && Array.isArray(metar.clouds) && metar.clouds.length > 0
              ? metar.clouds.map((c: any) => {
                  if (c.cover === 'CLR' || c.cover === 'SKC') return 'Clear';
                  if (c.cover === 'FEW') return `Few ${c.base ? c.base + 'ft' : ''}`;
                  if (c.cover === 'SCT') return `Scattered ${c.base ? c.base + 'ft' : ''}`;
                  if (c.cover === 'BKN') return `Broken ${c.base ? c.base + 'ft' : ''}`;
                  if (c.cover === 'OVC') return `Overcast ${c.base ? c.base + 'ft' : ''}`;
                  return `${c.cover} ${c.base ? c.base + 'ft' : ''}`;
                }).join(', ')
              : 'Clear';

            const popupContent = `
              <div style="min-width: 250px;">
                <div style="margin-bottom: 8px;">
                  <h4 style="margin: 0; color: ${color};"><strong>METAR - ${metar.icaoId || metar.stationId}</strong></h4>
                  <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">Flight Category: <strong style="color: ${color};">${metar.flightCategory || 'UNKNOWN'}</strong></div>
                </div>
                <p style="margin: 4px 0; font-size: 12px; color: #e5e7eb;">
                  ${zuluTime} (${relativeTime})
                </p>
                <div style="margin: 8px 0; font-size: 12px; color: #f3f4f6;">
                  <div><strong>Wind:</strong> ${windStr}</div>
                  <div><strong>Temp/Dewpoint:</strong> ${tempStr}</div>
                  <div><strong>Visibility:</strong> ${visStr}</div>
                  <div><strong>Altimeter:</strong> ${altStr}</div>
                  <div><strong>Clouds:</strong> ${cloudsStr}</div>
                  ${metar.wxString ? `<div><strong>Weather:</strong> ${metar.wxString}</div>` : ''}
                </div>
                ${metar.rawOb ? `<p style="margin: 8px 0; font-size: 10px; font-style: italic; color: #d1d5db; font-family: monospace; word-break: break-all;">${metar.rawOb}</p>` : ''}
              </div>
            `;

            marker.bindPopup(popupContent, {
              className: 'metar-popup',
              maxWidth: 280,
              autoPan: true,
              keepInView: true
            });
            
            (marker as any)._metarId = metar.id;
            layerGroupsRef.current.weather.addLayer(marker);
          });

        } catch (error) {
          console.error('[PilotMap] Failed to load METARs:', error);
        }
      }
    };

    updateMetars();

    // Listen for zoom changes to update METAR visibility
    const handleZoomEnd = () => {
      updateMetars();
    };

    mapInstance.on('zoomend', handleZoomEnd);

    return () => {
      mapInstance.off('zoomend', handleZoomEnd);
    };
  }, [mapInstance, displayOptions.showMetars]);

  const renderRunways = (mapInstance: L.Map, osmData: any, currentZoom: number, Leaflet: typeof L) => {
    mapInstance.eachLayer((layer: any) => {
      if (layer._runwayLabel || layer._runwayPolyline) {
        mapInstance.removeLayer(layer);
      }
    });
    
    const getRunwayWeight = (zoom: number): number => {
      if (zoom <= 9) return 2;
      if (zoom <= 11) return 3;
      if (zoom <= 13) return 5;
      if (zoom <= 15) return 7;
      return 8;
    };
    
    const runwayWeight = getRunwayWeight(currentZoom);
    
    osmData.runways.forEach((way: any) => {
      if (way.geometry && way.geometry.length > 1) {
        const coordinates = way.geometry.map((point: any) => {
          if (!point || !point.lat || !point.lon || isNaN(point.lat) || isNaN(point.lon)) {
            return null;
          }
          return [point.lat, point.lon] as [number, number];
        }).filter((coord: any) => coord !== null);
        
        if (coordinates.length < 2) return;
        
        const runway = Leaflet.polyline(coordinates, {
          color: '#0ea5e9',
          weight: runwayWeight,
          opacity: 1.0,
          interactive: false,
          pane: 'markerPane',
          zIndexOffset: 10 // Set z-index to 610 (10 + markerPane base 600), below tracks at 630
        });
        (runway as any)._runwayPolyline = true;
        runway.addTo(mapInstance);

        if (currentZoom >= 11) {
          const runwayRef = way.tags?.ref;
          if (runwayRef && runwayRef.includes('/')) {
            const runwayNumbers = runwayRef.split('/');
            const startPoint = coordinates[0];
            const endPoint = coordinates[coordinates.length - 1];
            
            const startLabel = Leaflet.marker(startPoint, {
              icon: Leaflet.divIcon({
                className: "runway-label",
                html: `<div style="
                  color: #ffffff; font-size: 10px; font-weight: 700;
                  text-shadow: 
                    -1px -1px 0 #000000,
                    1px -1px 0 #000000,
                    -1px 1px 0 #000000,
                    1px 1px 0 #000000,
                    0 0 2px rgba(0,0,0,0.8);
                  background: rgba(0,0,0,0.3); padding: 1px 2px;
                  border-radius: 1px; white-space: nowrap; 
                  text-align: center; line-height: 1;
                  display: inline-block; z-index: 3000;
                ">${runwayNumbers[0]}</div>`,
                iconSize: [20, 14], iconAnchor: [10, 14]
              }),
              interactive: false, pane: 'popupPane'
            });
            startLabel.addTo(mapInstance);
            (startLabel as any)._runwayLabel = true;

            const endLabel = Leaflet.marker(endPoint, {
              icon: Leaflet.divIcon({
                className: "runway-label",
                html: `<div style="
                  color: #ffffff; font-size: 10px; font-weight: 700;
                  text-shadow: 
                    -1px -1px 0 #000000,
                    1px -1px 0 #000000,
                    -1px 1px 0 #000000,
                    1px 1px 0 #000000,
                    0 0 2px rgba(0,0,0,0.8);
                  background: rgba(0,0,0,0.3); padding: 1px 2px;
                  border-radius: 1px; white-space: nowrap; 
                  text-align: center; line-height: 1;
                  display: inline-block; z-index: 3000;
                ">${runwayNumbers[1]}</div>`,
                iconSize: [20, 14], iconAnchor: [10, 14]
              }),
              interactive: false, pane: 'popupPane'
            });
            endLabel.addTo(mapInstance);
            (endLabel as any)._runwayLabel = true;
          }
        }
      }
    });
  };

  const renderExtendedCenterlines = (
    osmData: any,
    displayOptions: any,
    layerGroupsRef: React.MutableRefObject<Record<string, L.LayerGroup>>,
    Leaflet: typeof L
  ) => {
    if (displayOptions.showExtendedCenterlines && layerGroupsRef.current.extendedCenterlines) {
      layerGroupsRef.current.extendedCenterlines.clearLayers();
      
      osmData.runways.forEach((runway: any) => {
        try {
          const coordinates = runway.geometry || [];
          if (coordinates.length < 2) {
            return;
          }

          const startPoint = coordinates[0];
          const endPoint = coordinates[coordinates.length - 1];

          if (!startPoint || !endPoint || !startPoint.lat || !startPoint.lon || !endPoint.lat || !endPoint.lon) {
            return;
          }

          const dx = endPoint.lat - startPoint.lat;
          const dy = endPoint.lon - startPoint.lon;
          const length = Math.sqrt(dx * dx + dy * dy);

          if (length === 0) {
            return;
          }

          const extendedDistance = 30 * 1.852;
          const kmToDegrees = 1 / 111;

          const extendedStartLat = startPoint.lat - (dx / length) * extendedDistance * kmToDegrees;
          const extendedStartLon = startPoint.lon - (dy / length) * extendedDistance * kmToDegrees;

          const extendedEndLat = endPoint.lat + (dx / length) * extendedDistance * kmToDegrees;
          const extendedEndLon = endPoint.lon + (dy / length) * extendedDistance * kmToDegrees;

          const centerLine1 = Leaflet.polyline(
            [
              [startPoint.lat, startPoint.lon],
              [extendedStartLat, extendedStartLon],
            ],
            {
              color: "#9ca3af",
              weight: 2,
              opacity: 0.8,
              dashArray: "8,4",
              interactive: false,
              pane: 'markerPane',
              zIndexOffset: 10 // Set z-index to 610 (10 + markerPane base 600), below tracks at 630
            }
          );

          const centerLine2 = Leaflet.polyline(
            [
              [endPoint.lat, endPoint.lon],
              [extendedEndLat, extendedEndLon],
            ],
            {
              color: "#9ca3af",
              weight: 2,
              opacity: 0.8,
              dashArray: "8,4",
              interactive: false,
              pane: 'markerPane',
              zIndexOffset: 10 // Set z-index to 610 (10 + markerPane base 600), below tracks at 630
            }
          );

          layerGroupsRef.current.extendedCenterlines.addLayer(centerLine1);
          layerGroupsRef.current.extendedCenterlines.addLayer(centerLine2);
        } catch (error) {
          console.warn("Error drawing extended centerline:", error, runway);
        }
      });
    } else if (layerGroupsRef.current.extendedCenterlines) {
      layerGroupsRef.current.extendedCenterlines.clearLayers();
    }
  };

  // Update OSM features display - WITH ZOOM-BASED VISIBILITY
  useEffect(() => {
    if (!mapInstance || !osmData) return;

    const updateOSMFeatures = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Get current zoom level for visibility decisions
      const currentZoom = mapInstance.getZoom();

      // Clear ALL existing OSM features first
      layerGroupsRef.current.osm.clearLayers();

      // 1. Render other airport features FIRST (if toggle is enabled)
      if (displayOptions.showOSMFeatures) {
        // Taxiways - show at zoom 10+, major taxiways at zoom 10+, all at zoom 12+
        if (currentZoom >= 10) {
          osmData.taxiways.forEach(way => {
            if (way.geometry && way.geometry.length > 1) {
              const taxiwayRef = way.tags?.ref;
              const isMajorTaxiway = taxiwayRef && taxiwayRef.length === 1 && /^[A-Z]$/.test(taxiwayRef);
              const isMainTaxiway = taxiwayRef && ['A', 'B', 'C', 'D', 'E', 'F'].includes(taxiwayRef);
              
              // Show major taxiways at zoom 10+, all taxiways at zoom 12+
              const shouldShowTaxiway = isMainTaxiway || currentZoom >= 12;
              
              if (shouldShowTaxiway) {
                const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
                const taxiway = L.polyline(coordinates, {
                  color: '#8b5cf6', weight: 2, opacity: 0.8, interactive: false, pane: 'overlayPane'
                });
                layerGroupsRef.current.osm.addLayer(taxiway);

                // Add taxiway labels for major taxiways at zoom 14+
                if (isMajorTaxiway && currentZoom >= 14) {
                  const midIndex = Math.floor(coordinates.length / 2);
                  const midPoint = coordinates[midIndex];
                  
                  const taxiwayLabel = L.marker([midPoint[0], midPoint[1]], {
                    icon: L.divIcon({
                      className: "taxiway-label",
                      html: `<div style="
                        color: #8b5cf6; font-size: 9px; font-weight: bold;
                        text-shadow: 0px 0px 2px rgba(0,0,0,1), 0px 0px 4px rgba(0,0,0,0.8);
                        background: rgba(0,0,0,0.55); padding: 0px 1px; border-radius: 1px;
                        border: 1px solid rgba(139,92,246,0.5); white-space: nowrap;
                        z-index: 2000; display: flex; align-items: center; justify-content: center;
                        min-width: 12px; min-height: 10px;
                      ">${taxiwayRef}</div>`,
                      iconSize: [14, 12], iconAnchor: [7, 6]
                    }),
                    interactive: false,
                    pane: 'popupPane'
                  });
                  taxiwayLabel.setZIndexOffset(2000);
                  layerGroupsRef.current.osm.addLayer(taxiwayLabel);
                }
              }
            }
          });
        }

        // Terminals - show at zoom 12+
        if (currentZoom >= 12) {
          osmData.terminals.forEach(way => {
            if (way.geometry && way.geometry.length > 2) {
              const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
              const terminal = L.polygon(coordinates, {
                color: '#3b82f6', weight: 1, opacity: 0.6, fillOpacity: 0.2, interactive: false, pane: 'overlayPane'
              });
              layerGroupsRef.current.osm.addLayer(terminal);

              // Add terminal labels at zoom 14+
              const terminalName = way.tags?.name || way.tags?.ref;
              if (terminalName && currentZoom >= 14) {
                let sumLat = 0, sumLon = 0;
                coordinates.forEach(point => {
                  sumLat += point[0];
                  sumLon += point[1];
                });
                const centerLat = sumLat / coordinates.length;
                const centerLon = sumLon / coordinates.length;

                const terminalLabel = L.marker([centerLat, centerLon], {
                  icon: L.divIcon({
                    className: "terminal-label",
                    html: `<div style="
                      color: #3b82f6; font-size: 8px; font-weight: bold;
                      text-shadow: 0px 0px 2px rgba(0,0,0,1), 0px 0px 4px rgba(0,0,0,0.8);
                      background: none; padding: 0; white-space: nowrap;
                    ">${terminalName}</div>`,
                    iconSize: [40, 16], iconAnchor: [20, 8]
                  }),
                  interactive: false
                });
                layerGroupsRef.current.osm.addLayer(terminalLabel);
              }
            }
          });
        }

        // Aprons - show at zoom 13+
        if (currentZoom >= 13) {
          osmData.aprons.forEach(way => {
            if (way.geometry && way.geometry.length > 2) {
              const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
              const apron = L.polygon(coordinates, {
                color: '#64748b', weight: 1, opacity: 0.5, fillOpacity: 0.1, interactive: false
              });
              layerGroupsRef.current.osm.addLayer(apron);
            }
          });
        }

        // Hangars - show at zoom 13+
        if (currentZoom >= 13) {
          osmData.hangars.forEach(way => {
            if (way.geometry && way.geometry.length > 2) {
              const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
              const hangar = L.polygon(coordinates, {
                color: '#f59e0b', weight: 1, opacity: 0.7, fillOpacity: 0.3, interactive: false
              });
              layerGroupsRef.current.osm.addLayer(hangar);

              // Add hangar labels at zoom 15+
              const hangarName = way.tags?.name || way.tags?.ref || way.tags?.alt_name;
              if (hangarName && currentZoom >= 15) {
                let sumLat = 0, sumLon = 0;
                coordinates.forEach(point => {
                  sumLat += point[0];
                  sumLon += point[1];
                });
                const centerLat = sumLat / coordinates.length;
                const centerLon = sumLon / coordinates.length;

                const hangarLabel = L.marker([centerLat, centerLon], {
                  icon: L.divIcon({
                    className: "hangar-label",
                    html: `<div style="
                      color: #f59e0b; font-size: 7px; font-weight: bold;
                      text-shadow: 0px 0px 2px rgba(0,0,0,1), 0px 0px 4px rgba(0,0,0,0.8);
                      background: none; padding: 0; white-space: nowrap;
                    ">${hangarName}</div>`,
                    iconSize: [50, 14], iconAnchor: [25, 7]
                  }),
                  interactive: false
                });
                layerGroupsRef.current.osm.addLayer(hangarLabel);
              }
            }
          });
        }

        // Gates - show at zoom 14+
        if (currentZoom >= 14) {
          osmData.gates.forEach(node => {
            let lat, lon;
            if (node.lat && node.lon) {
              lat = node.lat; lon = node.lon;
            } else if (node.geometry && node.geometry.length > 0) {
              const point = node.geometry[0];
              lat = point.lat; lon = point.lon;
            }
            if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
              const gateRef = node.tags?.ref;
              if (gateRef) {
                const gateLabel = L.marker([lat, lon], {
                  icon: L.divIcon({
                    className: "gate-label",
                    html: `<div style="
                      color: #10b981; font-size: 9px; font-weight: bold;
                      text-shadow: 0px 0px 2px rgba(0,0,0,1);
                      background: rgba(0,0,0,0.55); padding: 0px 1px; border-radius: 1px;
                      border: 1px solid rgba(16,185,129,0.5); white-space: nowrap;
                      z-index: 2000; display: flex; align-items: center; justify-content: center;
                      min-width: 12px; min-height: 10px;
                    ">${gateRef}</div>`,
                    iconSize: [14, 12], iconAnchor: [7, 6]
                  }),
                  interactive: false,
                  pane: 'popupPane'
                });
                gateLabel.setZIndexOffset(2000);
                layerGroupsRef.current.osm.addLayer(gateLabel);
              }
            }
          });
        }

        // Control towers - show at zoom 12+
        if (currentZoom >= 12) {
          osmData.controlTowers.forEach(node => {
            let lat, lon;
            if (node.lat && node.lon) {
              lat = node.lat; lon = node.lon;
            } else if (node.geometry && node.geometry.length > 0) {
              const point = node.geometry[0];
              lat = point.lat; lon = point.lon;
            }
            if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
              const tower = L.circleMarker([lat, lon], {
                radius: 4, color: '#ef4444', weight: 2, opacity: 0.9, fillOpacity: 0.7, interactive: false
              });
              layerGroupsRef.current.osm.addLayer(tower);

              // Add control tower labels at zoom 14+
              const towerName = node.tags?.name || node.tags?.ref || 'TWR';
              if (currentZoom >= 14) {
                const towerLabel = L.marker([lat, lon], {
                  icon: L.divIcon({
                    className: "tower-label",
                    html: `<div style="
                      color: #ef4444; font-size: 8px; font-weight: bold;
                      text-shadow: 0px 0px 2px rgba(0,0,0,1), 0px 0px 4px rgba(0,0,0,0.8);
                      background: rgba(0,0,0,0.6); padding: 1px 2px; border-radius: 2px;
                      white-space: nowrap;
                    ">${towerName}</div>`,
                    iconSize: [20, 12], iconAnchor: [10, 6]
                  }),
                  interactive: false
                });
                layerGroupsRef.current.osm.addLayer(towerLabel);
              }
            }
          });
        }

        // Parking positions - show at zoom 15+
        if (currentZoom >= 15) {
          osmData.parkingPositions.forEach(node => {
            let lat, lon;
            if (node.lat && node.lon) {
              lat = node.lat; lon = node.lon;
            } else if (node.geometry && node.geometry.length > 0) {
              const point = node.geometry[0];
              lat = point.lat; lon = point.lon;
            }
            if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
              const parking = L.circleMarker([lat, lon], {
                radius: 2, color: '#6b7280', weight: 1, opacity: 0.6, fillOpacity: 0.4, interactive: false
              });
              layerGroupsRef.current.osm.addLayer(parking);

              // Add parking position labels at zoom 15+
              const parkingRef = node.tags?.ref;
              if (parkingRef) {
                const parkingLabel = L.marker([lat, lon], {
                  icon: L.divIcon({
                    className: "parking-label",
                    html: `<div style="
                      color: #6b7280; font-size: 7px; font-weight: bold;
                      text-shadow: 0px 0px 2px rgba(0,0,0,1);
                      background: rgba(0,0,0,0.6); padding: 1px 2px; border-radius: 2px;
                      white-space: nowrap;
                    ">${parkingRef}</div>`,
                    iconSize: [16, 10], iconAnchor: [8, 5]
                  }),
                  interactive: false
                });
                layerGroupsRef.current.osm.addLayer(parkingLabel);
              }
            }
          });
        }

        // Other features - show at zoom 13+
        if (currentZoom >= 13) {
          osmData.other.forEach(way => {
            if (way.geometry && way.geometry.length > 1) {
              const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
              const other = L.polyline(coordinates, {
                color: '#a78bfa', weight: 1, opacity: 0.5, interactive: false
              });
              layerGroupsRef.current.osm.addLayer(other);
            }
          });
        }
      }

      renderRunways(mapInstance, osmData, currentZoom, L);
      renderExtendedCenterlines(osmData, displayOptions, layerGroupsRef, L);
    };

    updateOSMFeatures();
  }, [mapInstance, displayOptions.showOSMFeatures, displayOptions.showExtendedCenterlines, osmData]);

  // Redraw OSM features when zoom changes
  useEffect(() => {
    if (!mapInstance || !osmData) return;

    const handleZoomEnd = () => {
      // Trigger OSM features update on zoom change
      const updateOSMFeatures = async () => {
        const leafletModule = await import('leaflet');
        const L = leafletModule.default;

        // Get current zoom level for visibility decisions
        const currentZoom = mapInstance.getZoom();

        // Clear ALL existing OSM features first
        layerGroupsRef.current.osm.clearLayers();

        // 1. Render other airport features FIRST (if toggle is enabled)
        if (displayOptions.showOSMFeatures) {
          console.log('[PilotMap] Redrawing airport features on zoom change:', {
            currentZoom,
            taxiways: osmData.taxiways.length,
            terminals: osmData.terminals.length,
            gates: osmData.gates.length
          });

          // Taxiways - show at zoom 10+, major taxiways at zoom 10+, all at zoom 12+
          if (currentZoom >= 10) {
            osmData.taxiways.forEach(way => {
              if (way.geometry && way.geometry.length > 1) {
                const taxiwayRef = way.tags?.ref;
                const isMajorTaxiway = taxiwayRef && taxiwayRef.length === 1 && /^[A-Z]$/.test(taxiwayRef);
                const isMainTaxiway = taxiwayRef && ['A', 'B', 'C', 'D', 'E', 'F'].includes(taxiwayRef);
                
                // Show major taxiways at zoom 10+, all taxiways at zoom 12+
                const shouldShowTaxiway = isMainTaxiway || currentZoom >= 12;
                
                if (shouldShowTaxiway) {
                  const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
                  const taxiway = L.polyline(coordinates, {
                    color: '#8b5cf6', weight: 2, opacity: 0.8, interactive: false, pane: 'overlayPane'
                  });
                  layerGroupsRef.current.osm.addLayer(taxiway);

                  // Add taxiway labels for major taxiways at zoom 14+
                  if (isMajorTaxiway && currentZoom >= 14) {
                    const midIndex = Math.floor(coordinates.length / 2);
                    const midPoint = coordinates[midIndex];
                    
                    const taxiwayLabel = L.marker([midPoint[0], midPoint[1]], {
                      icon: L.divIcon({
                        className: "taxiway-label",
                        html: `<div style="
                          color: #8b5cf6; font-size: 9px; font-weight: bold;
                          text-shadow: 0px 0px 2px rgba(0,0,0,1), 0px 0px 4px rgba(0,0,0,0.8);
                          background: rgba(0,0,0,0.55); padding: 0px 1px; border-radius: 1px;
                          border: 1px solid rgba(139,92,246,0.5); white-space: nowrap;
                          z-index: 2000; display: flex; align-items: center; justify-content: center;
                          min-width: 12px; min-height: 10px;
                        ">${taxiwayRef}</div>`,
                        iconSize: [14, 12], iconAnchor: [7, 6]
                      }),
                      interactive: false,
                      pane: 'popupPane'
                    });
                    taxiwayLabel.setZIndexOffset(2000);
                    layerGroupsRef.current.osm.addLayer(taxiwayLabel);
                  }
                }
              }
            });
          }

          // Terminals - show at zoom 12+
          if (currentZoom >= 12) {
            osmData.terminals.forEach(way => {
              if (way.geometry && way.geometry.length > 2) {
                const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
                const terminal = L.polygon(coordinates, {
                  color: '#3b82f6', weight: 1, opacity: 0.6, fillOpacity: 0.2, interactive: false, pane: 'overlayPane'
                });
                layerGroupsRef.current.osm.addLayer(terminal);

                // Add terminal labels at zoom 14+
                const terminalName = way.tags?.name || way.tags?.ref;
                if (terminalName && currentZoom >= 14) {
                  let sumLat = 0, sumLon = 0;
                  coordinates.forEach(point => {
                    sumLat += point[0];
                    sumLon += point[1];
                  });
                  const centerLat = sumLat / coordinates.length;
                  const centerLon = sumLon / coordinates.length;

                  const terminalLabel = L.marker([centerLat, centerLon], {
                    icon: L.divIcon({
                      className: "terminal-label",
                      html: `<div style="
                        color: #3b82f6; font-size: 8px; font-weight: bold;
                        text-shadow: 0px 0px 2px rgba(0,0,0,1), 0px 0px 4px rgba(0,0,0,0.8);
                        background: none; padding: 0; white-space: nowrap;
                      ">${terminalName}</div>`,
                      iconSize: [40, 16], iconAnchor: [20, 8]
                    }),
                    interactive: false
                  });
                  layerGroupsRef.current.osm.addLayer(terminalLabel);
                }
              }
            });
          }

          // Aprons - show at zoom 13+
          if (currentZoom >= 13) {
            osmData.aprons.forEach(way => {
              if (way.geometry && way.geometry.length > 2) {
                const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
                const apron = L.polygon(coordinates, {
                  color: '#64748b', weight: 1, opacity: 0.5, fillOpacity: 0.1, interactive: false
                });
                layerGroupsRef.current.osm.addLayer(apron);
              }
            });
          }

          // Hangars - show at zoom 13+
          if (currentZoom >= 13) {
            osmData.hangars.forEach(way => {
              if (way.geometry && way.geometry.length > 2) {
                const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
                const hangar = L.polygon(coordinates, {
                  color: '#f59e0b', weight: 1, opacity: 0.7, fillOpacity: 0.3, interactive: false
                });
                layerGroupsRef.current.osm.addLayer(hangar);

                // Add hangar labels at zoom 15+
                const hangarName = way.tags?.name || way.tags?.ref || way.tags?.alt_name;
                if (hangarName && currentZoom >= 15) {
                  let sumLat = 0, sumLon = 0;
                  coordinates.forEach(point => {
                    sumLat += point[0];
                    sumLon += point[1];
                  });
                  const centerLat = sumLat / coordinates.length;
                  const centerLon = sumLon / coordinates.length;

                  const hangarLabel = L.marker([centerLat, centerLon], {
                    icon: L.divIcon({
                      className: "hangar-label",
                      html: `<div style="
                        color: #f59e0b; font-size: 7px; font-weight: bold;
                        text-shadow: 0px 0px 2px rgba(0,0,0,1), 0px 0px 4px rgba(0,0,0,0.8);
                        background: none; padding: 0; white-space: nowrap;
                      ">${hangarName}</div>`,
                      iconSize: [50, 14], iconAnchor: [25, 7]
                    }),
                    interactive: false
                  });
                  layerGroupsRef.current.osm.addLayer(hangarLabel);
                }
              }
            });
          }

          // Gates - show at zoom 14+
          if (currentZoom >= 14) {
            osmData.gates.forEach(node => {
              let lat, lon;
              if (node.lat && node.lon) {
                lat = node.lat; lon = node.lon;
              } else if (node.geometry && node.geometry.length > 0) {
                const point = node.geometry[0];
                lat = point.lat; lon = point.lon;
              }
              if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
                const gateRef = node.tags?.ref;
                if (gateRef) {
                  const gateLabel = L.marker([lat, lon], {
                    icon: L.divIcon({
                      className: "gate-label",
                      html: `<div style="
                        color: #10b981; font-size: 9px; font-weight: bold;
                        text-shadow: 0px 0px 2px rgba(0,0,0,1);
                        background: rgba(0,0,0,0.55); padding: 0px 1px; border-radius: 1px;
                        border: 1px solid rgba(16,185,129,0.5); white-space: nowrap;
                        z-index: 2000; display: flex; align-items: center; justify-content: center;
                        min-width: 12px; min-height: 10px;
                      ">${gateRef}</div>`,
                      iconSize: [14, 12], iconAnchor: [7, 6]
                    }),
                    interactive: false,
                    pane: 'popupPane'
                  });
                  gateLabel.setZIndexOffset(2000);
                  layerGroupsRef.current.osm.addLayer(gateLabel);
                }
              }
            });
          }

          // Control towers - show at zoom 12+
          if (currentZoom >= 12) {
            osmData.controlTowers.forEach(node => {
              let lat, lon;
              if (node.lat && node.lon) {
                lat = node.lat; lon = node.lon;
              } else if (node.geometry && node.geometry.length > 0) {
                const point = node.geometry[0];
                lat = point.lat; lon = point.lon;
              }
              if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
                const tower = L.circleMarker([lat, lon], {
                  radius: 4, color: '#ef4444', weight: 2, opacity: 0.9, fillOpacity: 0.7, interactive: false
                });
                layerGroupsRef.current.osm.addLayer(tower);

                // Add control tower labels at zoom 14+
                const towerName = node.tags?.name || node.tags?.ref || 'TWR';
                if (currentZoom >= 14) {
                  const towerLabel = L.marker([lat, lon], {
                    icon: L.divIcon({
                      className: "tower-label",
                      html: `<div style="
                        color: #ef4444; font-size: 8px; font-weight: bold;
                        text-shadow: 0px 0px 2px rgba(0,0,0,1), 0px 0px 4px rgba(0,0,0,0.8);
                        background: rgba(0,0,0,0.6); padding: 1px 2px; border-radius: 2px;
                        white-space: nowrap;
                      ">${towerName}</div>`,
                      iconSize: [20, 12], iconAnchor: [10, 6]
                    }),
                    interactive: false
                  });
                  layerGroupsRef.current.osm.addLayer(towerLabel);
                }
              }
            });
          }

          // Parking positions - show at zoom 15+
          if (currentZoom >= 15) {
            osmData.parkingPositions.forEach(node => {
              let lat, lon;
              if (node.lat && node.lon) {
                lat = node.lat; lon = node.lon;
              } else if (node.geometry && node.geometry.length > 0) {
                const point = node.geometry[0];
                lat = point.lat; lon = point.lon;
              }
              if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
                const parking = L.circleMarker([lat, lon], {
                  radius: 2, color: '#6b7280', weight: 1, opacity: 0.6, fillOpacity: 0.4, interactive: false
                });
                layerGroupsRef.current.osm.addLayer(parking);

                // Add parking position labels at zoom 15+
                const parkingRef = node.tags?.ref;
                if (parkingRef) {
                  const parkingLabel = L.marker([lat, lon], {
                    icon: L.divIcon({
                      className: "parking-label",
                      html: `<div style="
                        color: #6b7280; font-size: 7px; font-weight: bold;
                        text-shadow: 0px 0px 2px rgba(0,0,0,1);
                        background: rgba(0,0,0,0.6); padding: 1px 2px; border-radius: 2px;
                        white-space: nowrap;
                      ">${parkingRef}</div>`,
                      iconSize: [16, 10], iconAnchor: [8, 5]
                    }),
                    interactive: false
                  });
                  layerGroupsRef.current.osm.addLayer(parkingLabel);
                }
              }
            });
          }

          // Other features - show at zoom 13+
          if (currentZoom >= 13) {
            osmData.other.forEach(way => {
              if (way.geometry && way.geometry.length > 1) {
                const coordinates = way.geometry.map(point => [point.lat, point.lon] as [number, number]);
                const other = L.polyline(coordinates, {
                  color: '#a78bfa', weight: 1, opacity: 0.5, interactive: false
                });
                layerGroupsRef.current.osm.addLayer(other);
              }
            });
          }
        }

        renderRunways(mapInstance, osmData, currentZoom, L);
        renderExtendedCenterlines(osmData, displayOptions, layerGroupsRef, L);
      };

      updateOSMFeatures();
    };

    // Listen for zoom changes
    mapInstance.on('zoomend', handleZoomEnd);

    // Cleanup function
    return () => {
      mapInstance.off('zoomend', handleZoomEnd);
    };
  }, [mapInstance, displayOptions.showOSMFeatures, displayOptions.showExtendedCenterlines, osmData]);

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
      
      {/* FAA Waypoint Layer */}
      {mapReady && mapInstance && (
        <FAAWaypointLayer
          map={mapInstance}
          airportCode={airport.code}
          showWaypoints={displayOptions.showWaypoints}
          layerGroup={layerGroupsRef.current.waypoints}
        />
      )}
    </div>
  );
}
