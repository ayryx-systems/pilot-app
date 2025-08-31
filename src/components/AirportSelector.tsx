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
        className="appearance-none bg-slate-700 text-white px-2 sm:px-3 py-1 sm:py-2 pr-6 sm:pr-8 rounded-lg 
                   border border-slate-600 focus:border-blue-400 focus:outline-none
                   disabled:opacity-50 disabled:cursor-not-allowed max-w-[140px] sm:max-w-[180px]
                   text-xs sm:text-sm truncate"
      >
        <option value="">Select Airport...</option>
        {airports.map(airport => (
          <option key={airport.id} value={airport.id}>
            {airport.code} - {airport.name}
            {airport.id === 'KDEN' ? ' (Storm Demo)' : airport.active ? '' : ' (Inactive)'}
          </option>
        ))}
      </select>

      <div className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
      </div>
    </div>
  );
}
