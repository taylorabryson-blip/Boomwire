/** Train drill-downs: History, Library (exercise database), Templates. */
import { h } from '../../components/dom.js';
import { NavHeader, List, ListRow, Card, EmptyState, Search, Button, SegmentedControl } from '../../components/primitives.js';
import { openSheet, confirmSheet, toast } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { EXERCISES } from '../../data/exercises/exercises.js';
import { canDo } from '../../data/exercises/gear.js';
import { GROUPS } from '../../data/anatomy/muscles.js';
import { completedWorkouts, workoutVolume, workoutSetCount } from '../../engines/training/metrics.js';
import { formatRelativeDay } from '../../utils/dates.js';
import { weightString } from '../../utils/units.js';
import { filterExercises, exerciseSubtitle } from './exercise-picker.js';
import { begin } from './training.js';
import { liveScreen } from '../shared/live.js';

export function history(root) {
  return liveScreen(root, async () => {
    const [settings, all] = await Promise.all([repo.getSettings(), repo.list('workouts')]);
    const done = completedWorkouts(all).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
    return [
      NavHeader({ title: 'History', back: { href: '#/train', label: 'Train' } }),
      done.length ? List(...done.map((w) => ListRow({ title: w.name, subtitle: `${formatRelativeDay(w.date)} · ${w.durationMin ?? '—'} min · ${workoutSetCount(w)} sets · ${weightString(workoutVolume(w), settings.units, 0)}`, href: `#/workout?id=${w.id}` })))
        : Card({}, EmptyState({ iconName: 'clock', title: 'No workouts yet', body: 'Finished workouts appear here.' })),
    ];
  });
}

let query = '', group = null, onlyMine = true;
export async function library(root) {
  const profile = await repo.getProfile();
  const results = h('div', {});
  const render = () => {
    const pool = onlyMine ? EXERCISES.filter((e) => canDo(e.id, profile.gear)) : EXERCISES;
    const list = filterExercises(pool, query, group);
    results.replaceChildren(list.length ? List(...list.map((e) => ListRow({ title: e.name, subtitle: exerciseSubtitle(e), href: `#/exercise?id=${e.id}` })))
      : Card({}, EmptyState({ inline: true, title: 'No matches', body: onlyMine ? 'Try “All exercises”, or add equipment in Profile → Gear.' : 'Try a muscle like “lats” or “quads”.' })));
  };
  const chips = h('div', { class: 'chips chips--scroll' }, [{ id: null, label: 'All' }, ...GROUPS].map((g) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(group === g.id), onClick: () => { group = g.id; chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b))); render(); } }, g.label);
    return b;
  }));
  root.append(
    NavHeader({ title: 'Library', back: { href: '#/train', label: 'Train' } }),
    Search({ placeholder: `Search ${EXERCISES.length} exercises`, value: query, onInput: (v) => { query = v; render(); } }),
    SegmentedControl({ label: 'Filter', value: onlyMine ? 'mine' : 'all', onChange: (v) => { onlyMine = v === 'mine'; render(); }, options: [{ value: 'mine', label: 'Fits my equipment' }, { value: 'all', label: 'All exercises' }] }),
    chips, results);
  render();
}

export function templates(root) {
  return liveScreen(root, async () => {
    const list = await repo.list('templates');
    return [
      NavHeader({ title: 'Templates', back: { href: '#/train', label: 'Train' } }),
      list.length ? List(...list.map((t) => ListRow({ title: t.name, subtitle: `${t.exercises.length} exercises`, onClick: () => {
        const sheet = openSheet({ title: t.name, content: h('div', { class: 'stack' },
          Button({ label: 'Start Workout', variant: 'primary', block: true, iconName: 'play', onClick: () => { sheet.close(); begin({ name: t.name, exercises: t.exercises, templateId: t.id }); } }),
          Button({ label: 'Delete Template', variant: 'danger', block: true, onClick: async () => {
            sheet.close();
            if (await confirmSheet({ title: 'Delete template?', message: `“${t.name}” will be removed. Workouts logged from it are kept.` })) { await repo.remove('templates', t.id); toast('Template deleted', { iconName: 'trash' }); }
          } })) });
      } })))
        : Card({}, EmptyState({ iconName: 'list', title: 'No templates', body: 'Finish a workout and tap “Save as Template” to reuse it.' })),
    ];
  });
}

export const mountHistory = history, mountLibrary = library, mountTemplates = templates;
