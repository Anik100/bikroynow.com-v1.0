// BikroyNow Service Worker for Android Mobile Push & In-Browser Notifications (v3)
const CACHE_NAME = 'bikroynow-sw-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Pass-through fetch event listener required by Google Chrome / Android for PWA installability criteria
self.addEventListener('fetch', (event) => {
  // Pass through network requests
});

// Handle clicking on the notification from Android status bar / shade
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Clear app launcher icon badge when notification is opened
  if (self.navigator && 'clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  // Handle Inline Direct Reply right from Android Notification shade
  if (event.action === 'reply') {
    const replyText = event.reply;
    const chatId = event.notification.data?.chatId;
    const senderId = event.notification.data?.senderId;

    if (replyText && replyText.trim() && chatId) {
      event.waitUntil(
        fetch(`/api/chats/${chatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender_id: senderId || null,
            content: replyText.trim()
          })
        }).catch(() => {})
      );
    }
    return;
  }

  const targetUrl = event.notification.data?.url || '/chat';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes('/chat')) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Clear app badge if user swipes away / closes notification
self.addEventListener('notificationclose', (event) => {
  if (self.navigator && 'clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }
});

// Background push notification listener
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { text: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'BikroyNow: নতুন মেসেজ এসেছে! 💬';
  const bodyText = data.body || data.text || 'আপনার বিজ্ঞাপনে একজন ক্রেতা মেসেজ পাঠিয়েছেন।';
  const targetUrl = data.url || '/chat';
  const unreadCount = Number(data.unreadCount || data.badgeCount || 1);

  event.waitUntil(
    (async () => {
      // 1. Set app badge on home screen if supported
      try {
        if (self.navigator && 'setAppBadge' in self.navigator) {
          await self.navigator.setAppBadge(unreadCount);
        }
      } catch (_) {}

      // 2. Display Android Status Bar Notification with Direct Reply & Single Alert
      const options = {
        body: bodyText,
        icon: '/icon-192.png',
        badge: '/favicon-48x48.png',
        vibrate: [250, 100, 250],
        tag: data.tag || 'bikroynow-new-message',
        renotify: false, // Prevent repeatedly buzzing/ringing for unread notifications
        data: {
          url: targetUrl,
          chatId: data.chatId || (targetUrl.includes('/chat/') ? targetUrl.split('/chat/')[1] : null),
          senderId: data.recipientId || null
        },
        actions: [
          {
            action: 'reply',
            type: 'text',
            title: 'রিপ্লাই (Reply)',
            placeholder: 'উত্তর লিখুন...'
          },
          {
            action: 'open',
            title: 'চ্যাট খুলুন'
          }
        ]
      };

      try {
        await self.registration.showNotification(title, options);
      } catch (err) {
        // Fallback with minimal options if device launcher rejected extended options
        try {
          await self.registration.showNotification(title, {
            body: bodyText,
            icon: '/icon-192.png'
          });
        } catch (_) {}
      }
    })()
  );
});
