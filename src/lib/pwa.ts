// PWA Service Worker Registration and Management
// ==============================================

export interface PWAInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class PWAManager {
  private deferredPrompt: PWAInstallPrompt | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;

  /**
   * Initialize PWA functionality
   */
  async init(): Promise<void> {
    console.log('[PWA] Initializing PWA manager...');

    // Register service worker
    await this.registerServiceWorker();

    // Setup install prompt handling
    this.setupInstallPrompt();

    // Setup background sync
    this.setupBackgroundSync();

    console.log('[PWA] PWA manager initialized');
  }

  /**
   * Register the service worker
   */
  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Workers not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      this.swRegistration = registration;

      console.log('[PWA] Service Worker registered successfully');

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          console.log('[PWA] New service worker installing...');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New service worker available');
              this.showUpdateAvailable();
            }
          });
        }
      });

      // Handle activation
      if (registration.waiting) {
        this.showUpdateAvailable();
      }

    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  }

  /**
   * Setup install prompt handling
   */
  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] Install prompt available');
      e.preventDefault();
      this.deferredPrompt = e as PWAInstallPrompt;
      this.showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.deferredPrompt = null;
    });
  }

  /**
   * Setup background sync
   */
  private setupBackgroundSync(): void {
    if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.warn('[PWA] Background Sync not supported');
      return;
    }

    // Register for background sync when app comes back online
    window.addEventListener('online', () => {
      console.log('[PWA] App back online, triggering background sync');
      this.requestBackgroundSync();
    });
  }

  /**
   * Show install button/prompt
   */
  private showInstallButton(): void {
    // Create and show install button
    const installButton = document.createElement('button');
    installButton.textContent = '📱 Install App';
    installButton.className = 'pwa-install-button';
    installButton.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      background: #3b82f6;
      color: white;
      border: none;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: all 0.2s;
    `;

    installButton.addEventListener('mouseenter', () => {
      installButton.style.background = '#2563eb';
      installButton.style.transform = 'translateY(-2px)';
    });

    installButton.addEventListener('mouseleave', () => {
      installButton.style.background = '#3b82f6';
      installButton.style.transform = 'translateY(0)';
    });

    installButton.addEventListener('click', () => {
      this.promptInstall();
    });

    document.body.appendChild(installButton);

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (installButton.parentNode) {
        installButton.style.opacity = '0.5';
      }
    }, 10000);

    // Hide completely after 30 seconds if not used
    setTimeout(() => {
      if (installButton.parentNode) {
        installButton.remove();
      }
    }, 30000);
  }

  /**
   * Show update available notification
   */
  private showUpdateAvailable(): void {
    const updateNotification = document.createElement('div');
    updateNotification.className = 'pwa-update-notification';
    updateNotification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      background: #059669;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      max-width: 300px;
      font-size: 14px;
    `;

    updateNotification.innerHTML = `
      <div style="margin-bottom: 8px;">
        <strong>Update Available</strong>
      </div>
      <div style="margin-bottom: 12px; color: #d1fae5;">
        A new version of the app is ready.
      </div>
      <button id="update-now" style="
        background: white;
        color: #059669;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        margin-right: 8px;
      ">Update Now</button>
      <button id="update-later" style="
        background: transparent;
        color: white;
        border: 1px solid white;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
      ">Later</button>
    `;

    document.body.appendChild(updateNotification);

    // Handle update buttons
    document.getElementById('update-now')?.addEventListener('click', () => {
      this.activateUpdate();
      updateNotification.remove();
    });

    document.getElementById('update-later')?.addEventListener('click', () => {
      updateNotification.remove();
    });

    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (updateNotification.parentNode) {
        updateNotification.remove();
      }
    }, 30000);
  }

  /**
   * Prompt user to install the app
   */
  async promptInstall(): Promise<void> {
    if (!this.deferredPrompt) {
      console.log('[PWA] Install prompt not available');
      return;
    }

    try {
      await this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted install prompt');
      } else {
        console.log('[PWA] User dismissed install prompt');
      }
      
      this.deferredPrompt = null;
      
      // Remove install button
      const installButton = document.querySelector('.pwa-install-button');
      if (installButton) {
        installButton.remove();
      }
      
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error);
    }
  }

  /**
   * Activate service worker update
   */
  private activateUpdate(): void {
    if (!this.swRegistration?.waiting) {
      console.warn('[PWA] No waiting service worker to activate');
      return;
    }

    this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload the page once the new service worker has taken control
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] New service worker activated, reloading...');
      window.location.reload();
    });
  }

  /**
   * Request background sync
   */
  private async requestBackgroundSync(): Promise<void> {
    if (!this.swRegistration?.sync) {
      console.warn('[PWA] Background sync not available');
      return;
    }

    try {
      await this.swRegistration.sync.register('background-sync-pilot-data');
      console.log('[PWA] Background sync registered');
    } catch (error) {
      console.error('[PWA] Background sync registration failed:', error);
    }
  }

  /**
   * Check if app is installed
   */
  isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true ||
           document.referrer.includes('android-app://');
  }

  /**
   * Check if app is running in PWA mode
   */
  isPWA(): boolean {
    return this.isInstalled();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    if (!this.swRegistration) {
      return null;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      this.swRegistration?.active?.postMessage(
        { type: 'GET_CACHE_STATS' },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<boolean> {
    if (!this.swRegistration) {
      return false;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.success);
      };

      this.swRegistration?.active?.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  }
}

export const pwaManager = new PWAManager();
