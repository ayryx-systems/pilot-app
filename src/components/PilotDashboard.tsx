'use client';

import React, { useState, useEffect } from 'react';
import { PilotMap } from './PilotMap';
import { AirportSelector } from './AirportSelector';
import { ConnectionStatus } from './ConnectionStatus';
import { SituationOverview } from './SituationOverview';
import { PirepsList } from './PirepsList';
import { MapControls } from './MapControls';
import { usePilotData } from '@/hooks/usePilotData';
import { MapDisplayOptions } from '@/types';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Menu, X } from 'lucide-react';
import { SimpleDataAge } from './SimpleDataAge';
import { AppUpdateNotifier } from './AppUpdateNotifier';
import { DebugTimestamp } from './DebugTimestamp';

export function PilotDashboard() {
  const {
    selectedAirport,
    setSelectedAirport,
    airports,
    airportOverview,
    pireps,
    tracks,
    summary,
    connectionStatus,
    loading,
    error,
    pirepsMetadata,
    tracksMetadata,
    summaryMetadata,
    refreshData
  } = usePilotData();

  // Debug data structure to help identify issues
  useEffect(() => {
    if (tracks && tracks.length > 0) {
      console.log('[PilotDashboard] Track data structure:', tracks[0]);
    }
    if (pireps && pireps.length > 0) {
      console.log('[PilotDashboard] PIREP data structure:', pireps[0]);
    }
  }, [tracks, pireps]);

  const [mapDisplayOptions, setMapDisplayOptions] = useState<MapDisplayOptions>({
    showRunways: true,
    showDmeRings: true,
    showWaypoints: true,
    showApproachRoutes: true,
    showExtendedCenterlines: false,
    showPireps: true,
    showGroundTracks: true,
  });

  const [showPirepPanel, setShowPirepPanel] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);

  // Auto-refresh data every 30 seconds when connected
  useEffect(() => {
    if (connectionStatus.connected && selectedAirport) {
      const interval = setInterval(() => {
        refreshData();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [connectionStatus.connected, selectedAirport, refreshData]);

  // Smart refresh that always tries to get the best available data
  const handleRefresh = async () => {
    try {
      // Always try to get fresh data, fall back to cache if needed
      await refreshData();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  const getConnectionStatusColor = () => {
    if (!connectionStatus.connected) return 'text-red-400';
    if (connectionStatus.latency && connectionStatus.latency > 2000) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getConnectionStatusIcon = () => {
    if (!connectionStatus.connected) {
      return <WifiOff className="w-4 h-4" />;
    }
    return <Wifi className="w-4 h-4" />;
  };

  // Get the most recent data timestamp
  const getDataStatus = (): { timestamp: Date; isLive: boolean } => {
    // Use actual data timestamps when available
    const dataTimestamp = airportOverview?.timestamp
      ? new Date(airportOverview.timestamp)
      : connectionStatus.lastUpdate;

    return {
      timestamp: dataTimestamp,
      isLive: connectionStatus.connected
    };
  };

  return (
    <div className="flex flex-col bg-slate-900 text-white overflow-hidden" style={{ height: '100dvh' }}>
      {/* Compact Header Bar */}
      <header className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <img
            src="/logo4.png"
            alt="AYRYX"
            className="h-6 w-6 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <AirportSelector
              airports={airports}
              selectedAirport={selectedAirport}
              onSelectAirport={setSelectedAirport}
              loading={loading}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          {selectedAirport && (() => {
            const dataStatus = getDataStatus();
            return (
              <SimpleDataAge
                timestamp={dataStatus.timestamp}
                isLive={dataStatus.isLive}
                offline={!connectionStatus.connected}
                size="sm"
              />
            );
          })()}

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center space-x-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 
                     rounded text-xs transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      {/* App Update Notifier */}
      <AppUpdateNotifier />

      {/* Status Notifications */}
      {!connectionStatus.connected && (
        <div className="bg-red-900/30 border-red-500/40 border-l-4 p-2 mx-3 mt-1 rounded text-sm">
          <div className="flex items-center text-red-200">
            <WifiOff className="w-4 h-4 mr-2" />
            <span>Offline - no data available</span>
          </div>
        </div>
      )}

      {error && error.includes('No data available') && (
        <div className="bg-red-900/30 border-red-500/40 border-l-4 p-2 mx-3 mt-1 rounded text-sm">
          <div className="flex items-center text-red-200">
            <AlertTriangle className="w-4 h-4 mr-2" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Main Content: Responsive Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Situation Overview Panel - Top on mobile, right side on desktop */}
        {!mapFullscreen && (
          <div className="lg:order-2 lg:w-96 lg:min-w-96 bg-slate-800/95 backdrop-blur-sm border-b lg:border-b-0 lg:border-l border-slate-700/50 p-2 lg:p-4 flex-shrink-0 lg:overflow-y-auto" style={{ zIndex: 1000 }}>
            <SituationOverview
              summary={summary}
              weather={airportOverview?.weather}
              loading={loading}
              connectionStatus={connectionStatus}
              airportCode={selectedAirport || undefined}
              summaryMetadata={summaryMetadata}
            />
          </div>
        )}

        {/* Map Section - Below situation overview on mobile, left side on desktop */}
        <div className="flex-1 lg:order-1 relative" style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}>
          <PilotMap
            airport={airportOverview?.airport}
            airportData={airportOverview || undefined}
            pireps={pireps}
            tracks={tracks}
            displayOptions={mapDisplayOptions}
            onDismissPirep={(id) => {
              console.log('Dismiss PIREP:', id);
            }}
            onFullscreenChange={setMapFullscreen}
          />
          
          {/* Map Controls - Top Right of Map Area */}
          {selectedAirport && (
            <div className="absolute top-2 right-2" style={{ zIndex: 1001 }}>
              <MapControls
                displayOptions={mapDisplayOptions}
                onOptionsChange={setMapDisplayOptions}
              />
            </div>
          )}
        </div>
      </div>

      {/* PIREP Panel Backdrop - Click outside to close */}
      {showPirepPanel && (
        <div 
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          style={{ zIndex: 999 }}
          onClick={() => setShowPirepPanel(false)}
        />
      )}

      {/* Left Side Panel - PIREPs (Collapsible, Fixed Width) */}
      <div className={`absolute left-0 top-0 bottom-12 lg:bottom-0 w-80 max-w-[85vw] bg-slate-800/95 backdrop-blur-sm border-r border-slate-700/50 
                      transform transition-transform duration-200 ease-in-out ${
                        showPirepPanel ? 'translate-x-0' : '-translate-x-full'
                      }`} style={{ zIndex: 1000 }}>
        <div className="p-2 sm:p-3 h-full">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-300">PIREPs</h3>
            <button
              onClick={() => setShowPirepPanel(false)}
              className="p-1 hover:bg-slate-700/50 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="h-full overflow-y-auto">
            <PirepsList
              pireps={pireps}
              onDismissPirep={(id) => {
                console.log('Dismiss PIREP from list:', id);
              }}
              connectionStatus={connectionStatus}
              pirepsMetadata={pirepsMetadata}
            />
          </div>
        </div>
      </div>

      {/* PIREP Panel Toggle Button (when panel is closed) - Bottom left position */}
      {!showPirepPanel && (
        <button
          onClick={() => setShowPirepPanel(true)}
          className={`absolute left-2 bottom-16 lg:bottom-14 px-3 py-2 rounded-lg 
                   hover:bg-slate-700/95 transition-colors flex items-center space-x-2 backdrop-blur-sm border
                   ${pireps && pireps.length > 0 
                     ? 'bg-yellow-900/80 border-yellow-500/60 text-yellow-200' 
                     : 'bg-slate-800/95 border-slate-700/50 text-gray-300'}`}
          style={{ zIndex: 1000 }}
        >
          <Menu className={`w-4 h-4 ${pireps && pireps.length > 0 ? 'text-yellow-300' : 'text-gray-300'}`} />
          <div className="flex flex-col items-start">
            <span className="text-xs font-medium">PIREPs</span>
            <span className="text-xs opacity-80">
              {pireps && pireps.length > 0 ? `${pireps.length} available` : 'None available'}
            </span>
          </div>
        </button>
      )}


      {/* Bottom Status Bar - Airport Info */}
      {airportOverview && (
        <div className="absolute left-0 right-0 lg:right-96 bg-slate-800/95 backdrop-blur-sm border-t border-slate-700/50 px-3 py-2" style={{ bottom: 'env(safe-area-inset-bottom)', zIndex: 1000 }}>
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center space-x-4">
              <span className="text-gray-400 font-medium">{airportOverview.airport.code}</span>
              <span>{airportOverview.runways.length} Runways</span>
              <span className={`flex items-center space-x-1 ${airportOverview.operational.active ? 'text-green-400' : 'text-red-400'}`}>
                <span>●</span>
                <span>{airportOverview.operational.active ? 'Active' : 'Inactive'}</span>
              </span>
            </div>

            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
              <DebugTimestamp
                serverTimestamp={airportOverview.timestamp}
                source="live data"
                className="opacity-60"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
