/** Application bootstrap. */
import { h } from '../components/dom.js';
import { openDB } from '../services/storage/db.js';
import { createTabBar } from '../navigation/tabbar.js';
import { startRouter, createTopbar } from '../navigation/router.js';
import { registerServiceWorker } from '../services/pwa/register-sw.js';
import { startWorkoutActivity } from '../screens/training/live-activity.js';
import { startReminderClock } from '../services/notifications/local.js';
import { installTouchEffects } from '../components/touch-effects.js';
import { announceUpdate } from '../services/pwa/whats-new.js';

// No long-press context menus / link previews anywhere except text fields.
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('input, textarea, .selectable')) e.preventDefault();
});
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
  try { const [{ getProfile }, { registerCustomGear }] = await Promise.all([import('../services/storage/repository.js'), import('../data/exercises/gear.js')]); registerCustomGear((await getProfile()).customGear?.items ?? []); } catch { /* first run */ }
  const applyMode = async () => { try { const { getProfile } = await import('../services/storage/repository.js'); tabbar.setHidden((await getProfile()).mode === 'nutrition' ? ['train'] : []); } catch { /* first run */ } };
  await applyMode();
  import('../services/storage/repository.js').then((repo) => repo.onChange(({ store }) => { if (store === 'profile') applyMode(); }));
  await startRouter(view, tabbar, topbar);
  registerServiceWorker();
  startWorkoutActivity();
  startReminderClock();
  import('../services/widgets.js').then((m) => m.startWidgetSync()).catch(() => {});
  installTouchEffects();
  import('../screens/settings/personalization.js').then(async (m) => m.applyAppearance(m.appearancePrefs(await (await import('../services/storage/repository.js')).getSettings()))).catch(() => {});
  window.__herculesBooted = true;
  announceUpdate();
}

boot().catch((e) => { window.__herculesBootError?.(e); });
