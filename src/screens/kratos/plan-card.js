/** The weekly plan, rendered as a card (Cratos chat, schedule screen). */
import { h } from '../../components/dom.js';
import { Card, Button } from '../../components/primitives.js';
import { toast } from '../../components/overlays.js';
import { DAY_SHORT, fmt12, toMin } from '../../engines/coach/parser.js';
import { EXERCISE_BY_ID } from '../../data/exercises/exercises.js';
import { startWorkout } from '../../services/training.js';
import { downloadPlanICS } from '../../services/calendar/ics.js';
import { navigate } from '../../navigation/nav.js';
import { openSheet } from '../../components/overlays.js';

export function PlanCard(plan, { compact = false } = {}) {
  if (!plan?.sessions?.length) return null;
  const todayIdx = (new Date().getDay() + 6) % 7;
  const rows = plan.sessions.map((s) => h('button', { class: 'plan__day', type: 'button', style: { width: '100%', textAlign: 'left' }, onClick: () => openSession(s) },
    h('div', { class: `plan__dow ${s.day === todayIdx ? 'plan__dow--today' : ''}` }, DAY_SHORT[s.day]),
    h('div', { class: 'grow' },
      h('div', { class: 't-headline' }, s.focus),
      h('div', { class: 't-footnote c-2', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
        s.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]?.name).filter(Boolean).slice(0, 3).join(' · '))),
    h('div', { class: 'plan__time' }, fmt12(toMin(s.start)))));
  return Card({ class: 'plan' },
    h('div', { class: 'row row--between', style: { marginBottom: '4px' } },
      h('div', { class: 't-footnote c-2', style: { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' } }, 'This week'),
      h('div', { class: 't-footnote c-2' }, `Rest: ${plan.restDays.map((d) => DAY_SHORT[d]).join(', ') || '—'}`)),
    rows,
    !compact && h('div', { class: 'btn-row', style: { marginTop: '12px' } },
      Button({ label: 'Add to Calendar', iconName: 'calendar', size: 'small', onClick: async () => { await downloadPlanICS(plan); toast('Calendar file ready', { iconName: 'calendar', subtitle: 'Open it to add weekly reminders' }); } }),
      Button({ label: 'Edit Schedule', iconName: 'edit', size: 'small', onClick: () => navigate('#/schedule') })));
}

function openSession(s) {
  const sheet = openSheet({
    title: `${DAY_SHORT[s.day]} · ${s.focus}`,
    content: h('div', { class: 'stack' },
      h('div', { class: 't-subhead c-2' }, `${fmt12(toMin(s.start))} – ${fmt12(toMin(s.end))}${s.short ? ' · shortened to fit' : ''}`),
      h('div', { class: 'list' }, s.exercises.map((e) => h('div', { class: 'list-row' },
        h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, EXERCISE_BY_ID[e.exerciseId]?.name ?? e.exerciseId)),
        h('span', { class: 'list-row__value' }, e.reps ? `${e.sets} × ${e.reps}` : `${e.sets} × ${e.durationSec}s`)))),
      Button({ label: 'Start This Workout', variant: 'primary', block: true, iconName: 'play', onClick: async () => {
        const w = await startWorkout({ name: s.focus, exercises: s.exercises, planFocus: s.focus });
        sheet.close(); navigate(`#/workout?id=${w.id}`);
      } })),
  });
}
