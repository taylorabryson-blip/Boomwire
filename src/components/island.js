/**
 * System-style surfaces (replaces the old Dynamic Island imitation).
 *
 *  island.flash({...})  → iOS notification banner: slides down from the top,
 *                         swipe up to dismiss, tap to act. Queued, one at a time.
 *  island.live({...})   → "Now playing"-style mini bar above the tab bar for
 *                         ongoing activities (workout timer, rest timer). Tap opens.
 *  island.clear(id)     → end the live activity.
 *
 * The export keeps the name `island` so call sites don't change.
 */
import { h } from './dom.js';
import { icon } from './icons.js';
import { haptic } from './haptics.js';
import { herculesMark } from './brand.js';

/* ---------- Banner ---------- */
let bannerEl = null, showing = false, hideTimer = null;
const queue = [];

function bannerNode(a) {
  const node = h('div', { class: 'banner', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'banner__app' }, a.icon ? icon(a.icon, 20) : herculesMark(22)),
    h('div', { class: 'banner__body' },
      h('div', { class: 'banner__top' }, h('span', { class: 'banner__title' }, a.title), h('span', { class: 'banner__time' }, 'now')),
      a.subtitle && h('div', { class: 'banner__sub' }, a.subtitle)),
    a.actionLabel && h('button', { class: 'banner__action', type: 'button', onClick: (e) => { e.stopPropagation(); a.onAction?.(); haptic(); dismiss(); } }, a.actionLabel));
  node.style.setProperty('--banner-accent', a.accent ?? '#fff');

  // Swipe up to dismiss, tap to act — same as iOS banners.
  let y0 = null, dy = 0;
  node.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; node.style.transition = 'none'; node.setPointerCapture?.(e.pointerId); });
  node.addEventListener('pointermove', (e) => {
    if (y0 == null) return;
    dy = e.clientY - y0;
    node.style.transform = `translateY(${dy < 0 ? dy : Math.sqrt(dy) * 3}px)`;
  });
  const end = () => {
    if (y0 == null) return;
    y0 = null; node.style.transition = ''; node.style.transform = '';
    if (dy < -24) dismiss();
    else if (Math.abs(dy) < 6 && a.onAction && !a.actionLabel) { a.onAction(); dismiss(); }
  };
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', end);
  return node;
}

function next() {
  if (showing || !queue.length) return;
  const a = queue.shift();
  showing = true;
  bannerEl = bannerNode(a);
  document.body.append(bannerEl);
  requestAnimationFrame(() => requestAnimationFrame(() => bannerEl?.classList.add('is-in')));
  hideTimer = setTimeout(dismiss, a.duration ?? 3600);
}

function dismiss() {
  clearTimeout(hideTimer);
  const el = bannerEl; bannerEl = null;
  if (!el) return;
  el.classList.remove('is-in');
  el.addEventListener('transitionend', () => { el.remove(); showing = false; next(); }, { once: true });
  setTimeout(() => { if (el.isConnected) { el.remove(); showing = false; next(); } }, 600);
}

/* ---------- Live mini bar ---------- */
let liveEl = null, liveActivity = null;

function renderLive(a) {
  if (!liveEl) {
    liveEl = h('button', { class: 'livebar', type: 'button', 'aria-label': 'Open activity', onClick: () => { haptic(); liveActivity?.onTap?.(); } });
    document.body.append(liveEl);
    requestAnimationFrame(() => requestAnimationFrame(() => liveEl?.classList.add('is-in')));
  }
  liveEl.style.setProperty('--live-accent', a.accent ?? '#fff');
  liveEl.replaceChildren(
    h('span', { class: 'livebar__icon' }, icon(a.icon ?? 'training', 18)),
    h('span', { class: 'livebar__text' }, h('span', { class: 'livebar__title' }, a.title ?? a.compactText ?? ''), a.subtitle && h('span', { class: 'livebar__sub' }, a.subtitle)),
    a.trail != null && h('span', { class: 'livebar__trail num' }, typeof a.trail === 'function' ? a.trail() : a.trail),
    a.progress != null && h('span', { class: 'livebar__progress' }, h('i', { style: { transform: `scaleX(${Math.max(0, Math.min(1, a.progress))})` } })));
  document.body.classList.add('has-live');
}

export const island = {
  flash(a) { queue.push(a); next(); },
  live(a) { liveActivity = a; renderLive(a); },
  clear(id) {
    if (!liveActivity || (id && liveActivity.id !== id)) return;
    liveActivity = null;
    document.body.classList.remove('has-live');
    const el = liveEl; liveEl = null;
    if (el) { el.classList.remove('is-in'); setTimeout(() => el.remove(), 400); }
  },
  get current() { return liveActivity; },
};
