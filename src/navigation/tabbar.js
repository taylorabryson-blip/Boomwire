import { h } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { kratosMark } from '../components/brand.js';
import { navigate } from './nav.js';
import { TABS } from './routes.js';

export function createTabBar() {
  const items = new Map();
  const indicator = h('div', { class: 'tabbar__indicator', style: { width: `calc((100% - 8px) / ${TABS.length})` } });
  const inner = h('div', { class: 'tabbar__inner' }, indicator);
  TABS.forEach((t, i) => {
    const glyph = t.icon === 'kratos' ? kratosMark(28) : icon(t.icon, 24);
    const b = h('button', { class: 'tabbar__item', type: 'button', 'aria-label': t.label, dataset: { index: String(i) },
      onClick: () => { if (b.getAttribute('aria-current') === 'page' && location.hash.split('?')[0] === `#/${t.id}`) window.scrollTo({ top: 0, behavior: 'smooth' }); else navigate(`#/${t.id}`); } },
    glyph, h('span', {}, t.label));
    items.set(t.id, b);
    inner.append(b);
  });
  const el = h('nav', { class: 'tabbar', 'aria-label': 'Primary' }, inner);
  return {
    el,
    setActive(id) {
      for (const [k, b] of items) {
        if (k === id) {
          b.setAttribute('aria-current', 'page');
          const next = `translateX(${Number(b.dataset.index) * 100}%)`;
          if (indicator.style.transform && indicator.style.transform !== next) {
            indicator.style.setProperty('--from', indicator.style.transform);
            indicator.classList.remove('is-moving'); void indicator.offsetWidth; indicator.classList.add('is-moving');
          }
          indicator.style.transform = next;
        }
        else b.removeAttribute('aria-current');
      }
    },
  };
}
