// Service Worker for Pilot App PWA
// ================================
// Handles caching, offline functionality, and background sync

const CACHE_NAME = 'pilot-app-v1.0';
const RUNTIME_CACHE = 'pilot-app-runtime-v1.0';

// Static assets to cache immediately
const STATIC_CACHE_URLS = [
  '/',
  '/favicon.ico',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html'
];

// API endpoints that can be cached
const CACHEABLE_API_PATTERNS = [
  /^\/api\/pilot\/airports$/,
  /^\/api\/pilot\/[^/]+\/overview$/,
  /^\/api\/pilot\/[^/]+\/summary$/,
  /^\/api\/pilot\/health$/
];

// Short-lived data that should be cached briefly
const SHORT_CACHE_PATTERNS = [
  /^\/api\/pilot\/[^/]+\/pireps$/,
  /^\/api\/pilot\/[^/]+\/tracks$/
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              // Delete old versions of our caches
              return cacheName.startsWith('pilot-app-') && 
                     cacheName !== CACHE_NAME && 
                     cacheName !== RUNTIME_CACHE;
            })
            .map(cacheName => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        // Claim all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/pilot/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  // Handle static assets and pages
  event.respondWith(handleStaticRequest(event.request));
});

// Handle API requests with appropriate caching strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const isShortCache = SHORT_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
  const isCacheable = CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname)) || isShortCache;
  
  if (!isCacheable) {
    // Don't cache this API endpoint, just fetch
    try {
      return await fetch(request);
    } catch (error) {
      console.warn('[SW] API request failed:', url.pathname);
      return new Response(JSON.stringify({
        error: 'Network unavailable',
        offline: true,
        timestamp: new Date().toISOString()
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    // Try network first for fresh data
    const networkResponse = await fetch(request.clone());
    
    if (networkResponse.ok) {
      // Cache successful response
      const responseClone = networkResponse.clone();
      
      // Add cache metadata
      const responseWithMetadata = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers: {
          ...Object.fromEntries(responseClone.headers.entries()),
          'sw-cached-at': new Date().toISOString(),
          'sw-cache-type': isShortCache ? 'short' : 'standard'
        }
      });
      
      cache.put(request, responseWithMetadata);
      console.log(`[SW] Cached API response: ${url.pathname}`);
    }
    
    return networkResponse;
  } catch (error) {
    console.warn(`[SW] Network failed for ${url.pathname}, trying cache`);
    
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Check if cached data is too old for short-cache items
      if (isShortCache) {
        const cachedAt = cachedResponse.headers.get('sw-cached-at');
        if (cachedAt) {
          const cacheAge = Date.now() - new Date(cachedAt).getTime();
          const maxAge = 2 * 60 * 1000; // 2 minutes for short cache items
          
          if (cacheAge > maxAge) {
            console.warn(`[SW] Cached data too old for ${url.pathname}, returning error`);
            return new Response(JSON.stringify({
              error: 'Data too old and network unavailable',
              offline: true,
              timestamp: new Date().toISOString(),
              lastCached: cachedAt
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      }
      
      console.log(`[SW] Serving cached response: ${url.pathname}`);
      
      // Add offline indicator to cached response
      const cachedData = await cachedResponse.json();
      const offlineResponse = {
        ...cachedData,
        source: 'offline-cache',
        offline: true,
        cachedAt: cachedResponse.headers.get('sw-cached-at')
      };
      
      return new Response(JSON.stringify(offlineResponse), {
        status: cachedResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // No cache available
    return new Response(JSON.stringify({
      error: 'No cached data available',
      offline: true,
      timestamp: new Date().toISOString()
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle static assets and pages
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  // Try cache first for static assets
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Try network for new assets
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful response
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed and no cache
    console.warn('[SW] Failed to fetch static asset:', request.url);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/offline.html');
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    // Return a generic error response
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Background sync for data updates (when online again)
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-pilot-data') {
    event.waitUntil(backgroundSyncData());
  }
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_STATS') {
    getCacheStats().then((stats) => {
      event.ports[0]?.postMessage(stats);
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    clearCaches().then((success) => {
      event.ports[0]?.postMessage({ success });
    });
  }
});

// Background sync implementation
async function backgroundSyncData() {
  console.log('[SW] Starting background data sync...');
  
  try {
    // Get fresh data for cached endpoints
    const endpoints = [
      '/api/pilot/airports',
      '/api/pilot/health'
    ];
    
    const cache = await caches.open(RUNTIME_CACHE);
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint);
        if (response.ok) {
          const responseWithMetadata = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: {
              ...Object.fromEntries(response.headers.entries()),
              'sw-cached-at': new Date().toISOString(),
              'sw-cache-type': 'background-sync'
            }
          });
          
          await cache.put(endpoint, responseWithMetadata);
          console.log(`[SW] Background sync updated: ${endpoint}`);
        }
      } catch (error) {
        console.warn(`[SW] Background sync failed for ${endpoint}:`, error);
      }
    }
    
    console.log('[SW] Background data sync completed');
  } catch (error) {
    console.error('[SW] Background sync error:', error);
  }
}

// Push notifications (for future use)
self.addEventListener('push', event => {
  console.log('[SW] Push message received');
  
  // For now, just log the event
  // This can be extended to show notifications for critical PIREPs or weather updates
});

// Get cache statistics
async function getCacheStats() {
  try {
    const cacheNames = await caches.keys();
    const stats = {
      totalCaches: cacheNames.length,
      caches: {}
    };
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      stats.caches[cacheName] = {
        entries: requests.length,
        urls: requests.map(req => req.url)
      };
    }
    
    return stats;
  } catch (error) {
    console.error('[SW] Error getting cache stats:', error);
    return { error: error.message };
  }
}

// Clear all caches
async function clearCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('[SW] All caches cleared');
    return true;
  } catch (error) {
    console.error('[SW] Error clearing caches:', error);
    return false;
  }
}

console.log('[SW] Service worker script loaded');
