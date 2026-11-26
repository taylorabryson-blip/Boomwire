import { h } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { TABS } from './routes.js';

export function createTabBar() {
  const items = new Map();
  const inner = h('div', { class: 'tabbar__inner' });
  for (const t of TABS) {
    const a = h('a', { class: 'tabbar__item', href: `#/${t.id}` }, icon(t.icon, 24), h('span', {}, t.label));
    items.set(t.id, a);
    inner.append(a);
  }
  const el = h('nav', { class: 'tabbar', 'aria-label': 'Primary' }, inner);
  return {
    el,
    setActive(id) { for (const [k, a] of items) k === id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); },
  };
}
