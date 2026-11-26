/** Line icon set — 24×24 grid, 1.75 stroke, currentColor. */
import { svg } from './dom.js';

const P = {
  home: '<path d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.25v-6h-5.5v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
  training: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  body: '<circle cx="12" cy="4.6" r="2.1"/><path d="M5 8.6c2.3.6 4.6.9 7 .9s4.7-.3 7-.9M12 9.5v5.5M12 15l-2.6 6M12 15l2.6 6"/>',
  nutrition: '<path d="M12 7.2c-2.8-1.9-7.2-1.2-7.2 4.3 0 4.9 3.1 9.5 5.4 9.5.8 0 1.2-.4 1.8-.4s1 .4 1.8.4c2.3 0 5.4-4.6 5.4-9.5 0-5.5-4.4-6.2-7.2-4.3z"/><path d="M12 7.2c0-2 1-3.7 3-4.2"/>',
  analytics: '<path d="M5 20v-7M10.5 20V5M16 20v-9.5M21 20H3"/>',
  settings: '<path d="M4 7.5h9M17.5 7.5H20M4 16.5h2.5M11 16.5h9"/><circle cx="15.25" cy="7.5" r="2.25"/><circle cx="8.75" cy="16.5" r="2.25"/>',
  drop: '<path d="M12 3.2s6.2 6.6 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.2 12 3.2z"/>',
  flame: '<path d="M12 21c3.6 0 6-2.5 6-6 0-4.5-4-6.5-4.5-11-2.5 1.5-4 4-4 6.5-1-.5-1.5-1.5-1.7-2.5C6.6 9.5 6 11.5 6 15c0 3.5 2.4 6 6 6z"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
  database: '<ellipse cx="12" cy="6" rx="7" ry="2.75"/><path d="M5 6v12c0 1.5 3.1 2.75 7 2.75s7-1.25 7-2.75V6M5 12c0 1.5 3.1 2.75 7 2.75s7-1.25 7-2.75"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6z"/>',
  ruler: '<path d="M3.5 15.5 15.5 3.5l5 5-12 12z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.8 4-5.6 7.5-5.6s6.3 1.8 7.5 5.6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 9.5v4l2.5 2M9.5 3.5h5"/>',
  trophy: '<path d="M8 4.5h8v5a4 4 0 0 1-8 0zM8 6.5H4.5c0 3 1.5 4.5 3.7 4.8M16 6.5h3.5c0 3-1.5 4.5-3.7 4.8M12 13.5v4M8.5 20.5h7"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  more: '<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>',
  edit: '<path d="M4.5 19.5h4l10-10-4-4-10 10zM13 7l4 4"/>',
  gear: '<path d="M7 7.5v9M17 7.5v9M4 10v4M20 10v4M7 12h10"/><rect x="2.5" y="10" width="1.5" height="4" rx=".5"/>',
  rotate: '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M17.5 3.5v3.6h-3.6M6.5 20.5v-3.6h3.6"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1" fill="currentColor"/><circle cx="4.8" cy="12" r="1" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1" fill="currentColor"/>',
  tag: '<path d="M3.5 12.5v-8h8l9 9-8 8z"/><circle cx="8" cy="8.5" r="1.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
};

export function icon(name, size = 22) {
  const node = svg(`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`);
  return node;
}
