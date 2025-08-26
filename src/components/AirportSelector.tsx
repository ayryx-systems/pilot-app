'use client';

import React from 'react';
import { Airport } from '@/types';
import { ChevronDown, Plane } from 'lucide-react';

interface AirportSelectorProps {
  airports: Airport[];
  selectedAirport: string | null;
  onSelectAirport: (airportId: string | null) => void;
  loading: boolean;
}

export function AirportSelector({ 
  airports, 
  selectedAirport, 
  onSelectAirport, 
  loading 
}: AirportSelectorProps) {
  const selectedAirportData = airports.find(a => a.id === selectedAirport);

  return (
    <div className="relative">
      <select
        value={selectedAirport || ''}
        onChange={(e) => onSelectAirport(e.target.value || null)}
        disabled={loading}
        className="appearance-none bg-slate-700 text-white px-3 py-2 pr-8 rounded-lg 
                   border border-slate-600 focus:border-blue-400 focus:outline-none
                   disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
      >
        <option value="">Select Airport...</option>
        {airports.map(airport => (
          <option key={airport.id} value={airport.id}>
            {airport.code} - {airport.name}
            {airport.active ? '' : ' (Inactive)'}
          </option>
        ))}
      </select>
      
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>
      
      {selectedAirportData && (
        <div className="flex items-center mt-1 text-xs text-gray-400">
          <Plane className="w-3 h-3 mr-1" />
          <span>{selectedAirportData.active ? 'Active' : 'Inactive'}</span>
        </div>
      )}
    </div>
  );
}
