/**
 * Widgets & phone alarms bridge.
 *
 * A Home Screen web app can't ship native WidgetKit widgets or touch the Clock app, so:
 *  - Widgets: the app publishes a small snapshot (today's targets/progress, next session,
 *    a Cratos line, tomorrow's alarms) to our relay under a random key only this phone holds.
 *    A Scriptable script (generated below, key embedded) renders native Home Screen and
 *    Lock Screen widgets from it.
 *  - Alarms: the app hands "HH:MM|Label" lines to a one-time "Hercules Alarms" shortcut
 *    (Shortcuts → Create Alarm), either on tap or nightly via a Shortcuts automation that
 *    reads the same relay.
 * Nothing else leaves the device. Turning sync off deletes the snapshot.
 */
import * as repo from './storage/repository.js';
import { activeTargets, waterGoal } from './nutrition/log.js';
import { totals } from '../engines/nutrition/nutrition.js';
import { alarmsForDay } from '../engines/coach/alarms.js';
import { toMin, fmt12, DAY_NAMES } from '../engines/coach/parser.js';
import { localDateKey } from '../utils/dates.js';

export const WIDGET_ENDPOINT = 'https://pwsrrxtugjvnvstzbnps.supabase.co/functions/v1/hercules-widget';
export const APP_URL = typeof location !== 'undefined' ? location.origin + location.pathname : 'https://taylorabryson-blip.github.io/boomwire/';
export const SHORTCUT_NAME = 'Hercules Alarms';
export const SCRIPTABLE_APP = 'https://apps.apple.com/app/scriptable/id1405459188';

const dowOf = (d) => (d.getDay() + 6) % 7;
const fmtVol = (ml, units) => (units === 'metric' ? `${(ml / 1000).toFixed(1)} L` : `${Math.round(ml / 29.5735)} oz`);

export function newKey() {
  const b = crypto.getRandomValues(new Uint8Array(30));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function enableSync() {
  const s = await repo.getSettings();
  if (s.widgetKey) return s.widgetKey;
  const key = newKey();
  await repo.updateSettings({ widgetKey: key });
  await publish(true);
  return key;
}

export async function disableSync() {
  const s = await repo.getSettings();
  if (s.widgetKey) await fetch(WIDGET_ENDPOINT, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: s.widgetKey }) }).catch(() => {});
  await repo.updateSettings({ widgetKey: null });
}

/** Alarms for a day as [{time,label}], respecting the user's workout-reminder lead time. */
export async function alarmsFor(date) {
  const [plan, av, s] = await Promise.all([repo.get('coach', 'plan').catch(() => null), repo.get('coach', 'availability').catch(() => null), repo.getSettings()]);
  const lead = s.reminders?.workout?.leadMin ?? 30;
  return alarmsForDay(plan, av, dowOf(date), { leadMin: lead });
}

export async function snapshot() {
  const now = new Date();
  const today = localDateKey(now);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const [settings, food, water, targets, plan] = await Promise.all([
    repo.getSettings(), repo.listByDate('foodLogs', today), repo.listByDate('hydrationLogs', today), activeTargets(), repo.get('coach', 'plan').catch(() => null)]);
  const wg = await waterGoal(settings);
  const t = totals(food);
  const waterMl = water.filter((x) => !x.deletedAt).reduce((a, x) => a + x.amountMl, 0);
  const has = targets && !targets.missing;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sessions = plan?.sessions ?? [];
  let next = null;
  for (let i = 0; i < 7 && !next; i++) {
    const dow = (dowOf(now) + i) % 7;
    const s = sessions.find((x) => x.day === dow && (i > 0 || toMin(x.start) > nowMin - 30));
    if (s) next = { focus: s.focus, time: fmt12(toMin(s.start)), when: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_NAMES[dow].slice(0, 3) };
  }
  const todaySession = sessions.find((x) => x.day === dowOf(now));
  const proteinLeft = has ? Math.max(0, Math.round(targets.protein - t.protein)) : null;
  const line = todaySession && toMin(todaySession.start) > nowMin
    ? `${todaySession.focus} at ${fmt12(toMin(todaySession.start))}.${proteinLeft ? ` ${proteinLeft} g protein to go.` : ''}`
    : proteinLeft ? `${proteinLeft} g protein to go today.` : has ? 'Targets hit. Rest well.' : 'Open Hercules to set your targets.';
  const alarmsToday = (await alarmsFor(now)).filter((a) => toMin(a.time) > nowMin);
  const alarms = await alarmsFor(tomorrow);
  return {
    v: 1, date: today, units: settings.units,
    kcal: { eaten: Math.round(t.kcal), target: has ? targets.kcal : null },
    protein: { eaten: Math.round(t.protein), target: has ? targets.protein : null },
    water: { ml: waterMl, target: wg.ml, display: fmtVol(waterMl, settings.units), targetDisplay: wg.ml ? fmtVol(wg.ml, settings.units) : null },
    next, line, alarms, alarmsToday, url: APP_URL,
  };
}

let timer = null, lastSent = '';
export async function publish(force = false) {
  const s = await repo.getSettings();
  if (!s.widgetKey || !navigator.onLine) return false;
  const data = await snapshot();
  const body = JSON.stringify({ key: s.widgetKey, data });
  if (!force && body === lastSent) return true;
  const r = await fetch(WIDGET_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => null);
  if (r?.ok) { lastSent = body; try { localStorage.setItem('hercules:widgetSyncedAt', new Date().toISOString()); } catch { /* ignore */ } }
  return !!r?.ok;
}
export const lastSyncedAt = () => { try { return localStorage.getItem('hercules:widgetSyncedAt'); } catch { return null; } };

/** Keep the snapshot fresh: after relevant changes (debounced) and when the app comes back. */
export function startWidgetSync() {
  const kick = () => { clearTimeout(timer); timer = setTimeout(() => publish().catch(() => {}), 4000); };
  repo.onChange(({ store }) => { if (['foodLogs', 'hydrationLogs', 'coach', 'workouts', 'profile', 'settings', 'bodyMetrics'].includes(store)) kick(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(); });
  kick();
}

/** shortcuts:// link that hands alarm lines to the user's "Hercules Alarms" shortcut. */
export function alarmShortcutURL(alarms) {
  const text = alarms.map((a) => `${a.time}|${a.label.replace(/[|\n]/g, ' ')}`).join('\n');
  return `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(text)}`;
}
export const alarmFeedURL = (key) => `${WIDGET_ENDPOINT}?k=${encodeURIComponent(key)}&f=alarms`;

/** The Scriptable script, with this phone's key baked in. */
export function scriptableSource(key) {
  return `// Hercules widget for Scriptable — Home Screen (small/medium/large) and Lock Screen.
// Generated by Hercules. Your private key is below; don't share this script.
const KEY = ${JSON.stringify(key)};
const ENDPOINT = ${JSON.stringify(WIDGET_ENDPOINT)};
const fm = FileManager.local();
const cache = fm.joinPath(fm.documentsDirectory(), "hercules-widget.json");

async function load() {
  try {
    const r = new Request(ENDPOINT + "?k=" + encodeURIComponent(KEY));
    r.timeoutInterval = 10;
    const d = await r.loadJSON();
    if (d && d.v) { fm.writeString(cache, JSON.stringify(d)); return d; }
  } catch (e) {}
  return fm.fileExists(cache) ? JSON.parse(fm.readString(cache)) : null;
}

function ring(pct, color, size, width) {
  const dc = new DrawContext();
  dc.size = new Size(size, size); dc.opaque = false; dc.respectScreenScale = true;
  const c = size / 2, r = c - width / 2 - 1;
  const arc = (from, to, col) => {
    const p = new Path(); const steps = Math.max(2, Math.ceil((to - from) * 90));
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + 2 * Math.PI * (from + (to - from) * i / steps);
      const pt = new Point(c + r * Math.cos(a), c + r * Math.sin(a));
      i === 0 ? p.move(pt) : p.addLine(pt);
    }
    dc.addPath(p); dc.setStrokeColor(col); dc.setLineWidth(width); dc.strokePath();
  };
  arc(0, 1, new Color(color.hex, 0.22));
  if (pct > 0) arc(0, Math.min(1, pct), color);
  return dc.getImage();
}

const WHITE = Color.white(), GREY = new Color("#8e8e93");
const ORANGE = new Color("#ff9f0a"), BLUE = new Color("#64d2ff"), GREEN = new Color("#30d158");
const pct = (a, b) => (b ? a / b : 0);

function text(stack, s, size, color = WHITE, weight = "semibold") {
  const t = stack.addText(String(s));
  t.font = weight === "bold" ? Font.boldRoundedSystemFont(size) : weight === "regular" ? Font.systemFont(size) : Font.semiboldRoundedSystemFont(size);
  t.textColor = color; t.lineLimit = 1; t.minimumScaleFactor = 0.6;
  return t;
}

function ringCell(parent, d, label, value, color, size) {
  const s = parent.addStack(); s.layoutVertically(); s.centerAlignContent();
  const img = s.addImage(ring(d, color, size, size / 7)); img.imageSize = new Size(size, size);
  s.addSpacer(4); text(s, value, 13); text(s, label, 10, GREY, "regular");
}

async function build() {
  const d = await load();
  const fam = config.widgetFamily || "medium";
  const w = new ListWidget();
  w.url = d?.url || "${APP_URL}";
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  if (!fam.startsWith("accessory")) {
    const g = new LinearGradient(); g.colors = [new Color("#1c1c1e"), new Color("#000000")]; g.locations = [0, 1]; w.backgroundGradient = g;
    w.setPadding(14, 14, 14, 14);
  }
  if (!d) { text(w, "Open Hercules", 14); text(w, "Turn on Widgets in Settings", 11, GREY, "regular"); return w; }

  const kP = pct(d.kcal.eaten, d.kcal.target), pP = pct(d.protein.eaten, d.protein.target), wP = pct(d.water.ml, d.water.target);

  if (fam === "accessoryInline") {
    text(w, d.next ? \`\${d.next.focus} \${d.next.when.toLowerCase()} \${d.next.time}\` : \`\${d.kcal.eaten} kcal · \${d.protein.eaten} g protein\`, 12);
    return w;
  }
  if (fam === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
    const img = s.addImage(ring(pP || kP, WHITE, 52, 6)); img.imageSize = new Size(52, 52); img.centerAlignImage();
    w.addSpacer(-38); const t = w.addStack(); t.addSpacer(); text(t, d.protein.target ? Math.max(0, d.protein.target - d.protein.eaten) : d.kcal.eaten, 14, WHITE, "bold"); t.addSpacer();
    const u = w.addStack(); u.addSpacer(); text(u, d.protein.target ? "g left" : "kcal", 8, WHITE, "regular"); u.addSpacer();
    return w;
  }
  if (fam === "accessoryRectangular") {
    text(w, "HERCULES", 10, WHITE, "bold");
    text(w, d.kcal.target ? \`\${d.kcal.eaten} / \${d.kcal.target} kcal\` : \`\${d.kcal.eaten} kcal\`, 13);
    text(w, d.protein.target ? \`\${d.protein.eaten}/\${d.protein.target} g protein · \${d.water.display}\` : d.water.display, 11, WHITE, "regular");
    if (d.next) text(w, \`\${d.next.focus} · \${d.next.when} \${d.next.time}\`, 11, WHITE, "regular");
    return w;
  }

  const head = w.addStack(); head.centerAlignContent();
  text(head, "HERCULES", 11, GREY, "bold"); head.addSpacer();
  if (d.next && fam !== "small") text(head, \`\${d.next.when} · \${d.next.time}\`, 11, GREY, "regular");
  w.addSpacer(8);

  if (fam === "small") {
    const row = w.addStack(); row.centerAlignContent();
    const img = row.addImage(ring(kP, WHITE, 58, 8)); img.imageSize = new Size(58, 58);
    row.addSpacer(10);
    const col = row.addStack(); col.layoutVertically();
    text(col, d.kcal.target ? Math.max(0, d.kcal.target - d.kcal.eaten) : d.kcal.eaten, 20, WHITE, "bold");
    text(col, d.kcal.target ? "kcal left" : "kcal", 10, GREY, "regular");
    w.addSpacer(8);
    text(w, d.protein.target ? \`\${d.protein.eaten}/\${d.protein.target} g protein\` : \`\${d.protein.eaten} g protein\`, 11, ORANGE);
    text(w, d.water.targetDisplay ? \`\${d.water.display} / \${d.water.targetDisplay}\` : d.water.display, 11, BLUE);
    w.addSpacer();
    text(w, d.next ? \`\${d.next.focus} · \${d.next.when}\` : "Rest day", 11, GREY, "regular");
    return w;
  }

  const rings = w.addStack(); rings.centerAlignContent();
  const size = fam === "large" ? 64 : 46;
  ringCell(rings, kP, d.kcal.target ? \`of \${d.kcal.target} kcal\` : "kcal", d.kcal.eaten, WHITE, size); rings.addSpacer();
  ringCell(rings, pP, d.protein.target ? \`of \${d.protein.target} g\` : "protein", \`\${d.protein.eaten} g\`, ORANGE, size); rings.addSpacer();
  ringCell(rings, wP, d.water.targetDisplay ? \`of \${d.water.targetDisplay}\` : "water", d.water.display, BLUE, size);
  w.addSpacer(fam === "large" ? 14 : 8);
  const line = text(w, d.line, 12, WHITE, "regular"); line.lineLimit = 2;
  if (fam === "large") {
    w.addSpacer(12);
    if (d.next) { text(w, "NEXT SESSION", 10, GREY, "bold"); text(w, \`\${d.next.focus} · \${d.next.when} \${d.next.time}\`, 15, GREEN); w.addSpacer(10); }
    if (d.alarms?.length) { text(w, "TOMORROW'S ALARMS", 10, GREY, "bold"); for (const a of d.alarms.slice(0, 3)) text(w, \`\${a.time}  \${a.label}\`, 12, WHITE, "regular"); }
    w.addSpacer();
  }
  return w;
}

const widget = await build();
if (config.runsInWidget || config.runsInAccessoryWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
`;
}
