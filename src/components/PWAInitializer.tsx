'use client';

import { useEffect } from 'react';
import { pwaManager } from '@/lib/pwa';

/**
 * PWA Initializer Component
 * Handles service worker registration and PWA setup
 */
export function PWAInitializer() {
  useEffect(() => {
    // Initialize PWA manager on client side only
    if (typeof window !== 'undefined') {
      pwaManager.init().catch((error) => {
        console.error('[PWA] Failed to initialize PWA manager:', error);
      });
    }
  }, []);

  // This component renders nothing - it's just for initialization
  return null;
}
