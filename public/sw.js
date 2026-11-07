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

// Background push notification listener
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { text: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'BikroyNow: নতুন মেসেজ এসেছে! 💬';
  const options = {
    body: data.body || data.text || 'আপনার বিজ্ঞাপনে একজন ক্রেতা মেসেজ পাঠিয়েছেন।',
    icon: '/icon-192.png',
    badge: '/favicon-48x48.png',
    vibrate: [200, 100, 200],
    tag: 'bikroynow-new-message',
    renotify: true,
    data: {
      url: data.url || '/chat'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
