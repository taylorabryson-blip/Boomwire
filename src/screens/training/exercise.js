/** Exercise detail: how-to, muscles, PRs, estimated 1RM trend, history. */
import { equipmentNeeded } from '../../data/exercises/gear.js';
import { h } from '../../components/dom.js';
import { NavHeader, Card, List, ListRow, Provenance, EmptyState, Button } from '../../components/primitives.js';
import { openSheet } from '../../components/overlays.js';
import { LineChart } from '../../components/line-chart.js';
import * as repo from '../../services/storage/repository.js';
import { startWorkout } from '../../services/training.js';
import { navigate } from '../../navigation/nav.js';
import { EXERCISE_BY_ID, EQUIPMENT_LABELS, PATTERN_LABELS } from '../../data/exercises/exercises.js';
import { MUSCLE_BY_ID } from '../../data/anatomy/muscles.js';
import { exerciseHistory, personalRecords, e1rmTrend } from '../../engines/training/metrics.js';
import { weightString, weightValue } from '../../utils/units.js';
import { formatRelativeDay, parseDateKey } from '../../utils/dates.js';
import { liveScreen } from '../shared/live.js';

export function mount(root, { params }) {
  const def = EXERCISE_BY_ID[params.get('id')];
  return liveScreen(root, async () => {
    if (!def) return [NavHeader({ title: 'Exercise', back: { href: '#/train', label: 'Train' } }), Card({}, EmptyState({ title: 'Exercise not found' }))];
    const [settings, workouts] = await Promise.all([repo.getSettings(), repo.list('workouts')]);
    const u = settings.units;
    const hist = exerciseHistory(workouts, def.id);
    const pr = personalRecords(workouts, def.id);
    const trend = e1rmTrend(workouts, def.id);
    const pts = hist.filter((x) => x.bestE1rm != null).map((x) => ({ label: parseDateKey(x.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: weightValue(x.bestE1rm, u) }));
    const muscleChips = (ids, primary) => ids.map((m) => h('a', { class: 'chip', href: `#/muscle?id=${m}`, style: { display: 'inline-flex', alignItems: 'center', opacity: primary ? 1 : 0.7 } }, MUSCLE_BY_ID[m]?.name ?? m));
    const tile = (label, value) => h('div', { class: 'tile' }, h('div', { class: 'tile__value' }, value), h('div', { class: 'tile__label' }, label));
    const wu = u === 'metric' ? 'kg' : 'lb';
    const variations = def.variations.filter((v) => EXERCISE_BY_ID[v]);

    const howTo = () => openSheet({ title: def.name, content: List(...def.instructions.map((step, i) => h('div', { class: 'list-row' }, h('span', { class: 'list-row__icon rounded', style: { fontWeight: 700 } }, String(i + 1)), h('div', { class: 'list-row__main t-subhead' }, step)))) });
    const history = () => openSheet({ title: 'History', content: h('div', { class: 'stack' },
      pts.length >= 2 && Card({ badge: Provenance('estimated') },
        trend && h('div', { class: 't-subhead c-2', style: { marginBottom: '8px' } }, `Est. 1RM ${trend.change >= 0 ? '+' : ''}${weightString(trend.change, u)} (${Math.round(trend.pct * 100)}%) over ${trend.sessions} sessions`),
        LineChart({ points: pts, format: (v) => `${v}` })),
      List(...[...hist].reverse().slice(0, 30).map((x) => ListRow({
        title: formatRelativeDay(x.date),
        subtitle: x.sets.map((s) => (def.metric === 'time' ? `${s.durationSec ?? 0}s` : `${s.weightKg != null ? weightValue(s.weightKg, u) : 'BW'}×${s.reps ?? 0}`)).join('  '),
        href: `#/workout?id=${x.workoutId}`,
      })))) });
    const variationSheet = () => { const { close } = openSheet({ title: 'Variations', content: List(...variations.map((v) => ListRow({ title: EXERCISE_BY_ID[v].name, onClick: () => { close(); navigate(`#/exercise?id=${v}`); } }))) }); };

    return [
      NavHeader({ title: def.name, back: { href: '#/train', label: 'Back' }, eyebrow: `${PATTERN_LABELS[def.pattern] ?? def.pattern} · ${EQUIPMENT_LABELS[def.equipment] ?? def.equipment} · ${def.difficulty}` }),
      h('div', { class: 'chips chips--scroll' }, muscleChips(def.primary, true), muscleChips(def.secondary, false)),
      h('div', { class: 'tiles' },
        tile(def.metric === 'time' ? 'longest hold' : `heaviest · ${wu}`, def.metric === 'time' ? (pr?.longestHold ? `${pr.longestHold.value}s` : '—') : (pr?.heaviest ? String(weightValue(pr.heaviest.value, u)) : '—')),
        tile(def.metric === 'time' ? 'sessions' : 'est. 1RM', def.metric === 'time' ? String(pr?.sessions ?? 0) : (pr?.bestE1rm ? String(weightValue(pr.bestE1rm.value, u, 0)) : '—')),
        tile('most reps', def.metric === 'time' ? '—' : String(pr?.mostReps?.value ?? '—'))),
      List(
        ListRow({ iconName: 'training', title: 'Equipment', subtitle: equipmentNeeded(def.id, { short: true }), onClick: () => openSheet({ title: 'Equipment', content: h('p', { class: 't-subhead', style: { margin: 0, lineHeight: 1.45 } }, equipmentNeeded(def.id)) }) }),
        ListRow({ iconName: 'list', title: 'How to Perform', value: `${def.instructions.length} steps`, onClick: howTo }),
        ListRow({ iconName: 'clock', title: 'History', value: hist.length ? `${hist.length} sessions` : 'None yet', onClick: hist.length ? history : null }),
        variations.length > 0 && ListRow({ iconName: 'rotate', title: 'Variations', value: String(variations.length), onClick: variationSheet })),
      Button({ label: 'Start Workout With This', variant: 'primary', block: true, iconName: 'play', onClick: async () => {
        const w = await startWorkout({ name: def.name, exercises: [{ exerciseId: def.id, sets: 3, reps: def.metric === 'time' ? null : 10, durationSec: def.metric === 'time' ? 30 : null }] });
        navigate(`#/workout?id=${w.id}`);
      } }),
    ];
  });
}
