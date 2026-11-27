/**
 * System-style surfaces.
 *
 *  island.flash({...})  → HUD for quick confirmations, capsule above the tab bar when
 *                         there's an action (Undo/View/Open). Queued, one at a time.
 *  island.live({...})   → "Now playing"-style mini bar above the tab bar for
 *                         ongoing activities (workout timer, rest timer). Tap opens.
 *  island.clear(id)     → end the live activity.
 *
 * The export keeps the name `island` so call sites don't change.
 */
import { h } from './dom.js';
import { icon } from './icons.js';
import { haptic } from './haptics.js';

/* ---------- Feedback: Apple's in-app patterns ----------
 *  • Quick confirmation (no action)  → HUD: small rounded square in the middle, symbol + a
 *    couple of words, springs in and fades (like "Copied" / silent-mode HUDs).
 *  • Has an action (Undo, View, Open) → capsule just above the tab bar with the action on the
 *    right (like Mail's Undo Send). Swipe down to dismiss.
 *  • Android keeps the Material snackbar.
 */
let current = null, hideTimer = null;
const queue = [];
const android = () => document.documentElement.dataset.platform === 'android';

function hudNode(a) {
  return h('div', { class: 'hud', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'hud__icon' }, icon(a.icon ?? 'check', 34)),
    h('div', { class: 'hud__title' }, a.title),
    a.subtitle && h('div', { class: 'hud__sub' }, a.subtitle));
}

function capsuleNode(a) {
  const node = h('div', { class: android() ? 'banner' : 'capsule', role: 'status', 'aria-live': 'polite' },
    android() ? null : h('span', { class: 'capsule__icon' }, icon(a.icon ?? 'check', 18)),
    h('div', { class: 'capsule__text' }, h('span', { class: 'capsule__title' }, a.title), a.subtitle && h('span', { class: 'capsule__sub' }, a.subtitle)),
    a.actionLabel && h('button', { class: 'capsule__action', type: 'button', onClick: (e) => { e.stopPropagation(); a.onAction?.(); haptic(); dismiss(); } }, a.actionLabel));
  let y0 = null, dy = 0;
  node.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; node.style.transition = 'none'; });
  node.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(-6, e.clientY - y0); node.style.transform = `translate(-50%, ${dy}px)`; });
  const end = () => { if (y0 == null) return; y0 = null; node.style.transition = ''; node.style.transform = ''; if (dy > 20) dismiss(); };
  node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
  return node;
}

function next() {
  if (current || !queue.length) return;
  const a = queue.shift();
  const isCapsule = !!a.actionLabel || android();
  const el = isCapsule ? capsuleNode(a) : hudNode(a);
  current = el;
  document.body.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
  const ms = a.duration ?? (isCapsule ? 4000 : (a.subtitle ? 1900 : 1300));
  hideTimer = setTimeout(dismiss, isCapsule ? ms : Math.min(ms, 2400));
}

function dismiss() {
  clearTimeout(hideTimer);
  const el = current;
  if (!el) return;
  el.classList.remove('is-in'); el.classList.add('is-out');
  const done = () => { if (current === el) current = null; el.remove(); next(); };
  el.addEventListener('transitionend', done, { once: true });
  setTimeout(() => { if (el.isConnected) done(); }, 450);
}

/* ---------- Live mini bar ---------- */
let liveEl = null, liveActivity = null;

function renderLive(a) {
  if (!liveEl) {
    liveEl = h('button', { class: 'livebar lg', type: 'button', 'aria-label': 'Open activity', onClick: () => { haptic(); liveActivity?.onTap?.(); } });
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
