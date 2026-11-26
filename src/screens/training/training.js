/** Train — hub: today's plan, resume, history, exercise library, templates. */
import { h } from '../../components/dom.js';
import { NavHeader, Section, Card, List, ListRow, Stat, Provenance, SegmentedControl, Search, Button, EmptyState, IconButton } from '../../components/primitives.js';
import { openSheet, confirmSheet, toast } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { startWorkout, activeWorkout } from '../../services/training.js';
import { getPlan } from '../../services/coach.js';
import { navigate } from '../../navigation/nav.js';
import { EXERCISES } from '../../data/exercises/exercises.js';
import { GROUPS } from '../../data/anatomy/muscles.js';
import { completedWorkouts, workoutVolume, workoutSetCount } from '../../engines/training/metrics.js';
import { localDateKey, addDays, formatRelativeDay } from '../../utils/dates.js';
import { weightString, weightValue, weightUnit } from '../../utils/units.js';
import { fmt12, toMin } from '../../engines/coach/parser.js';
import { filterExercises, exerciseSubtitle } from './exercise-picker.js';
import { liveScreen } from '../shared/live.js';

let tab = 'history', query = '', group = null;

async function begin(opts) {
  const w = await startWorkout(opts);
  navigate(`#/workout?id=${w.id}`);
}

export function mount(root) {
  return liveScreen(root, async (refresh) => {
    const today = localDateKey();
    const [settings, all, templates, plan, active] = await Promise.all([repo.getSettings(), repo.list('workouts'), repo.list('templates'), getPlan(), activeWorkout()]);
    const done = completedWorkouts(all).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
    const week = done.filter((w) => w.date >= addDays(today, -6));
    const vol = week.reduce((s, w) => s + workoutVolume(w), 0);
    const todayIdx = (new Date().getDay() + 6) % 7;
    const todays = plan?.sessions?.find((s) => s.day === todayIdx);
    const u = settings.units;

    const body = tab === 'history' ? historyView(done, u)
      : tab === 'exercises' ? exercisesView(refresh)
      : templatesView(templates);

    return [
      NavHeader({ title: 'Train', trailing: IconButton({ iconName: 'plus', label: 'Start empty workout', onClick: () => begin({ name: 'Workout' }) }) }),
      active && Section({ first: true }, Card({ glass: true, onClick: () => navigate(`#/workout?id=${active.id}`) },
        h('div', { class: 'row row--between' },
          h('div', {}, h('div', { class: 't-footnote c-2' }, 'In progress'), h('div', { class: 't-title-3' }, active.name)),
          Button({ label: 'Resume', variant: 'primary', size: 'small', iconName: 'play', onClick: (e) => { e.stopPropagation(); navigate(`#/workout?id=${active.id}`); } })))),
      !active && todays && Section({ first: true }, Card({ glass: true },
        h('div', { class: 't-footnote c-2', style: { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' } }, 'Kratos · today'),
        h('div', { class: 'row row--between', style: { margin: '4px 0 12px', alignItems: 'baseline' } },
          h('div', { class: 't-title-2' }, todays.focus), h('div', { class: 'rounded t-headline' }, fmt12(toMin(todays.start)))),
        Button({ label: `Start ${todays.focus}`, variant: 'primary', block: true, iconName: 'play', onClick: () => begin({ name: todays.focus, exercises: todays.exercises, planFocus: todays.focus }) }))),
      Section({ title: 'Last 7 Days', first: !active && !todays, action: Provenance('recorded') },
        h('div', { class: 'grid-2', style: { gridTemplateColumns: 'repeat(3, minmax(0,1fr))' } },
          Card({}, Stat({ value: String(week.length), label: 'sessions' })),
          Card({}, Stat({ value: String(week.reduce((s, w) => s + workoutSetCount(w), 0)), label: 'sets' })),
          Card({}, Stat({ value: vol ? String(Math.round(weightValue(vol, u, 0))) : '0', label: `${weightUnit(u)} volume` })))),
      Section({},
        SegmentedControl({ label: 'View', value: tab, onChange: (v) => { tab = v; refresh(); },
          options: [{ value: 'history', label: 'History' }, { value: 'exercises', label: 'Exercises' }, { value: 'templates', label: 'Templates' }] }),
        h('div', { style: { marginTop: '14px' } }, body)),
    ];
  });
}

function historyView(done, u) {
  if (!done.length) return Card({}, EmptyState({ iconName: 'training', title: 'No workouts yet', body: 'Start one with + or from Kratos’ plan. Everything you log shows up here.' }));
  return List(...done.slice(0, 60).map((w) => ListRow({
    title: w.name,
    subtitle: `${formatRelativeDay(w.date)} · ${w.durationMin ?? '—'} min · ${workoutSetCount(w)} sets · ${weightString(workoutVolume(w), u, 0)}`,
    href: `#/workout?id=${w.id}`,
  })));
}

function exercisesView(refresh) {
  const results = h('div', {});
  const renderList = () => {
    const list = filterExercises(EXERCISES, query, group);
    results.replaceChildren(list.length ? List(...list.map((e) => ListRow({ title: e.name, subtitle: exerciseSubtitle(e), href: `#/exercise?id=${e.id}` })))
      : Card({}, EmptyState({ inline: true, title: 'No matches', body: 'Try a muscle name like “lats” or “quads”.' })));
  };
  renderList();
  return h('div', {},
    Search({ placeholder: 'Search 60+ exercises', value: query, onInput: (v) => { query = v; renderList(); } }),
    h('div', { class: 'chips chips--scroll', style: { margin: '12px calc(-1 * var(--gutter))' } },
      [{ id: null, label: 'All' }, ...GROUPS].map((g) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(group === g.id), onClick: () => { group = g.id; refresh(); } }, g.label))),
    results);
}

function templatesView(templates) {
  if (!templates.length) return Card({}, EmptyState({ iconName: 'list', title: 'No templates', body: 'Finish a workout and tap “Save as Template” to reuse it.' }));
  return List(...templates.map((t) => ListRow({
    title: t.name, subtitle: `${t.exercises.length} exercises`,
    onClick: () => {
      const sheet = openSheet({ title: t.name, content: h('div', { class: 'stack' },
        Button({ label: 'Start Workout', variant: 'primary', block: true, iconName: 'play', onClick: () => { sheet.close(); begin({ name: t.name, exercises: t.exercises, templateId: t.id }); } }),
        Button({ label: 'Delete Template', variant: 'danger', block: true, onClick: async () => {
          sheet.close();
          if (await confirmSheet({ title: 'Delete template?', message: `“${t.name}” will be removed. Workouts logged from it are kept.` })) { await repo.remove('templates', t.id); toast('Template deleted', { iconName: 'trash' }); }
        } })) });
    },
  })));
}
