/**
 * Dynamic Island–style live surface. A black pill that grows out of the top
 * of the screen (and out of the hardware island on iPhones that have one).
 *
 *  island.flash({...})  → expand briefly (confirmations, undo)
 *  island.live({...})   → persistent compact activity (workout timer, rest timer); tap to expand
 *  island.clear(id)     → end a live activity
 */
import { h } from './dom.js';
import { icon } from './icons.js';
import { haptic } from './haptics.js';

let el = null, content = null, liveActivity = null, flashTimer = null, expandTimer = null;

function mount() {
  if (el) return;
  content = h('div', { class: 'island__content' });
  el = h('div', { class: 'island', role: 'status', 'aria-live': 'polite' }, content);
  el.style.viewTransitionName = 'island';
  el.addEventListener('click', (e) => {
    if (e.target.closest('.island__action')) return;
    if (liveActivity && !el.classList.contains('is-expanded')) { render(liveActivity, true); setState('expanded'); scheduleCollapse(4000); haptic(); }
    else if (liveActivity?.onTap) liveActivity.onTap();
  });
  document.body.append(el);
}

function setState(state) {
  el.classList.toggle('is-compact', state === 'compact');
  el.classList.toggle('is-expanded', state === 'expanded');
}

function render(a, expanded) {
  const lead = a.lead ?? (a.icon ? icon(a.icon, expanded ? 22 : 16) : null);
  content.replaceChildren(...[
    lead && h('div', { class: 'island__lead', style: a.leadColor ? { color: a.leadColor } : null }, lead),
    h('div', { class: 'island__text' },
      expanded ? [h('div', { class: 'island__title' }, a.title), a.subtitle && h('div', { class: 'island__sub' }, a.subtitle)] : (a.compactText ?? '')),
    a.trail != null && h('div', { class: 'island__trail' }, typeof a.trail === 'function' ? a.trail() : a.trail),
    expanded && a.actionLabel && h('button', { class: 'island__action', onClick: () => { a.onAction?.(); haptic(); returnToLive(); } }, a.actionLabel),
    expanded && a.progress != null && h('div', { class: 'island__progress' }, h('i', { style: { transform: `scaleX(${Math.max(0, Math.min(1, a.progress))})` } })),
  ].filter(Boolean));
  el.style.setProperty('--island-accent', a.accent ?? '#fff');
}

function scheduleCollapse(ms) {
  clearTimeout(expandTimer);
  expandTimer = setTimeout(returnToLive, ms);
}

function returnToLive() {
  clearTimeout(flashTimer); clearTimeout(expandTimer);
  if (liveActivity) { render(liveActivity, false); setState('compact'); }
  else setState('none');
}

export const island = {
  /** Brief expanded confirmation. */
  flash(a) {
    mount();
    render(a, true);
    setState('expanded');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(returnToLive, a.duration ?? 3200);
  },
  /** Start/update a persistent activity. `a.id` identifies it. */
  live(a) {
    mount();
    const isNew = liveActivity?.id !== a.id;
    liveActivity = a;
    if (el.classList.contains('is-expanded') && !isNew) render(a, true);
    else if (!flashTimer || isNew) { render(a, false); if (!el.classList.contains('is-expanded')) setState('compact'); }
  },
  clear(id) {
    if (!liveActivity || (id && liveActivity.id !== id)) return;
    liveActivity = null;
    if (!el.classList.contains('is-expanded')) setState('none');
  },
  get current() { return liveActivity; },
};
