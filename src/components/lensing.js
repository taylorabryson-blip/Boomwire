/**
 * Liquid Glass lensing — clear glass that bends light, no frosting.
 *
 * Safari can't run SVG filters on what's *behind* an element (backdrop-filter: url()
 * parses but renders nothing). It can run them on an element. So instead of filtering
 * the backdrop of each glass object, we filter the page itself (#view) with one
 * displacement map that is neutral everywhere except exactly under the glass:
 *
 *   • fixed glass (tab bar, live bar, banners, chat bar): a convex rim — content is
 *     bent along the rounded edges, strongest at the edge, flat in the middle;
 *   • a pressed control: a dome — it magnifies what's in it and bends hardest at the rim.
 *
 * Red, green and blue are displaced by different amounts (blue most, like real glass),
 * so curved edges split into RGB fringes — chromatic aberration.
 */
const NS = 'http://www.w3.org/2000/svg';
const MAX_SHIFT = 11;                  // px of bend at the strongest point (red channel)
const DISPERSION = [1, 1.14, 1.3];     // R, G, B: shorter wavelengths bend more
let view = null, svg = null, feImage = null, maps = [], enabled = true;
let pressed = null, pressedRect = null, raf = 0, animUntil = 0, lastKey = '';
const cache = new Map();

/** Per-pixel displacement for one rounded rect. profile 'rim' | 'dome'. Returns a canvas. */
function lensTile(w, h, radius, profile, ky) {
  const key = `${w}x${h}r${radius}${profile}${ky.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const r = Math.min(radius, w / 2, h / 2);
  const bezel = profile === 'dome' ? Math.min(w, h) / 2 : Math.max(10, Math.min(34, h * 0.5));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
      let d, nx, ny;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; d = l - r; nx = (qx / l) * Math.sign(px); ny = (qy / l) * Math.sign(py); }
      else if (qx > qy) { d = qx - r; nx = Math.sign(px); ny = 0; }
      else { d = qy - r; nx = 0; ny = Math.sign(py); }
      const i = (y * w + x) * 4;
      if (d > 0) { img.data[i] = 128; img.data[i + 1] = 128; img.data[i + 2] = 128; img.data[i + 3] = 255; continue; }
      const depth = -d;
      let m;
      if (profile === 'dome') {
        const t = Math.min(1, depth / bezel);       // 0 at rim → 1 at centre
        m = 0.75 * Math.pow(1 - t, 1.8);            // gentle magnification inside, hard bend at the rim
      } else {
        const t = depth < bezel ? 1 - depth / bezel : 0;
        m = Math.pow(t, 2.2);                       // convex rim: bends hardest right at the edge, flat centre
      }
      // sample *inward* (content pulled toward the rim): a convex lens magnifies
      img.data[i] = 128 - nx * m * 127;
      img.data[i + 1] = 128 - ny * m * 127 * ky;
      img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

function ensureFilter() {
  if (svg) return;
  svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  const M = { r: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', g: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', b: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0' };
  const chan = (n) => `<feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" result="d${n}"/>
    <feColorMatrix in="d${n}" type="matrix" values="${M[n]}" result="${n}"/>`;
  svg.innerHTML = `<filter id="hz-lens" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
    <feFlood flood-color="rgb(128,128,128)" result="neutral"/>
    <feImage x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="img"/>
    <feComposite in="img" in2="neutral" operator="over" result="raw"/>
    <feColorMatrix in="raw" type="matrix" values="1 0 0 0 -0.00196  0 1 0 0 -0.00196  0 0 1 0 0  0 0 0 1 0" result="map"/>
    ${chan('r')}${chan('g')}${chan('b')}
    <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg"/>
    <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1"/>
  </filter>`;
  document.body.append(svg);
  feImage = svg.querySelector('feImage');
  maps = [...svg.querySelectorAll('feDisplacementMap')];
}

const glassEls = () => [...document.querySelectorAll('.lg')].filter((e) => !view.contains(e));

function rebuild() {
  raf = 0;
  if (!view) return;
  const vr = view.getBoundingClientRect();
  const W = Math.round(vr.width), H = Math.round(Math.max(vr.height, 1));
  const useIt = enabled && !view.querySelector('canvas'); // WebGL under an SVG filter is too slow; the 3D body page gets plain clear glass
  const rects = [];
  if (useIt) {
    for (const el of glassEls()) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || getComputedStyle(el).opacity === '0') continue;
      rects.push({ r, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 16, profile: 'rim' });
    }
    if (pressed?.isConnected && pressedRect) rects.push(pressedRect);
  }
  if (!rects.length) { view.style.filter = ''; lastKey = ''; return; }
  ensureFilter();
  // Only redraw the map when the glass itself changes. Scrolling just moves it (below):
  // Safari decodes a new map image asynchronously, so swapping it every frame tears.
  const key = rects.map(({ r, radius, profile }) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)},${radius},${profile}`).join('|') + `@${W}x${H}`;
  if (key === lastKey && view.style.filter) { place(vr, W, H); return; }
  lastKey = key;
  // Map covers the viewport; it sits at the view's current scroll position inside the filter box.
  const vw = innerWidth, vh = innerHeight;
  const c = document.createElement('canvas'); c.width = vw; c.height = vh;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, vw, vh);
  const ky = W / H; // bbox units scale x by W and y by H; pre-scale y so the bend is equal in px
  for (const { r, radius, profile } of rects) {
    const w = Math.round(r.width), h = Math.round(r.height);
    ctx.drawImage(lensTile(w, h, Math.round(radius), profile, ky), Math.round(r.left), Math.round(r.top));
  }
  feImage.setAttribute('href', c.toDataURL());
  place(vr, W, H);
  maps.forEach((m, i) => m.setAttribute('scale', ((MAX_SHIFT * 2 * DISPERSION[i]) / W).toFixed(5)));
  view.style.filter = 'url(#hz-lens)';
}
function place(vr, W, H) {
  feImage.setAttribute('x', String(-vr.left / W));
  feImage.setAttribute('y', String(-vr.top / H));
  feImage.setAttribute('width', String(innerWidth / W));
  feImage.setAttribute('height', String(innerHeight / H));
}

const schedule = () => { if (!raf) raf = requestAnimationFrame(rebuild); };
/** Keep rebuilding every frame for `ms` (while something glassy animates). */
function animate(ms = 600) {
  animUntil = Math.max(animUntil, performance.now() + ms);
  const tick = () => { rebuild(); if (performance.now() < animUntil) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

export function installLensing(viewEl) {
  view = viewEl;
  if (document.documentElement.dataset.platform === 'android') return; // Material, not Liquid Glass
  enabled = document.documentElement.dataset.glass !== 'off';
  addEventListener('resize', schedule);
  addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(schedule).observe(view);
  new MutationObserver((recs) => {
    if (recs.some((r) => r.target === view || [...r.addedNodes, ...r.removedNodes].some((n) => n.nodeType === 1 && (n.classList?.contains('lg') || n.querySelector?.('canvas'))))) animate(700);
  }).observe(document.body, { childList: true, subtree: true });
  new MutationObserver(() => { enabled = document.documentElement.dataset.glass !== 'off'; schedule(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-glass'] });
  animate(900);
}

/** Press lens on a control inside the page. */
/** Press lens: the dome is drawn once at the control's swollen size (it springs to it in ~0.3 s). */
export function pressGlass(el, grow = 1.06) {
  const r = el.getBoundingClientRect();
  const s = el.classList.contains('lg-press') ? 1 : grow; // rect may already include the swell
  const w = r.width * s, h = r.height * s;
  pressed = el;
  pressedRect = { r: { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h }, radius: (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12) * s, profile: 'dome' };
  schedule();
}
export function releaseGlass() { if (!pressed) return; pressed = null; pressedRect = null; schedule(); }
export const lensingRefresh = schedule;
