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
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
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
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-2 sm:p-4 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
          <img
            src="/logo4.png"
            alt="AYRYX"
            className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
          />

          <AirportSelector
            airports={airports}
            selectedAirport={selectedAirport}
            onSelectAirport={setSelectedAirport}
            loading={loading}
          />
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
          {/* Data Age Indicator */}
          {selectedAirport && (() => {
            const dataStatus = getDataStatus();
            return (
              <SimpleDataAge
                timestamp={dataStatus.timestamp}
                isLive={dataStatus.isLive}
                offline={!connectionStatus.connected}
                size="md"
              />
            );
          })()}

          {/* Connection Status */}
          <div className={`flex items-center space-x-1 ${getConnectionStatusColor()}`}>
            {getConnectionStatusIcon()}
            <span className="text-xs hidden sm:inline">
              {connectionStatus.connected ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Single, Smart Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 
                     rounded text-xs sm:text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Debug info - last connection test timestamp */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-full left-0 p-1 text-xs text-gray-500 font-mono bg-slate-800/50">
            <DebugTimestamp
              serverTimestamp={connectionStatus.lastUpdate.toISOString()}
              source="connection test"
              className="opacity-60"
            />
          </div>
        )}
      </header>

      {/* App Update Notifier */}
      <AppUpdateNotifier />

      {/* Offline notification */}
      {!connectionStatus.connected && (
        <div className="bg-red-900/30 border-red-500/40 border-l-4 p-3 mx-4 mt-2 rounded">
          <div className="flex items-center text-red-200">
            <WifiOff className="w-4 h-4 mr-2" />
            <span className="text-sm">
              Offline - no data available. Please check your internet connection.
            </span>
          </div>
        </div>
      )}

      {/* Error display for when we have no data at all */}
      {error && error.includes('No data available') && (
        <div className="bg-red-900/30 border-red-500/40 border-l-4 p-3 mx-4 mt-2 rounded">
          <div className="flex items-center text-red-200">
            <AlertTriangle className="w-4 h-4 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Map Area */}
        <div className="flex-1 relative order-2 lg:order-1">
          <PilotMap
            airport={airportOverview?.airport}
            airportData={airportOverview || undefined}
            pireps={pireps}
            tracks={tracks}
            displayOptions={mapDisplayOptions}
            onDismissPirep={(id) => {
              // Handle PIREP dismissal
              console.log('Dismiss PIREP:', id);
            }}
          />

          {/* Map Controls Overlay - Positioned at top-right to avoid zoom controls */}
          {selectedAirport && (
            <div
              className="absolute top-2 right-2 lg:top-4 lg:right-6 pointer-events-none"
              style={{ zIndex: 40 }}
            >
              <div className="pointer-events-auto">
                <MapControls
                  displayOptions={mapDisplayOptions}
                  onOptionsChange={setMapDisplayOptions}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Responsive layout */}
        <div className="
          w-full lg:w-80 xl:w-96 
          h-64 sm:h-80 lg:h-full 
          bg-slate-800 
          border-t lg:border-t-0 lg:border-l border-slate-700 
          flex flex-col 
          order-1 lg:order-2
          overflow-hidden
        ">
          {/* Situation Overview */}
          <div className="p-2 sm:p-4 border-b border-slate-700 flex-shrink-0">
            <SituationOverview
              summary={summary}
              weather={airportOverview?.weather}
              loading={loading}
              connectionStatus={connectionStatus}
              airportCode={selectedAirport || undefined}
              summaryMetadata={summaryMetadata}
            />
          </div>

          {/* PIREPs List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-2 sm:p-4">
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

          {/* Airport Info Footer */}
          {airportOverview && (
            <div className="p-2 sm:p-4 border-t border-slate-700 bg-slate-800 flex-shrink-0">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Airport:</span>
                  <span>{airportOverview.airport.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Runways:</span>
                  <span>{airportOverview.runways.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={airportOverview.operational.active ? 'text-green-400' : 'text-red-400'}>
                    {airportOverview.operational.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Debug timestamp */}
                <div className="pt-2 border-t border-slate-600/50">
                  <DebugTimestamp
                    serverTimestamp={airportOverview.timestamp}
                    source="live data"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
