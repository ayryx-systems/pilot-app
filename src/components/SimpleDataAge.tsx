'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Wifi, WifiOff } from 'lucide-react';

interface SimpleDataAgeProps {
    timestamp: Date;
    isLive?: boolean;
    offline?: boolean;
    size?: 'sm' | 'md';
}

export function SimpleDataAge({
    timestamp,
    isLive = true,
    offline = false,
    size = 'sm'
}: SimpleDataAgeProps) {
    const [mounted, setMounted] = useState(false);

    // Ensure component is only rendered on client after hydration
    useEffect(() => {
        setMounted(true);
    }, []);

    const formatAge = (timestamp: Date): string => {
        const now = new Date();
        const diff = Math.floor((now.getTime() - timestamp.getTime()) / 1000);

        if (diff < 30) return 'Just now';
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    const getStatusColor = () => {
        if (offline) return 'text-red-400';

        const ageMinutes = (new Date().getTime() - timestamp.getTime()) / (1000 * 60);
        if (isLive && ageMinutes < 2) return 'text-green-400';
        if (ageMinutes < 5) return 'text-blue-400';
        if (ageMinutes < 30) return 'text-yellow-400';
        return 'text-orange-400';
    };

    const getIcon = () => {
        if (offline) return <WifiOff className="w-3 h-3" />;
        if (isLive) return <Wifi className="w-3 h-3" />;
        return <Clock className="w-3 h-3" />;
    };

    const sizeClass = size === 'md' ? 'text-sm' : 'text-xs';

    // Show a static placeholder during SSR to prevent hydration mismatch
    if (!mounted) {
        return (
            <div className={`flex items-center space-x-1 text-gray-400 ${sizeClass}`}>
                <Clock className="w-3 h-3" />
                <span>Loading...</span>
            </div>
        );
    }

    return (
        <div className={`flex items-center space-x-1 ${getStatusColor()} ${sizeClass}`}>
            {getIcon()}
            <span>{formatAge(timestamp)}</span>
        </div>
    );
}
