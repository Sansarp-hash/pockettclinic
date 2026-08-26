// Give the service worker access to Firebase Messaging.
// Note that you can use any version of Firebase v10+ via CDN compat scripts.
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config credentials.
firebase.initializeApp({
  apiKey: "AIzaSyBTZOoQWudvEtjg3HXVwZeEps2qycqGZPA",
  authDomain: "pharmabridgeghana-prodd.firebaseapp.com",
  projectId: "pharmabridgeghana-prodd",
  storageBucket: "pharmabridgeghana-prodd.firebasestorage.app",
  messagingSenderId: "169002986248",
  appId: "1:169002986248:web:be7504baf58096fca25abd"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// notifications.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'PockettClinic Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update in PockettClinic.',
    icon: '/logo.svg',
    badge: '/logo.svg',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
