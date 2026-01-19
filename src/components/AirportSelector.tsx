'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Airport } from '@/types';
import { ChevronDown } from 'lucide-react';

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
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedAirportData = airports.find(a => a.id === selectedAirport);
  const displayCode = selectedAirportData?.code || (airports.length > 0 ? airports[0].code : '');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleSelect = (airportId: string) => {
    onSelectAirport(airportId);
    setOpen(false);
  };

  if (loading || airports.length === 0) {
    return (
      <div className="bg-slate-700 text-slate-400 px-2 sm:px-3 py-1 sm:py-2 rounded-lg text-xs sm:text-sm">
        {loading ? 'Loading...' : 'No airports'}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-1.5 bg-slate-700 text-white px-2 sm:px-3 py-1 sm:py-2 rounded-lg 
                   border focus:outline-none
                   disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-medium
                   transition-colors min-w-[60px]"
        style={{ 
          borderColor: open ? '#fee000ff' : '#475569',
          borderWidth: '1px'
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.borderColor = '#fee000ff';
          }
        }}
        onMouseLeave={(e) => {
          if (!open && !loading) {
            e.currentTarget.style.borderColor = '#475569';
          }
        }}
        title={selectedAirportData ? `${selectedAirportData.code} - ${selectedAirportData.name}` : ''}
      >
        <span>{displayCode}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      
      {open && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 4000 }} onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-slate-800 border rounded-lg shadow-xl 
                        max-h-[300px] overflow-y-auto min-w-[200px]" style={{ zIndex: 4001, borderColor: '#fee000ff', borderWidth: '1px' }}>
            {airports.map((airport) => (
              <button
                key={airport.id}
                onClick={() => handleSelect(airport.id)}
                className={`w-full text-left px-3 py-2 text-xs sm:text-sm transition-colors
                  ${airport.id === selectedAirport 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-200 hover:bg-slate-700'
                  }
                  ${airport.id === 'KDEN' ? 'font-semibold' : ''}
                  ${!airport.active ? 'opacity-60' : ''}
                `}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{airport.code}</span>
                  <span className="text-slate-400 truncate flex-1 text-right">{airport.name}</span>
                </div>
                {airport.id === 'KDEN' && (
                  <div className="text-[10px] text-blue-300 mt-0.5">Storm Demo</div>
                )}
                {!airport.active && (
                  <div className="text-[10px] text-slate-500 mt-0.5">Inactive</div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
