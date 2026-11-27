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
 * Swipe between the main tabs, the iOS page-view way: the neighbouring page is already
 * rendered (router pager) and slides in beside the current one, glued to your finger.
 * Let go past ~30% (or flick) and it springs the rest of the way; otherwise it snaps back.
 */
export function installTabSwipe(view, pager) {
  const W = () => window.innerWidth;
  const BLOCK = '.chips--scroll, .week-strip, canvas, input, textarea, select, .segmented, .stepper, .composer, .ql, .day-picker, [data-no-swipe]';
  const EASE = 'cubic-bezier(.22,.9,.28,1)';
  let s = null; // gesture state

  const move = (el, x, ms = 0) => {
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms ${EASE}` : 'none';
    el.style.transform = x == null ? '' : `translate3d(${x}px,0,0)`;
  };

  view.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (s?.settling || e.touches.length > 1 || view.querySelector('.nav-back') || document.querySelector('.sheet') || document.body.classList.contains('focus-flow')) return;
    if (t.clientX < 24 || t.clientX > W() - 12 || e.target.closest(BLOCK)) return;
    const { prev, next } = pager.neighbours();
    s = { x0: t.clientX, y0: t.clientY, t0: performance.now(), dx: 0, decided: false, prevPath: prev, nextPath: next, prev: null, next: null, lastX: t.clientX, lastT: performance.now(), v: 0 };
    // make sure both neighbours exist (usually already warm; the 3D page mounts here on demand)
    if (prev) s.prev = pager.prepare(prev);
    if (next) s.next = pager.prepare(next);
  }, { passive: true });

  view.addEventListener('touchmove', (e) => {
    if (!s || s.settling) return;
    const t = e.touches[0];
    const mx = t.clientX - s.x0, my = t.clientY - s.y0;
    if (!s.decided) {
      if (Math.abs(my) > 8 && Math.abs(my) > Math.abs(mx)) { s = null; return; }
      if (Math.abs(mx) < 10) return;
      s.decided = true;
      for (const p of [s.prev, s.next]) if (p) { p.host.classList.add('is-peeking'); }
    }
    e.preventDefault();
    const now = performance.now();
    s.v = (t.clientX - s.lastX) / Math.max(1, now - s.lastT); s.lastX = t.clientX; s.lastT = now;
    const target = mx < 0 ? s.next : s.prev;
    s.dx = target ? mx : mx * 0.22; // rubber-band at the first/last tab
    move(view, s.dx);
    move(s.next?.host, W() + s.dx);
    move(s.prev?.host, -W() + s.dx);
  }, { passive: false });

  const end = () => {
    if (!s) return;
    const g = s;
    if (!g.decided) { s = null; return; }
    g.settling = true;
    const target = g.dx < 0 ? g.next : g.prev;
    const go = !!target && (Math.abs(g.dx) > W() * 0.3 || (Math.abs(g.v) > 0.35 && Math.sign(g.v) === Math.sign(g.dx)));
    const remaining = go ? W() - Math.abs(g.dx) : Math.abs(g.dx);
    const ms = Math.round(Math.max(170, Math.min(300, remaining / Math.max(0.9, Math.abs(g.v)) )));
    if (go) {
      const dir = g.dx < 0 ? -1 : 1;
      move(view, dir * W(), ms);
      move(target.host, 0, ms);
      setTimeout(async () => {
        haptic();
        await target.ready;
        move(view, null); move(target.host, null);
        for (const p of [g.prev, g.next]) p?.host.classList.remove('is-peeking');
        pager.adopt(target);
        s = null;
      }, ms);
    } else {
      move(view, 0, ms); move(g.next?.host, W(), ms); move(g.prev?.host, -W(), ms);
      setTimeout(() => {
        for (const p of [g.prev, g.next]) { p?.host.classList.remove('is-peeking'); move(p?.host, null); }
        move(view, null); s = null;
      }, ms);
    }
  };
  view.addEventListener('touchend', end);
  view.addEventListener('touchcancel', end);
}
