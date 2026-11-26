/**
 * Home — deliberately light: Kratos' next move, two rings, three quick actions.
 * Everything else lives one tap away.
 */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { kratosAvatar } from '../../components/brand.js';
import { NavHeader, Section, Card, ProgressRing, Button, IconButton } from '../../components/primitives.js';
import * as repo from '../../services/storage/repository.js';
import { getPlan, getAvailability } from '../../services/coach.js';
import { startWorkout, activeWorkout } from '../../services/training.js';
import { navigate } from '../../navigation/nav.js';
import { localDateKey, addDays, formatLongDate } from '../../utils/dates.js';
import { volumeString, cupsString, flOzToMl } from '../../utils/units.js';
import { dailyTotal, goalProgress } from '../../engines/calculations/hydration.js';
import { completedWorkouts } from '../../engines/training/metrics.js';
import { nextSession } from '../../engines/coach/kratos.js';
import { fmt12, toMin, DAY_NAMES } from '../../engines/coach/parser.js';
import { addWater } from '../shared/hydration-ui.js';
import { liveScreen } from '../shared/live.js';
import { openLogWeightSheet } from '../progress/measurements.js';

function weekStart(today) {
  const d = new Date();
  return addDays(today, -((d.getDay() + 6) % 7));
}

export function mount(root) {
  return liveScreen(root, async () => {
    const today = localDateKey();
    const ws = weekStart(today);
    const [settings, profile, water, workouts, plan, av, active] = await Promise.all([
      repo.getSettings(), repo.getProfile(), repo.listByDate('hydrationLogs', today), repo.listByDate('workouts', ws, today),
      getPlan(), getAvailability(), activeWorkout(),
    ]);
    const totalMl = dailyTotal(water, today);
    const done = completedWorkouts(workouts).length;
    const planned = plan?.sessions?.length ?? 0;
    const greet = profile.displayName ? `Let’s work, ${profile.displayName}` : 'Today';

    return [
      NavHeader({
        eyebrow: formatLongDate(today), title: greet,
        trailing: IconButton({ iconName: 'user', label: 'Profile', href: '#/profile' }),
      }),
      Section({ first: true }, kratosCard({ plan, av, active, today })),
      Section({ title: 'Rings' },
        Card({},
          h('div', { class: 'row', style: { justifyContent: 'space-around' } },
            ringBlock({
              progress: goalProgress(totalMl, settings.hydrationGoalMl), color: 'var(--c-water)',
              value: volumeString(totalMl, settings.units), label: settings.hydrationGoalMl ? `of ${volumeString(settings.hydrationGoalMl, settings.units)}` : (settings.units === 'metric' ? 'water today' : cupsString(totalMl)),
              onClick: () => navigate('#/nutrition'),
            }),
            ringBlock({
              progress: planned ? done / planned : null, color: 'var(--c-series-1)',
              value: `${done}${planned ? `/${planned}` : ''}`, label: planned ? 'sessions this week' : 'sessions this week',
              onClick: () => navigate('#/train'),
            })))),
      Section({ title: 'Quick Actions' },
        h('div', { class: 'btn-row' },
          Button({ label: settings.units === 'metric' ? '+250 ml' : '+1 cup', iconName: 'drop', onClick: () => addWater(settings.units === 'metric' ? 250 : Math.round(flOzToMl(8)), settings) }),
          Button({ label: active ? 'Resume' : 'Workout', iconName: active ? 'play' : 'training', onClick: async () => { const w = active ?? await startWorkout({ name: 'Workout' }); navigate(`#/workout?id=${w.id}`); } }),
          Button({ label: 'Weigh-in', iconName: 'ruler', onClick: () => openLogWeightSheet(settings) }))),
    ];
  });
}

function ringBlock({ progress, color, value, label, onClick }) {
  return h('button', { class: 'pressable', type: 'button', onClick, style: { display: 'grid', justifyItems: 'center', gap: '10px' } },
    ProgressRing({ progress, size: 104, stroke: 12, color, center: h('div', { class: 'rounded t-headline num' }, progress == null ? '—' : `${Math.round(progress * 100)}%`) }),
    h('div', { style: { textAlign: 'center' } },
      h('div', { class: 't-headline num' }, value),
      h('div', { class: 't-footnote c-2' }, label)));
}

function kratosCard({ plan, av, active, today }) {
  const head = h('div', { class: 'row', style: { marginBottom: '12px' } }, kratosAvatar(40),
    h('div', { class: 'grow' }, h('div', { class: 't-headline' }, 'Kratos'), h('div', { class: 't-footnote c-2' }, 'God of strength · your coach')));
  if (active) {
    return Card({ glass: true }, head,
      h('div', { class: 't-title-3', style: { marginBottom: '14px' } }, `${active.name} in progress. Finish what you started.`),
      Button({ label: 'Resume Workout', variant: 'primary', block: true, iconName: 'play', onClick: () => navigate(`#/workout?id=${active.id}`) }));
  }
  if (!av) {
    return Card({ glass: true }, head,
      h('div', { class: 't-title-3', style: { marginBottom: '6px' } }, 'Tell me your schedule.'),
      h('p', { class: 't-subhead c-2', style: { margin: '0 0 14px' } }, 'Work, school, when you wake and sleep. I’ll find your training days and times.'),
      Button({ label: 'Talk to Kratos', variant: 'primary', block: true, onClick: () => navigate('#/kratos') }));
  }
  const n = nextSession(plan, new Date());
  if (!n) {
    return Card({ glass: true }, head, h('div', { class: 't-title-3', style: { marginBottom: '14px' } }, 'No sessions planned. Ask me for a plan.'),
      Button({ label: 'Open Kratos', block: true, onClick: () => navigate('#/kratos') }));
  }
  const s = n.session;
  const when = n.inDays === 0 ? 'Today' : n.inDays === 1 ? 'Tomorrow' : DAY_NAMES[s.day];
  return Card({ glass: true }, head,
    h('div', { class: 't-footnote c-2', style: { textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 } }, 'Next session'),
    h('div', { class: 'row row--between', style: { margin: '4px 0 14px', alignItems: 'baseline' } },
      h('div', { class: 't-title-2' }, s.focus),
      h('div', { class: 'rounded t-headline num' }, `${when} · ${fmt12(toMin(s.start))}`)),
    h('div', { class: 'btn-row' },
      n.inDays === 0
        ? Button({ label: 'Start Now', variant: 'primary', iconName: 'play', onClick: async () => { const w = await startWorkout({ name: s.focus, exercises: s.exercises, planFocus: s.focus }); navigate(`#/workout?id=${w.id}`); } })
        : Button({ label: 'See Plan', variant: 'primary', onClick: () => navigate('#/kratos') }),
      Button({ label: 'Chat', iconName: null, onClick: () => navigate('#/kratos') })));
}

export { icon };
