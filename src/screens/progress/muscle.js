/** Muscle detail: estimated workload, last trained, logged exercises, best exercises for it. */
import { h } from '../../components/dom.js';
import { NavHeader, Card, List, ListRow, Provenance, EmptyState } from '../../components/primitives.js';
import * as repo from '../../services/storage/repository.js';
import { MUSCLE_BY_ID } from '../../data/anatomy/muscles.js';
import { EXERCISES, contribution } from '../../data/exercises/exercises.js';
import { canDo } from '../../data/exercises/gear.js';
import { setsPerMuscle, completedWorkouts } from '../../engines/training/metrics.js';
import { lastTrained } from '../../engines/anatomy/workload.js';
import { localDateKey, addDays, formatRelativeDay } from '../../utils/dates.js';

export async function mount(root, { params }) {
  const m = MUSCLE_BY_ID[params.get('id')];
  if (!m) { root.append(NavHeader({ title: 'Muscle', back: { href: '#/progress', label: 'Progress' } }), Card({}, EmptyState({ title: 'Not found' }))); return; }
  const [workouts, profile] = await Promise.all([repo.list('workouts'), repo.getProfile()]);
  const today = localDateKey();
  const w7 = completedWorkouts(workouts).filter((w) => w.date >= addDays(today, -6));
  const w30 = completedWorkouts(workouts).filter((w) => w.date >= addDays(today, -29));
  const last = lastTrained(workouts)[m.id];
  const used = new Map();
  for (const w of w30) for (const ex of w.exercises) {
    const def = EXERCISES.find((e) => e.id === ex.exerciseId);
    if (def && contribution(def, m.id) > 0) used.set(def.id, (used.get(def.id) ?? 0) + ex.sets.filter((s) => s.completed).length);
  }
  const best = EXERCISES.filter((e) => contribution(e, m.id) === 1 && canDo(e.id, profile.gear)).slice(0, 4);
  const tile = (label, value, badge) => h('div', { class: 'tile' }, h('div', { class: 'tile__value' }, value), h('div', { class: 'tile__label' }, label), badge);
  root.append(
    NavHeader({ title: m.name, eyebrow: m.group, back: { href: '#/progress', label: 'Progress' } }),
    h('div', { class: 'tiles' },
      tile('est. sets · 7d', String(Math.round(setsPerMuscle(w7)[m.id] * 10) / 10)),
      tile('est. sets · 30d', String(Math.round(setsPerMuscle(w30)[m.id] * 10) / 10)),
      tile('last trained', last ? formatRelativeDay(last) : 'never')),
    h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, Provenance('estimated')),
    used.size ? List(...[...used].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ListRow({ title: EXERCISES.find((e) => e.id === id).name, value: `${n} sets · 30d`, href: `#/exercise?id=${id}` }))) : null,
    List(...best.map((e) => ListRow({ title: e.name, value: 'Primary', href: `#/exercise?id=${e.id}` }))),
  );
  [...root.childNodes].forEach((n) => { if (n.nodeType === 3) n.remove(); });
}
