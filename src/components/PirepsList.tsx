'use client';

import React from 'react';
import { PiRep, ConnectionStatus } from '@/types';
import { AlertTriangle, Clock, X, Plane } from 'lucide-react';
import { SimpleDataAge } from './SimpleDataAge';
import { DebugTimestamp } from './DebugTimestamp';

interface PirepsListProps {
  pireps: PiRep[];
  onDismissPirep: (id: string) => void;
  connectionStatus: ConnectionStatus;
  pirepsMetadata?: {
    active: boolean;
    message?: string;
    lastUpdate?: Date;
    source?: 'live' | 'cache' | 'stale-cache';
    serverTimestamp?: string;
  };
}

export function PirepsList({ pireps, onDismissPirep, connectionStatus, pirepsMetadata }: PirepsListProps) {
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-blue-400" />;
    }
  };

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-400';
      case 'high':
        return 'border-l-yellow-400';
      default:
        return 'border-l-blue-400';
    }
  };

  const formatAge = (ageMinutes: number) => {
    if (ageMinutes < 60) return `${ageMinutes}m ago`;
    const hours = Math.floor(ageMinutes / 60);
    const mins = ageMinutes % 60;
    return `${hours}h ${mins}m ago`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Pilot Reports</h2>

        <div className="flex items-center text-xs text-gray-400">
          <Plane className="w-3 h-3 mr-1" />
          <span>{pireps.length} active</span>
        </div>
      </div>

      {pireps.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {pirepsMetadata?.message
              ? pirepsMetadata.message
              : connectionStatus.connected
                ? 'No current PIREPs'
                : 'Connect to load PIREPs'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pireps
            .filter(pirep => !pirep.dismissed)
            .sort((a, b) => a.ageMinutes - b.ageMinutes)
            .map(pirep => (
              <div
                key={pirep.id}
                className={`p-3 bg-slate-700 rounded-lg border-l-4 ${getPriorityBorder(pirep.priority)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2 flex-1">
                    {getPriorityIcon(pirep.priority)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">
                          {pirep.aircraft}
                        </span>
                        <div className="flex items-center text-xs text-gray-400">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatAge(pirep.ageMinutes)}
                        </div>
                      </div>
                      <p className="text-sm text-gray-200 break-words">
                        {pirep.message}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onDismissPirep(pirep.id)}
                    className="ml-2 p-1 hover:bg-slate-600 rounded text-gray-400 hover:text-white"
                    title="Dismiss PIREP"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Data freshness indicator */}
      <div className="mt-4 pt-3 border-t border-slate-600">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>PIREP Data</span>
          <span className={
            pirepsMetadata?.active === false
              ? 'text-gray-400'
              : connectionStatus.connected
                ? 'text-green-400'
                : 'text-yellow-400'
          }>
            {pirepsMetadata?.active === false
              ? 'Processing inactive'
              : connectionStatus.connected
                ? 'Real-time'
                : 'Cached'
            }
          </span>
        </div>

        {/* Debug timestamp for PIREPs */}
        {pirepsMetadata?.serverTimestamp && (
          <div className="mt-1">
            <DebugTimestamp
              serverTimestamp={pirepsMetadata.serverTimestamp}
              source="PIREP data"
            />
          </div>
        )}
      </div>
    </div>
  );
}
