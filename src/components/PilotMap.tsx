'use client';

import React from 'react';
import { Airport, AirportOverview, PiRep, GroundTrack, MapDisplayOptions } from '@/types';
import { Map, MapPin, Navigation } from 'lucide-react';

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
  return (
    <div className="h-full bg-slate-800 flex items-center justify-center">
      <div className="text-center text-gray-400">
        <Map className="w-16 h-16 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Pilot Situational Map</h2>
        {airport ? (
          <div className="space-y-1">
            <p>Airport: {airport.code} - {airport.name}</p>
            <p>PIREPs: {pireps.length}</p>
            <p>Ground Tracks: {tracks.length}</p>
            <p className="text-xs text-gray-500 mt-4">
              Map implementation will show:<br/>
              • Airport runways and features<br/>
              • Ground traffic patterns<br/>
              • PIREP locations<br/>
              • DME rings and waypoints<br/>
              • No live aircraft (optimized for connectivity)
            </p>
          </div>
        ) : (
          <p>Select an airport to view map</p>
        )}
      </div>
    </div>
  );
}
