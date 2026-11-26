/**
 * Hash router with iOS-style transitions.
 *  - push/pop slides between depths, cross-fade between tabs (View Transitions API when available)
 *  - collapsing large title → compact glass top bar
 * Screen contract: `mount(root, { params }) => Promise<cleanup?>`.
 */
import { h } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { ROUTES, ALIASES } from './routes.js';
import { parseHash, goBack } from './nav.js';

export function startRouter(view, tabbar, topbar) {
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

  async function render() {
    let { name, params } = parseHash();
    name = ALIASES[name] ?? name;
    const route = ROUTES[name] ?? ROUTES.home;
    const my = ++token;
    tabbar.setActive(route.tab);
    const dir = lastDepth == null ? 'none' : route.depth > lastDepth ? 'push' : route.depth < lastDepth ? 'pop' : 'fade';
    lastDepth = route.depth;
    document.documentElement.dataset.nav = dir;
    if (document.startViewTransition && dir !== 'none' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const vt = document.startViewTransition(() => swap(route, params, my));
      await vt.updateCallbackDone.catch(() => {});
    } else {
      await swap(route, params, my);
      view.firstElementChild?.classList.add('screen-in');
    }
  }

  window.addEventListener('hashchange', () => { sessionStorage.setItem('hercules:navigated', '1'); render(); });
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
