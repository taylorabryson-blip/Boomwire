/** My Schedule — the structured editor behind Cratos' plan. */
import { h } from '../../components/dom.js';
import { NavHeader, Section, List, FieldRow, ListRow, SegmentedControl, Stepper, Button, Card, EmptyState, TimeField } from '../../components/primitives.js';
import { confirmSheet, openSheet, toast } from '../../components/overlays.js';
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
  return TimeField({ value, onChange });
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
      NavHeader({ title: 'My Schedule', back: { href: '#/kratos', label: 'Cratos' } }),
      List(
        FieldRow({ title: 'Wake up', iconName: 'sunrise', control: timeInput(av.wakeTime, (v) => set({ wakeTime: v })) }),
        FieldRow({ title: 'Bedtime', iconName: 'moon', control: timeInput(av.sleepTime, (v) => set({ sleepTime: v })) })),
      List(
        FieldRow({ title: 'Days per week', control: Stepper({ value: av.daysPerWeek ?? 3, min: 1, max: 6, onChange: (v) => set({ daysPerWeek: v }) }) }),
        FieldRow({ title: 'Session length', control: Stepper({ value: av.sessionMinutes ?? 60, min: 20, max: 120, step: 5, format: (v) => `${v}m`, onChange: (v) => set({ sessionMinutes: v }) }) })),
      SegmentedControl({ label: 'Preferred time', value: av.preference, onChange: (v) => set({ preference: v }),
        options: [{ value: 'morning', label: 'Morning' }, { value: 'midday', label: 'Midday' }, { value: 'evening', label: 'Evening' }, { value: 'any', label: 'Any' }] }),
      h('div', {},
        List(
          ...[...groups.values()].map((g) => ListRow({
            iconName: 'calendar',
            title: `${g.label} · ${dayList(g.idx.map((i) => av.busy[i].day))}`,
            subtitle: fmtRange(toMin(g.start), toMin(g.end)),
            onClick: async () => { if (!(await confirmSheet({ title: `Remove ${g.label}?`, message: 'Cratos will re-plan your week without it.', confirmLabel: 'Remove' }))) return; const busy = av.busy.filter((_, i) => !g.idx.includes(i)); await set({ busy }); toast('Removed', { iconName: 'trash' }); },
            trailing: h('span', { class: 't-footnote c-3' }, 'Remove'), chevron: false })),
          ListRow({ iconName: 'plus', title: 'Add Commitment', subtitle: groups.size ? null : 'Work, school, practice — anything fixed', onClick: () => addBlockSheet(av) }))),
    ];
  });
}

const dayList = (days) => {
  const d = [...new Set(days)].sort();
  if (d.length === 7) return 'Every day';
  if (d.join() === '5,6') return 'Weekends';
  const runs = []; for (const x of d) { const r = runs[runs.length - 1]; if (r && x === r[1] + 1) r[1] = x; else runs.push([x, x]); }
  return runs.map(([a, b]) => (a === b ? DAY_SHORT[a] : b === a + 1 ? `${DAY_SHORT[a]}, ${DAY_SHORT[b]}` : `${DAY_SHORT[a]}–${DAY_SHORT[b]}`)).join(', ');
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
        FieldRow({ title: 'Starts', control: TimeField({ value: start, onChange: (v) => { start = v; } }) }),
        FieldRow({ title: 'Ends', control: TimeField({ value: end, onChange: (v) => { end = v; } }) })),
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
