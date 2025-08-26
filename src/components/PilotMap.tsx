'use client';

import React, { useRef, useEffect, useState } from 'react';
import type * as L from 'leaflet';
import { Airport, AirportOverview, PiRep, GroundTrack, MapDisplayOptions } from '@/types';
import { AIRPORTS } from '@/constants/airports';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';

interface PilotMapProps {
  airport?: Airport;
  airportData?: AirportOverview;
  pireps: PiRep[];
  tracks: GroundTrack[];
  displayOptions: MapDisplayOptions;
  onDismissPirep: (id: string) => void;
}

export function PilotMap({
  airport,
  airportData,
  pireps,
  tracks,
  displayOptions,
  onDismissPirep
}: PilotMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

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
          z-index: 1 !important;
        }
        
        /* Force all Leaflet layers to stay below custom controls */
        .leaflet-tile-pane,
        .leaflet-overlay-pane,
        .leaflet-shadow-pane,
        .leaflet-marker-pane,
        .leaflet-tooltip-pane,
        .leaflet-popup-pane {
          z-index: 1 !important;
        }
        
        /* Ensure map controls are above everything */
        .leaflet-control-container {
          pointer-events: none;
          z-index: 1 !important;
        }
        
        .leaflet-control {
          pointer-events: auto;
          z-index: 1 !important;
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

  // Create/destroy map when airport changes
  useEffect(() => {
    if (!leafletLoaded || !airport || !airportConfig) {
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
        : airportConfig.position;

      // Create map
      const map = L.map(mapRef.current, {
        center: mapCenter,
        zoom: 13,
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

      // Initialize layer groups
      layerGroupsRef.current = {
        runways: L.layerGroup().addTo(map),
        dmeRings: L.layerGroup().addTo(map),
        waypoints: L.layerGroup().addTo(map),
        approachRoutes: L.layerGroup().addTo(map),
        extendedCenterlines: L.layerGroup().addTo(map),
        pireps: L.layerGroup().addTo(map),
        tracks: L.layerGroup().addTo(map),
        airport: L.layerGroup().addTo(map),
      };

      // Add airport marker at correct position
      const airportMarker = L.marker(mapCenter)
        .bindPopup(`<strong>${airport.code}</strong><br/>${airport.name}`);
      layerGroupsRef.current.airport.addLayer(airportMarker);

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
    if (!mapInstance || !airportConfig || !layerGroupsRef.current.runways) return;

    const updateRunways = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing runways
      layerGroupsRef.current.runways.clearLayers();

      if (displayOptions.showRunways) {
        // Use runways from airportData if available, fallback to airportConfig
        const runways = airportData?.runways || airportConfig.runways;
        runways.forEach(runway => {
          if (runway.threshold && runway.oppositeEnd) {
            const runwayLine = L.polyline([
              [runway.threshold.lat, runway.threshold.lon],
              [runway.oppositeEnd.lat, runway.oppositeEnd.lon]
            ], {
              color: '#333333',
              weight: 8,
              opacity: 0.9
            }).bindPopup(
              `<div class="runway-popup">
                <h4><strong>Runway ${runway.name}/${runway.oppositeEnd.name}</strong></h4>
                <p><strong>Length:</strong> ${runway.length.toLocaleString()} ft</p>
                <p><strong>Heading:</strong> ${runway.heading}°/${runway.oppositeHeading}°</p>
              </div>`
            );

            layerGroupsRef.current.runways.addLayer(runwayLine);

            // Add runway threshold markers
            const thresholdIcon = L.divIcon({
              html: `<div style="
                background: #333;
                color: white;
                font-size: 10px;
                font-weight: bold;
                padding: 2px 4px;
                border-radius: 2px;
                border: 1px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              ">${runway.name}</div>`,
              className: 'runway-threshold-marker',
              iconAnchor: [10, 5]
            });

            const thresholdMarker = L.marker([runway.threshold.lat, runway.threshold.lon], { icon: thresholdIcon })
              .bindPopup(`<strong>Runway ${runway.name}</strong><br/>Threshold`);

            layerGroupsRef.current.runways.addLayer(thresholdMarker);
          }
        });
      }
    };

    updateRunways();
  }, [mapInstance, displayOptions.showRunways, airportConfig]);

  // Update DME rings display
  useEffect(() => {
    if (!mapInstance || !airportConfig || !layerGroupsRef.current.dmeRings) return;

    const updateDmeRings = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing DME rings
      layerGroupsRef.current.dmeRings.clearLayers();

      if (displayOptions.showDmeRings) {
        // Use the same center as the map
        const dmeCenter: [number, number] = airport.position
          ? [airport.position.lat, airport.position.lon]
          : airportConfig.position;

        airportConfig.dmeRings.forEach(distance => {
          const dmeRing = L.circle(dmeCenter, {
            radius: distance * 1852, // Convert NM to meters
            fill: false,
            color: distance % 10 === 0 ? '#3b82f6' : '#94a3b8',
            weight: distance % 10 === 0 ? 2 : 1,
            opacity: 0.6
          }).bindPopup(`<strong>${distance} NM</strong><br/>DME Ring`);

          layerGroupsRef.current.dmeRings.addLayer(dmeRing);
        });
      }
    };

    updateDmeRings();
  }, [mapInstance, displayOptions.showDmeRings, airportConfig]);

  // Update waypoints display
  useEffect(() => {
    if (!mapInstance || !airportConfig || !layerGroupsRef.current.waypoints) return;

    const updateWaypoints = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing waypoints
      layerGroupsRef.current.waypoints.clearLayers();

      if (displayOptions.showWaypoints && airportConfig.waypoints) {
        airportConfig.waypoints.forEach(waypoint => {
          const waypointIcon = L.divIcon({
            html: `<div style="
              width: 12px;
              height: 12px;
              background: #8b5cf6;
              border: 2px solid #ffffff;
              border-radius: 50%;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            "></div>`,
            className: 'custom-waypoint-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });

          const waypointMarker = L.marker([waypoint.lat, waypoint.lon], { icon: waypointIcon })
            .bindPopup(`
              <div class="waypoint-popup">
                <h4><strong>${waypoint.name}</strong></h4>
                ${waypoint.description ? `<p>${waypoint.description}</p>` : ''}
                <p class="text-sm text-gray-600">
                  ${waypoint.lat.toFixed(4)}, ${waypoint.lon.toFixed(4)}
                </p>
              </div>
            `);

          layerGroupsRef.current.waypoints.addLayer(waypointMarker);
        });
      }
    };

    updateWaypoints();
  }, [mapInstance, displayOptions.showWaypoints, airportConfig]);

  // Update approach routes display
  useEffect(() => {
    if (!mapInstance || !airportConfig || !layerGroupsRef.current.approachRoutes) return;

    const updateApproachRoutes = async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default;

      // Clear existing approach routes
      layerGroupsRef.current.approachRoutes.clearLayers();

      if (displayOptions.showApproachRoutes) {
        // Use runways from airportData if available, fallback to airportConfig
        const runways = airportData?.runways || airportConfig.runways;
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
                // Add approach path line
                const approachPath = L.polyline(approachWaypoints, {
                  color: '#f59e0b',
                  weight: 2,
                  opacity: 0.7,
                  dashArray: '5, 10'
                }).bindPopup(
                  `<strong>${approach.name} Approach</strong><br/>Runway ${runway.name}`
                );

                layerGroupsRef.current.approachRoutes.addLayer(approachPath);

                // Add approach waypoint markers
                approach.waypoints.forEach((waypoint, index) => {
                  if (index < approachWaypoints.length) {
                    const waypointIcon = L.divIcon({
                      html: `<div style="
                        background: #f59e0b;
                        color: white;
                        font-size: 8px;
                        font-weight: bold;
                        padding: 1px 3px;
                        border-radius: 2px;
                        border: 1px solid white;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.3);
                      ">${waypoint.name}</div>`,
                      className: 'approach-waypoint-marker',
                      iconAnchor: [10, 5]
                    });

                    const waypointMarker = L.marker(approachWaypoints[index], { icon: waypointIcon })
                      .bindPopup(`
                        <div class="approach-waypoint-popup">
                          <h4><strong>${waypoint.name}</strong></h4>
                          <p><strong>Approach:</strong> ${approach.name}</p>
                          <p><strong>Distance:</strong> ${waypoint.distanceFromThreshold} NM</p>
                          <p><strong>Runway:</strong> ${runway.name}</p>
                        </div>
                      `);

                    layerGroupsRef.current.approachRoutes.addLayer(waypointMarker);
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
        // Use runways from airportData if available, fallback to airportConfig
        const runways = airportData?.runways || airportConfig?.runways || [];

        runways.forEach(runway => {
          if (runway.threshold && runway.oppositeEnd) {
            // Calculate extended centerline points (extend 10 NM from each end)
            const extensionDistanceNm = 10;
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

            // Create extended centerline
            const centerline = L.polyline([
              [extLat1, extLon1],
              [runway.threshold.lat, runway.threshold.lon],
              [runway.oppositeEnd.lat, runway.oppositeEnd.lon],
              [extLat2, extLon2]
            ], {
              color: '#fbbf24', // amber-400
              weight: 1,
              opacity: 0.6,
              dashArray: '10, 10'
            }).bindPopup(`<strong>Extended Centerline</strong><br/>Runway ${runway.name}/${runway.oppositeEnd.name}`);

            layerGroupsRef.current.extendedCenterlines.addLayer(centerline);
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

          // Create custom PIREP icon
          const pirepIcon = L.divIcon({
            html: `<div style="
              width: 16px;
              height: 16px;
              background: ${color};
              border: 2px solid #ffffff;
              border-radius: 3px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: bold;
              color: white;
            ">P</div>`,
            className: 'custom-pirep-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
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
                <h4 style="margin: 0; color: ${color};"><strong>PIREP ${pirep.id ? pirep.id.slice(-6) : 'Unknown'}</strong></h4>
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
          if (!track || !track.points || !Array.isArray(track.points)) {
            console.warn('[PilotMap] Invalid track data:', track);
            return;
          }

          if (track.points.length < 2) return; // Need at least 2 points for a line

          // Convert coordinates to Leaflet LatLng format with additional safety checks
          const latLngs: [number, number][] = track.points
            .filter(coord => coord && typeof coord.lat === 'number' && typeof coord.lon === 'number')
            .map(coord => [coord.lat, coord.lon]);

          // Skip if we don't have enough valid coordinates after filtering
          if (latLngs.length < 2) {
            console.warn('[PilotMap] Track has insufficient valid coordinates:', track.id || track.callsign);
            return;
          }

          // Determine track color based on status and callsign
          let color = '#3b82f6'; // Default blue for active flights
          if (track.status === 'COMPLETED') {
            color = '#6b7280'; // Gray for completed flights
          } else if (track.status === 'EMERGENCY') {
            color = '#ef4444'; // Red for emergency
          } else if (track.callsign?.includes('UAL')) {
            color = '#8b5cf6'; // Purple for United
          } else if (track.callsign?.includes('AAL')) {
            color = '#10b981'; // Green for American
          } else {
            // Use a hash of the callsign for consistent coloring per flight
            const hash = track.callsign ? track.callsign.split('').reduce((a, b) => {
              a = ((a << 5) - a) + b.charCodeAt(0);
              return a & a;
            }, 0) : 0;
            const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
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
          if (latLngs.length > 0 && track.points && track.points.length > 0) {
            const startCoord = track.points[0];
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

            const startMarker = L.marker([startCoord.lat, startCoord.lon], { icon: startIcon })
              .bindPopup(`
                <div class="track-popup">
                  <h4><strong>Flight Start</strong></h4>
                  <p><strong>Aircraft:</strong> ${track.aircraft}</p>
                  <p><strong>Callsign:</strong> ${track.callsign}</p>
                  <p><strong>Departure:</strong> ${new Date(track.startTime).toLocaleString()}</p>
                  <p><strong>Status:</strong> ${track.status}</p>
                  ${track.runway ? `<p><strong>Runway:</strong> ${track.runway}</p>` : ''}
                </div>
              `);

            if (layerGroupsRef.current.tracks) {
              layerGroupsRef.current.tracks.addLayer(startMarker);
            }
          }

          // Add end marker (current position or landing)
          if (latLngs.length > 1 && track.points && track.points.length > 1) {
            const endCoord = track.points[track.points.length - 1];
            if (!endCoord || typeof endCoord.lat !== 'number' || typeof endCoord.lon !== 'number') {
              console.warn('[PilotMap] Invalid end coordinate for track:', track.id || track.callsign);
              return;
            }
            const isCompleted = track.status === 'COMPLETED';

            const endIcon = L.divIcon({
              html: `<div style="
                width: 0;
                height: 0;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-bottom: 12px solid ${color};
                filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
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
              iconSize: [12, 12],
              iconAnchor: [6, 12]
            });

            const endMarker = L.marker([endCoord.lat, endCoord.lon], { icon: endIcon })
              .bindPopup(`
                <div class="track-popup">
                  <h4><strong>${isCompleted ? 'Flight Ended' : 'Current Position'}</strong></h4>
                  <p><strong>Aircraft:</strong> ${track.aircraft}</p>
                  <p><strong>Callsign:</strong> ${track.callsign}</p>
                  <p><strong>Altitude:</strong> ${endCoord.altitude?.toLocaleString() || 'Unknown'} ft</p>
                  <p><strong>Updated:</strong> ${new Date(endCoord.timestamp).toLocaleString()}</p>
                  ${track.endTime ? `<p><strong>Arrival:</strong> ${new Date(track.endTime).toLocaleString()}</p>` : ''}
                </div>
              `);

            if (layerGroupsRef.current.tracks) {
              layerGroupsRef.current.tracks.addLayer(endMarker);
            }
          }
        });
      }
    };

    updateTracks();
  }, [mapInstance, tracks, displayOptions.showGroundTracks]);

  // Handle recenter events (similar to ATC dashboard)
  useEffect(() => {
    const handleRecenter = () => {
      if (mapInstance && airport) {
        const mapCenter: [number, number] = airport.position
          ? [airport.position.lat, airport.position.lon]
          : airportConfig?.position || [0, 0];
        mapInstance.flyTo(mapCenter, 13, { duration: 1.5 });
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
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
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
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}
