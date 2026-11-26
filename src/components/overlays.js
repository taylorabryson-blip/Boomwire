/** Bottom sheet + toast. */
import { h } from './dom.js';
import { icon } from './icons.js';

export function openSheet({ title, content, onClose }) {
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet__grabber' }),
    h('div', { class: 'sheet__head' },
      h('div', { class: 'sheet__title' }, title),
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onClick: () => close() }, icon('close', 18))),
    content);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    backdrop.classList.remove('is-open'); panel.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { backdrop.remove(); panel.remove(); onClose?.(); }, 420);
  }
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop, panel);
  requestAnimationFrame(() => requestAnimationFrame(() => { backdrop.classList.add('is-open'); panel.classList.add('is-open'); }));
  return { close, panel };
}

let current = null;
export function toast(message, { actionLabel, onAction, duration = 4000 } = {}) {
  current?.dismiss();
  const el = h('div', { class: 'toast', role: 'status' }, h('span', {}, message),
    actionLabel && h('button', { class: 'toast__action', onClick: () => { onAction?.(); dismiss(); } }, actionLabel));
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  const timer = setTimeout(dismiss, duration);
  function dismiss() { clearTimeout(timer); el.classList.remove('is-visible'); setTimeout(() => el.remove(), 300); if (current?.el === el) current = null; }
  current = { el, dismiss };
  return dismiss;
}
