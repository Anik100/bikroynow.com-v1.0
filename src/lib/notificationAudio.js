/**
 * BikroyNow Message Notification & Audio Helper
 * Plays Melodic Chime (Tone 3) and shows Android Status Bar / Desktop Notifications.
 * Uses Service Worker on mobile to support Android's top pull-down notification shade.
 */

let sharedAudioCtx = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
};

// 3-note Melodic Chime synthesizer (F#5, A5, C#6) as 100% resilient fallback
const playSynthesizedMelodicChime = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [739.99, 880.00, 1108.73];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.1;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.6);
    });
  } catch (e) {
    console.warn('[NotificationAudio] Synthesizer error:', e);
  }
};

export const playNotificationSound = () => {
  if (typeof window === 'undefined') return;

  try {
    const audio = new Audio('/sounds/message_notification.wav');
    audio.volume = 0.8;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        playSynthesizedMelodicChime();
      });
    }
  } catch (err) {
    playSynthesizedMelodicChime();
  }
};

// Base64 helper for VAPID public key conversion
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Subscribes current device to Web Push and syncs endpoint with backend API
export const subscribeUserToPush = async (userId) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  if (!userId) return null;

  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return null;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BJOmaOksk0mUbNzIe1FiT34MpGAlus-RlYNnVwRCdT3dm_C_ny2BvFsLJzZET4MLRhL1CP4xlKks-WOYBvnlxmI';

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
    }

    if (sub) {
      await fetch('/api/notifications/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          subscription: sub.toJSON()
        })
      }).catch(() => {});
      return sub;
    }
  } catch (err) {
    console.warn('[PushManager] subscribe error:', err);
  }
  return null;
};

// Auto-register Service Worker on mobile / desktop browsers
export const registerServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('[ServiceWorker] Registration failed:', err);
    return null;
  }
};

export const requestNotificationPermission = async (userId = null) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') {
    registerServiceWorker();
    if (userId) subscribeUserToPush(userId);
    return 'granted';
  }
  if (Notification.permission === 'denied') return 'denied';

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      await registerServiceWorker();
      if (userId) subscribeUserToPush(userId);
    }
    return perm;
  } catch (e) {
    return 'denied';
  }
};

/**
 * Checks if the user is currently on screen actively viewing this chat room.
 */
export const isUserActivelyViewingChat = (chatId) => {
  if (typeof window === 'undefined') return false;

  const isDocVisible = document.visibilityState === 'visible';
  const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  if (!isDocVisible || !hasFocus) {
    return false;
  }

  if (chatId) {
    const path = window.location.pathname;
    const targetPath = `/chat/${chatId}`;
    return path === targetPath || path === `${targetPath}/`;
  }

  return false;
};

export const playMessageNotification = ({
  title = 'BikroyNow: নতুন মেসেজ এসেছে! 💬',
  body = 'আপনার বিজ্ঞাপনে একজন ক্রেতা মেসেজ পাঠিয়েছেন।',
  url = '/chat',
  chatId = null,
  force = false
} = {}) => {
  if (typeof window === 'undefined') return;

  // SMART FILTER: Mute alert when user is actively focused inside this room
  if (!force && chatId && isUserActivelyViewingChat(chatId)) {
    return;
  }

  // 1. Play Tone 3 Melodic sound
  playNotificationSound();

  // 2. Android Status Bar Notification & Desktop System Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    const notificationOptions = {
      body,
      icon: '/icon-192.png',
      badge: '/favicon-48x48.png',
      vibrate: [200, 100, 200],
      tag: 'bikroynow-new-message',
      renotify: true,
      data: { url }
    };

    // On Android Mobile Chrome, showNotification via Service Worker is mandatory
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, notificationOptions);
      }).catch(() => {
        try {
          const n = new Notification(title, notificationOptions);
          n.onclick = () => {
            window.focus();
            if (url && typeof window !== 'undefined') window.location.href = url;
          };
        } catch (e) {}
      });
    } else {
      try {
        const n = new Notification(title, notificationOptions);
        n.onclick = () => {
          window.focus();
          if (url && typeof window !== 'undefined') window.location.href = url;
        };
      } catch (e) {}
    }
  }
};
