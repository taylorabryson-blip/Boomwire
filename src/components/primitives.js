/**
 * Reusable presentational components. Pure functions: props in, element out.
 * No component reads storage — screens pass data in.
 * Interactive elements are <button>s (never <a href>) to avoid iOS link previews.
 */
import { h, svg } from './dom.js';
import { icon } from './icons.js';
import { haptic } from './haptics.js';
import { navigate, goBack } from '../navigation/nav.js';

export function NavHeader({ title, eyebrow, trailing, back }) {
  return h('header', { 'data-nav-title': title, 'data-nav-back': back ? back.href : null },
    back && h('button', { class: 'nav-back', type: 'button', onClick: () => goBack(back.href) }, icon('chevronLeft', 22), back.label),
    h('div', { class: 'nav-header' },
      h('div', { class: 'grow' },
        eyebrow && h('div', { class: 'nav-header__eyebrow' }, eyebrow),
        h('h1', { class: 't-large-title nav-header__title' }, title)),
      trailing));
}

export function IconButton({ iconName, label, onClick, href, glass, node }) {
  return h('button', { class: `icon-btn ${glass ? 'icon-btn--glass' : ''}`, type: 'button', 'aria-label': label, onClick: href ? () => navigate(href) : (e) => { haptic(); onClick?.(e); } }, node ?? icon(iconName, 20));
}

export function Section({ title, action, footer, first }, ...children) {
  return h('section', { class: `section ${first ? 'section--first' : ''}` },
    (title || action) && h('div', { class: 'section__header' },
      title && h('h2', { class: 'section__title' }, title), action),
    ...children,
    footer && h('p', { class: 'section__footer' }, footer));
}

export function SectionAction(label, onClick) {
  return h('button', { class: 'section__action', type: 'button', onClick: () => { haptic(); onClick(); } }, label);
}

export function Card({ label, iconName, badge, onClick, href, glass, class: cls = '', style }, ...children) {
  const tap = onClick || href;
  return h(tap ? 'button' : 'div', {
    class: `card ${tap ? 'card--tap' : ''} ${glass ? 'card--glass' : ''} ${cls}`, type: tap ? 'button' : null, style,
    onClick: href ? () => navigate(href) : onClick ? (e) => { haptic(); onClick(e); } : null,
  },
  (label || badge) && h('div', { class: 'card__head' }, h('div', { class: 'card__label' }, iconName && icon(iconName, 18), label), badge),
  ...children);
}

/** Provenance badge — every statistic declares how it was obtained. */
export function Provenance(kind = 'recorded') {
  const text = { recorded: 'Recorded', measured: 'Measured', estimated: 'Estimate' }[kind];
  return h('span', { class: `prov prov--${kind}`, title: `${text} value` }, text);
}

export function Stat({ value, unit, label, large = false }) {
  return h('div', { class: 'stat' },
    h('div', { class: `stat__value ${large ? 'stat__value--lg' : ''}` }, value, unit && h('span', { class: 'stat__unit' }, unit)),
    label && h('div', { class: 'stat__label' }, label));
}

export function List(...rows) { return h('div', { class: 'list' }, ...rows); }

export function ListRow({ title, subtitle, value, iconName, iconNode, href, onClick, chevron = !!(href || onClick), trailing, danger }) {
  const tap = href || onClick;
  return h(tap ? 'button' : 'div', {
    class: `list-row ${iconName || iconNode ? 'list-row--leading-icon' : ''}`, type: tap ? 'button' : null,
    onClick: href ? () => navigate(href) : onClick ? (e) => { haptic(); onClick(e); } : null,
  },
  (iconName || iconNode) && h('span', { class: 'list-row__icon' }, iconNode ?? icon(iconName, 17)),
  h('div', { class: 'list-row__main' },
    h('div', { class: 'list-row__title', style: danger ? { color: 'var(--c-danger)' } : null }, title),
    subtitle && h('div', { class: 'list-row__subtitle' }, subtitle)),
  value != null && h('span', { class: 'list-row__value' }, value),
  trailing,
  chevron && h('span', { class: 'list-row__chevron' }, icon('chevronRight', 16)));
}

/** List row with an inline editor on the right (input or select). */
export function FieldRow({ title, control, iconName }) {
  return h('label', { class: `list-row ${iconName ? 'list-row--leading-icon' : ''}` },
    iconName && h('span', { class: 'list-row__icon' }, icon(iconName, 17)),
    h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, title)),
    control);
}

export function Select({ value, options, onChange, placeholder = 'Not set' }) {
  const sel = h('select', { onChange: (e) => { haptic(); onChange(e.target.value || null); } },
    h('option', { value: '' }, placeholder),
    options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value) ? true : null }, o.label)));
  return sel;
}

export function Button({ label, variant, size, block, onClick, iconName, disabled, type = 'button', node }) {
  const cls = ['btn', variant && `btn--${variant}`, size && `btn--${size}`, block && 'btn--block'].filter(Boolean).join(' ');
  return h('button', { class: cls, onClick: (e) => { haptic(variant === 'primary' ? 'medium' : 'light'); onClick?.(e); }, disabled, type }, node, iconName && icon(iconName, 18), label);
}

export function EmptyState({ iconName, iconNode, title, body, inline = false, action }) {
  return h('div', { class: `empty ${inline ? 'empty--inline' : ''}` },
    !inline && (iconName || iconNode) && h('div', { class: 'empty__icon' }, iconNode ?? icon(iconName, 26)),
    h('div', { class: 'empty__title' }, title),
    body && h('p', { class: 'empty__body' }, body),
    action);
}

/** Segmented control with a sliding (spring) thumb. */
export function SegmentedControl({ options, value, onChange, label }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const thumb = h('div', { class: 'segmented__thumb', style: { width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${idx * 100}%)` } });
  const root = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label }, thumb);
  options.forEach((opt, i) => {
    root.append(h('button', {
      class: 'segmented__item', role: 'radio', type: 'button', 'aria-checked': String(opt.value === value),
      onClick: () => {
        if (opt.value === value) return;
        haptic();
        thumb.style.transform = `translateX(${i * 100}%)`;
        root.querySelectorAll('.segmented__item').forEach((b, j) => b.setAttribute('aria-checked', String(j === i)));
        setTimeout(() => onChange(opt.value), 160);
      },
    }, opt.label));
  });
  return root;
}

export function Switch({ checked, onChange, label }) {
  const input = h('input', { type: 'checkbox', checked: !!checked, 'aria-label': label, onChange: (e) => { haptic(); onChange(e.target.checked); } });
  return h('span', { class: 'switch' }, input, h('span', { class: 'switch__track' }), h('span', { class: 'switch__knob' }));
}

export function Stepper({ value, min = 0, max = 99, step = 1, onChange, format = String }) {
  const val = h('span', { class: 'stepper__value' }, format(value));
  let v = value;
  const set = (n) => { v = Math.max(min, Math.min(max, n)); val.textContent = format(v); haptic(); onChange(v); };
  return h('span', { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': 'Decrease', onClick: (e) => { e.preventDefault(); set(v - step); } }, icon('minus', 16)),
    val,
    h('button', { type: 'button', 'aria-label': 'Increase', onClick: (e) => { e.preventDefault(); set(v + step); } }, icon('plus', 16)));
}

/**
 * Circular progress. `progress` is a ratio (may exceed 1; the ring caps at one
 * full turn). null renders an empty track.
 */
export function ProgressRing({ progress, size = 96, stroke = 10, center, color }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = progress == null ? 0 : Math.max(0, Math.min(1, progress));
  const ring = svg(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)" aria-hidden="true">
    <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
    <circle class="ring__fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c}" ${p === 0 ? 'opacity="0"' : ''}/></svg>`);
  // animate in
  requestAnimationFrame(() => requestAnimationFrame(() => ring.querySelector('.ring__fill')?.setAttribute('stroke-dashoffset', String(c * (1 - p)))));
  return h('div', { class: 'ring', style: { width: `${size}px`, height: `${size}px`, ...(color ? { '--ring-color': color } : {}) } }, ring, center && h('div', { class: 'ring__center' }, center));
}

export function ProgressBar({ progress, color }) {
  const p = progress == null ? 0 : Math.max(0, Math.min(1, progress));
  return h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': Math.round(p * 100), 'aria-valuemin': 0, 'aria-valuemax': 100, style: color ? { '--bar-color': color } : null },
    h('div', { class: 'bar__fill', style: { width: `${p * 100}%` } }));
}

export function HBar({ label, value, ratio, color }) {
  return h('div', { class: 'hbar' }, h('span', { class: 'c-2' }, label), ProgressBar({ progress: ratio, color }), h('span', { class: 'hbar__value' }, value));
}

/** Roadmap row for modules that are not built yet. Honest, non-interactive. */
export function RoadmapRow({ title, subtitle, phase, iconName }) {
  return ListRow({ title, subtitle, iconName, trailing: h('span', { class: 'phase-tag' }, `Phase ${phase}`) });
}

export function Search({ placeholder = 'Search', value = '', onInput }) {
  const input = h('input', { type: 'search', placeholder, value, enterkeyhint: 'search', onInput: (e) => onInput(e.target.value) });
  return h('label', { class: 'search' }, icon('search', 16), input);
}
