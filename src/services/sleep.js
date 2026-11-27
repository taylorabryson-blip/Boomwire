/**
 * Sleep: Apple Health import (via the "Hercules Sleep" shortcut and the sync
 * relay) and the S1 estimate. Also records when you use Hercules, which is
 * one of the estimate's clues. Usage moments stay on this phone.
 */
import * as repo from './storage/repository.js';
import { WIDGET_ENDPOINT, enableSync } from './widgets.js';
import { estimateSleep, healthNightFor } from '../engines/recovery/sleep.js';
import { localDateKey, localTime } from '../utils/dates.js';

export const SLEEP_SHORTCUT = 'Hercules Sleep';
const ACT_KEY = 'hercules:activity';

/* ── App-use moments (kept 3 days, at most one per 2 minutes) ── */
function readActivity() { try { return JSON.parse(localStorage.getItem(ACT_KEY) || '[]'); } catch { return []; } }
function mark() {
  const now = Date.now();
  const list = readActivity();
  if (list.length && now - list[list.length - 1] < 120000) return;
  list.push(now);
  try { localStorage.setItem(ACT_KEY, JSON.stringify(list.filter((t) => now - t < 3 * 86400000).slice(-500))); } catch {}
}
export function startActivityTracking() {
  mark();
  document.addEventListener('visibilitychange', () => { mark(); if (document.visibilityState === 'visible') importHealthSleep().catch(() => {}); });
  addEventListener('pointerdown', mark, { passive: true });
  addEventListener('pagehide', mark);
  importHealthSleep().catch(() => {});
}

/* ── Apple Health import ── */
export const sleepPostURL = (key) => `${WIDGET_ENDPOINT}?k=${encodeURIComponent(key)}&f=sleep`;

let importing = null;
/** Pull recent Health nights into recovery logs. Never overwrites times you set yourself. */
export function importHealthSleep() {
  importing ??= (async () => {
    const s = await repo.getSettings();
    if (!s.widgetKey || !s.sleepFromHealth) return 0;
    const r = await fetch(`${WIDGET_ENDPOINT}?k=${encodeURIComponent(s.widgetKey)}&f=sleep-list`).catch(() => null);
    if (!r?.ok) return 0;
    const entries = await r.json();
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = localDateKey(d);
      const night = healthNightFor(entries, key);
      if (!night) continue;
      const existing = (await repo.listByDate('recoveryLogs', key))[0];
      if (existing?.sleepSource === 'manual') continue;
      const rec = { sleepStart: night.start, sleepEnd: night.end, sleepSource: 'health', sleepHours: Math.round(((Date.parse(night.end) - Date.parse(night.start)) / 3600000) * 10) / 10 };
      if (existing) { if (existing.sleepEnd !== night.end || existing.sleepStart !== night.start) { await repo.update('recoveryLogs', existing.id, rec); n++; } }
      else { await repo.create('recoveryLogs', { date: key, ...rec, provenance: 'measured' }); n++; }
    }
    if (n) await repo.updateSettings({ sleepLastImport: new Date().toISOString() });
    return n;
  })().finally(() => { importing = null; });
  return importing;
}

export async function turnOnHealthSleep() {
  const key = await enableSync();
  await repo.updateSettings({ sleepFromHealth: true });
  return sleepPostURL(key);
}

/* ── Last night: Health if we have it, else the S1 estimate ── */
export async function lastNight(date = localDateKey()) {
  const existing = (await repo.listByDate('recoveryLogs', date))[0];
  if (existing?.sleepStart && existing?.sleepEnd) {
    return { asleep: new Date(existing.sleepStart), woke: new Date(existing.sleepEnd), source: existing.sleepSource ?? 'manual', basis: [] };
  }
  const av = await repo.get('coach', 'availability').catch(() => null);
  const est = estimateSleep({ now: new Date(), bedtime: av?.sleepTime ?? '23:00', wake: av?.wakeTime ?? '07:00', activity: readActivity() });
  return { ...est, source: 'estimate' };
}

export const hhmm = (d) => localTime(d);
