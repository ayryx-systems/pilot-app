'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Plane, XCircle, Cloud } from 'lucide-react';
import { pilotApi } from '@/services/api';
import { FAADelayForecast } from './FAADelayForecast';
import { formatAirportLocalTimeFromString } from '@/utils/airportTime';
import { HelpButton } from './HelpButton';

interface FAAStatus {
  airportId: string;
  airportCode: string;
  airportCodeWithK: string;
  airportLongName: string | null;
  groundStop: {
    id: string;
    impactingCondition: string;
    startTime: string;
    endTime: string;
    programExpirationTime: string;
    center: string;
    advisoryUrl: string;
    probabilityOfExtension: string;
  } | null;
  groundDelay: {
    id: string;
    impactingCondition: string;
    avgDelay: number;
    maxDelay: number;
    startTime: string;
    endTime: string;
    center: string;
    advisoryUrl: string;
    delayForecast: Array<{ sequence: number; delayMinutes: number }> | null;
    forecastStartTime: string | null;
  } | null;
  airportClosure: {
    id: string;
    startTime: string;
    endTime: string;
    text: string;
    simpleText: string;
    notamNumber: number;
  } | null;
  freeForm: {
    id: string;
    startTime: string;
    endTime: string;
    text: string;
    simpleText: string;
    notamNumber: number;
  } | null;
  arrivalDelay: {
    reason: string;
    arrivalDeparture: {
      type: string;
      min: string;
      max: string;
      trend: string;
    };
    updateTime: string;
    averageDelay: string;
    trend: string;
  } | null;
  departureDelay: {
    reason: string;
    arrivalDeparture: {
      type: string;
      min: string;
      max: string;
      trend: string;
    };
    updateTime: string;
    averageDelay: string;
    trend: string;
  } | null;
  airportConfig: {
    id: string;
    arrivalRunwayConfig: string;
    departureRunwayConfig: string;
    arrivalRate: number;
    sourceTimeStamp: string;
  } | null;
  deicing: {
    id: string;
    eventTime: string;
    expTime: string;
  } | null;
  lastUpdated: string;
}

interface FAAStatusProps {
  airportId: string | null;
}

export function FAAStatus({ airportId }: FAAStatusProps) {
  const [status, setStatus] = useState<FAAStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!airportId) {
      setStatus(null);
      return;
    }

    const fetchStatus = async () => {
      setLoading(true);
      try {
        const response = await pilotApi.getFAAStatus(airportId);
        setStatus(response.status);
      } catch (error) {
        console.error('Failed to fetch FAA status:', error);
        setStatus(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [airportId]);

  if (!airportId || loading) {
    return null;
  }

  if (!status) {
    return null;
  }

  const hasActiveEvents = !!(
    status.groundStop ||
    status.groundDelay ||
    status.airportClosure ||
    status.freeForm ||
    status.arrivalDelay ||
    status.departureDelay ||
    status.deicing
  );

  if (!hasActiveEvents && !status.airportConfig) {
    return null;
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-yellow-400" />
        <h3 className="text-sm font-semibold text-slate-200">FAA NAS Status</h3>
        <HelpButton
          title="FAA NAS Status"
          size="sm"
          content={
            <div className="space-y-2">
              <p>
                Live status information from the <strong>FAA National Airspace System (NAS)</strong>.
              </p>
              <div className="space-y-1.5 text-xs">
                <p><strong>Ground Stop:</strong> All departures to this airport are stopped</p>
                <p><strong>Ground Delay:</strong> Departures are being delayed before takeoff</p>
                <p><strong>Arrival/Departure Delays:</strong> Expected delays for arriving or departing aircraft</p>
                <p><strong>Airport Configuration:</strong> Active runway configuration and arrival/departure rates</p>
                <p><strong>Airport Closure:</strong> Full or partial airport closure</p>
                <p><strong>De-icing:</strong> Active de-icing operations</p>
              </div>
              <p className="text-xs text-gray-400">
                Data is updated every 5 minutes from FAA sources.
              </p>
              <p className="text-blue-300">
                💡 This shows official FAA advisories and may differ from your flight planning.
              </p>
            </div>
          }
        />
      </div>

      {status.groundStop && (
        <div className="p-2 bg-red-900/20 border border-red-700 rounded text-sm">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-3 w-3 text-red-400" />
            <span className="font-semibold text-red-400">Ground Stop</span>
            {status.groundStop.center && (
              <span className="text-xs text-slate-400">({status.groundStop.center})</span>
            )}
          </div>
          <p className="text-slate-300 text-xs">{status.groundStop.impactingCondition}</p>
          <p className="text-slate-400 text-xs mt-1">
            Until: {airportId ? formatAirportLocalTimeFromString(status.groundStop.endTime, airportId) : new Date(status.groundStop.endTime).toLocaleString()}
          </p>
          {status.groundStop.probabilityOfExtension && status.groundStop.probabilityOfExtension !== 'NONE' && (
            <p className="text-slate-400 text-xs">
              Extension: {status.groundStop.probabilityOfExtension}
            </p>
          )}
        </div>
      )}

      {status.groundDelay && (
        <div className="p-2 bg-yellow-900/20 border border-yellow-700 rounded text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3 w-3 text-yellow-400" />
            <span className="font-semibold text-yellow-400">Ground Delay</span>
            {status.groundDelay.center && (
              <span className="text-xs text-slate-400">({status.groundDelay.center})</span>
            )}
          </div>
          <p className="text-slate-300 text-xs">
            Avg: {Math.round(status.groundDelay.avgDelay)} min
            {status.groundDelay.maxDelay && status.groundDelay.maxDelay < 1000 && (
              <> | Max: {status.groundDelay.maxDelay} min</>
            )}
          </p>
          <p className="text-slate-400 text-xs mt-1">{status.groundDelay.impactingCondition}</p>
          {status.groundDelay.startTime && (
            <p className="text-slate-400 text-xs">
              Started: {airportId ? formatAirportLocalTimeFromString(status.groundDelay.startTime, airportId) : new Date(status.groundDelay.startTime).toLocaleString()}
            </p>
          )}
          {status.groundDelay.delayForecast && status.groundDelay.delayForecast.length > 0 && (
            <FAADelayForecast
              delayForecast={status.groundDelay.delayForecast}
              forecastStartTime={status.groundDelay.forecastStartTime}
              airportCode={airportId || undefined}
            />
          )}
        </div>
      )}

      {status.departureDelay && (
        <div className="p-2 bg-orange-900/20 border border-orange-700 rounded text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Plane className="h-3 w-3 text-orange-400" />
            <span className="font-semibold text-orange-400">Departure Delays</span>
          </div>
          <p className="text-slate-300 text-xs">
            {status.departureDelay.arrivalDeparture.min} - {status.departureDelay.arrivalDeparture.max}
            {status.departureDelay.averageDelay && (
              <span className="text-slate-400 ml-2">(avg: ~{status.departureDelay.averageDelay} min)</span>
            )}
          </p>
          <p className="text-slate-400 text-xs mt-1">{status.departureDelay.reason}</p>
          {status.departureDelay.trend && (
            <p className="text-slate-400 text-xs">Trend: {status.departureDelay.trend}</p>
          )}
          {status.departureDelay.updateTime && (
            <p className="text-slate-400 text-xs">
              Updated: {airportId ? formatAirportLocalTimeFromString(status.departureDelay.updateTime, airportId) : new Date(status.departureDelay.updateTime).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {status.arrivalDelay && (
        <div className="p-2 bg-orange-900/20 border border-orange-700 rounded text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Plane className="h-3 w-3 text-orange-400" />
            <span className="font-semibold text-orange-400">Arrival Delays</span>
          </div>
          <p className="text-slate-300 text-xs">
            {status.arrivalDelay.arrivalDeparture.min} - {status.arrivalDelay.arrivalDeparture.max}
            {status.arrivalDelay.averageDelay && (
              <span className="text-slate-400 ml-2">(avg: ~{status.arrivalDelay.averageDelay} min)</span>
            )}
          </p>
          <p className="text-slate-400 text-xs mt-1">{status.arrivalDelay.reason}</p>
          {status.arrivalDelay.trend && (
            <p className="text-slate-400 text-xs">Trend: {status.arrivalDelay.trend}</p>
          )}
          {status.arrivalDelay.updateTime && (
            <p className="text-slate-400 text-xs">
              Updated: {airportId ? formatAirportLocalTimeFromString(status.arrivalDelay.updateTime, airportId) : new Date(status.arrivalDelay.updateTime).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {status.airportClosure && (
        <div className="p-2 bg-red-900/20 border border-red-700 rounded text-sm">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-3 w-3 text-red-400" />
            <span className="font-semibold text-red-400">Closure</span>
            {status.airportClosure.notamNumber && (
              <span className="text-xs text-slate-400">(NOTAM {status.airportClosure.notamNumber})</span>
            )}
          </div>
          <p className="text-slate-300 text-xs">{status.airportClosure.text}</p>
          <p className="text-slate-400 text-xs mt-1">
            {airportId ? formatAirportLocalTimeFromString(status.airportClosure.startTime, airportId) : new Date(status.airportClosure.startTime).toLocaleString()} - {airportId ? formatAirportLocalTimeFromString(status.airportClosure.endTime, airportId) : new Date(status.airportClosure.endTime).toLocaleString()}
          </p>
        </div>
      )}

      {status.freeForm && (
        <div className="p-2 bg-blue-900/20 border border-blue-700 rounded text-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-3 w-3 text-blue-400" />
            <span className="font-semibold text-blue-400">Notice</span>
            {status.freeForm.notamNumber && (
              <span className="text-xs text-slate-400">(NOTAM {status.freeForm.notamNumber})</span>
            )}
          </div>
          <p className="text-slate-300 text-xs">{status.freeForm.text}</p>
        </div>
      )}

      {status.deicing && (
        <div className="p-2 bg-cyan-900/20 border border-cyan-700 rounded text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Cloud className="h-3 w-3 text-cyan-400" />
            <span className="font-semibold text-cyan-400">Deicing Active</span>
          </div>
          <p className="text-slate-400 text-xs">
            Until: {airportId ? formatAirportLocalTimeFromString(status.deicing.expTime, airportId) : new Date(status.deicing.expTime).toLocaleString()}
          </p>
        </div>
      )}

      {status.airportConfig && (
        <div className="pt-2 border-t border-slate-700 text-xs text-slate-400">
          <p className="mb-1">Config: Arr {status.airportConfig.arrivalRunwayConfig} / Dep {status.airportConfig.departureRunwayConfig}</p>
          <p>Rate: {status.airportConfig.arrivalRate}/hr</p>
        </div>
      )}
    </div>
  );
}




