// sw.js - BMD App Service Worker
const CACHE_NAME = 'bmd-cache-v4';
const urlsToCache = [
  '/BMD-APP/',
  '/BMD-APP/index.html',
  '/BMD-APP/index-style.css',
  '/BMD-APP/index-app.js',
  '/BMD-APP/register.html',
  '/BMD-APP/account.html',
  '/BMD-APP/post.html',
  '/BMD-APP/activities.html',
  '/BMD-APP/my-posts.html',
  '/BMD-APP/o-m-i-r.html',
  '/BMD-APP/about-bmd.html',
  '/BMD-APP/firebase-messaging-sw.js',
  '/BMD-APP/launchericon-192x192.png',
  '/BMD-APP/Screenshot 2026-07-27 223306.png',
  '/BMD-APP/Screenshot 2026-07-27 223558.png',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// Install event
self.addEventListener('install', event => {
  console.log('[sw.js] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[sw.js] Caching assets...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[sw.js] Assets cached successfully!');
        return self.skipWaiting();
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('[sw.js] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[sw.js] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[sw.js] Service Worker activated!');
      return self.clients.claim();
    })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  if (event.request.url.startsWith('https://res.cloudinary.com/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200) {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          })
          .catch(() => {
            return new Response('Offline - Please check your connection', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Push notifications
self.addEventListener('push', event => {
  console.log('[sw.js] Push notification received:', event);
  
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }

  let notificationData = {
    title: 'BMD Update',
    body: 'New content available',
    icon: '/BMD-APP/launchericon-192x192.png',
    badge: '/BMD-APP/launchericon-192x192.png'
  };

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.notification) {
        notificationData = {
          title: data.notification.title || notificationData.title,
          body: data.notification.body || notificationData.body,
          icon: data.notification.icon || notificationData.icon,
          badge: data.notification.badge || notificationData.badge
        };
      }
    } catch (e) {
      console.log('Push data parse error:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: 'bmd-notification',
      data: {
        url: 'https://byamukama1.github.io/BMD-APP/'
      }
    })
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  console.log('[sw.js] Notification clicked:', event);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || 'https://byamukama1.github.io/BMD-APP/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then(windowClients => {
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

console.log('[sw.js] Service Worker loaded successfully!');
