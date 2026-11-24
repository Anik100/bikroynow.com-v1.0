import webpush, { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from './webPushServer';
import { getServerSupabase } from './serverSupabase';

/**
 * Sends a background Push Notification to a user via Google Web Push / FCM.
 * Awakens the device's Service Worker and rings notification sound even when the app is completely closed.
 */
export async function sendPushNotificationToUser(recipientUserId, payload) {
  if (!recipientUserId) return { sent: 0, failed: 0 };

  const serverSupabase = getServerSupabase();
  if (!serverSupabase) return { sent: 0, failed: 0 };

  try {
    const settingsKey = `push_subs_${recipientUserId}`;
    const { data: row } = await serverSupabase
      .from('admin_settings')
      .select('value')
      .eq('key', settingsKey)
      .maybeSingle();

    if (!row?.value) return { sent: 0, failed: 0 };

    let subscriptions = [];
    try {
      subscriptions = JSON.parse(row.value);
    } catch (_) {
      return { sent: 0, failed: 0 };
    }

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title || 'BikroyNow: নতুন মেসেজ এসেছে! 💬',
      body: payload.body || 'আপনার বিজ্ঞাপনে একজন ক্রেতা মেসেজ পাঠিয়েছেন।',
      url: payload.url || '/chat',
      icon: '/icon-192.png',
      badge: '/favicon-48x48.png',
      tag: payload.tag || `bkr-msg-${Date.now()}`
    });

    let sent = 0;
    let failed = 0;
    const survivingSubs = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub, notificationPayload, {
          TTL: 60 * 60 * 24, // 24 hours delivery window
          urgency: 'high'
        });
        sent++;
        survivingSubs.push(sub);
      } catch (err) {
        failed++;
        // If endpoint is expired or unsubscribed (404/410), do not keep it
        if (err.statusCode !== 404 && err.statusCode !== 410) {
          survivingSubs.push(sub);
        }
      }
    }

    // Prune expired endpoints if any were removed
    if (survivingSubs.length !== subscriptions.length) {
      await serverSupabase
        .from('admin_settings')
        .upsert({
          key: settingsKey,
          value: JSON.stringify(survivingSubs)
        }, { onConflict: 'key' })
        .catch(() => {});
    }

    return { sent, failed };
  } catch (e) {
    console.error('[sendPushNotificationToUser] Error:', e);
    return { sent: 0, failed: 0 };
  }
}
