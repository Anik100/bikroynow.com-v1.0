// Utility to manage PWA Installation, standalone detection, and prompt state

let deferredPrompt = null;
let listenersInitialized = false;

export function initPWAInstallListener() {
  if (typeof window === 'undefined' || listenersInitialized) return;
  listenersInitialized = true;

  // Capture the native PWA install prompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa_prompt_ready'));
  });

  // Track when app is installed
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    try {
      localStorage.setItem('bikroynow_pwa_installed', 'true');
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('pwa_installed'));
  });
}

// Check if currently running inside the installed PWA standalone window
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// Check if the user has already installed the app
export function isPWAInstalled() {
  if (typeof window === 'undefined') return false;
  if (isStandalone()) return true;
  try {
    return localStorage.getItem('bikroynow_pwa_installed') === 'true';
  } catch (_) {
    return false;
  }
}

// Check if install popup banner should be displayed
export function canShowInstallPopup() {
  if (typeof window === 'undefined') return false;

  // 1. NEVER show inside standalone PWA app
  if (isStandalone()) return false;

  // 2. NEVER show if user has already installed it
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

// User installed app: permanently prevent showing popup again
export function markPWAInstalled() {
  try {
    localStorage.setItem('bikroynow_pwa_installed', 'true');
  } catch (_) {}
}

export function isIOS() {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Trigger installation prompt
export async function promptPWAInstall({ onAccepted, onDismissed, onFallback } = {}) {
  if (typeof window === 'undefined') return { success: false };

  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        markPWAInstalled();
        deferredPrompt = null;
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
