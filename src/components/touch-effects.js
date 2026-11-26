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
const PRESSABLE = '.btn, .chip, .icon-btn, button.list-row, a.list-row, .card--tap, .tabbar__item, .segmented__item, .nav-tile, .choice, .composer__send, .composer__mic, .banner__action, .livebar, .set-check, .add-btn, .stepper button, .scale5 button, .accordion__head, .gear-tile, .meal-tile__main, .ql__mic';
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

export function installTouchEffects() {
  let pressed = null;
  const release = () => { pressed?.classList.remove('is-pressed'); pressed = null; };
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest(PRESSABLE);
    if (!el || el.disabled) return;
    if (android()) { ripple(el, e); return; }
    release(); pressed = el; el.classList.add('is-pressed');
  }, { passive: true });
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
function displacementMap(w, h, radius, bezel) {
  const key = `${w}x${h}r${radius}b${bezel}`;
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
      img.data[i] = 128 + nx * m * 127;
      img.data[i + 1] = 128 + ny * m * 127;
      img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL();
  maps.set(key, url);
  return url;
}

function refract(el) {
  const r = el.getBoundingClientRect();
  const w = Math.round(r.width), h = Math.round(r.height);
  if (w < 8 || h < 8) return;
  const radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 16, h / 2);
  const bezel = Math.max(6, Math.min(22, h * 0.3));
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
    defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.append(defs);
  }
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
