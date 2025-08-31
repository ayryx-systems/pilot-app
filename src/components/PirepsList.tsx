'use client';

import React, { useState } from 'react';
import { PiRep, ConnectionStatus } from '@/types';
import { AlertTriangle, Clock, X, Plane, ChevronDown, ChevronUp } from 'lucide-react';
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
  isDemo?: boolean;
}

export function PirepsList({ pireps, onDismissPirep, connectionStatus, pirepsMetadata, isDemo }: PirepsListProps) {
  const [isExpanded, setIsExpanded] = useState(true); // Start expanded by default to ensure visibility
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

  // Calculate urgent pireps for status display
  const urgentPireps = pireps.filter(pirep => pirep.priority === 'urgent' && !pirep.dismissed);
  const activePireps = pireps.filter(pirep => !pirep.dismissed);

  // Get status color based on priority
  const getStatusColor = () => {
    if (urgentPireps.length > 0) return 'text-red-400';
    if (activePireps.length > 0) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStatusText = () => {
    if (urgentPireps.length > 0) return `${urgentPireps.length} urgent`;
    if (activePireps.length > 0) return `${activePireps.length} reports`;
    return 'All clear';
  };

  return (
    <div>
      {/* Demo Mode Indicator */}
      {isDemo && (
        <div className="mb-3 p-2 rounded-lg bg-orange-600/20 border border-orange-500/50 text-orange-200">
          <div className="flex items-center gap-2 text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            STORM DEMO - PIREPs show windshear and turbulence reports
          </div>
        </div>
      )}

      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 hover:bg-slate-700/30 rounded-lg transition-colors mb-3"
      >
        <div className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-600">
            <Plane className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left">
            <h2 className="text-base font-semibold text-white">Pilot Reports</h2>
            <div className={`text-xs ${getStatusColor()}`}>
              {getStatusText()}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick status indicators when collapsed */}
          {!isExpanded && activePireps.length > 0 && (
            <div className="flex items-center space-x-1">
              {urgentPireps.length > 0 && (
                <div className="flex items-center space-x-1 px-2 py-1 bg-red-900/30 rounded text-red-300 text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{urgentPireps.length}</span>
                </div>
              )}
              <div className="text-xs text-gray-400">
                {activePireps.length} active
              </div>
            </div>
          )}

          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-3">
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
      )}

      {/* Bottom spacing for mobile */}
      <div className="h-4 lg:hidden"></div>
    </div>
  );
}
