/** Application bootstrap. */
import { h } from '../components/dom.js';
import { openDB } from '../services/storage/db.js';
import { createTabBar } from '../navigation/tabbar.js';
import { startRouter } from '../navigation/router.js';
import { registerServiceWorker } from '../services/pwa/register-sw.js';

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
  app.replaceChildren(view, tabbar.el);
  await startRouter(view, tabbar);
  registerServiceWorker();
}

boot();
