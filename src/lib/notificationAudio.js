/**
 * BikroyNow Message Notification & Audio Helper
 * Plays Melodic Chime (Tone 3) and shows system popup notification.
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
      playPromise.catch((err) => {
        // Autoplay policy or format fallback: use Web Audio API synthesizer
        playSynthesizedMelodicChime();
      });
    }
  } catch (err) {
    playSynthesizedMelodicChime();
  }
};

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (e) {
    return 'denied';
  }
};

export const playMessageNotification = ({ title = 'BikroyNow: নতুন মেসেজ এসেছে!', body = 'আপনার বিজ্ঞাপনে একজন ক্রেতা মেসেজ পাঠিয়েছেন।', url = '/chat' } = {}) => {
  if (typeof window === 'undefined') return;

  // 1. Play Tone 3 sound
  playNotificationSound();

  // 2. Browser System Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'bikroynow-new-message',
        renotify: true
      });
      n.onclick = () => {
        window.focus();
        if (url && typeof window !== 'undefined') {
          window.location.href = url;
        }
      };
    } catch (e) {
      console.warn('[NotificationAudio] Desktop notification error:', e);
    }
  }
};
