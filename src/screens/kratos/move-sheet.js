/** Move / skip a planned session. Cratos plans, you decide. */
import { h } from '../../components/dom.js';
import { Button, SegmentedControl, TimeField } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import { DAY_SHORT, DAY_NAMES, fmt12, toMin, toHHMM } from '../../engines/coach/parser.js';
import { conflicts } from '../../engines/coach/reschedule.js';
import { rescheduleSession, skipSessionThisWeek, restorePlan } from '../../services/coach.js';

export function openMoveSheet({ session, plan, availability }) {
  let day = session.day, start = session.start, scope = 'week';
  const length = toMin(session.end) - toMin(session.start);
  const others = new Map(plan.sessions.filter((x) => x !== session).map((x) => [x.day, x]));

  const days = h('div', { class: 'day-picker' });
  const note = h('div', { class: 'move-note' });
  const paintDays = () => days.replaceChildren(...DAY_SHORT.map((d, i) => h('button', {
    type: 'button', class: `day-picker__d${i === day ? ' is-on' : ''}`, 'aria-pressed': String(i === day), 'aria-label': DAY_NAMES[i],
    onClick: () => { day = i; haptic(); paintDays(); paintNote(); },
  }, h('span', {}, d.slice(0, 1)), others.has(i) ? h('i', {}) : null)));
  const paintNote = () => {
    const end = toHHMM(Math.min(toMin(start) + length, 1439));
    const clash = conflicts(availability, day, start, end);
    const swap = others.get(day);
    note.replaceChildren(...[
      swap && h('div', {}, `Swaps with ${swap.focus} — it moves to ${DAY_NAMES[session.day]}.`),
      clash.length && h('div', { class: 'move-note__warn' }, `Overlaps ${clash.map((c) => `${c.label ?? 'a commitment'} (${fmt12(toMin(c.start))}–${fmt12(toMin(c.end))})`).join(', ')}. You can still do it.`),
      !swap && !clash.length && h('div', {}, `${DAY_NAMES[day]} · ${fmt12(toMin(start))} – ${fmt12(toMin(end))}`),
    ].filter(Boolean));
  };
  paintDays(); paintNote();

  const done = (prev, title, subtitle) => {
    haptic('success'); sheet.close();
    toast(title, { iconName: 'calendar', subtitle, actionLabel: 'Undo', onAction: () => restorePlan(prev) });
  };

  const sheet = openSheet({ title: `Move ${session.focus}`, content: h('div', { class: 'stack' },
    days,
    h('div', { class: 'row row--between' }, h('span', { class: 't-body' }, 'Start time'), TimeField({ value: start, onChange: (v) => { start = v; paintNote(); } })),
    SegmentedControl({ label: 'Apply to', value: scope, options: [{ value: 'week', label: 'This Week' }, { value: 'always', label: 'Every Week' }], onChange: (v) => { scope = v; } }),
    note,
    Button({ label: 'Move Session', variant: 'primary', block: true, onClick: async () => {
      const prev = await rescheduleSession(session.day, { day, start }, scope);
      if (prev) done(prev, `${session.focus} moved`, `${DAY_NAMES[day]} ${fmt12(toMin(start))}${scope === 'always' ? ' · every week' : ' · this week'}`);
    } }),
    Button({ label: `Skip ${session.focus} This Week`, variant: 'danger', block: true, onClick: async () => {
      const prev = await skipSessionThisWeek(session.day);
      if (prev) done(prev, `${session.focus} skipped`, 'Back on the plan next week');
    } })) });
  return sheet;
}
