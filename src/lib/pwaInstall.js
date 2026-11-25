// Utility to manage PWA Installation, standalone detection, and prompt state

let deferredPrompt = null;
let listenersInitialized = false;

// Clear any installed state flag (e.g. when uninstalled or beforeinstallprompt fires)
export function clearInstalledState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('bikroynow_pwa_installed');
    localStorage.removeItem('bikroynow_pwa_installed_v2');
  } catch (_) {}
}

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

export function initPWAInstallListener() {
  if (typeof window === 'undefined') return;

  // Always purge legacy contaminated key
  try {
    localStorage.removeItem('bikroynow_pwa_installed');
  } catch (_) {}

  // Pick up early prompt if captured in <head>
  if (window.__bikroynow_pwa?.deferredPrompt) {
    deferredPrompt = window.__bikroynow_pwa.deferredPrompt;
  }

  // Check if browser supports getInstalledRelatedApps to verify true installation state
  if ('getInstalledRelatedApps' in navigator) {
    navigator.getInstalledRelatedApps().then((apps) => {
      if (Array.isArray(apps) && apps.length > 0) {
        // App is truly installed on the device
        try {
          localStorage.setItem('bikroynow_pwa_installed_v2', 'true');
        } catch (_) {}
        window.dispatchEvent(new CustomEvent('pwa_installed'));
      } else {
        // Not installed or was UNINSTALLED!
        clearInstalledState();
        window.dispatchEvent(new CustomEvent('pwa_can_install'));
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
    // If beforeinstallprompt fires, the app is 100% NOT installed (or was uninstalled)
    clearInstalledState();
    window.dispatchEvent(new CustomEvent('pwa_prompt_ready'));
    window.dispatchEvent(new CustomEvent('pwa_can_install'));
  });

  // Track when app is actually installed
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (window.__bikroynow_pwa) window.__bikroynow_pwa.deferredPrompt = null;
    try {
      localStorage.setItem('bikroynow_pwa_installed_v2', 'true');
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('pwa_installed'));
  });
}

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
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// Check if the user has already installed the app
export function isPWAInstalled() {
  if (typeof window === 'undefined') return false;
  // If running inside the native Android app or standalone PWA, it is 100% installed
  if (isNativeApp() || isStandalone()) return true;

  // If beforeinstallprompt is ready, it is definitely NOT installed
  if (getDeferredPrompt()) return false;

  try {
    return localStorage.getItem('bikroynow_pwa_installed_v2') === 'true';
  } catch (_) {
    return false;
  }
}

// Check if install popup banner should be displayed
export function canShowInstallPopup() {
  if (typeof window === 'undefined') return false;

  // 1. NEVER show inside native Android app or standalone PWA app
  if (isNativeApp() || isStandalone()) return false;

  // 2. NEVER show if verified installed
  if (isPWAInstalled()) return false;

  // 3. If closed via corner cross button, suppress for 10 minutes
  try {
    const dismissedAt = localStorage.getItem('bikroynow_pwa_dismissed_at');
    if (dismissedAt) {
      const diff = Date.now() - Number(dismissedAt);
      if (!isNaN(diff) && diff < 10 * 60 * 1000) {
        // Less than 10 minutes have passed
        return false;
      }
    }
  } catch (_) {}

  return true;
}

// User closed popup via corner cross button: record timestamp
export function dismissInstallPopup() {
  try {
    localStorage.setItem('bikroynow_pwa_dismissed_at', String(Date.now()));
  } catch (_) {}
}

// User installed app: mark installed
export function markPWAInstalled() {
  try {
    localStorage.setItem('bikroynow_pwa_installed_v2', 'true');
  } catch (_) {}
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
      prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') {
        markPWAInstalled();
        deferredPrompt = null;
        if (window.__bikroynow_pwa) window.__bikroynow_pwa.deferredPrompt = null;
        if (onAccepted) onAccepted();
        return { success: true, outcome: 'accepted' };
      } else {
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
