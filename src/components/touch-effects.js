/**
 * Platform touch feedback.
 *  iOS / desktop: pressed controls swell slightly with a lit glass rim (CSS transform
 *                 only — no filters, so it costs nothing to draw).
 *  Android:       Material 3 ripple from the touch point.
 */
const android = () => document.documentElement.dataset.platform === 'android';

function ripple(el, e) {
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2.2;
  const s = document.createElement('span');
  s.className = 'm3-ripple';
  Object.assign(s.style, { width: `${size}px`, height: `${size}px`, left: `${e.clientX - r.left - size / 2}px`, top: `${e.clientY - r.top - size / 2}px` });
  el.append(s);
  setTimeout(() => s.remove(), 560);
}

/* ---------------- Liquid Glass press (iOS 26 behaviour) ----------------
 * Press a control: it swells slightly and its glass rim lights up; release springs back.
 * Transform + box-shadow only, so it never costs a repaint of the page. Rows only highlight. */
const LENS = '.btn, .chip, .icon-btn, .tabbar__item, .segmented__item, .add-btn, .composer__send, .composer__mic, .gear-tile, .meal-tile__main, .nav-tile, .choice, .day-picker__d, .week-day, .ql__mic, .set-check, .stepper button, .meal-time, .banner__action';
const ROW = 'button.list-row, a.list-row, .card--tap, .livebar, .scale5 button, .accordion__head';

function pressLens(el) {
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  const grow = r.width < 70 ? 1.16 : r.width < 180 ? 1.08 : 1.04; // small controls swell more, like iOS
  el.style.setProperty('--lg-grow', String(grow));
  el.classList.remove('lg-release');
  el.classList.add('lg-press');
  return el;
}
function releaseLens(el) {
  if (!el) return;
  el.classList.remove('lg-press');
  el.classList.add('lg-release');
  setTimeout(() => el.classList.remove('lg-release'), 560);
}

export function installTouchEffects() {
  let lens = null, row = null;
  const release = () => { releaseLens(lens); lens = null; row?.classList.remove('is-pressed'); row = null; };
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest(`${LENS}, ${ROW}`);
    if (!el || el.disabled) return;
    if (android()) { ripple(el, e); return; }
    release();
    if (el.matches(ROW) || document.documentElement.dataset.glass === 'off') { row = el; el.classList.add('is-pressed'); return; }
    lens = pressLens(el);
  }, { passive: true });
  document.addEventListener('pointerup', release, { passive: true });
  document.addEventListener('pointercancel', release, { passive: true });
  document.addEventListener('scroll', release, { passive: true, capture: true });
}

