'use client';

import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export function AppUpdateNotifier() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check for app updates
        const checkForUpdates = () => {
            if ('serviceWorker' in navigator) {
                // Listen for new service worker installations
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    // A new service worker has taken control
                    if (!dismissed) {
                        setUpdateAvailable(true);
                    }
                });

                // Check for waiting service worker on page load
                navigator.serviceWorker.getRegistration().then((registration) => {
                    if (registration?.waiting) {
                        setUpdateAvailable(true);
                    }

                    // Listen for new service worker installations
                    registration?.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New service worker is installed and ready
                                    setUpdateAvailable(true);
                                }
                            });
                        }
                    });
                });

                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data?.type === 'UPDATE_AVAILABLE') {
                        setUpdateAvailable(true);
                    }
                });
            }
        };

        checkForUpdates();

        // Check periodically for updates (every 10 minutes)
        const interval = setInterval(() => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistration().then((registration) => {
                    registration?.update();
                });
            }
        }, 10 * 60 * 1000);

        return () => clearInterval(interval);
    }, [dismissed]);

    const handleUpdate = () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then((registration) => {
                if (registration?.waiting) {
                    // Tell the waiting service worker to skip waiting
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    // Reload the page to get the new version
                    window.location.reload();
                }
            });
        } else {
            // Fallback for browsers without service worker
            window.location.reload();
        }
    };

    if (!updateAvailable || dismissed) {
        return null;
    }

    return (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg border border-blue-500 max-w-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Download className="w-5 h-5" />
                        <div>
                            <div className="font-medium text-sm">App Update Available</div>
                            <div className="text-xs text-blue-100">
                                Reload to get the latest version
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-3">
                        <button
                            onClick={handleUpdate}
                            className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-xs font-medium transition-colors"
                        >
                            Update
                        </button>
                        <button
                            onClick={() => setDismissed(true)}
                            className="p-1 hover:bg-blue-700 rounded transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
