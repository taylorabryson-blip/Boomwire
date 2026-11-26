/** Exercise detail: how-to, muscles, PRs, estimated 1RM trend, history. */
import { h } from '../../components/dom.js';
import { NavHeader, Section, Card, List, ListRow, Stat, Provenance, EmptyState, Button } from '../../components/primitives.js';
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
    const muscleChips = (ids, primary) => ids.map((m) => h('span', { class: 'chip', style: { display: 'inline-flex', alignItems: 'center', opacity: primary ? 1 : 0.7 } }, MUSCLE_BY_ID[m]?.name ?? m));

    return [
      NavHeader({ title: def.name, back: { href: '#/train', label: 'Back' }, eyebrow: `${PATTERN_LABELS[def.pattern] ?? def.pattern} · ${EQUIPMENT_LABELS[def.equipment] ?? def.equipment} · ${def.difficulty}` }),
      Section({ first: true, title: 'Muscles', footer: 'Primary muscles are credited fully and secondary muscles half in Hercules’ workload estimates.' },
        h('div', { class: 'chips' }, muscleChips(def.primary, true)),
        def.secondary.length ? h('div', { class: 'chips', style: { marginTop: '8px' } }, muscleChips(def.secondary, false)) : null),
      Section({ title: 'How To' },
        List(...def.instructions.map((step, i) => h('div', { class: 'list-row' }, h('span', { class: 'list-row__icon rounded', style: { fontWeight: 700 } }, String(i + 1)), h('div', { class: 'list-row__main t-subhead' }, step))))),
      Section({ title: 'Records', action: Provenance('recorded') },
        pr ? h('div', { class: 'grid-2' },
          Card({}, Stat({ value: pr.heaviest ? String(weightValue(pr.heaviest.value, u)) : '—', unit: pr.heaviest ? (u === 'metric' ? 'kg' : 'lb') : '', label: 'heaviest set' })),
          Card({}, Stat({ value: def.metric === 'time' ? `${pr.longestHold?.value ?? 0}s` : String(pr.mostReps?.value ?? 0), label: def.metric === 'time' ? 'longest hold' : 'most reps' })),
          Card({}, Stat({ value: String(pr.sessions), label: 'sessions' })),
          Card({ badge: Provenance('estimated') }, Stat({ value: pr.bestE1rm ? String(weightValue(pr.bestE1rm.value, u, 0)) : '—', label: 'best est. 1RM' })))
          : Card({}, EmptyState({ inline: true, title: 'No sets logged yet', body: 'Log this exercise to start tracking records.' }))),
      pts.length >= 2 && Section({ title: 'Estimated 1RM', action: Provenance('estimated'), footer: 'Epley formula: weight × (1 + reps ÷ 30), from your best set each session (1–12 reps). An estimate, not a tested max.' },
        Card({},
          trend && h('div', { class: 't-subhead c-2', style: { marginBottom: '8px' } }, `${trend.change >= 0 ? '+' : ''}${weightString(trend.change, u)} (${Math.round(trend.pct * 100)}%) over ${trend.sessions} sessions`),
          LineChart({ points: pts, format: (v) => `${v}` }))),
      hist.length > 0 && Section({ title: 'History' },
        List(...[...hist].reverse().slice(0, 20).map((x) => ListRow({
          title: formatRelativeDay(x.date),
          subtitle: x.sets.map((s) => (def.metric === 'time' ? `${s.durationSec ?? 0}s` : `${s.weightKg != null ? weightValue(s.weightKg, u) : 'BW'}×${s.reps ?? 0}`)).join('  '),
          href: `#/workout?id=${x.workoutId}`,
        })))),
      def.variations.length > 0 && Section({ title: 'Variations' },
        List(...def.variations.filter((v) => EXERCISE_BY_ID[v]).map((v) => ListRow({ title: EXERCISE_BY_ID[v].name, href: `#/exercise?id=${v}` })))),
      Section({}, Button({ label: 'Start Workout With This', variant: 'primary', block: true, iconName: 'play', onClick: async () => {
        const w = await startWorkout({ name: def.name, exercises: [{ exerciseId: def.id, sets: 3, reps: def.metric === 'time' ? null : 10, durationSec: def.metric === 'time' ? 30 : null }] });
        navigate(`#/workout?id=${w.id}`);
      } })),
    ];
  });
}
