/** My Schedule — the structured editor behind Kratos' plan. */
import { h } from '../../components/dom.js';
import { NavHeader, Section, List, FieldRow, ListRow, SegmentedControl, Stepper, Button, Card, EmptyState } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { getAvailability, saveAvailability, savePlan } from '../../services/coach.js';
import { DEFAULT_AVAILABILITY, planWeek } from '../../engines/coach/planner.js';
import { DAY_SHORT, fmtRange, fmt12, toMin } from '../../engines/coach/parser.js';
import { summarizeBlocks } from '../../engines/coach/kratos.js';
import { liveScreen } from '../shared/live.js';
import { PlanCard } from './plan-card.js';

async function save(av) {
  await saveAvailability(av);
  const profile = await repo.getProfile();
  await savePlan(planWeek({ availability: av, profile, today: new Date() }));
}

function timeInput(value, onChange) {
  return h('input', { type: 'time', value, onChange: (e) => e.target.value && onChange(e.target.value) });
}

export function mount(root) {
  return liveScreen(root, async () => {
    const stored = await getAvailability();
    const av = { ...DEFAULT_AVAILABILITY, ...(stored ?? {}) };
    const plan = await repo.get('coach', 'plan');
    const set = (patch) => save({ ...av, ...patch });
    const groups = new Map();
    av.busy.forEach((b, i) => { const k = `${b.label}|${b.start}|${b.end}`; if (!groups.has(k)) groups.set(k, { ...b, idx: [] }); groups.get(k).idx.push(i); });

    return [
      NavHeader({ title: 'My Schedule', back: { href: '#/kratos', label: 'Kratos' } }),
      Section({ first: true, title: 'Day', footer: 'Kratos keeps 30 minutes after waking and 90 before bed free, plus 30 minutes around every commitment.' },
        List(
          FieldRow({ title: 'Wake up', iconName: 'clock', control: timeInput(av.wakeTime, (v) => set({ wakeTime: v })) }),
          FieldRow({ title: 'Bedtime', iconName: 'clock', control: timeInput(av.sleepTime, (v) => set({ sleepTime: v })) }))),
      Section({ title: 'Training' },
        List(
          FieldRow({ title: 'Days per week', control: Stepper({ value: av.daysPerWeek ?? 3, min: 1, max: 6, onChange: (v) => set({ daysPerWeek: v }) }) }),
          FieldRow({ title: 'Session length', control: Stepper({ value: av.sessionMinutes ?? 60, min: 20, max: 120, step: 5, format: (v) => `${v}m`, onChange: (v) => set({ sessionMinutes: v }) }) })),
        h('div', { style: { marginTop: '12px' } },
          SegmentedControl({ label: 'Preferred time', value: av.preference, onChange: (v) => set({ preference: v }),
            options: [{ value: 'morning', label: 'Morning' }, { value: 'midday', label: 'Midday' }, { value: 'evening', label: 'Evening' }, { value: 'any', label: 'Any' }] }))),
      Section({ title: 'Commitments', footer: 'Work, school, practice — anything you can’t train during. You can also just text Kratos.' },
        groups.size
          ? List(...[...groups.values()].map((g) => ListRow({
              title: `${g.label} · ${dayList(g.idx.map((i) => av.busy[i].day))}`,
              subtitle: fmtRange(toMin(g.start), toMin(g.end)),
              onClick: async () => { const busy = av.busy.filter((_, i) => !g.idx.includes(i)); await set({ busy }); toast('Removed', { iconName: 'trash' }); },
              trailing: h('span', { class: 't-footnote c-3' }, 'Remove'), chevron: false })))
          : Card({}, EmptyState({ inline: true, title: 'No commitments yet', body: 'Add your work or school hours so Kratos plans around them.' })),
        h('div', { style: { marginTop: '12px' } }, Button({ label: 'Add Commitment', iconName: 'plus', block: true, onClick: () => addBlockSheet(av) }))),
      plan?.sessions?.length && Section({ title: 'Resulting Plan' }, PlanCard(plan, { compact: true })),
    ];
  });
}

const dayList = (days) => {
  const d = [...new Set(days)].sort();
  if (d.join() === '0,1,2,3,4') return 'Mon–Fri';
  if (d.join() === '5,6') return 'Weekends';
  if (d.length === 7) return 'Every day';
  return d.map((x) => DAY_SHORT[x]).join(', ');
};

function addBlockSheet(av) {
  let label = 'Work', days = new Set([0, 1, 2, 3, 4]), start = '09:00', end = '17:00';
  const dayChips = h('div', { class: 'chips' }, DAY_SHORT.map((d, i) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(days.has(i)), onClick: () => { days.has(i) ? days.delete(i) : days.add(i); b.setAttribute('aria-pressed', String(days.has(i))); } }, d);
    return b;
  }));
  const err = h('div', { class: 'field-error' });
  const sheet = openSheet({
    title: 'Add Commitment',
    content: h('div', { class: 'stack' },
      SegmentedControl({ label: 'Type', value: label, onChange: (v) => { label = v; }, options: ['Work', 'School', 'Practice', 'Busy'].map((x) => ({ value: x, label: x })) }),
      dayChips,
      List(
        FieldRow({ title: 'Starts', control: h('input', { type: 'time', value: start, onChange: (e) => { start = e.target.value; } }) }),
        FieldRow({ title: 'Ends', control: h('input', { type: 'time', value: end, onChange: (e) => { end = e.target.value; } }) })),
      err,
      Button({ label: 'Add', variant: 'primary', block: true, onClick: async () => {
        if (!days.size) { err.textContent = 'Pick at least one day.'; return; }
        if (!start || !end || end <= start) { err.textContent = 'End time must be after the start time.'; return; }
        const busy = [...av.busy, ...[...days].map((day) => ({ day, start, end, label }))];
        sheet.close();
        await save({ ...av, busy });
        toast(`${label} added`, { subtitle: `${dayList([...days])}, ${fmt12(toMin(start))} – ${fmt12(toMin(end))}` });
      } })),
  });
}

export { summarizeBlocks };
