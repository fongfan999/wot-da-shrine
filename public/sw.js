/**
 * The shrine's service worker: it only shows notifications. The shrine sends one, encrypted, through
 * the browser's push service when something goes down, comes back, the watch is handed to you or
 * your run of morning bows is waiting on today's (worker/push.js, and notify() in the Shrine). No
 * caching: the shrine is live or it is nothing.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { body: e.data?.text() ?? '' }; }
  const url = new URL(m.url || '/', self.location.origin).href;
  e.waitUntil(self.registration.showNotification(m.title || 'Wot Da Shrine', {
    body: m.body || '',
    tag: m.tag || undefined,
    renotify: Boolean(m.tag), // a newer word on the same vigil buzzes again, and replaces the old one
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    requireInteraction: Boolean(m.urgent),
    data: { url },
  }));
});

/** A tap opens the shrine: the tab already showing it, if there is one, else a new one. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  const bare = (u) => u.split(/[?#]/)[0].replace(/\/$/, '');
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = open.find((c) => bare(c.url) === bare(url));
    if (tab) return tab.focus();
    return self.clients.openWindow(url);
  })());
});
