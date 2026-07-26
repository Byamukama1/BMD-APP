// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC-PINF2AJcETYIMINiCfT0gSxLxw70vSE",
  authDomain: "bmd-app-1aec8.firebaseapp.com",
  projectId: "bmd-app-1aec8",
  storageBucket: "bmd-app-1aec8.firebasestorage.app",
  messagingSenderId: "722780031230",
  appId: "1:722780031230:web:cd19a98e24e4d9d80dfdaf"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'BMD Update';
  const notificationOptions = {
    body: payload.notification?.body || 'New content available',
    icon: 'https://res.cloudinary.com/dp81zzxlh/image/upload/v1/bmd-og-default.jpg'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
