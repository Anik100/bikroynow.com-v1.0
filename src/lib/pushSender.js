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
    const rawId = String(recipientUserId).trim();
    const keysToTry = new Set([`push_subs_${rawId}`, `push_subs_${rawId.toLowerCase()}`]);

    // Check if recipient has matching UUID/email profile to catch all devices
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
      const query = serverSupabase.from('profiles').select('id, email');
      const { data: prof } = isUUID
        ? await query.eq('id', rawId).maybeSingle()
        : await query.ilike('email', rawId).maybeSingle();

      if (prof) {
        if (prof.id) {
          keysToTry.add(`push_subs_${prof.id}`);
          keysToTry.add(`push_subs_${String(prof.id).toLowerCase()}`);
        }
        if (prof.email) {
          const em = prof.email.toLowerCase();
          keysToTry.add(`push_subs_${em}`);
          keysToTry.add(`push_subs_user-${em.replace(/[^a-z0-9]/g, '')}`);
        }
      }
    } catch (_) {}

    const { data: rows } = await serverSupabase
      .from('admin_settings')
      .select('key, value')
      .in('key', Array.from(keysToTry));

    let subscriptions = [];
    const seenEndpoints = new Set();

    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row?.value) {
          try {
            const parsed = JSON.parse(row.value);
            if (Array.isArray(parsed)) {
              for (const sub of parsed) {
                if (sub?.endpoint && !seenEndpoints.has(sub.endpoint)) {
                  seenEndpoints.add(sub.endpoint);
                  subscriptions.push(sub);
                }
              }
            }
          } catch (_) {}
        }
      }
    }

    if (subscriptions.length === 0) return { sent: 0, failed: 0 };

    const notificationPayload = JSON.stringify({
      title: payload.title || 'BikroyNow: নতুন মেসেজ এসেছে! 💬',
      body: payload.body || 'আপনার বিজ্ঞাপনে একজন ক্রেতা মেসেজ পাঠিয়েছেন।',
      url: payload.url || '/chat',
      icon: '/icon-192.png',
      badge: '/favicon-48x48.png',
      tag: payload.tag || `bkr-msg-${Date.now()}`,
      unreadCount: payload.unreadCount || payload.badgeCount || 1,
      badgeCount: payload.unreadCount || payload.badgeCount || 1
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
