/** Application bootstrap. */
import { h } from '../components/dom.js';
import { openDB } from '../services/storage/db.js';
import { createTabBar } from '../navigation/tabbar.js';
import { startRouter, createTopbar } from '../navigation/router.js';
import { registerServiceWorker } from '../services/pwa/register-sw.js';
import { startWorkoutActivity } from '../screens/training/live-activity.js';
import { startReminderClock } from '../services/notifications/local.js';

// No long-press context menus / link previews anywhere except text fields.
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('input, textarea, .selectable')) e.preventDefault();
});
// iOS: stop double-tap zoom on fast taps.
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300 && !e.target.closest('input, textarea, select')) e.preventDefault();
  lastTouch = now;
}, { passive: false });

async function boot() {
  const app = document.getElementById('app');
  try {
    await openDB();
  } catch (e) {
    app.replaceChildren(h('div', { class: 'fatal' },
      h('h1', { class: 't-title-2' }, 'Storage unavailable'),
      h('p', { class: 'c-2' }, e.message)));
    return;
  }
  const view = h('main', { class: 'view', id: 'view' });
  const tabbar = createTabBar();
  const topbar = createTopbar();
  app.replaceChildren(topbar.el, view, tabbar.el);
  await startRouter(view, tabbar, topbar);
  registerServiceWorker();
  startWorkoutActivity();
  startReminderClock();
}

boot();
