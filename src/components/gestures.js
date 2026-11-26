/**
 * iOS edge-swipe back. Home Screen web apps don't get the system gesture,
 * so we rebuild it: drag from the left edge on any pushed screen; the page
 * follows your finger with a parallax shadow; let go past ~35% (or flick)
 * to go back, otherwise it springs home.
 */
import { haptic } from './haptics.js';

export function installEdgeSwipe(view) {
  if (document.documentElement.dataset.platform === 'android') return; // Android has its own system back
  let x0 = 0, y0 = 0, t0 = 0, dx = 0, active = false, decided = false, back = null;
  const W = () => window.innerWidth;

  view.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    back = view.querySelector('.nav-back');
    if (!back || t.clientX > 22 || document.querySelector('.sheet')) return;
    x0 = t.clientX; y0 = t.clientY; t0 = performance.now(); dx = 0; active = true; decided = false;
  }, { passive: true });

  view.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = e.touches[0];
    const mx = t.clientX - x0, my = t.clientY - y0;
    if (!decided) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { active = false; return; }
      if (mx < 8) return;
      decided = true; view.classList.add('is-swiping');
    }
    e.preventDefault();
    dx = Math.max(0, mx);
    view.style.transform = `translateX(${dx}px)`;
    view.style.setProperty('--swipe', String(dx / W()));
  }, { passive: false });

  const end = () => {
    if (!active) return;
    active = false;
    if (!decided) return;
    const v = dx / Math.max(1, performance.now() - t0);
    const go = dx > W() * 0.35 || v > 0.6;
    view.classList.remove('is-swiping');
    view.classList.add('is-settling');
    view.style.transform = go ? `translateX(${W()}px)` : '';
    setTimeout(() => {
      view.classList.remove('is-settling');
      if (go) { haptic(); window.__herculesSkipNavAnim = true; back.click(); requestAnimationFrame(() => { view.style.transform = ''; }); }
      view.style.removeProperty('--swipe');
    }, 280);
  };
  view.addEventListener('touchend', end);
  view.addEventListener('touchcancel', end);
}

/**
 * Swipe between the main tabs (Home ⇄ Train ⇄ Cratos ⇄ Nutrition ⇄ Progress).
 * Works on top-level screens only; ignores gestures that start on things that
 * scroll or drag sideways themselves (chip rows, sliders, the 3D body, sheets).
 */
export function installTabSwipe(view) {
  let x0 = 0, y0 = 0, t0 = 0, dx = 0, active = false, decided = false;
  const W = () => window.innerWidth;
  const BLOCK = '.chips--scroll, .week-strip, canvas, input, textarea, select, .segmented, .stepper, .composer, .ql, .tiles--scroll, [data-no-swipe]';
  const items = () => [...document.querySelectorAll('.tabbar__item')].filter((b) => !b.hidden);
  const current = () => items().findIndex((b) => b.getAttribute('aria-current') === 'page');

  view.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (e.touches.length > 1 || view.querySelector('.nav-back') || document.querySelector('.sheet') || document.body.classList.contains('focus-flow')) return;
    if (t.clientX < 24 || t.clientX > W() - 12 || e.target.closest(BLOCK)) return;
    x0 = t.clientX; y0 = t.clientY; t0 = performance.now(); dx = 0; active = true; decided = false;
  }, { passive: true });

  view.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = e.touches[0];
    const mx = t.clientX - x0, my = t.clientY - y0;
    if (!decided) {
      if (Math.abs(my) > 8 && Math.abs(my) > Math.abs(mx) * 0.8) { active = false; return; }
      if (Math.abs(mx) < 12) return;
      decided = true; view.classList.add('is-tab-swiping');
    }
    e.preventDefault();
    const i = current(), n = items().length;
    const blocked = (mx < 0 && i >= n - 1) || (mx > 0 && i <= 0);
    dx = blocked ? mx * 0.25 : mx; // rubber-band at the ends
    view.style.transform = `translateX(${dx}px)`;
    view.style.opacity = String(1 - Math.min(0.35, Math.abs(dx) / W() * 0.6));
  }, { passive: false });

  const end = () => {
    if (!active) return;
    active = false;
    if (!decided) return;
    const i = current(), list = items();
    const v = Math.abs(dx) / Math.max(1, performance.now() - t0);
    const target = dx < 0 ? i + 1 : i - 1;
    const go = (Math.abs(dx) > W() * 0.25 || v > 0.5) && target >= 0 && target < list.length;
    view.classList.remove('is-tab-swiping');
    view.classList.add('is-tab-settling');
    view.style.transform = go ? `translateX(${dx < 0 ? -W() * 0.5 : W() * 0.5}px)` : '';
    view.style.opacity = go ? '0' : '';
    setTimeout(() => {
      view.classList.remove('is-tab-settling');
      view.style.transform = ''; view.style.opacity = '';
      if (go) { haptic(); window.__herculesTabSwipe = dx < 0 ? 'next' : 'prev'; list[target].click(); }
    }, go ? 200 : 260);
  };
  view.addEventListener('touchend', end);
  view.addEventListener('touchcancel', end);
}
