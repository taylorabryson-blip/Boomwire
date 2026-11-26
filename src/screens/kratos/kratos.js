/**
 * Kratos — button-driven coach dashboard (fits one screen).
 * Week at a glance · next session with Start · fuel for today · recovery call · actions.
 * Chat is a secondary tool ("Ask Kratos").
 */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { kratosAvatar } from '../../components/brand.js';
import { NavHeader, Card, Button, EmptyState, IconButton } from '../../components/primitives.js';
import { toast } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { getPlan, getAvailability } from '../../services/coach.js';
import { startWorkout, activeWorkout } from '../../services/training.js';
import { activeTargets } from '../../services/nutrition/log.js';
import { downloadPlanICS } from '../../services/calendar/ics.js';
import { navigate } from '../../navigation/nav.js';
import { localDateKey, addDays } from '../../utils/dates.js';
import { DAY_SHORT, DAY_NAMES, fmt12, toMin } from '../../engines/coach/parser.js';
import { nextSession } from '../../engines/coach/kratos.js';
import { completedWorkouts } from '../../engines/training/metrics.js';
import { totals } from '../../engines/nutrition/nutrition.js';
import { readiness, readinessAdvice } from '../../engines/analytics/compare.js';
import { EXERCISE_BY_ID } from '../../data/exercises/exercises.js';
import { todaysCheckin, openCheckin } from '../shared/checkin.js';
import { liveScreen } from '../shared/live.js';

export function mount(root) {
  return liveScreen(root, async () => {
    const today = localDateKey();
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const weekStart = addDays(today, -dow);
    const [plan, av, active, workouts, food, targets, check] = await Promise.all([
      getPlan(), getAvailability(), activeWorkout(), repo.listByDate('workouts', weekStart, addDays(weekStart, 6)),
      repo.listByDate('foodLogs', today), activeTargets(), todaysCheckin(today)]);
    const header = NavHeader({ title: 'Kratos', eyebrow: 'God of strength · your coach', trailing: kratosAvatar(40) });

    if (!plan?.sessions?.length) {
      return [header,
        Card({ glass: true },
          EmptyState({ iconNode: kratosAvatar(56), title: 'Let’s build your week.', body: 'A few quick taps: your schedule, sleep, how often you can train, where, and what you want. I’ll pick your days, times and workouts.' }),
          Button({ label: av ? 'Finish Setup' : 'Start Setup', variant: 'primary', block: true, onClick: () => navigate('#/kratos-setup') })),
        Button({ label: 'Ask Kratos a Question', iconName: 'chat', block: true, onClick: () => navigate('#/kratos-chat') })];
    }

    const doneDays = new Set(completedWorkouts(workouts).map((w) => w.date));
    const strip = h('div', { class: 'week-strip' }, DAY_SHORT.map((d, i) => {
      const s = plan.sessions.find((x) => x.day === i);
      const date = addDays(weekStart, i);
      const cls = ['week-day', s && 'week-day--train', doneDays.has(date) && 'week-day--done', i === dow && 'week-day--today'].filter(Boolean).join(' ');
      return h('div', { class: cls }, h('span', { class: 'week-day__dow' }, d[0]), h('span', { class: 'week-day__dot' }), h('span', { class: 'week-day__time' }, s ? fmt12(toMin(s.start)).replace(' ', '').replace(':00', '').toLowerCase() : 'rest'));
    }));

    const n = nextSession(plan, now);
    const s = n?.session;
    const when = !n ? '' : n.inDays === 0 ? 'Today' : n.inDays === 1 ? 'Tomorrow' : DAY_NAMES[s.day];
    const sessionCard = active
      ? Card({ glass: true }, h('div', { class: 't-footnote c-2' }, 'In progress'), h('div', { class: 't-title-2', style: { margin: '2px 0 12px' } }, active.name),
        Button({ label: 'Resume Workout', variant: 'primary', block: true, iconName: 'play', onClick: () => navigate(`#/workout?id=${active.id}`) }))
      : s ? Card({ glass: true },
        h('div', { class: 'row row--between', style: { alignItems: 'baseline' } },
          h('div', { class: 't-footnote c-2', style: { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' } }, n.inDays === 0 ? 'Today' : 'Next session'),
          h('div', { class: 'rounded t-headline num' }, `${when} · ${fmt12(toMin(s.start))}`)),
        h('div', { class: 't-title-2', style: { margin: '2px 0 4px' } }, s.focus),
        h('div', { class: 't-footnote c-2', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '12px' } }, s.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]?.name).filter(Boolean).join(' · ')),
        Button({ label: n.inDays === 0 ? `Start ${s.focus}` : `Start ${s.focus} Early`, variant: n.inDays === 0 ? 'primary' : undefined, block: true, iconName: 'play',
          onClick: async () => { const w = await startWorkout({ name: s.focus, exercises: s.exercises, planFocus: s.focus }); navigate(`#/workout?id=${w.id}`); } }))
      : null;

    const t = totals(food);
    const hasT = targets && !targets.missing;
    const meal = plan.nutrition?.meals?.find((m) => m.day === dow);
    const fuel = Card({ onClick: () => navigate('#/nutrition') },
      h('div', { class: 'row' },
        h('span', { class: 'list-row__icon' }, icon('apple', 17)),
        h('div', { class: 'grow' },
          h('div', { class: 't-headline' }, hasT ? `${Math.max(0, Math.round(targets.kcal - t.kcal))} kcal · ${Math.max(0, Math.round(targets.protein - t.protein))} g protein left` : 'Set nutrition targets'),
          h('div', { class: 't-footnote c-2' }, meal ? `Eat ~${fmt12(toMin(meal.pre.time))} · protein meal by ${fmt12(toMin(meal.post.time))}` : 'Rest day: keep protein high, eat normally.')),
        h('span', { class: 'list-row__chevron' }, icon('chevronRight', 16))));

    const r = readiness(check);
    const recovery = Card({ onClick: openCheckin },
      h('div', { class: 'row' },
        h('span', { class: 'list-row__icon' }, icon('heart', 17)),
        h('div', { class: 'grow' },
          h('div', { class: 't-headline' }, r != null ? `Readiness ${r}/100` : 'How did you sleep?'),
          h('div', { class: 't-footnote c-2' }, r != null ? readinessAdvice(r) : 'Check in so I can adjust today’s training.')),
        h('span', { class: 'list-row__chevron' }, icon('chevronRight', 16))));

    const planHeader = NavHeader({ title: 'Kratos', eyebrow: 'God of strength · your coach',
      trailing: h('div', { class: 'row', style: { gap: '8px' } },
        IconButton({ iconName: 'chat', label: 'Ask Kratos', href: '#/kratos-chat' }),
        IconButton({ iconName: 'calendar', label: 'Add plan to Calendar', onClick: async () => { await downloadPlanICS(plan); toast('Calendar file ready', { iconName: 'calendar' }); } }),
        IconButton({ iconName: 'edit', label: 'Edit plan', href: '#/kratos-setup' })) });
    return [planHeader, strip, sessionCard, fuel, recovery];
  });
}
