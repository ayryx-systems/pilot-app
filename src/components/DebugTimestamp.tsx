'use client';

import React, { useEffect, useState } from 'react';

interface DebugTimestampProps {
    serverTimestamp?: string;
    source?: string;
    className?: string;
}

export function DebugTimestamp({
    serverTimestamp,
    source = 'unknown',
    className = ''
}: DebugTimestampProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Don't render anything during SSR to prevent hydration mismatch
    if (!isClient || !serverTimestamp) {
        return null;
    }

    const formatTimestamp = (isoString: string): string => {
        try {
            const date = new Date(isoString);
            return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
        } catch {
            return 'Invalid timestamp';
        }
    };

    return (
        <div className={`text-xs text-gray-500 font-mono ${className}`}>
            <span title={`Server timestamp from ${source}`}>
                🕐 {formatTimestamp(serverTimestamp)}
            </span>
        </div>
    );
}
