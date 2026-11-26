/**
 * Home — fits one screen: Kratos' next move, three rings, four quick actions.
 */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { kratosAvatar } from '../../components/brand.js';
import { NavHeader, Card, ProgressRing, Button, IconButton } from '../../components/primitives.js';
import * as repo from '../../services/storage/repository.js';
import { getPlan } from '../../services/coach.js';
import { startWorkout, activeWorkout } from '../../services/training.js';
import { activeTargets } from '../../services/nutrition/log.js';
import { navigate } from '../../navigation/nav.js';
import { localDateKey, addDays, formatLongDate } from '../../utils/dates.js';
import { volumeString, flOzToMl } from '../../utils/units.js';
import { dailyTotal, goalProgress } from '../../engines/calculations/hydration.js';
import { completedWorkouts } from '../../engines/training/metrics.js';
import { totals } from '../../engines/nutrition/nutrition.js';
import { nextSession } from '../../engines/coach/kratos.js';
import { fmt12, toMin, DAY_NAMES } from '../../engines/coach/parser.js';
import { addWater } from '../shared/hydration-ui.js';
import { openCheckin } from '../shared/checkin.js';
import { liveScreen } from '../shared/live.js';

export function mount(root) {
  return liveScreen(root, async () => {
    const today = localDateKey();
    const ws = addDays(today, -((new Date().getDay() + 6) % 7));
    const [settings, profile, water, workouts, food, plan, active, targets] = await Promise.all([
      repo.getSettings(), repo.getProfile(), repo.listByDate('hydrationLogs', today), repo.listByDate('workouts', ws, today),
      repo.listByDate('foodLogs', today), getPlan(), activeWorkout(), activeTargets(),
    ]);
    const waterMl = dailyTotal(water, today);
    const done = completedWorkouts(workouts).length;
    const planned = plan?.sessions?.length ?? 0;
    const kcal = totals(food).kcal;
    const hasT = targets && !targets.missing;

    return [
      NavHeader({ eyebrow: formatLongDate(today), title: profile.displayName ? `Hey, ${profile.displayName}` : 'Today', trailing: IconButton({ iconName: 'user', label: 'Profile', href: '#/profile' }) }),
      kratosCard({ plan, active }),
      Card({},
        h('div', { class: 'row', style: { justifyContent: 'space-between' } },
          ring({ progress: hasT ? kcal / targets.kcal : null, color: '#fff', value: `${Math.round(kcal)}`, label: hasT ? `of ${targets.kcal} kcal` : 'kcal', href: '#/nutrition' }),
          ring({ progress: goalProgress(waterMl, settings.hydrationGoalMl), color: 'var(--c-water)', value: volumeString(waterMl, settings.units), label: settings.hydrationGoalMl ? `of ${volumeString(settings.hydrationGoalMl, settings.units)}` : 'water', href: '#/nutrition' }),
          ring({ progress: planned ? done / planned : null, color: '#30d158', value: `${done}${planned ? `/${planned}` : ''}`, label: 'workouts', href: '#/train' }))),
      h('div', { class: 'grid-2' },
        Button({ label: 'Log Food', iconName: 'apple', onClick: () => navigate(`#/add-food?meal=${mealForNow()}&date=${today}`) }),
        Button({ label: settings.units === 'metric' ? '+250 ml' : '+1 Cup', iconName: 'drop', onClick: () => addWater(settings.units === 'metric' ? 250 : Math.round(flOzToMl(8)), settings) }),
        Button({ label: active ? 'Resume' : 'Workout', iconName: active ? 'play' : 'training', onClick: async () => { const w = active ?? await startWorkout({ name: 'Workout' }); navigate(`#/workout?id=${w.id}`); } }),
        Button({ label: 'Check-in', iconName: 'heart', onClick: openCheckin })),
    ];
  });
}

function mealForNow() {
  const hr = new Date().getHours();
  return hr < 11 ? 'breakfast' : hr < 15 ? 'lunch' : hr < 21 ? 'dinner' : 'snacks';
}

function ring({ progress, color, value, label, href }) {
  return h('button', { class: 'pressable', type: 'button', onClick: () => navigate(href), style: { display: 'grid', justifyItems: 'center', gap: '8px', flex: 1, minWidth: 0 } },
    ProgressRing({ progress, size: 86, stroke: 10, color, center: h('div', { class: 'rounded t-footnote num', style: { fontWeight: 700 } }, progress == null ? '—' : `${Math.round(progress * 100)}%`) }),
    h('div', { style: { textAlign: 'center', minWidth: 0 } }, h('div', { class: 't-subhead num', style: { fontWeight: 600, whiteSpace: 'nowrap' } }, value), h('div', { class: 't-caption c-2', style: { whiteSpace: 'nowrap' } }, label)));
}

function kratosCard({ plan, active }) {
  const head = (line) => h('div', { class: 'row', style: { marginBottom: '12px' } }, kratosAvatar(38),
    h('div', { class: 'grow' }, h('div', { class: 't-headline' }, 'Kratos'), h('div', { class: 't-footnote c-2' }, line)));
  if (active) {
    return Card({ glass: true }, head('Finish what you started.'),
      Button({ label: `Resume ${active.name}`, variant: 'primary', block: true, iconName: 'play', onClick: () => navigate(`#/workout?id=${active.id}`) }));
  }
  if (!plan?.sessions?.length) {
    return Card({ glass: true }, head('No plan yet. A few taps and I’ll build your week.'),
      Button({ label: 'Set Up My Plan', variant: 'primary', block: true, onClick: () => navigate('#/kratos-setup') }));
  }
  const n = nextSession(plan, new Date());
  const s = n.session;
  const when = n.inDays === 0 ? 'Today' : n.inDays === 1 ? 'Tomorrow' : DAY_NAMES[s.day];
  return Card({ glass: true }, head(`${when} · ${fmt12(toMin(s.start))}`),
    h('div', { class: 'row row--between' },
      h('div', { class: 't-title-2' }, s.focus),
      n.inDays === 0
        ? Button({ label: 'Start', variant: 'primary', size: 'small', iconName: 'play', onClick: async () => { const w = await startWorkout({ name: s.focus, exercises: s.exercises, planFocus: s.focus }); navigate(`#/workout?id=${w.id}`); } })
        : Button({ label: 'View Plan', size: 'small', onClick: () => navigate('#/kratos') })));
}

export { icon };
