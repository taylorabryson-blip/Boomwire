/**
 * Progress — Muscles (3D heat map) · Body (weight & measurements) · Stats.
 * One tab instead of three so Home stays clean.
 */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { NavHeader, Section, Card, List, ListRow, Stat, Provenance, SegmentedControl, Button, EmptyState, HBar } from '../../components/primitives.js';
import { BarChart } from '../../components/bar-chart.js';
import { LineChart } from '../../components/line-chart.js';
import { haptic } from '../../components/haptics.js';
import * as repo from '../../services/storage/repository.js';
import { MUSCLES, MUSCLE_BY_ID, GROUPS } from '../../data/anatomy/muscles.js';
import { EXERCISES, contribution } from '../../data/exercises/exercises.js';
import { MODES, RANGES, muscleWorkload, normalize, lastTrained } from '../../engines/anatomy/workload.js';
import { setsPerMuscle, setsPerGroup, weeklyTotals, completedWorkouts } from '../../engines/training/metrics.js';
import { dailyTotals, loggedDayAverage } from '../../engines/calculations/hydration.js';
import { localDateKey, addDays, lastNDays, weekdayInitial, formatRelativeDay, parseDateKey } from '../../utils/dates.js';
import { weightValue, weightUnit, volumeString, lengthString, formatVolume } from '../../utils/units.js';
import { MEASUREMENTS } from '../../data/models.js';
import { openLogWeightSheet, MEASURE_LABELS } from './measurements.js';

let seg = 'muscles';
const state = { mode: 'recent', range: '7d', group: null, selected: null };

export async function mount(root) {
  const content = h('div', {});
  let cleanup = null;
  const show = async () => {
    cleanup?.(); cleanup = null;
    content.replaceChildren();
    cleanup = seg === 'muscles' ? await musclesView(content) : seg === 'body' ? await bodyView(content) : await statsView(content);
  };
  root.append(
    NavHeader({ title: 'Progress' }),
    SegmentedControl({ label: 'Section', value: seg, onChange: (v) => { seg = v; show(); },
      options: [{ value: 'muscles', label: 'Muscles' }, { value: 'body', label: 'Body' }, { value: 'stats', label: 'Stats' }] }),
    h('div', { style: { marginTop: '8px' } }, content));
  await show();
  const off = repo.onChange(({ store }) => { if (seg !== 'muscles' && ['workouts', 'bodyMetrics', 'hydrationLogs', 'settings'].includes(store)) show(); });
  return () => { off(); cleanup?.(); };
}

/* ---------------------------------------------------------------- Muscles */
async function musclesView(el) {
  const workouts = await repo.list('workouts');
  const today = localDateKey();
  const stage = h('div', { class: 'anatomy' });
  const labelLayer = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' } });
  const panel = h('div', {});
  const legend = h('div', { class: 'anatomy__legend' });
  let viewer = null, showLabels = false;

  const compute = () => {
    const r = RANGES.find((x) => x.id === state.range);
    const from = r.days ? addDays(today, -(r.days - 1)) : null;
    return { ...muscleWorkload(workouts, { mode: state.mode, from, to: today }), from };
  };

  function updatePanel() {
    const { values, workoutsUsed, from } = compute();
    const norm = normalize(values);
    viewer?.setHeat(norm);
    viewer?.setGroup(state.group);
    viewer?.setSelected(state.selected);
    const mode = MODES.find((m) => m.id === state.mode);
    legend.replaceChildren(h('span', {}, 'Low'), h('div', { class: 'heat-scale' }), h('span', {}, 'High'), Provenance('estimated'));
    const fmt = (v) => (state.mode === 'historical' ? `${Math.round(weightValue(v, 'imperial', 0))}` : (Math.round(v * 10) / 10).toString());
    const ranked = MUSCLES.filter((m) => !state.group || m.group === state.group).map((m) => ({ m, v: values[m.id] })).sort((a, b) => b.v - a.v);
    const max = ranked[0]?.v || 1;
    const sel = state.selected ? MUSCLE_BY_ID[state.selected] : null;
    panel.replaceChildren(...[
      sel ? muscleDetail(sel, workouts, values, from, today) : null,
      Section({ title: sel ? null : 'Ranking', footer: `${mode.describe} ${state.mode === 'historical' ? 'Shown in lb. ' : ''}Estimated from ${workoutsUsed} logged workout${workoutsUsed === 1 ? '' : 's'}: primary muscles count 1, secondary 0.5. Not measured muscle activation or growth.` },
        workoutsUsed
          ? Card({}, ranked.slice(0, 8).map(({ m, v }) => h('button', { type: 'button', style: { display: 'block', width: '100%' }, onClick: () => select(m.id) },
            HBar({ label: m.short, value: fmt(v), ratio: v / max, color: 'var(--c-heat)' }))))
          : Card({}, EmptyState({ inline: true, title: 'No training in this range', body: 'Log workouts in Train and your muscles light up here.' }))),
    ].filter(Boolean));
    drawLabels();
  }

  function select(id) { state.selected = id; haptic(); updatePanel(); }

  function drawLabels() {
    if (!viewer) return;
    const items = [];
    if (state.selected) {
      const p = viewer.screenPos(state.selected);
      if (p) items.push(h('div', { class: 'anatomy__label', style: { left: `${p.x}px`, top: `${p.y}px` } }, MUSCLE_BY_ID[state.selected].name));
    }
    if (showLabels) {
      const az = viewer.azimuth, front = Math.cos(az) > 0;
      const placed = [];
      for (const m of MUSCLES) {
        if (m.id === state.selected || (state.group && m.group !== state.group)) continue;
        if (m.view !== 'both' && (m.view === 'front') !== front) continue;
        const p = viewer.screenPos(m.id);
        if (!p?.visible) continue;
        // Skip labels that would collide with one already placed (≈ label box size).
        const w = m.short.length * 6.2 + 8;
        if (placed.some((q) => Math.abs(q.x - p.x) < (q.w + w) / 2 && Math.abs(q.y - p.y) < 15)) continue;
        placed.push({ x: p.x, y: p.y, w });
        items.push(h('div', { class: 'anatomy__label anatomy__label--minor', style: { left: `${p.x}px`, top: `${p.y}px` } }, m.short));
      }
    }
    labelLayer.replaceChildren(...items);
  }

  const viewSeg = SegmentedControl({ label: 'View', value: 'front', onChange: (v) => (v === 'front' ? viewer?.front() : viewer?.back()), options: [{ value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }] });
  viewSeg.style.width = '150px';
  const labelBtn = h('button', { class: 'icon-btn icon-btn--glass', type: 'button', 'aria-label': 'Toggle labels', onClick: () => { showLabels = !showLabels; labelBtn.style.background = showLabels ? '#fff' : ''; labelBtn.style.color = showLabels ? '#000' : ''; haptic(); drawLabels(); } }, icon('tag', 18));
  stage.append(labelLayer, h('div', { class: 'anatomy__controls' }, viewSeg, labelBtn), legend);

  el.append(
    stage,
    h('div', { style: { marginTop: '12px' } }, SegmentedControl({ label: 'Mode', value: state.mode, onChange: (v) => { state.mode = v; updatePanel(); }, options: MODES.map((m) => ({ value: m.id, label: m.label })) })),
    h('div', { class: 'chips', style: { marginTop: '10px', justifyContent: 'space-between' } },
      RANGES.map((r) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.range === r.id), style: { flex: '1', padding: 0 },
        onClick: (e) => { state.range = r.id; e.currentTarget.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); haptic(); updatePanel(); } }, r.label))),
    h('div', { class: 'chips chips--scroll', style: { marginTop: '10px' } },
      [{ id: null, label: 'All muscles' }, ...GROUPS].map((g) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.group === g.id),
        onClick: (e) => { state.group = g.id; state.selected = null; e.currentTarget.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); haptic(); updatePanel(); } }, g.label))),
    panel);

  try {
    const { createAnatomyViewer } = await import('./anatomy-viewer.js');
    viewer = await createAnatomyViewer(stage, { onSelect: (id) => select(id) });
    stage.insertBefore(viewer && stage.querySelector('canvas'), labelLayer);
    viewer.onFrame(() => drawLabels());
  } catch (e) {
    console.warn('[anatomy] 3D unavailable', e);
    stage.append(h('div', { class: 'anatomy__fallback' }, h('div', {}, h('div', { class: 't-headline' }, '3D view unavailable'), h('p', { class: 't-subhead' }, 'This device couldn’t start WebGL. The ranking below still works.'))));
  }
  updatePanel();
  return () => viewer?.dispose();
}

function muscleDetail(m, workouts, values, from, today) {
  const inRange = completedWorkouts(workouts).filter((w) => (!from || w.date >= from) && w.date <= today);
  const sets = setsPerMuscle(inRange)[m.id];
  const last = lastTrained(workouts)[m.id];
  const top = EXERCISES.filter((e) => contribution(e, m.id) === 1).slice(0, 4);
  const used = new Map();
  for (const w of inRange) for (const ex of w.exercises) {
    const def = EXERCISES.find((e) => e.id === ex.exerciseId);
    if (def && contribution(def, m.id) > 0) used.set(def.name, (used.get(def.name) ?? 0) + ex.sets.filter((s) => s.completed).length);
  }
  return Section({ title: m.name },
    h('div', { class: 'grid-2' },
      Card({ badge: Provenance('estimated') }, Stat({ value: String(Math.round(sets * 10) / 10), label: 'est. sets in range' })),
      Card({ badge: Provenance('recorded') }, Stat({ value: last ? formatRelativeDay(last) : '—', label: 'last trained' }))),
    used.size ? Card({ label: 'Logged exercises' }, [...used].map(([n, c]) => h('div', { class: 'row row--between t-subhead', style: { padding: '4px 0' } }, h('span', {}, n), h('span', { class: 'c-2 num' }, `${c} sets`)))) : null,
    List(...top.map((e) => ListRow({ title: e.name, subtitle: 'Primary target', href: `#/exercise?id=${e.id}` }))));
}

/* ------------------------------------------------------------------- Body */
async function bodyView(el) {
  const [settings, profile, metrics] = await Promise.all([repo.getSettings(), repo.getProfile(), repo.list('bodyMetrics')]);
  const u = settings.units;
  const sorted = metrics.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const weights = sorted.filter((m) => m.weightKg != null);
  const latest = Object.fromEntries(MEASUREMENTS.map((k) => [k, [...sorted].reverse().find((m) => m[k] != null)]));
  const first = Object.fromEntries(MEASUREMENTS.map((k) => [k, sorted.find((m) => m[k] != null)]));
  const change = weights.length >= 2 ? weightValue(weights.at(-1).weightKg, u) - weightValue(weights[0].weightKg, u) : null;

  el.append(
    Section({ first: true, title: 'Weight', action: Provenance('recorded') },
      Card({},
        weights.length
          ? [h('div', { class: 'row row--between', style: { alignItems: 'flex-end', marginBottom: '10px' } },
              Stat({ value: String(weightValue(weights.at(-1).weightKg, u)), unit: weightUnit(u), label: formatRelativeDay(weights.at(-1).date) }),
              change != null && h('div', { class: 't-subhead c-2 num' }, `${change >= 0 ? '+' : ''}${Math.round(change * 10) / 10} ${weightUnit(u)} since ${parseDateKey(weights[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)),
            weights.length >= 2 && LineChart({ points: weights.slice(-30).map((m) => ({ label: parseDateKey(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: weightValue(m.weightKg, u) })), format: (v) => `${v}` })]
          : EmptyState({ inline: true, title: 'No weigh-ins yet', body: 'Log your weight to see the trend. Hercules never predicts or invents values.' }),
        h('div', { style: { marginTop: '12px' } }, Button({ label: 'Log Weight & Measurements', iconName: 'plus', block: true, variant: 'primary', onClick: () => openLogWeightSheet(settings) })))),
    Section({ title: 'Measurements', action: Provenance('recorded'), footer: 'Change compares your first and latest entry for each measurement.' },
      List(...MEASUREMENTS.map((k) => {
        const l = latest[k], f = first[k];
        const diff = l && f && l !== f ? `${l[k] - f[k] >= 0 ? '+' : ''}${lengthString(l[k] - f[k], u)}` : null;
        return ListRow({ title: MEASURE_LABELS[k], subtitle: diff ? `${diff} since first` : l ? formatRelativeDay(l.date) : 'Not logged', value: l ? lengthString(l[k], u) : '—', href: '#/measurements' });
      }))),
    Section({}, List(
      ListRow({ iconName: 'user', title: 'Profile & training style', subtitle: profile.style ? 'Gear, goals and preferences' : 'Set your gear, goals and style', href: '#/profile' }),
      ListRow({ iconName: 'list', title: 'All entries', href: '#/measurements' }))),
  );
}

/* ------------------------------------------------------------------ Stats */
async function statsView(el) {
  const today = localDateKey();
  const [settings, workouts, water] = await Promise.all([repo.getSettings(), repo.list('workouts'), repo.listByDate('hydrationLogs', addDays(today, -6), today)]);
  const u = settings.units;
  const dow = (new Date().getDay() + 6) % 7;
  const thisWeek = addDays(today, -dow);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i)));
  const totals = weeklyTotals(workouts, weeks, addDays);
  const recent = completedWorkouts(workouts).filter((w) => w.date >= addDays(today, -6));
  const groups = setsPerGroup(recent);
  const gMax = Math.max(1, ...Object.values(groups));
  const keys = lastNDays(7, today);
  const wt = dailyTotals(water, keys);
  const avg = loggedDayAverage(wt);
  const avgV = formatVolume(avg, u);

  el.append(
    Section({ first: true, title: 'Weekly Volume', action: Provenance('recorded'), footer: 'Volume load = weight × reps of completed sets. It measures work done, not muscle growth.' },
      Card({}, totals.some((t) => t.sessions)
        ? BarChart({ bars: totals.map((t, i) => ({ label: i === 7 ? 'Now' : parseDateKey(t.weekStart).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }), value: t.sessions ? weightValue(t.volume, u, 0) : null, highlight: i === 7 })), formatMax: (v) => `${Math.round(v).toLocaleString()} ${weightUnit(u)}` })
        : EmptyState({ inline: true, title: 'No workouts yet', body: 'Weekly volume appears after your first logged session.' }))),
    Section({ title: 'Sets by Muscle Group', action: Provenance('estimated'), footer: 'Last 7 days. A set counts 1 for a group if it is a primary target, 0.5 if secondary.' },
      Card({}, GROUPS.map((g) => HBar({ label: g.label, value: String(Math.round(groups[g.id] * 10) / 10), ratio: groups[g.id] / gMax })))),
    Section({ title: 'Water', action: Provenance('recorded'), footer: 'Average across logged days only. Days without entries are not counted as zero.' },
      Card({},
        h('div', { class: 'row row--between', style: { marginBottom: '10px' } }, Stat({ value: avgV.value, unit: avgV.unit, label: 'daily average' }), h('div', { class: 't-subhead c-2' }, `${wt.filter((t) => t.logged).length}/7 days logged`)),
        BarChart({ bars: wt.map((t) => ({ label: weekdayInitial(t.date), value: t.logged ? t.totalMl : null, highlight: t.date === today })), goal: settings.hydrationGoalMl, formatMax: (v) => volumeString(v, u) }))),
  );
}
