// Utility to manage PWA Installation, standalone detection, and prompt state

let deferredPrompt = null;
let listenersInitialized = false;

export function getDeferredPrompt() {
  if (typeof window === 'undefined') return null;
  return deferredPrompt || window.__bikroynow_pwa?.deferredPrompt || null;
}

export function isAndroid() {
  if (typeof window === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

export function isIOS() {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Check if running inside native Android app
export function isNativeApp() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (typeof window.AndroidNative !== 'undefined' && window.AndroidNative?.isNativeApp?.()) ||
    (navigator.userAgent && navigator.userAgent.includes('BikroyNowApp')) ||
    (typeof document !== 'undefined' && document.cookie.includes('is_native_app=true'))
  );
}

// Check if currently running inside the installed PWA standalone window OR native Android app
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  if (isNativeApp()) return true;
  const isStand = Boolean(
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
  if (isStand) {
    markPWAInstalled();
  }
  return isStand;
}

// Mark app as installed permanently
export function markPWAInstalled() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('bikroynow_app_installed', 'true');
    localStorage.setItem('bikroynow_pwa_installed_v2', 'true');
    localStorage.setItem('bikroynow_pwa_installed', 'true');
    document.cookie = 'bikroynow_app_installed=true; max-age=31536000; path=/';
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('pwa_installed'));
}

// Check if the user has already installed the app
export function isPWAInstalled() {
  if (typeof window === 'undefined') return false;

  // 1. If running inside the native Android app or standalone desktop window, 100% installed
  if (isNativeApp() || isStandalone()) return true;

  // 2. Persistent storage flags (set when installed)
  try {
    if (
      localStorage.getItem('bikroynow_app_installed') === 'true' ||
      localStorage.getItem('bikroynow_pwa_installed_v2') === 'true' ||
      localStorage.getItem('bikroynow_pwa_installed') === 'true'
    ) {
      return true;
    }
  } catch (_) {}

  // 3. Cookie flag
  try {
    if (document.cookie.includes('bikroynow_app_installed=true')) {
      return true;
    }
  } catch (_) {}

  return false;
}

// Check if install popup banner should be displayed
export function canShowInstallPopup() {
  if (typeof window === 'undefined') return false;

  // 1. NEVER show inside native Android app or standalone desktop window
  if (isNativeApp() || isStandalone()) return false;

  // 2. NEVER show if verified installed (once installed, this option will NEVER appear again!)
  if (isPWAInstalled()) return false;

  // 3. If closed via corner cross button, suppress for 10 minutes
  try {
    const dismissedAt = localStorage.getItem('bikroynow_pwa_dismissed_at');
    if (dismissedAt) {
      const elapsed = Date.now() - Number(dismissedAt);
      if (!isNaN(elapsed) && elapsed < 10 * 60 * 1000) {
        // Less than 10 minutes have passed since user clicked cross [X]
        return false;
      }
    }
  } catch (_) {}

  return true;
}

// User closed popup via corner cross button: record timestamp
export function dismissInstallPopup() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('bikroynow_pwa_dismissed_at', String(Date.now()));
  } catch (_) {}
}

export function initPWAInstallListener() {
  if (typeof window === 'undefined') return;

  // Pick up early prompt if captured in <head>
  if (window.__bikroynow_pwa?.deferredPrompt) {
    deferredPrompt = window.__bikroynow_pwa.deferredPrompt;
  }

  // Check if browser supports getInstalledRelatedApps to verify true installation state
  if ('getInstalledRelatedApps' in navigator) {
    navigator.getInstalledRelatedApps().then((apps) => {
      if (Array.isArray(apps) && apps.length > 0) {
        // App is truly installed on the device
        markPWAInstalled();
      }
    }).catch(() => {});
  }

  if (listenersInitialized) return;
  listenersInitialized = true;

  // Capture the native PWA install prompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (window.__bikroynow_pwa) window.__bikroynow_pwa.deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa_prompt_ready'));
    // Only dispatch can_install if NOT already installed
    if (!isPWAInstalled()) {
      window.dispatchEvent(new CustomEvent('pwa_can_install'));
    }
  });

  // Track when app is actually installed
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (window.__bikroynow_pwa) window.__bikroynow_pwa.deferredPrompt = null;
    markPWAInstalled();
  });
}

// Trigger installation prompt
export async function promptPWAInstall({ onAccepted, onDismissed, onFallback } = {}) {
  if (typeof window === 'undefined') return { success: false };

  let prompt = getDeferredPrompt();

  // If prompt is not yet available, wait up to 800ms in case beforeinstallprompt is in-flight
  if (!prompt) {
    await new Promise((resolve) => {
      let resolved = false;
      const onReady = () => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('pwa_prompt_ready', onReady);
          resolve();
        }
      };
      window.addEventListener('pwa_prompt_ready', onReady);
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          window.removeEventListener('pwa_prompt_ready', onReady);
          resolve();
        }
      }, 800);
    });
    prompt = getDeferredPrompt();
  }

  if (prompt) {
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') {
        markPWAInstalled();
        deferredPrompt = null;
        if (window.__bikroynow_pwa) window.__bikroynow_pwa.deferredPrompt = null;
        if (onAccepted) onAccepted();
        return { success: true, outcome: 'accepted' };
      } else {
        // If user explicitly dismissed the browser prompt, wait 10 minutes before nagging again
        dismissInstallPopup();
        if (onDismissed) onDismissed();
        return { success: false, outcome: 'dismissed' };
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  }

  // Fallback for iOS or browsers without active beforeinstallprompt
  if (onFallback) onFallback();
  return { success: false, fallback: true };
}
