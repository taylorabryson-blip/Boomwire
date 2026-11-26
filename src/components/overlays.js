/**
 * Sheets (iOS card presentation, drag-to-dismiss) and transient feedback.
 * `toast()` is kept as the public API; it now renders in the Dynamic Island.
 */
import { h } from './dom.js';
import { icon } from './icons.js';
import { island } from './island.js';
import { haptic } from './haptics.js';
import { Button } from './primitives.js';

let openCount = 0;

export function openSheet({ title, content, onClose }) {
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const head = h('div', { class: 'sheet__head' },
    h('div', { class: 'sheet__title' }, title),
    h('button', { class: 'icon-btn', 'aria-label': 'Close', onClick: () => close() }, icon('close', 18)));
  const grabber = h('div', { class: 'sheet__grabber' });
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, grabber, head, content);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  let closed = false;

  function close() {
    if (closed) return; closed = true;
    backdrop.classList.remove('is-open'); panel.classList.remove('is-open');
    panel.style.removeProperty('--drag');
    document.removeEventListener('keydown', onKey);
    if (--openCount === 0) document.body.classList.remove('sheet-open');
    setTimeout(() => { backdrop.remove(); panel.remove(); onClose?.(); }, 480);
  }

  // Drag to dismiss from the grabber/header.
  let startY = null, lastY = 0, lastT = 0, v = 0;
  const down = (e) => { startY = e.clientY; lastY = e.clientY; lastT = e.timeStamp; panel.classList.add('is-dragging'); e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    if (startY == null) return;
    const dy = Math.max(0, e.clientY - startY);
    v = (e.clientY - lastY) / Math.max(1, e.timeStamp - lastT); lastY = e.clientY; lastT = e.timeStamp;
    panel.style.setProperty('--drag', `${dy}px`);
  };
  const up = (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY; startY = null;
    panel.classList.remove('is-dragging');
    if (dy > 120 || v > 0.6) close(); else panel.style.setProperty('--drag', '0px');
  };
  for (const t of [grabber, head]) {
    t.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) down(e); });
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
  }

  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop, panel);
  openCount++;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    backdrop.classList.add('is-open'); panel.classList.add('is-open'); document.body.classList.add('sheet-open');
  }));
  return { close, panel };
}

/** Confirmation sheet for destructive actions. Resolves true/false. */
export function confirmSheet({ title, message, confirmLabel = 'Delete', destructive = true }) {
  return new Promise((resolve) => {
    let answered = false;
    const sheet = openSheet({
      title,
      onClose: () => { if (!answered) resolve(false); },
      content: h('div', { class: 'stack' },
        message && h('p', { class: 't-subhead c-2', style: { margin: 0 } }, message),
        Button({ label: confirmLabel, variant: destructive ? 'danger' : 'primary', block: true, onClick: () => { answered = true; haptic('heavy'); resolve(true); sheet.close(); } }),
        Button({ label: 'Cancel', block: true, onClick: () => sheet.close() })),
    });
  });
}

/** Transient message (shown in the Dynamic Island). */
export function toast(message, { actionLabel, onAction, duration = 3600, iconName = 'check', subtitle } = {}) {
  island.flash({ icon: iconName, title: message, subtitle, actionLabel, onAction, duration });
}
