/**
 * Z-Index Layer Constants for Map Components
 * =======================================
 * 
 * SYSTEMATIC LAYERING HIERARCHY (Bottom to Top):
 * 
 * Based on Leaflet's default pane structure and logical visual hierarchy:
 * 
 * 1. Map tiles (Leaflet default: ~200)
 * 2. OSM overlay data (airport infrastructure) 
 * 3. Airport features (DME rings, waypoints, centerlines)
 * 4. Ground tracks
 * 5. Aircraft markers
 * 6. Communication bubbles
 * 7. Aircraft contextual windows/popups
 * 8. UI controls (fullscreen, recenter, layer toggles)
 * 
 * LEAFLET DEFAULT PANE Z-INDEX VALUES:
 * - mapPane: 200
 * - overlayPane: 400  
 * - markerPane: 600
 * - tooltipPane: 650
 * - popupPane: 700
 * 
 * NOTE: Our z-index offsets are added to Leaflet's markerPane base (600)
 */

export const Z_INDEX_LAYERS = {
  // Base layers (following Leaflet's structure)
  MAP_TILES: 200,                  // Leaflet mapPane default
  
  // OSM overlay data (airport infrastructure) - above map tiles, below airport features
  OSM_OVERLAY: 300,                // Airport details, runways, taxiways from OSM
  OSM_INTERACTIVE: 301,            // Interactive OSM elements  
  OSM_LABELS: 302,                // OSM markers and labels (taxiway labels, etc.)
  
  // Airport features (DME rings, waypoints, centerlines) - above OSM, below aircraft
  AIRPORT_FEATURES: 10,            // DME rings, extended centerlines
  AIRPORT_LABELS: 20,              // Airport center labels
  
  // Ground tracks - above airport features, below waypoints and aircraft
  GROUND_TRACKS: 30,               // Aircraft ground tracks
  
  // Waypoints - above ground tracks, below aircraft
  WAYPOINTS: 35,                   // FAA waypoint markers (above ground tracks for clickability)
  WAYPOINT_LABELS: 36,             // Waypoint name labels
  
  // Aircraft - above all airport elements, below communications
  AIRCRAFT_MARKERS: 40,            // Aircraft position markers (Leaflet markerPane default)
  AIRCRAFT_LABELS: 50,             // Aircraft callsign labels
  
  // Communication bubbles - above aircraft
  COMMUNICATION_BUBBLES: 1000,    // Communication speech bubbles - high value to ensure visibility
  
  // Aircraft contextual windows - above communications
  AIRCRAFT_POPUPS: 800,            // Aircraft detail popups and tooltips
  
  // UI controls (highest priority) - above everything
  UI_CONTROLS: 900,                // Fullscreen, recenter, layer toggles
  UI_OVERLAYS: 901,                // Loading indicators, error messages
} as const;

/**
 * Helper function to get z-index for a specific layer
 */
export function getZIndex(layer: keyof typeof Z_INDEX_LAYERS): number {
  return Z_INDEX_LAYERS[layer];
}

/**
 * Helper function to get z-index offset for markers
 * This is used with Leaflet's zIndexOffset property
 */
export function getZIndexOffset(layer: keyof typeof Z_INDEX_LAYERS): number {
  return Z_INDEX_LAYERS[layer];
}
