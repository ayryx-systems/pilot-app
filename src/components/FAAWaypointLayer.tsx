import { useEffect, useRef, useCallback, useState } from "react";
import L from "leaflet";
import { waypointService } from "@/services/waypointService";
import { FormattedWaypoint } from "@/types/waypoints";

interface FAAWaypointLayerProps {
  map: L.Map;
  airportCode: string;
  showWaypoints: boolean;
  layerGroup: L.LayerGroup;
}

export function FAAWaypointLayer({
  map,
  airportCode,
  showWaypoints,
  layerGroup,
}: FAAWaypointLayerProps) {
  const [waypoints, setWaypoints] = useState<FormattedWaypoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load waypoints from backend API
  const loadWaypoints = useCallback(async () => {
    if (!airportCode) return;

    setLoading(true);
    setError(null);

    try {
      const waypointData = await waypointService.getWaypointsForAirport(airportCode);
      setWaypoints(waypointData.waypoints);
      console.log(`[FAAWaypointLayer] Loaded ${waypointData.waypointCount} FAA waypoints for ${airportCode}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load waypoints';
      setError(errorMessage);
      console.error(`[FAAWaypointLayer] Error loading waypoints for ${airportCode}:`, err);
      setWaypoints([]);
    } finally {
      setLoading(false);
    }
  }, [airportCode]);

  // Draw waypoints on the map
  const drawWaypoints = useCallback(() => {
    if (!map || !showWaypoints || waypoints.length === 0 || !layerGroup) {
      return;
    }

    console.log(`[FAAWaypointLayer] Drawing ${waypoints.length} FAA waypoints for ${airportCode}`);

    waypoints.forEach((waypoint) => {
      try {
        const position: [number, number] = waypoint.position;

        // Determine waypoint color based on type
        let color = "#8b5cf6"; // Default purple
        let typeLabel = "Waypoint";
        
        switch (waypoint.type) {
          case "C": // Compulsory
            color = "#ef4444"; // Red
            typeLabel = "Compulsory";
            break;
          case "W": // Waypoint
            color = "#8b5cf6"; // Purple
            typeLabel = "Waypoint";
            break;
          case "R": // Reporting point
            color = "#f59e0b"; // Orange
            typeLabel = "Reporting";
            break;
          default:
            color = "#6b7280"; // Gray
            typeLabel = "Other";
        }

        // Draw waypoint marker
        const waypointMarker = L.marker(position, {
          icon: L.divIcon({
            className: "faa-waypoint-marker",
            html: `<div style="width: 6px; height: 6px; background-color: ${color}; border-radius: 50%; border: 1px solid #fff;"></div>`,
            iconSize: [8, 8],
            iconAnchor: [4, 4],
          }),
          interactive: true,
        });

        // Add waypoint information popup
        const usageText = waypoint.usage ? ` (${waypoint.usage})` : "";
        waypointMarker.bindTooltip(
          `${waypoint.name}: ${typeLabel}${usageText}`,
          {
            permanent: false,
            direction: "top",
            className: "waypoint-tooltip",
          }
        );

        // Add waypoint label
        const waypointLabel = L.marker(position, {
          icon: L.divIcon({
            className: "faa-waypoint-label",
            html: `<div style="color: ${color}; font-size: 10px; font-weight: bold; text-shadow: 0px 0px 2px rgba(0,0,0,1)">${waypoint.name}</div>`,
            iconSize: [40, 20],
            iconAnchor: [20, -6], // Place the label above the marker
          }),
          interactive: false,
        });

        // Add to layer group
        layerGroup.addLayer(waypointMarker);
        layerGroup.addLayer(waypointLabel);
      } catch (error) {
        console.error("Error drawing FAA waypoint:", error, waypoint);
      }
    });
  }, [map, showWaypoints, waypoints, airportCode, layerGroup]);

  // Load waypoints when airport changes
  useEffect(() => {
    loadWaypoints();
  }, [loadWaypoints]);

  // Draw waypoints when visibility changes or waypoints are loaded
  useEffect(() => {
    if (!map || !layerGroup) return;

    // Clear existing waypoints from layer group
    layerGroup.clearLayers();

    // Draw new waypoints if they should be shown
    if (showWaypoints && waypoints.length > 0) {
      drawWaypoints();
    }
  }, [map, showWaypoints, waypoints, drawWaypoints, layerGroup]);

  // Debug info
  if (loading) {
    console.log(`[FAAWaypointLayer] Loading waypoints for ${airportCode}...`);
  }
  
  if (error) {
    console.warn(`[FAAWaypointLayer] Error loading waypoints for ${airportCode}:`, error);
  }

  return null; // This component doesn't render anything visible
}
