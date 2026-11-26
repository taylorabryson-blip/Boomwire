/** Programmatic navigation (buttons, not <a> links, so iOS shows no link previews on long-press). */
import { haptic } from '../components/haptics.js';

export function navigate(href, { replace = false } = {}) {
  haptic();
  const target = href.startsWith('#') ? href : `#${href}`;
  if (replace) location.replace(target);
  else location.hash = target;
}

/** Back: use history when we navigated within the app, else go to a fallback. */
export function goBack(fallback = '#/home') {
  haptic();
  if (history.length > 1 && sessionStorage.getItem('hercules:navigated') === '1') history.back();
  else location.hash = fallback;
}

/** Parse "#/route?x=1" into { name, params }. */
export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [name, query = ''] = raw.split('?');
  return { name: name || 'home', params: new URLSearchParams(query) };
}
