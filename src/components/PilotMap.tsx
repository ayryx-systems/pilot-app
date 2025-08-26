'use client';

import React, { useRef, useEffect, useState } from 'react';
import type * as L from 'leaflet';
import { Airport, AirportOverview, PiRep, GroundTrack, MapDisplayOptions } from '@/types';
import { AIRPORTS } from '@/constants/airports';
import { Loader2 } from 'lucide-react';

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
  // airportData,
  // pireps,
  // tracks,
  displayOptions,
  // onDismissPirep 
}: PilotMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Get airport configuration from constants
  const airportConfig = airport ? AIRPORTS[airport.code] : null;

  // Load Leaflet and create map
  useEffect(() => {
    if (typeof window === 'undefined' || !airport || !airportConfig) return;

    let isMounted = true;

    const initializeMap = async () => {
      try {
        console.log('[PilotMap] Loading Leaflet for', airport.code);
        
        // Load Leaflet dynamically
        const leafletModule = await import('leaflet');
        
        // Import CSS as side effect
        await import('leaflet/dist/leaflet.css');
        
        const L = leafletModule.default;

        if (!isMounted) return;

        // Fix Leaflet default icon path issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        if (mapRef.current && !mapInstance) {
          console.log('[PilotMap] Creating map for', airport.code);
          
          // Create map
          const map = L.map(mapRef.current, {
            center: airportConfig.position,
            zoom: 13,
            zoomControl: true,
          });

          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
          }).addTo(map);

          // Add airport marker
          L.marker(airportConfig.position)
            .addTo(map)
            .bindPopup(`<strong>${airport.code}</strong><br/>${airport.name}`);

          // Add runways
          if (displayOptions.showRunways) {
            airportConfig.runways.forEach(runway => {
              if (runway.threshold && runway.oppositeEnd) {
                L.polyline([
                  [runway.threshold.lat, runway.threshold.lon],
                  [runway.oppositeEnd.lat, runway.oppositeEnd.lon]
                ], {
                  color: '#333',
                  weight: 8,
                  opacity: 0.8
                }).addTo(map).bindPopup(
                  `Runway ${runway.name}/${runway.oppositeEnd.name}<br/>Length: ${runway.length.toLocaleString()} ft`
                );
              }
            });
          }

          // Add DME rings
          if (displayOptions.showDmeRings) {
            airportConfig.dmeRings.forEach(distance => {
              L.circle(airportConfig.position, {
                radius: distance * 1852, // Convert NM to meters
                fill: false,
                color: distance % 10 === 0 ? '#3b82f6' : '#94a3b8',
                weight: distance % 10 === 0 ? 2 : 1,
                opacity: 0.6
              }).addTo(map);
            });
          }

          setMapInstance(map);
          setMapReady(true);
          console.log('[PilotMap] Map ready!');
        }
      } catch (error) {
        console.error('[PilotMap] Failed to load map:', error);
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      if (mapInstance) {
        mapInstance.remove();
        setMapInstance(null);
        setMapReady(false);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airport?.code, displayOptions.showRunways, displayOptions.showDmeRings]);
  
  if (!airport || !airportConfig) {
    return (
      <div className="h-full bg-slate-800 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p>Select an airport to view map</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
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
