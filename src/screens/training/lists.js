/** Train drill-downs: History, Library (exercise database), Templates. */
import { h } from '../../components/dom.js';
import { NavHeader, List, ListRow, Card, EmptyState, Search, Button, SegmentedControl, Section, SectionAction } from '../../components/primitives.js';
import { sessionExercises, FOCUS_NAMES, weekIndex } from '../../engines/coach/planner.js';
import { exerciseName } from '../../data/exercises/exercises.js';
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

const READY = [
  ['Full Body', 'Everything in one session'], ['Upper', 'Chest, back, shoulders, arms'], ['Lower', 'Quads, hamstrings, glutes, calves'],
  ['Push', 'Chest, shoulders, triceps'], ['Pull', 'Back, rear delts, biceps'], ['Legs', 'Squat, hinge, lunge, accessories'],
  ['Chest & Back', 'Big upper-body supersets'], ['Shoulders', 'Front, side and rear delts'], ['Arms', 'Biceps and triceps'],
  ['Glutes', 'Hinges, thrusts and lunges'], ['Core', 'Abs and obliques'], ['Conditioning', 'Power and sweat'],
];
const LENGTHS = [20, 30, 45, 60, 75];
/** Rough minutes: per set ~40 s of work + the prescribed rest. */
const estMinutes = (ex) => Math.round(ex.reduce((a, e) => a + e.sets * ((e.durationSec ?? 40) + (e.restSec ?? 60)), 0) / 60) + 5;
const rx = (e) => (e.reps ? `${e.sets} × ${e.reps}` : `${e.sets} × ${e.durationSec}s`);

export function templates(root) {
  let minutes = 45;
  const shown = {}; // focus → ids already offered, so Shuffle brings genuinely new picks
  return liveScreen(root, async (refresh) => {
    const [list, profile] = await Promise.all([repo.list('templates'), repo.getProfile()]);
    const build = (focus) => sessionExercises(focus, { gear: profile.gear, experience: profile.experience ?? 'beginner', style: profile.style ?? 'general',
      sessionMinutes: minutes, focusAreas: profile.focusAreas ?? [], week: weekIndex(), used: new Set(shown[focus] ?? []) });

    const openReady = (focus) => {
      const body = h('div', { class: 'stack' });
      const draw = () => {
        const ex = build(focus);
        body.replaceChildren(
          List(...ex.map((e) => ListRow({ title: exerciseName(e.exerciseId), value: rx(e), onClick: () => { sheet.close(); location.hash = `#/exercise?id=${e.exerciseId}`; } }))),
          h('p', { class: 't-footnote c-2', style: { margin: 0 } }, `About ${estMinutes(ex)} min · picked from your equipment`),
          Button({ label: 'Start Workout', variant: 'primary', block: true, iconName: 'play', onClick: () => { sheet.close(); begin({ name: focus, exercises: ex }); } }),
          Button({ label: 'Shuffle Exercises', block: true, iconName: 'rotate', onClick: () => { shown[focus] = new Set([...(shown[focus] ?? []), ...ex.map((e) => e.exerciseId)]); draw(); } }));
      };
      const sheet = openSheet({ title: focus, content: body });
      draw();
    };

    const openSaved = () => {
      const sheet = openSheet({ title: 'Saved Workouts', content: h('div', { class: 'stack' }, list.length
        ? List(...list.map((t) => ListRow({ title: t.name, subtitle: `${t.exercises.length} exercises`, onClick: () => { sheet.close(); openTemplate(t); } })))
        : EmptyState({ inline: true, iconName: 'list', title: 'No saved workouts', body: 'Finish a workout and tap “Save as Template” to reuse it.' })) });
    };
    const openTemplate = (t) => {
      const sheet = openSheet({ title: t.name, content: h('div', { class: 'stack' },
        List(...t.exercises.map((e) => ListRow({ title: exerciseName(e.exerciseId), value: rx(e) }))),
        Button({ label: 'Start Workout', variant: 'primary', block: true, iconName: 'play', onClick: () => { sheet.close(); begin({ name: t.name, exercises: t.exercises, templateId: t.id }); } }),
        Button({ label: 'Delete Template', variant: 'danger', block: true, onClick: async () => {
          sheet.close();
          if (await confirmSheet({ title: 'Delete template?', message: `“${t.name}” will be removed. Workouts logged from it are kept.` })) { await repo.remove('templates', t.id); toast('Template deleted', { iconName: 'trash' }); }
        } })) });
    };

    const ready = READY.filter(([f]) => FOCUS_NAMES.includes(f)).map(([f, sub]) => [f, sub, build(f).length]).filter(([, , n]) => n >= 3);
    return [
      NavHeader({ title: 'Workouts', back: { href: '#/train', label: 'Train' } }),
      SegmentedControl({ label: 'Length', value: String(minutes), onChange: (v) => { minutes = Number(v); refresh(); },
        options: LENGTHS.map((m) => ({ value: String(m), label: `${m}m` })) }),
      Section({ title: 'Ready-Made', action: SectionAction(`Saved (${list.length})`, openSaved) },
        h('div', { class: 'nav-tiles workout-tiles' }, ready.map(([f, sub, n]) => h('button', { class: 'nav-tile', type: 'button', 'aria-label': `${f}: ${sub}`, onClick: () => openReady(f) },
          h('span', { class: 'nav-tile__title' }, f), h('span', { class: 'nav-tile__sub' }, `${n} exercises`))))),
    ];
  });
}

export const mountHistory = history, mountLibrary = library, mountTemplates = templates;
