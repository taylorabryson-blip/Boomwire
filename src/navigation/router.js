/**
 * Hash router with iOS-style transitions.
 *  - push/pop slides between depths, cross-fade between tabs (View Transitions API when available)
 *  - collapsing large title → compact glass top bar
 * Screen contract: `mount(root, { params }) => Promise<cleanup?>`.
 */
import { installEdgeSwipe, installTabSwipe } from '../components/gestures.js';
import { h } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { ROUTES, ALIASES } from './routes.js';
import { parseHash, goBack } from './nav.js';

export function startRouter(view, tabbar, topbar) {
  installEdgeSwipe(view);
  let cleanup = null, token = 0, lastDepth = null, io = null;

  async function swap(route, params, my) {
    const mod = await route.load();
    if (my !== token) return;
    cleanup?.();
    const root = h('div', { class: 'screen' });
    view.replaceChildren(root);
    window.scrollTo(0, 0);
    cleanup = (await mod[route.fn ?? 'mount'](root, { params })) ?? null;
    wireTopbar(root);
  }

  function wireTopbar(root) {
    io?.disconnect();
    const header = root.querySelector('[data-nav-title]');
    topbar.set(header?.dataset.navTitle ?? '', header?.dataset.navBack ?? null);
    const title = header?.querySelector('.nav-header__title');
    if (!title) { topbar.show(false); return; }
    io = new IntersectionObserver(([e]) => topbar.show(!e.isIntersecting && window.scrollY > 4), { rootMargin: `-${44 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0)}px 0px 0px 0px` });
    io.observe(title);
  }

  /* ---------- Pager: neighbouring tabs live, pre-rendered off-screen ----------
   * Lets a swipe show the next page under your finger (like UIPageViewController) and
   * makes tab taps instant. A peer is a fully mounted screen in a hidden fixed host;
   * adopting it just moves its root into #view — no re-render, state kept. */
  const peers = new Map(); // '#/name' → { host, root, route, cleanup, ready, path }
  let current = null;      // { path, route } of the mounted top-level screen
  let adoptedHash = null;
  const tabPaths = () => [...document.querySelectorAll('.tabbar__item')].filter((b) => !b.hidden).map((b) => b.getAttribute('href') ?? `#/${b.dataset.tab}`);

  function prepare(path) {
    if (peers.has(path)) return peers.get(path);
    const route = ROUTES[path.replace(/^#\//, '')];
    if (!route || route.depth !== 0) return null;
    const host = h('div', { class: 'view view--peer', 'aria-hidden': 'true' });
    const root = h('div', { class: 'screen' });
    host.append(root);
    document.body.append(host);
    const peer = { host, root, route, path, cleanup: null };
    peer.ready = route.load().then((mod) => mod[route.fn ?? 'mount'](root, { params: new URLSearchParams() })).then((c) => { peer.cleanup = c ?? null; }).catch(() => {});
    peers.set(path, peer);
    return peer;
  }
  function park(path, root, route, cl) { // turn the outgoing screen into a peer so swiping back is instant
    const host = h('div', { class: 'view view--peer', 'aria-hidden': 'true' });
    host.append(root); document.body.append(host);
    peers.set(path, { host, root, route, path, cleanup: cl, ready: Promise.resolve() });
  }
  function drop(path) { const p = peers.get(path); if (!p) return; p.cleanup?.(); p.host.remove(); peers.delete(path); }
  function neighbours(path) { const list = tabPaths(); const i = list.indexOf(path); return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null }; }
  let warmT = 0;
  function warmNeighbours() {
    clearTimeout(warmT);
    warmT = setTimeout(() => {
      if (!current || current.route.depth !== 0) { [...peers.keys()].forEach(drop); return; }
      const { prev, next } = neighbours(current.path);
      for (const k of [...peers.keys()]) if (k !== prev && k !== next) drop(k);
      for (const k of [prev, next]) if (k && k !== '#/progress') prepare(k); // 3D body is mounted on demand only
    }, 350);
  }
  /** Make a prepared peer the live screen. */
  function adopt(peer) {
    token++;
    const old = view.firstElementChild;
    if (current?.route.depth === 0 && old && current.path !== peer.path) park(current.path, old, current.route, cleanup);
    else cleanup?.();
    peers.delete(peer.path);
    view.replaceChildren(peer.root);
    peer.host.remove();
    cleanup = peer.cleanup;
    lastDepth = 0;
    tabbar.setActive(peer.route.tab);
    current = { path: peer.path, route: peer.route };
    window.scrollTo(0, 0);
    wireTopbar(peer.root);
    if (location.hash !== peer.path) { adoptedHash = peer.path; location.hash = peer.path; }
    warmNeighbours();
  }
  const pager = { prepare, adopt, neighbours: () => (current ? neighbours(current.path) : {}), get current() { return current; } };
  installTabSwipe(view, pager);

  async function render() {
    if (adoptedHash && location.hash === adoptedHash) { adoptedHash = null; return; }
    // Tab tap onto a pre-rendered page: instant
    const peer = peers.get(location.hash);
    if (peer && lastDepth === 0) {
      await peer.ready;
      adopt(peer);
      view.firstElementChild?.classList.add('screen-in');
      return;
    }
    let { name, params } = parseHash();
    name = ALIASES[name] ?? name;
    const route = ROUTES[name] ?? ROUTES.home;
    const my = ++token;
    tabbar.setActive(route.tab);
    const swipeDir = window.__herculesTabSwipe; window.__herculesTabSwipe = null;
    const dir = swipeDir ? 'tab' : lastDepth == null ? 'none' : route.depth > lastDepth ? 'push' : route.depth < lastDepth ? 'pop' : 'fade';
    lastDepth = route.depth;
    document.documentElement.dataset.nav = dir;
    const skip = window.__herculesSkipNavAnim; window.__herculesSkipNavAnim = false;
    if (!skip && document.startViewTransition && dir !== 'none' && dir !== 'tab' && !matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.motion !== 'reduce') {
      // Keep the floating bars still while pages move. The names are applied only for the
      // duration of the transition: a permanent view-transition-name would make the glass
      // a backdrop root and stop it from seeing the page behind it.
      tabbar.el.style.viewTransitionName = 'tabbar'; topbar.el.style.viewTransitionName = 'topbar';
      document.documentElement.classList.add('vt-running');
      await route.load(); // module ready before the snapshot, so the animation starts immediately
      const vt = document.startViewTransition(() => swap(route, params, my));
      await vt.updateCallbackDone.catch(() => {});
      vt.ready.catch(() => {});
      vt.finished.catch(() => {}).finally(() => { tabbar.el.style.viewTransitionName = ''; topbar.el.style.viewTransitionName = ''; document.documentElement.classList.remove('vt-running'); });
    } else {
      await swap(route, params, my);
      view.firstElementChild?.classList.add(dir === 'tab' ? (swipeDir === 'next' ? 'screen-in-right' : 'screen-in-left') : 'screen-in');
    }
    if (my === token) { current = { path: `#/${name}`, route }; warmNeighbours(); }
  }

  window.addEventListener('hashchange', () => { sessionStorage.setItem('hercules:navigated', '1'); render(); });
  // Warm every screen's code once the first one is up, so navigation never waits on the network.
  const warm = () => Object.values(ROUTES).forEach((r) => r.load().catch(() => {}));
  (window.requestIdleCallback ?? ((f) => setTimeout(f, 1200)))(warm);
  return render();
}

export function createTopbar() {
  const title = h('div', { class: 'topbar__title' });
  const backSlot = h('div', {});
  const el = h('div', { class: 'topbar', 'aria-hidden': 'true' }, backSlot, title, h('div', {}));
  return {
    el,
    set(text, back) {
      title.textContent = text;
      backSlot.replaceChildren(back ? h('button', { class: 'topbar__back', type: 'button', onClick: () => goBack(back) }, icon('chevronLeft', 22)) : '');
    },
    show(v) { el.classList.toggle('is-visible', v); el.setAttribute('aria-hidden', String(!v)); },
  };
}
