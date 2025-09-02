'use client';

import React, { useState, useEffect } from 'react';
import { ConnectionStatus as ConnectionStatusType } from '@/types';
import { Wifi, WifiOff, Clock, Signal } from 'lucide-react';

interface ConnectionStatusProps {
  connectionStatus: ConnectionStatusType;
  isDemo?: boolean;
}

export function ConnectionStatus({ connectionStatus, isDemo }: ConnectionStatusProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Ensure component is only fully rendered after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update current time every few seconds to keep age calculation current
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [mounted]);

  const getStatusColor = () => {
    if (!connectionStatus.connected) return 'text-red-400';
    if (connectionStatus.latency && connectionStatus.latency > 2000) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStatusIcon = () => {
    if (!connectionStatus.connected) {
      return <WifiOff className="w-4 h-4" />;
    }
    return <Wifi className="w-4 h-4" />;
  };

  const formatLastUpdate = (date: Date) => {
    if (!mounted) return 'Loading...';

    const diff = Math.floor((currentTime.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const getLatencyText = () => {
    if (!connectionStatus.latency) return '';
    if (connectionStatus.latency < 500) return 'Fast';
    if (connectionStatus.latency < 1000) return 'Good';
    if (connectionStatus.latency < 2000) return 'Slow';
    return 'Very Slow';
  };

  return (
    <div className="bg-slate-800 rounded-lg p-3 border border-slate-600">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">Connection Status</h3>
        <div className={`flex items-center space-x-1 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm font-medium">
            {connectionStatus.connected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Demo Mode Indicator */}
      {isDemo && (
        <div className="mb-2 p-2 rounded bg-orange-600/20 border border-orange-500/50 text-orange-200 text-xs">
          <div className="flex items-center gap-1 font-medium">
            <Signal className="w-3 h-3" />
            STORM DEMO MODE
          </div>
          <div className="text-orange-300 mt-1">
            Simulating live data for Denver storm conditions
          </div>
        </div>
      )}

      <div className="space-y-1 text-xs text-gray-400">
        <div className="flex justify-between">
          <span>Last Update:</span>
          <span>{formatLastUpdate(connectionStatus.lastUpdate)}</span>
        </div>

        {connectionStatus.latency && (
          <div className="flex justify-between">
            <span>Response Time:</span>
            <span className={getStatusColor()}>
              {connectionStatus.latency}ms ({getLatencyText()})
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span>Data Age:</span>
          <span className={connectionStatus.connected ? 'text-green-400' : 'text-red-400'}>
            {connectionStatus.connected ? 'Real-time' : 'Cached'}
          </span>
        </div>
      </div>
    </div>
  );
}
