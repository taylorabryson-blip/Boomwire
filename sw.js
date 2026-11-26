/**
 * Offline service worker. Caches the app shell; stale-while-revalidate.
 * User data lives in IndexedDB and is never touched here.
 * Bump CACHE on every release so clients pick up new code.
 */
const CACHE = 'hercules-shell-v0.1.0';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './assets/icons/icon-180.png', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './src/design-system/tokens.css', './src/design-system/base.css', './src/design-system/components.css',
  './src/app/main.js', './src/app/version.js',
  './src/components/dom.js', './src/components/icons.js', './src/components/primitives.js',
  './src/components/overlays.js', './src/components/bar-chart.js',
  './src/navigation/routes.js', './src/navigation/router.js', './src/navigation/tabbar.js',
  './src/data/models.js',
  './src/services/storage/db.js', './src/services/storage/repository.js', './src/services/storage/backup.js',
  './src/services/sync/merge.js', './src/services/pwa/register-sw.js',
  './src/engines/calculations/hydration.js',
  './src/utils/dates.js', './src/utils/units.js', './src/utils/id.js',
  './src/screens/shared/live.js', './src/screens/shared/hydration-ui.js',
  './src/screens/home/home.js', './src/screens/training/training.js', './src/screens/body/body.js',
  './src/screens/nutrition/nutrition.js', './src/screens/analytics/analytics.js', './src/screens/settings/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hercules-shell-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => cached);
    return cached || network;
  }));
});
