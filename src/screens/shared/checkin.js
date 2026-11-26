/** Daily recovery check-in sheet (Phase 7). One record per day; editing updates it. */
import { h } from '../../components/dom.js';
import { Button, Stepper, List, FieldRow, Switch } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import * as repo from '../../services/storage/repository.js';
import { localDateKey } from '../../utils/dates.js';
import { readiness } from '../../engines/analytics/compare.js';

export async function todaysCheckin(date = localDateKey()) {
  return (await repo.listByDate('recoveryLogs', date))[0] ?? null;
}

function scale(label, low, high, value, onChange) {
  let v = value;
  const row = h('div', { class: 'scale5', role: 'radiogroup', 'aria-label': label }, [1, 2, 3, 4, 5].map((n) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(n === v), onClick: () => { v = n; row.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-pressed', String(i + 1 === n))); haptic(); onChange(n); } }, String(n));
    return b;
  }));
  return h('div', {},
    h('div', { class: 'row row--between t-footnote', style: { marginBottom: '6px' } }, h('span', { class: 't-subhead' }, label), h('span', { class: 'c-3' }, `${low} → ${high}`)),
    row);
}

export async function openCheckin() {
  const date = localDateKey();
  const existing = await todaysCheckin(date);
  const s = { sleepHours: existing?.sleepHours ?? 7.5, sleepQuality: existing?.sleepQuality ?? null, soreness: existing?.soreness ?? null, energy: existing?.energy ?? null, stress: existing?.stress ?? null, restDay: existing?.restDay ?? false };
  const sheet = openSheet({
    title: 'Daily Check-in',
    content: h('div', { class: 'stack' },
      List(FieldRow({ title: 'Sleep last night', iconName: 'bed', control: Stepper({ value: s.sleepHours, min: 0, max: 14, step: 0.5, format: (v) => `${v} h`, onChange: (v) => { s.sleepHours = v; } }) }),
        FieldRow({ title: 'Rest day today', control: Switch({ checked: s.restDay, label: 'Rest day', onChange: (v) => { s.restDay = v; } }) })),
      scale('Sleep quality', 'poor', 'great', s.sleepQuality, (n) => { s.sleepQuality = n; }),
      scale('Muscle soreness', 'none', 'very sore', s.soreness, (n) => { s.soreness = n; }),
      scale('Energy', 'drained', 'fired up', s.energy, (n) => { s.energy = n; }),
      scale('Stress', 'calm', 'maxed', s.stress, (n) => { s.stress = n; }),
      Button({ label: 'Save Check-in', variant: 'primary', block: true, onClick: async () => {
        const rec = { date, ...s, provenance: 'recorded' };
        if (existing) await repo.update('recoveryLogs', existing.id, rec); else await repo.create('recoveryLogs', rec);
        sheet.close(); haptic('success');
        const r = readiness(rec);
        toast('Check-in saved', { iconName: 'heart', subtitle: r != null ? `Readiness ${r}/100 (self-reported)` : '' });
      } })),
  });
}
