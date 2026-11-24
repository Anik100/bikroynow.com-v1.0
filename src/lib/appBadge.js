/**
 * App Icon & Favicon Badging Helper
 * Updates App launcher icon badge on mobile home screen / desktop taskbar
 * via W3C Badging API (navigator.setAppBadge / clearAppBadge),
 * and dynamically overlays a red counter badge on browser tab favicon & title.
 */

export function setFaviconBadge(count) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    const favicon = document.querySelector("link[rel='icon']") || document.querySelector("link[rel*='icon']");
    if (!favicon) return;

    if (count <= 0) {
      favicon.href = '/favicon-32x32.png';
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/favicon-32x32.png';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, 32, 32);

        // Draw bright red badge circle on top right corner
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(23, 9, 8, 0, 2 * Math.PI);
        ctx.fill();

        // White border around red badge
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Draw counter text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = count > 9 ? '9+' : String(count);
        ctx.fillText(text, 23, 9.5);

        favicon.href = canvas.toDataURL('image/png');
      } catch (_) {}
    };
  } catch (_) {}
}

export function updateAppBadge(count) {
  if (typeof window === 'undefined') return;
  const num = Math.max(0, parseInt(count, 10) || 0);

  // 1. W3C Badging API (Android PWA launcher icon, Windows/Mac desktop icon)
  if (typeof navigator !== 'undefined') {
    try {
      if (num > 0 && typeof navigator.setAppBadge === 'function') {
        navigator.setAppBadge(num).catch(() => {});
      } else if (num === 0 && typeof navigator.clearAppBadge === 'function') {
        navigator.clearAppBadge().catch(() => {});
      }
    } catch (_) {}
  }

  // 2. Dynamic Red Badge on Favicon
  setFaviconBadge(num);

  // 3. Document Title Indicator (e.g. "(2) BikroyNow")
  if (typeof document !== 'undefined') {
    try {
      const cleanTitle = (document.title || 'BikroyNow').replace(/^\(\d+\+?\)\s*/, '');
      if (num > 0) {
        document.title = `(${num > 99 ? '99+' : num}) ${cleanTitle}`;
      } else {
        document.title = cleanTitle;
      }
    } catch (_) {}
  }
}

export function clearAppBadge() {
  updateAppBadge(0);
}
