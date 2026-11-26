/**
 * Platform touch feedback.
 *  iOS / desktop: Liquid Glass — a glass lens grows over the pressed control,
 *                 tracks the finger with a specular highlight, then dissolves.
 *                 With a mouse, a softer lens appears on hover.
 *  Android:       Material 3 ripple from the touch point.
 */
const PRESSABLE = '.btn, .chip, .icon-btn, button.list-row, .card--tap, .tabbar__item, .segmented__item, .nav-tile, .choice, .composer__send, .island__action, .set-check, .add-btn, .stepper button, .scale5 button, .accordion__head';
const android = () => document.documentElement.dataset.platform === 'android';

function lensFor(el) {
  const r = el.getBoundingClientRect();
  const pad = Math.min(10, Math.max(4, r.height * 0.14));
  const b = document.createElement('div');
  b.className = 'lg-bubble';
  const cs = getComputedStyle(el);
  const radius = parseFloat(cs.borderTopLeftRadius) || 12;
  Object.assign(b.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`, borderRadius: `${Math.min(999, radius + pad)}px` });
  document.body.append(b);
  return b;
}
function track(b, el, e) {
  const r = el.getBoundingClientRect();
  b.style.setProperty('--x', `${((e.clientX - r.left) / r.width) * 100}%`);
  b.style.setProperty('--y', `${((e.clientY - r.top) / r.height) * 100}%`);
}
function release(b) {
  if (!b) return;
  b.classList.remove('is-on', 'is-hover');
  b.classList.add('is-off');
  setTimeout(() => b.remove(), 420);
}

function ripple(el, e) {
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2.2;
  const s = document.createElement('span');
  s.className = 'm3-ripple';
  Object.assign(s.style, { width: `${size}px`, height: `${size}px`, left: `${e.clientX - r.left - size / 2}px`, top: `${e.clientY - r.top - size / 2}px` });
  el.append(s);
  setTimeout(() => s.remove(), 560);
}

export function installTouchEffects() {
  let active = null; // { el, lens }
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest(PRESSABLE);
    if (!el || el.disabled) return;
    if (android()) { ripple(el, e); return; }
    release(active?.lens);
    const lens = lensFor(el);
    track(lens, el, e);
    requestAnimationFrame(() => lens.classList.add('is-on'));
    active = { el, lens, id: e.pointerId };
  }, { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (active && e.pointerId === active.id) track(active.lens, active.el, e);
  }, { passive: true });
  const end = (e) => { if (active && (!e.pointerId || e.pointerId === active.id)) { release(active.lens); active = null; } };
  document.addEventListener('pointerup', end, { passive: true });
  document.addEventListener('pointercancel', end, { passive: true });
  document.addEventListener('scroll', () => { if (active) { release(active.lens); active = null; } }, { passive: true, capture: true });

  // Hover lens for mouse/trackpad users.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let hover = null;
    document.addEventListener('pointerover', (e) => {
      if (android() || e.pointerType !== 'mouse') return;
      const el = e.target.closest(PRESSABLE);
      if (!el || el === hover?.el || el.disabled) return;
      release(hover?.lens);
      const lens = lensFor(el);
      track(lens, el, e);
      requestAnimationFrame(() => lens.classList.add('is-hover'));
      hover = { el, lens };
    });
    document.addEventListener('pointermove', (e) => { if (hover && e.pointerType === 'mouse') track(hover.lens, hover.el, e); }, { passive: true });
    document.addEventListener('pointerout', (e) => {
      if (!hover || e.pointerType !== 'mouse') return;
      if (hover.el.contains(e.relatedTarget)) return;
      release(hover.lens); hover = null;
    });
  }
}
