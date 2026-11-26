/**
 * Hash router (#/home). Hash routing works on GitHub Pages and from a
 * home-screen PWA without server rewrites.
 *
 * Screen contract: module exports `mount(root) => Promise<cleanup?>`.
 */
import { h } from '../components/dom.js';
import { ROUTES } from './routes.js';

export function startRouter(view, tabbar) {
  let cleanup = null;
  let token = 0;

  async function render() {
    const name = location.hash.replace(/^#\/?/, '').split(/[?/]/)[0] || 'home';
    const route = ROUTES[name] ?? ROUTES.home;
    const my = ++token;
    tabbar.setActive(route.tab);
    const mod = await route.load();
    if (my !== token) return; // a newer navigation won
    cleanup?.();
    const root = h('div', { class: 'screen' });
    view.replaceChildren(root);
    window.scrollTo(0, 0);
    cleanup = (await mod.mount(root)) ?? null;
  }

  window.addEventListener('hashchange', render);
  return render();
}
