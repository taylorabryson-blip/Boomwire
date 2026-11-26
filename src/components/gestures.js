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
