/** Registers the offline service worker when the context allows it. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('[sw] registration skipped:', e.message));
}
