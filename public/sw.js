self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            caches.delete('viewer-v1'),
            self.clients.claim()
        ])
    );
});
