/**
 * Date utilities. All day-level records use a LOCAL calendar "date key"
 * (YYYY-MM-DD) so a log made at 11pm belongs to that local day regardless
 * of UTC offset. Timestamps (createdAt/updatedAt) are ISO-8601 UTC.
 */

const pad = (n) => String(n).padStart(2, '0');

/** @param {Date} [d] @returns {string} YYYY-MM-DD in local time */
export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** @param {Date} [d] @returns {string} HH:MM in local time */
export function localTime(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a date key into a local Date at midnight. */
export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = parseDateKey(v);
  return localDateKey(d) === v; // rejects 2026-02-31 etc.
}

/** Add n calendar days to a date key (DST-safe: uses calendar arithmetic). */
export function addDays(key, n) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return localDateKey(d);
}

/** Inclusive list of n date keys ending at `end`, oldest first. */
export function lastNDays(n, end = localDateKey()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

export function weekdayInitial(key) {
  return parseDateKey(key).toLocaleDateString(undefined, { weekday: 'narrow' });
}

export function formatLongDate(key) {
  return parseDateKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function formatRelativeDay(key, today = localDateKey()) {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  return parseDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
