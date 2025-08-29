'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, CheckCircle, Info, Cloud } from 'lucide-react';

interface ConditionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    condition: {
        status?: 'normal' | 'caution' | 'warning' | 'active' | 'inactive' | 'unavailable' | 'check-overview';
        short_summary?: string;
        long_summary?: string;
        description?: string;
    };
    airportCode?: string;
}

export function ConditionModal({
    isOpen,
    onClose,
    title,
    condition,
    airportCode
}: ConditionModalProps) {
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

    const getStatusIcon = (status?: string) => {
        switch (status) {
            case 'warning':
                return <AlertTriangle className="w-5 h-5 text-red-400" />;
            case 'caution':
                return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
            case 'active':
                return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'inactive':
            case 'unavailable':
                return <Info className="w-5 h-5 text-gray-400" />;
            case 'check-overview':
                return <Cloud className="w-5 h-5 text-blue-400" />;
            default:
                return <CheckCircle className="w-5 h-5 text-green-400" />;
        }
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'warning':
                return 'text-red-400';
            case 'caution':
                return 'text-yellow-400';
            case 'active':
                return 'text-green-400';
            case 'inactive':
            case 'unavailable':
                return 'text-gray-400';
            case 'check-overview':
                return 'text-blue-400';
            default:
                return 'text-green-400';
        }
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
                        {getStatusIcon(condition.status)}
                        <h2 className="text-xl font-semibold text-white capitalize">
                            {title} {airportCode ? `- ${airportCode}` : ''}
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
                <div className="p-4 space-y-4">
                    {/* Status */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Status:</span>
                        <span className={`text-sm font-medium ${getStatusColor(condition.status)} capitalize`}>
                            {condition.status || 'Normal'}
                        </span>
                    </div>

                    {/* Short Summary */}
                    {condition.short_summary && (
                        <div className="p-3 bg-slate-700/50 rounded-lg">
                            <h3 className="text-sm font-medium text-white mb-2">Summary</h3>
                            <p className="text-sm text-gray-300">
                                {condition.short_summary}
                            </p>
                        </div>
                    )}

                    {/* Detailed Information */}
                    {(condition.long_summary || condition.description) && (
                        <div className="p-3 bg-slate-700/30 rounded-lg">
                            <h3 className="text-sm font-medium text-white mb-2">Details</h3>
                            <p className="text-sm text-gray-300 leading-relaxed">
                                {condition.long_summary || condition.description || 'No detailed information available'}
                            </p>
                        </div>
                    )}

                    {/* No Information Available */}
                    {!condition.short_summary && !condition.long_summary && !condition.description && (
                        <div className="text-center py-6">
                            <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-400">
                                No detailed information available for this condition
                            </p>
                        </div>
                    )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-700">
                        <button
                            onClick={onClose}
                            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
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
