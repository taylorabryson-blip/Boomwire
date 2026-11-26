/**
 * Platform touch feedback + Liquid Glass material.
 *
 *  iOS / desktop: no overlays. Pressed controls do what iOS controls do — a quick
 *                 spring scale-down with a slight dim, released with a spring.
 *  Android:       Material 3 ripple from the touch point.
 *
 *  Liquid Glass: elements with .lg get Apple's material. Where the browser can
 *  run SVG filters on the backdrop (Chromium / Android), a displacement map built
 *  for each element's exact size and corner radius bends the content behind it at
 *  the rounded edges — real refraction. Safari doesn't render SVG backdrop filters
 *  yet, so there the material is built from clear glass + rim specular + edge
 *  shading (CSS in components.css), which is as far as WebKit allows.
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
 * Press a control and it becomes a glass lens: it swells, its own content bends at
 * the rim (an SVG displacement filter on the element itself — this kind of filter
 * Safari does render), a specular light follows your finger and the rim lights up.
 * Release and it springs back. Rows (full-width list items) only highlight, as on iOS. */
const LENS = '.btn, .chip, .icon-btn, .tabbar__item, .segmented__item, .add-btn, .composer__send, .composer__mic, .gear-tile, .meal-tile__main, .nav-tile, .choice, .day-picker__d, .week-day, .ql__mic, .set-check, .stepper button, .meal-time, .banner__action';
const ROW = 'button.list-row, a.list-row, .card--tap, .livebar, .scale5 button, .accordion__head';

function lensFilter(w, h, radius) {
  const key = `lens-${w}x${h}r${Math.round(radius)}`;
  ensureDefs();
  if (!defs.querySelector(`#${key}`)) {
    // Element-relative units: Safari and Chrome agree on these for filters on HTML elements.
    // In bounding-box units the displacement scale multiplies by width on x and height on y,
    // so the map is pre-scaled per axis to give the same bend (in px) on every edge.
    const bezel = Math.max(5, Math.min(16, Math.min(w, h) * 0.3));
    const m = Math.min(w, h);
    const scale = (bezel * 0.9) / m;
    const url = displacementMap(w, h, radius, bezel, { kx: m / w, ky: m / h });
    defs.insertAdjacentHTML('beforeend', `<filter id="${key}" x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
      <feImage href="${url}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale.toFixed(4)}" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`);
  }
  return key;
}

function pressLens(el, e) {
  const r = el.getBoundingClientRect();
  const w = Math.round(r.width), h = Math.round(r.height);
  if (w < 8 || h < 8) return null;
  const cs = getComputedStyle(el);
  if (cs.position === 'static') el.style.position = 'relative';
  const radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 12, h / 2);
  const grow = w < 70 ? 1.14 : w < 180 ? 1.07 : 1.035; // small controls swell more, like iOS
  el.style.setProperty('--lg-grow', String(grow));
  el.style.filter = `url(#${lensFilter(w, h, radius)})`;
  let light = el.querySelector(':scope > .lg-light');
  if (!light) { light = document.createElement('span'); light.className = 'lg-light'; el.append(light); }
  track(el, e);
  el.classList.add('lg-press');
  return el;
}
function track(el, e) {
  const r = el.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  el.style.setProperty('--px', `${x * 100}%`); el.style.setProperty('--py', `${y * 100}%`);
  // a little stretch toward the finger, like the gel follows you
  el.style.setProperty('--sx', `${(x - 0.5) * 4}px`); el.style.setProperty('--sy', `${(y - 0.5) * 3}px`);
}
function releaseLens(el) {
  if (!el) return;
  el.classList.remove('lg-press');
  el.classList.add('lg-release');
  setTimeout(() => {
    if (el.classList.contains('lg-press')) return;
    el.classList.remove('lg-release');
    el.style.filter = '';
    el.querySelector(':scope > .lg-light')?.remove();
  }, 420);
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
    lens = pressLens(el, e);
  }, { passive: true });
  document.addEventListener('pointermove', (e) => { if (lens) track(lens, e); }, { passive: true });
  document.addEventListener('pointerup', release, { passive: true });
  document.addEventListener('pointercancel', release, { passive: true });
  document.addEventListener('scroll', release, { passive: true, capture: true });
  installRefraction();
}

/* ---------------- Liquid Glass refraction (Chromium) ---------------- */
const canRefract = () => {
  const ua = navigator.userAgent;
  return document.documentElement.dataset.platform !== 'android' && /Chrome\/\d+/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua) && !/Version\/[\d.]+.*Safari/.test(ua) && document.documentElement.dataset.glass !== 'off';
};
let defs = null, seq = 0;
const maps = new Map();

/** Displacement map: pixels inside the bezel sample the backdrop further out along the edge normal (a convex lens). */
function displacementMap(w, h, radius, bezel, { kx = 1, ky = 1 } = {}) {
  const key = `${w}x${h}r${radius}b${bezel}k${kx.toFixed(3)}${ky.toFixed(3)}`;
  if (maps.has(key)) return maps.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const r = Math.min(radius, w / 2, h / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // signed distance to rounded rect (inside negative), and outward normal
      const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
      let d, nx, ny;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); d = l - r; nx = (qx / l) * Math.sign(px); ny = (qy / l) * Math.sign(py); }
      else if (qx > qy) { d = qx - r; nx = Math.sign(px); ny = 0; }
      else { d = qy - r; nx = 0; ny = Math.sign(py); }
      const depth = -d; // distance in from the edge
      const t = depth < bezel ? 1 - depth / bezel : 0;
      const m = t * t * (3 - 2 * t); // smooth falloff: strongest bending right at the rim
      const i = (y * w + x) * 4;
      img.data[i] = 128 + nx * m * 127 * kx;
      img.data[i + 1] = 128 + ny * m * 127 * ky;
      img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL();
  maps.set(key, url);
  return url;
}

function ensureDefs() {
  if (defs) return;
  defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.append(defs);
}

function refract(el) {
  const r = el.getBoundingClientRect();
  const w = Math.round(r.width), h = Math.round(r.height);
  if (w < 8 || h < 8) return;
  const radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 16, h / 2);
  const bezel = Math.max(6, Math.min(22, h * 0.3));
  ensureDefs();
  const id = el.dataset.lgId || `lg${++seq}`;
  el.dataset.lgId = id;
  defs.querySelector(`#${id}`)?.remove();
  defs.insertAdjacentHTML('beforeend', `<filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
    <feImage href="${displacementMap(w, h, radius, bezel)}" x="0" y="0" width="${w}" height="${h}" result="map"/>
    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="soft"/>
    <feDisplacementMap in="soft" in2="map" scale="${-bezel * 1.3}" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`);
  el.style.setProperty('--lg-filter', `url(#${id}) saturate(1.8) brightness(1.05)`);
  el.classList.add('lg--refract');
}

function installRefraction() {
  if (!canRefract()) return;
  const seen = new WeakSet();
  const ro = new ResizeObserver((entries) => entries.forEach((e) => refract(e.target)));
  const scan = () => document.querySelectorAll('.lg').forEach((el) => { if (!seen.has(el)) { seen.add(el); ro.observe(el); refract(el); } });
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
}
