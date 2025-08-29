'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Cloud, Wind, Eye, Thermometer } from 'lucide-react';
import { DebugTimestamp } from './DebugTimestamp';

interface WeatherModalProps {
    isOpen: boolean;
    onClose: () => void;
    airportCode: string;
    weatherData?: {
        metar: string;
        metarFriendly: string;
        temperature?: string;
        wind?: {
            direction: number;
            speed: number;
            gust?: number;
        };
        visibility?: string;
        timestamp: string;
    };
    summaryData?: {
        long_summary: string;
        status: 'normal' | 'caution' | 'warning' | 'check-overview' | 'unavailable';
    };
}

export function WeatherModal({
    isOpen,
    onClose,
    airportCode,
    weatherData,
    summaryData
}: WeatherModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'normal':
                return 'text-green-400';
            case 'caution':
                return 'text-yellow-400';
            case 'warning':
                return 'text-red-400';
            case 'check-overview':
                return 'text-blue-400';
            case 'unavailable':
                return 'text-gray-400';
            default:
                return 'text-gray-400';
        }
    };

    const formatWindDisplay = (wind?: { direction: number; speed: number; gust?: number }) => {
        if (!wind || wind.direction === null || wind.speed === null) {
            return 'Calm';
        }

        let windStr = `${wind.direction.toString().padStart(3, '0')}° at ${wind.speed} kt`;
        if (wind.gust) {
            windStr += ` gusting ${wind.gust} kt`;
        }
        return windStr;
    };

    const modalContent = (
        <div className="fixed inset-0 flex items-start justify-center bg-black bg-opacity-50 py-4 px-4" style={{ zIndex: 999999999 }}>
            <div 
                ref={modalRef} 
                className="bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full overflow-hidden"
                style={{ 
                    marginTop: '4rem',
                    marginBottom: '2rem',
                    maxHeight: 'calc(100vh - 6rem)'
                }}
            >
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                            <Cloud className="w-5 h-5 text-blue-400" />
                            <h2 className="text-xl font-semibold text-white">
                                Weather Details - {airportCode}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-6">
                        {/* Weather Summary (from LLM) */}
                        {summaryData && (
                            <div>
                                <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                                    <Cloud className="w-4 h-4 text-blue-400" />
                                    Weather Summary
                                    {summaryData.status && (
                                        <span className={`text-sm ${getStatusColor(summaryData.status)} capitalize`}>
                                            ({summaryData.status})
                                        </span>
                                    )}
                                </h3>
                                <div className="bg-slate-900 rounded-lg p-3">
                                    <p className="text-gray-300 text-sm leading-relaxed">
                                        {summaryData.long_summary || summaryData.description || 'Weather summary unavailable'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* User-Friendly METAR */}
                        {weatherData?.metarFriendly && (
                            <div>
                                <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-green-400" />
                                    Current Conditions
                                </h3>
                                <div className="bg-slate-900 rounded-lg p-3">
                                    <p className="text-gray-300 text-sm leading-relaxed">
                                        {weatherData.metarFriendly}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Quick Stats */}
                        {weatherData && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Wind */}
                                <div className="bg-slate-900 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Wind className="w-4 h-4 text-cyan-400" />
                                        <span className="text-sm font-medium text-white">Wind</span>
                                    </div>
                                    <p className="text-gray-300 text-sm">
                                        {formatWindDisplay(weatherData.wind)}
                                    </p>
                                </div>

                                {/* Temperature */}
                                {weatherData.temperature && (
                                    <div className="bg-slate-900 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Thermometer className="w-4 h-4 text-orange-400" />
                                            <span className="text-sm font-medium text-white">Temperature</span>
                                        </div>
                                        <p className="text-gray-300 text-sm">
                                            {weatherData.temperature}°C
                                        </p>
                                    </div>
                                )}

                                {/* Visibility */}
                                {weatherData.visibility && (
                                    <div className="bg-slate-900 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Eye className="w-4 h-4 text-purple-400" />
                                            <span className="text-sm font-medium text-white">Visibility</span>
                                        </div>
                                        <p className="text-gray-300 text-sm">
                                            {parseFloat(weatherData.visibility) >= 10 ? '10+ miles' : `${weatherData.visibility} miles`}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Raw METAR */}
                        {weatherData?.metar && (
                            <div>
                                <h3 className="text-lg font-medium text-white mb-2">
                                    Raw METAR
                                </h3>
                                <div className="bg-slate-900 rounded-lg p-3">
                                    <code className="text-green-400 text-sm font-mono break-all">
                                        {weatherData.metar}
                                    </code>
                                </div>
                            </div>
                        )}

                        {/* Last Updated */}
                        {weatherData?.timestamp && (
                            <div className="space-y-2">
                                <div className="text-xs text-gray-500 text-center">
                                    Last updated: {new Date(weatherData.timestamp).toLocaleString()}
                                </div>
                                {/* Debug: Show weather observation timestamp in UTC */}
                                <div className="text-center">
                                    <DebugTimestamp
                                        serverTimestamp={weatherData.timestamp}
                                        source="weather observation"
                                        className="text-center"
                                    />
                                </div>
                            </div>
                        )}

                        {/* No Data Message */}
                        {(!weatherData || !summaryData) && (
                            <div className="text-center py-8">
                                <Cloud className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                                <p className="text-gray-400">
                                    {!summaryData ? 'Weather summary unavailable' : 'METAR data unavailable'}
                                </p>
                                <p className="text-gray-500 text-sm mt-1">
                                    Check local weather sources for current conditions
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-700 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // Render modal using portal to document.body to escape any stacking context issues
    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
