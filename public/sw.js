// BikroyNow Service Worker for Android Mobile Push & In-Browser Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle clicking on the notification from Android status bar / shade
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Clear app launcher icon badge when notification is opened
  if (self.navigator && 'clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
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

  const unreadCount = Number(data.unreadCount || data.badgeCount || 1);
  const title = data.title || 'BikroyNow: নতুন মেসেজ এসেছে! 💬';
  const options = {
    body: data.body || data.text || 'আপনার বিজ্ঞাপনে একজন ক্রেতা মেসেজ পাঠিয়েছেন।',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/favicon-48x48.png',
    vibrate: [300, 150, 300, 150, 300],
    sound: '/sounds/message_notification.wav',
    tag: data.tag || `bikroynow-msg-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: {
      url: data.url || '/chat'
    }
  };

  const tasks = [];
  tasks.push(self.registration.showNotification(title, options));

  if (self.navigator && 'setAppBadge' in self.navigator) {
    tasks.push(self.navigator.setAppBadge(unreadCount).catch(() => {}));
  }

  event.waitUntil(Promise.all(tasks));
});
