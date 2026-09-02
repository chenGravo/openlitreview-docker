self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Do not cache pages, tasks, results, or credentials. The service worker exists
// only so supported browsers can install the private portal as an app.
