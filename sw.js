// sw.js - BMD App Service Worker
const CACHE_NAME = 'bmd-cache-v2';
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
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

// Install event - cache assets
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

// Activate event - clean old caches
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

// Fetch event - serve from cache if available
self.addEventListener('fetch', event => {
  // Skip cross-origin requests (like Cloudinary images)
  if (event.request.url.startsWith('https://res.cloudinary.com/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Return cached response
          return response;
        }
        // If not in cache, fetch from network
        return fetch(event.request)
          .then(response => {
            // Don't cache non-success responses
            if (!response || response.status !== 200) {
              return response;
            }
            // Clone and cache the response
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          })
          .catch(() => {
            // If offline, return a fallback (if needed)
            // For now, just return the error
            return new Response('Offline - Please check your connection', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Handle push notifications
self.addEventListener('push', event => {
  console.log('[sw.js] Push notification received:', event);
  
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }

  let notificationData = {
    title: 'BMD Update',
    body: 'New content available',
    icon: 'https://res.cloudinary.com/dp81zzxlh/image/upload/v1784978097/vhaafrigchmqnqbhehft.jpg'
  };

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.notification) {
        notificationData = {
          title: data.notification.title || notificationData.title,
          body: data.notification.body || notificationData.body,
          icon: data.notification.icon || notificationData.icon
        };
      }
    } catch (e) {
      // Use default
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      tag: 'bmd-notification',
      data: {
        url: 'https://byamukama1.github.io/BMD-APP/'
      }
    })
  );
});

// Handle notification clicks
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
      // Check if there's already a window/tab open
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

console.log('[sw.js] Service Worker loaded successfully!');
