/**
 * Reusable presentational components. Pure functions: props in, element out.
 * No component reads storage — screens pass data in.
 */
import { h, svg } from './dom.js';
import { icon } from './icons.js';

export function NavHeader({ title, eyebrow, trailing, back }) {
  return h('header', {},
    back && h('a', { class: 'nav-back', href: back.href }, icon('chevronLeft', 22), back.label),
    h('div', { class: 'nav-header' },
      h('div', {},
        eyebrow && h('div', { class: 'nav-header__eyebrow' }, eyebrow),
        h('h1', { class: 't-large-title', style: { margin: 0 } }, title)),
      trailing));
}

export function Section({ title, action, footer }, ...children) {
  return h('section', { class: 'section' },
    (title || action) && h('div', { class: 'section__header' },
      title && h('h2', { class: 'section__title' }, title), action),
    ...children,
    footer && h('p', { class: 'section__footer', style: { margin: 0 } }, footer));
}

export function Card({ label, iconName, badge, onClick, class: cls = '' }, ...children) {
  const tag = onClick ? 'button' : 'div';
  return h(tag, { class: `card ${cls}`, onClick, style: onClick ? { width: '100%', textAlign: 'left', display: 'block' } : null },
    (label || badge) && h('div', { class: 'card__head' },
      h('div', { class: 'card__label' }, iconName && icon(iconName, 18), label), badge),
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

export function ListRow({ title, subtitle, value, iconName, href, onClick, chevron = !!(href || onClick), trailing, danger }) {
  const tag = href ? 'a' : onClick ? 'button' : 'div';
  return h(tag, { class: `list-row ${iconName ? 'list-row--leading-icon' : ''}`, href, onClick, type: tag === 'button' ? 'button' : null },
    iconName && h('span', { class: 'list-row__icon' }, icon(iconName, 17)),
    h('div', { class: 'list-row__main' },
      h('div', { class: 'list-row__title', style: danger ? { color: 'var(--c-danger)' } : null }, title),
      subtitle && h('div', { class: 'list-row__subtitle' }, subtitle)),
    value != null && h('span', { class: 'list-row__value' }, value),
    trailing,
    chevron && h('span', { class: 'list-row__chevron' }, icon('chevronRight', 16)));
}

export function Button({ label, variant, size, block, onClick, iconName, disabled, type = 'button' }) {
  const cls = ['btn', variant && `btn--${variant}`, size && `btn--${size}`, block && 'btn--block'].filter(Boolean).join(' ');
  return h('button', { class: cls, onClick, disabled, type }, iconName && icon(iconName, 18), label);
}

export function EmptyState({ iconName, title, body, inline = false }) {
  return h('div', { class: `empty ${inline ? 'empty--inline' : ''}` },
    !inline && iconName && h('div', { class: 'empty__icon' }, icon(iconName, 24)),
    h('div', { class: 'empty__title' }, title),
    body && h('p', { class: 'empty__body' }, body));
}

export function SegmentedControl({ options, value, onChange, label }) {
  const root = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  for (const opt of options) {
    root.append(h('button', {
      class: 'segmented__item', role: 'radio', type: 'button',
      'aria-checked': String(opt.value === value),
      onClick: () => { if (opt.value !== value) onChange(opt.value); },
    }, opt.label));
  }
  return root;
}

/**
 * Circular progress. `progress` is a ratio (may exceed 1; ring visually caps
 * at one full turn). Pass null to render an empty track.
 */
export function ProgressRing({ progress, size = 96, stroke = 9, center }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = progress == null ? 0 : Math.max(0, Math.min(1, progress));
  const ring = svg(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)" aria-hidden="true">
    <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
    <circle class="ring__fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" ${p === 0 ? 'opacity="0"' : ''}/></svg>`);
  return h('div', { class: 'ring', style: { width: `${size}px`, height: `${size}px` } }, ring, center && h('div', { class: 'ring__center' }, center));
}

export function ProgressBar({ progress }) {
  const p = progress == null ? 0 : Math.max(0, Math.min(1, progress));
  return h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': Math.round(p * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div', { class: 'bar__fill', style: { width: `${p * 100}%` } }));
}

/** Roadmap row for modules that are not built yet. Honest, non-interactive. */
export function RoadmapRow({ title, subtitle, phase, iconName }) {
  return ListRow({ title, subtitle, iconName, trailing: h('span', { class: 'phase-tag' }, `Phase ${phase}`) });
}
