/** Train — one-screen hub: today's session, this week, and three destinations. */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { NavHeader, Card, Button, IconButton } from '../../components/primitives.js';
import * as repo from '../../services/storage/repository.js';
import { startWorkout, activeWorkout } from '../../services/training.js';
import { getPlan } from '../../services/coach.js';
import { navigate } from '../../navigation/nav.js';
import { EXERCISES } from '../../data/exercises/exercises.js';
import { exercisesForGear } from '../../data/exercises/gear.js';
import { completedWorkouts, workoutVolume, workoutSetCount } from '../../engines/training/metrics.js';
import { localDateKey, addDays, formatRelativeDay } from '../../utils/dates.js';
import { weightValue, weightUnit } from '../../utils/units.js';
import { fmt12, toMin } from '../../engines/coach/parser.js';
import { liveScreen } from '../shared/live.js';

export async function begin(opts) {
  const w = await startWorkout(opts);
  navigate(`#/workout?id=${w.id}`);
}

const tile = (label, value) => h('div', { class: 'tile' }, h('div', { class: 'tile__value' }, value), h('div', { class: 'tile__label' }, label));
const navTile = (iconName, title, sub, href) => h('button', { class: 'nav-tile', type: 'button', onClick: () => navigate(href) },
  h('span', { class: 'nav-tile__icon' }, icon(iconName, 18)), h('span', { class: 'nav-tile__title' }, title), h('span', { class: 'nav-tile__sub' }, sub));

export function mount(root) {
  return liveScreen(root, async () => {
    const today = localDateKey();
    const [settings, profile, all, templates, plan, active] = await Promise.all([repo.getSettings(), repo.getProfile(), repo.list('workouts'), repo.list('templates'), getPlan(), activeWorkout()]);
    const done = completedWorkouts(all).sort((a, b) => b.date.localeCompare(a.date));
    const week = done.filter((w) => w.date >= addDays(today, -6));
    const vol = week.reduce((s, w) => s + workoutVolume(w), 0);
    const todayIdx = (new Date().getDay() + 6) % 7;
    const todays = plan?.sessions?.find((s) => s.day === todayIdx);
    const u = settings.units;
    const avail = exercisesForGear(profile.gear).length;

    const hero = active
      ? Card({ glass: true }, h('div', { class: 't-footnote c-2' }, 'In progress'), h('div', { class: 't-title-2', style: { margin: '2px 0 12px' } }, active.name),
        Button({ label: 'Resume Workout', variant: 'primary', block: true, iconName: 'play', onClick: () => navigate(`#/workout?id=${active.id}`) }))
      : todays
        ? Card({ glass: true },
          h('div', { class: 'row row--between', style: { alignItems: 'baseline' } }, h('div', { class: 't-footnote c-2', style: { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' } }, 'Kratos · today'), h('div', { class: 'rounded t-headline' }, fmt12(toMin(todays.start)))),
          h('div', { class: 't-title-2', style: { margin: '2px 0 12px' } }, todays.focus),
          Button({ label: `Start ${todays.focus}`, variant: 'primary', block: true, iconName: 'play', onClick: () => begin({ name: todays.focus, exercises: todays.exercises, planFocus: todays.focus }) }))
        : Card({ glass: true },
          h('div', { class: 't-footnote c-2' }, plan ? 'Rest day on your plan' : 'No plan yet'),
          h('div', { class: 't-title-3', style: { margin: '2px 0 12px' } }, done[0] ? `Last: ${done[0].name}, ${formatRelativeDay(done[0].date).toLowerCase()}` : 'Log your first workout'),
          Button({ label: 'Start Empty Workout', variant: 'primary', block: true, iconName: 'plus', onClick: () => begin({ name: 'Workout' }) }));

    return [
      NavHeader({ title: 'Train', trailing: IconButton({ iconName: 'plus', label: 'Start empty workout', onClick: () => begin({ name: 'Workout' }) }) }),
      hero,
      h('div', { class: 'tiles' }, tile('sessions · 7d', String(week.length)), tile('sets · 7d', String(week.reduce((s, w) => s + workoutSetCount(w), 0))), tile(`${weightUnit(u)} · 7d`, vol ? Math.round(weightValue(vol, u, 0)).toLocaleString() : '0')),
      h('div', { class: 'nav-tiles' },
        navTile('clock', 'History', `${done.length} workouts`, '#/history'),
        navTile('search', 'Library', `${avail} for your gear`, '#/library'),
        navTile('list', 'Templates', `${templates.length} saved`, '#/templates')),
      plan && Button({ label: 'This Week’s Plan', iconName: 'calendar', block: true, onClick: () => navigate('#/kratos') }),
    ];
  });
}

export { EXERCISES };
