/**
 * Progress — four one-screen views: Muscles (3D) · Body · Recovery · Trends.
 * Details open on their own screens or sheets instead of growing this page.
 */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { NavHeader, Card, Provenance, SegmentedControl, Button, EmptyState, HBar, ProgressRing } from '../../components/primitives.js';
import { BarChart } from '../../components/bar-chart.js';
import { LineChart } from '../../components/line-chart.js';
import { openSheet } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import * as repo from '../../services/storage/repository.js';
import { navigate } from '../../navigation/nav.js';
import { MUSCLES, MUSCLE_BY_ID } from '../../data/anatomy/muscles.js';
import { MODES, RANGES, muscleWorkload, normalize, lastTrained } from '../../engines/anatomy/workload.js';
import { setsPerMuscle, completedWorkouts, weeklyTotals } from '../../engines/training/metrics.js';
import { weekComparison, readiness, readinessAdvice } from '../../engines/analytics/compare.js';
import { dailySummaries } from '../../engines/nutrition/nutrition.js';
import { localDateKey, addDays, lastNDays, weekdayInitial, formatRelativeDay, parseDateKey } from '../../utils/dates.js';
import { weightValue, weightUnit, lengthString } from '../../utils/units.js';
import { MEASUREMENTS } from '../../data/models.js';
import { openLogWeightSheet, MEASURE_LABELS } from './measurements.js';
import { openCheckin, todaysCheckin } from '../shared/checkin.js';

let seg = 'muscles';
const state = { mode: 'recent', range: '7d', group: null, selected: null };

export async function mount(root) {
  const content = h('div', {});
  let cleanup = null;
  const show = async () => {
    cleanup?.(); cleanup = null;
    const views = { muscles: musclesView, body: bodyView, recovery: recoveryView, trends: trendsView };
    const next = h('div', { class: 'stack' });
    cleanup = await views[seg](next);
    content.replaceChildren(next);
  };
  root.append(
    NavHeader({ title: 'Progress' }),
    SegmentedControl({ label: 'Section', value: seg, onChange: (v) => { seg = v; show(); },
      options: [{ value: 'muscles', label: 'Muscles' }, { value: 'body', label: 'Body' }, { value: 'recovery', label: 'Recovery' }, { value: 'trends', label: 'Trends' }] }),
    content);
  await show();
  const off = repo.onChange(({ store }) => { if (seg !== 'muscles' && ['workouts', 'bodyMetrics', 'recoveryLogs', 'foodLogs', 'settings'].includes(store)) show(); });
  return () => { off(); cleanup?.(); };
}

/* ---------------------------------------------------------------- Muscles */
async function musclesView(el) {
  const workouts = await repo.list('workouts');
  const today = localDateKey();
  const stage = h('div', { class: 'anatomy fill-rest' });
  stage.style.setProperty('--reserve', '250px');
  const labelLayer = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' } });
  const overlay = h('div', { class: 'overlay-card' });
  let viewer = null, showLabels = false, values = {}, used = 0, from = null;

  const compute = () => {
    const r = RANGES.find((x) => x.id === state.range);
    from = r.days ? addDays(today, -(r.days - 1)) : null;
    const res = muscleWorkload(workouts, { mode: state.mode, from, to: today });
    values = res.values; used = res.workoutsUsed;
  };
  const update = () => {
    compute();
    viewer?.setHeat(normalize(values)); viewer?.setGroup(state.group); viewer?.setSelected(state.selected);
    const m = state.selected && MUSCLE_BY_ID[state.selected];
    const lt = m ? lastTrained(workouts)[m.id] : null;
    overlay.replaceChildren(...(m ? [Card({ glass: true },
      h('div', { class: 'row' },
        h('div', { class: 'grow' },
          h('div', { class: 't-headline' }, m.name),
          h('div', { class: 't-footnote c-2' }, `${Math.round(setsPerMuscle(completedWorkouts(workouts).filter((w) => (!from || w.date >= from) && w.date <= today))[m.id] * 10) / 10} est. sets · last ${lt ? formatRelativeDay(lt).toLowerCase() : 'never'}`)),
        Button({ label: 'Details', size: 'small', onClick: () => navigate(`#/muscle?id=${m.id}`) }),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onClick: () => { state.selected = null; update(); } }, icon('close', 16))))]
      : !used ? [h('div', { style: { textAlign: 'center' } }, h('span', { class: 'glass-pill t-footnote' }, 'No training logged in this range'))] : []));
    drawLabels();
  };
  const select = (id) => { state.selected = id; haptic(); update(); };

  function drawLabels() {
    if (!viewer) return;
    const items = [], placed = [];
    if (showLabels) {
      const front = Math.cos(viewer.azimuth) > 0;
      for (const m of MUSCLES) {
        if (m.id === state.selected || (state.group && m.group !== state.group)) continue;
        if (m.view !== 'both' && (m.view === 'front') !== front) continue;
        const p = viewer.screenPos(m.id);
        if (!p?.visible) continue;
        const w = m.short.length * 6.2 + 8;
        if (placed.some((q) => Math.abs(q.x - p.x) < (q.w + w) / 2 && Math.abs(q.y - p.y) < 15)) continue;
        placed.push({ x: p.x, y: p.y, w });
        items.push(h('div', { class: 'anatomy__label anatomy__label--minor', style: { left: `${p.x}px`, top: `${p.y}px` } }, m.short));
      }
    }
    if (state.selected) {
      const p = viewer.screenPos(state.selected);
      if (p) items.push(h('div', { class: 'anatomy__label', style: { left: `${p.x}px`, top: `${p.y}px` } }, MUSCLE_BY_ID[state.selected].short));
    }
    labelLayer.replaceChildren(...items);
  }

  function rankingSheet() {
    compute();
    const mode = MODES.find((x) => x.id === state.mode);
    const ranked = MUSCLES.map((m) => ({ m, v: values[m.id] })).sort((a, b) => b.v - a.v);
    const max = ranked[0]?.v || 1;
    const fmt = (v) => (state.mode === 'historical' ? `${Math.round(weightValue(v, 'imperial', 0)).toLocaleString()}` : (Math.round(v * 10) / 10).toString());
    const sheet = openSheet({ title: `Ranking · ${mode.label}`, content: h('div', { class: 'stack' },
      Card({}, ranked.slice(0, 12).map(({ m, v }) => h('button', { type: 'button', style: { display: 'block', width: '100%', padding: '4px 0' }, onClick: () => { sheet.close(); select(m.id); } },
        HBar({ label: m.short, value: fmt(v), ratio: v / max, color: 'var(--c-heat)' })))),
      h('p', { class: 'section__footer' }, `${mode.describe} Estimated from ${used} workout${used === 1 ? '' : 's'}: primary muscles count 1, secondary 0.5. Not measured activation or growth.`)) });
  }

  const viewSeg = SegmentedControl({ label: 'View', value: 'front', onChange: (v) => (v === 'front' ? viewer?.front() : viewer?.back()), options: [{ value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }] });
  viewSeg.style.width = '140px';
  const labelBtn = h('button', { class: 'icon-btn icon-btn--glass', type: 'button', 'aria-label': 'Labels', onClick: () => { showLabels = !showLabels; labelBtn.style.background = showLabels ? '#fff' : ''; labelBtn.style.color = showLabels ? '#000' : ''; drawLabels(); } }, icon('tag', 18));
  const rankBtn = h('button', { class: 'icon-btn icon-btn--glass', type: 'button', 'aria-label': 'Ranking', onClick: rankingSheet }, icon('list', 18));
  stage.append(labelLayer, h('div', { class: 'anatomy__controls' }, viewSeg, h('div', { class: 'row', style: { gap: '8px' } }, rankBtn, labelBtn)),
    h('div', { class: 'anatomy__legend', style: { bottom: '6px' } }, h('span', {}, 'Low'), h('div', { class: 'heat-scale' }), h('span', {}, 'High'), Provenance('estimated')), overlay);

  const rangeChips = h('div', { class: 'chips', style: { flexWrap: 'nowrap' } }, RANGES.map((r) => h('button', { class: 'chip', type: 'button', style: { flex: 1, padding: 0 }, 'aria-pressed': String(state.range === r.id),
    onClick: (e) => { state.range = r.id; rangeChips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); update(); } }, r.label)));
  el.append(stage,
    SegmentedControl({ label: 'Mode', value: state.mode, onChange: (v) => { state.mode = v; update(); }, options: MODES.map((m) => ({ value: m.id, label: m.label })) }),
    rangeChips);

  try {
    const { createAnatomyViewer } = await import('./anatomy-viewer.js');
    viewer = await createAnatomyViewer(stage, { onSelect: select });
    stage.insertBefore(stage.querySelector('canvas'), labelLayer);
    viewer.onFrame(drawLabels);
  } catch (e) {
    console.warn('[anatomy] 3D unavailable', e);
    stage.append(h('div', { class: 'anatomy__fallback' }, h('div', {}, h('div', { class: 't-headline' }, '3D view unavailable'), h('p', { class: 't-subhead' }, 'This device couldn’t start WebGL. Use the ranking list.'))));
  }
  update();
  return () => viewer?.dispose();
}

/* ------------------------------------------------------------------- Body */
async function bodyView(el) {
  const [settings, metrics] = await Promise.all([repo.getSettings(), repo.list('bodyMetrics')]);
  const u = settings.units;
  const sorted = metrics.sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.filter((m) => m.weightKg != null);
  const latest = (k) => [...sorted].reverse().find((m) => m[k] != null);
  const first = (k) => sorted.find((m) => m[k] != null);
  const change = weights.length >= 2 ? weightValue(weights.at(-1).weightKg, u) - weightValue(weights[0].weightKg, u) : null;
  el.append(
    Card({ badge: Provenance('recorded'), label: 'Weight', iconName: 'ruler' },
      ...(weights.length
        ? [h('div', { class: 'row row--between', style: { alignItems: 'baseline' } },
            h('div', { class: 'stat__value' }, String(weightValue(weights.at(-1).weightKg, u)), h('span', { class: 'stat__unit' }, weightUnit(u))),
            h('div', { class: 't-footnote c-2 num' }, change != null ? `${change >= 0 ? '+' : ''}${Math.round(change * 10) / 10} ${weightUnit(u)} since ${parseDateKey(weights[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : formatRelativeDay(weights.at(-1).date))),
          weights.length >= 2 ? LineChart({ points: weights.slice(-30).map((m) => ({ label: parseDateKey(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: weightValue(m.weightKg, u) })), height: 110 }) : null]
        : [EmptyState({ inline: true, title: 'No weigh-ins yet', body: 'Log your weight to see the trend.' })])),
    h('div', { class: 'tiles' }, MEASUREMENTS.map((k) => {
      const l = latest(k), f = first(k);
      const d = l && f && l !== f ? l[k] - f[k] : null;
      return h('button', { class: 'tile', type: 'button', style: { textAlign: 'left' }, onClick: () => navigate('#/measurements') },
        h('div', { class: 'tile__value' }, l ? lengthString(l[k], u) : '—'), h('div', { class: 'tile__label' }, MEASURE_LABELS[k]),
        h('div', { class: `tile__delta ${d == null ? 'flat' : d > 0 ? 'up' : 'down'}` }, d == null ? ' ' : `${d > 0 ? '+' : ''}${lengthString(d, u)}`));
    })),
    h('div', { class: 'btn-row' },
      Button({ label: 'Log', iconName: 'plus', variant: 'primary', onClick: () => openLogWeightSheet(settings) }),
      Button({ label: 'All Entries', iconName: 'list', onClick: () => navigate('#/measurements') })));
}

/* --------------------------------------------------------------- Recovery */
async function recoveryView(el) {
  const today = localDateKey();
  const keys = lastNDays(7, today);
  const [logs, check] = await Promise.all([repo.listByDate('recoveryLogs', keys[0], today), todaysCheckin(today)]);
  const r = readiness(check);
  const avg = (k) => { const v = logs.filter((x) => x[k] != null).map((x) => x[k]); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const f1 = (v) => (v == null ? '—' : (Math.round(v * 10) / 10).toString());
  el.append(
    Card({ badge: Provenance('estimated') },
      h('div', { class: 'row', style: { gap: '16px' } },
        ProgressRing({ progress: r == null ? null : r / 100, size: 80, stroke: 10, color: r == null ? '#fff' : r >= 75 ? '#30d158' : r >= 50 ? '#ffd60a' : '#ff9f0a', center: h('div', { class: 'rounded t-headline num' }, r == null ? '—' : String(r)) }),
        h('div', { class: 'grow' }, h('div', { class: 't-headline' }, r == null ? 'No check-in today' : 'Readiness · self-reported'), h('div', { class: 't-footnote c-2' }, r == null ? 'Two taps tell Cratos how recovered you are.' : readinessAdvice(r))))),
    Card({ label: 'Sleep · 7 days', iconName: 'bed', badge: Provenance('recorded') },
      BarChart({ bars: keys.map((d) => { const x = logs.find((l) => l.date === d); return { label: weekdayInitial(d), value: x?.sleepHours ?? null, highlight: d === today }; }), goal: 8, height: 72, formatMax: (v) => `${v} h` })),
    h('div', { class: 'tiles' },
      h('div', { class: 'tile' }, h('div', { class: 'tile__value' }, `${f1(avg('sleepHours'))} h`), h('div', { class: 'tile__label' }, 'avg sleep')),
      h('div', { class: 'tile' }, h('div', { class: 'tile__value' }, `${f1(avg('soreness'))}/5`), h('div', { class: 'tile__label' }, 'avg soreness')),
      h('div', { class: 'tile' }, h('div', { class: 'tile__value' }, `${f1(avg('energy'))}/5`), h('div', { class: 'tile__label' }, 'avg energy'))),
    Button({ label: check ? 'Edit Today’s Check-in' : 'Check In', variant: 'primary', block: true, iconName: 'heart', onClick: openCheckin }));
}

/* ----------------------------------------------------------------- Trends */
let trend = 'volume';
async function trendsView(el) {
  const today = localDateKey();
  const [settings, workouts, foodLogs, bodyMetrics, recoveryLogs] = await Promise.all([repo.getSettings(), repo.list('workouts'), repo.listByDate('foodLogs', addDays(today, -55), today), repo.list('bodyMetrics'), repo.listByDate('recoveryLogs', addDays(today, -55), today)]);
  const u = settings.units;
  const cmp = weekComparison({ workouts, foodLogs, bodyMetrics, recoveryLogs }, { this: [addDays(today, -6), today], last: [addDays(today, -13), addDays(today, -7)] });
  const tile = (label, c, fmt, goodUp = true) => {
    const d = c.delta;
    const cls = d == null || Math.abs(d) < 1e-9 ? 'flat' : (d > 0) === goodUp ? 'up' : 'down';
    return h('div', { class: 'tile' }, h('div', { class: 'tile__value' }, c.cur == null ? '—' : fmt(c.cur)), h('div', { class: 'tile__label' }, label),
      h('div', { class: `tile__delta ${cls}` }, d == null ? 'no prior data' : `${d > 0 ? '▲' : d < 0 ? '▼' : '•'} ${fmt(Math.abs(d))}${c.pct != null ? ` (${Math.round(Math.abs(c.pct) * 100)}%)` : ''}`));
  };
  const lb = (v) => Math.round(weightValue(v, u, 0)).toLocaleString();
  const chart = h('div', {});
  const draw = () => {
    if (trend === 'volume') {
      const dow = (new Date().getDay() + 6) % 7, ws = addDays(today, -dow);
      const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws, -7 * (7 - i)));
      const t = weeklyTotals(workouts, weeks, addDays);
      chart.replaceChildren(BarChart({ bars: t.map((x, i) => ({ label: i === 7 ? 'Now' : parseDateKey(x.weekStart).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }), value: x.sessions ? weightValue(x.volume, u, 0) : null, highlight: i === 7 })), height: 84, formatMax: (v) => `${Math.round(v).toLocaleString()} ${weightUnit(u)}` }));
    } else if (trend === 'calories') {
      const keys = lastNDays(14, today);
      const days = dailySummaries(foodLogs, keys);
      chart.replaceChildren(BarChart({ bars: days.map((d) => ({ label: weekdayInitial(d.date), value: d.logged ? Math.round(d.totals.kcal) : null, highlight: d.date === today })), height: 84, formatMax: (v) => `${v} kcal` }));
    } else {
      const w = bodyMetrics.filter((m) => m.weightKg != null).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
      chart.replaceChildren(w.length >= 2 ? LineChart({ points: w.map((m) => ({ label: parseDateKey(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: weightValue(m.weightKg, u) })), height: 84 }) : EmptyState({ inline: true, title: 'Log at least two weigh-ins' }));
    }
  };
  el.append(
    h('div', { class: 't-footnote c-2', style: { padding: '0 4px' } }, 'Last 7 days vs the 7 before'),
    h('div', { class: 'tiles' },
      tile('sessions', cmp.sessions, (v) => String(Math.round(v))),
      tile(`${weightUnit(u)} volume`, cmp.volume, lb),
      tile('sets', cmp.sets, (v) => String(Math.round(v)))),
    h('div', { class: 'tiles' },
      tile('avg kcal', cmp.kcal, (v) => String(Math.round(v))),
      tile('avg protein', cmp.protein, (v) => `${Math.round(v)} g`),
      tile('avg sleep', cmp.sleep, (v) => `${Math.round(v * 10) / 10} h`)),
    Card({ badge: Provenance('recorded') },
      SegmentedControl({ label: 'Chart', value: trend, onChange: (v) => { trend = v; draw(); }, options: [{ value: 'volume', label: 'Volume' }, { value: 'calories', label: 'Calories' }, { value: 'weight', label: 'Weight' }] }),
      h('div', { style: { marginTop: '12px' } }, chart)));
  draw();
}
