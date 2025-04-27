import { useEffect } from 'react';

// Match the version in App.tsx
const APP_VERSION = '1.0.1';
const VERSION_KEY = 'app_version';

export function VersionCheck() {
  useEffect(() => {
    const checkVersion = () => {
      console.log('=== Version Check Start ===');
      const storedVersion = localStorage.getItem(VERSION_KEY);
      console.log('Initial Check:', { 
        current: APP_VERSION, 
        stored: storedVersion,
        needsUpdate: storedVersion !== APP_VERSION,
        timestamp: new Date().toISOString()
      });
      
      if (storedVersion !== APP_VERSION) {
        console.log('Version mismatch detected:', {
          before: localStorage.getItem(VERSION_KEY),
          action: 'clearing cache'
        });
        
        // Clear all caches
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear service worker cache if it exists
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => registration.unregister());
          });
        }
        
        // Store new version
        localStorage.setItem(VERSION_KEY, APP_VERSION);
        console.log('Cache cleared:', {
          after: localStorage.getItem(VERSION_KEY),
          action: 'reloading page'
        });
        
        // Reload the page
        window.location.reload(true);
      } else {
        console.log('Version check complete - no action needed');
      }
      console.log('=== Version Check End ===');
    };

    checkVersion();
  }, []);

  return null;
} 