/** Daily recovery check-in sheet (Phase 7). One record per day; editing updates it. */
import { h } from '../../components/dom.js';
import { Button, Stepper, List, FieldRow, Switch } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import * as repo from '../../services/storage/repository.js';
import { localDateKey } from '../../utils/dates.js';
import { readiness } from '../../engines/analytics/compare.js';
import { lastNight, hhmm } from '../../services/sleep.js';
import { minutesBetween } from '../../engines/recovery/sleep.js';
import { fmt12, toMin } from '../../engines/coach/parser.js';

const dur = (m) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`;
/** ISO timestamps for "fell asleep HH:MM" / "woke HH:MM" on the night ending on `date`. */
function nightISO(date, asleep, woke) {
  const [y, mo, d] = date.split('-').map(Number);
  const at = (t, dayOffset) => { const [h, m] = t.split(':').map(Number); return new Date(y, mo - 1, d + dayOffset, h, m).toISOString(); };
  const wakeISO = at(woke, 0);
  const startISO = new Date(Date.parse(wakeISO) - minutesBetween(asleep, woke) * 60000).toISOString();
  return { sleepStart: startISO, sleepEnd: wakeISO };
}

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
  const night = await lastNight(date);
  const times = { asleep: hhmm(night.asleep), woke: hhmm(night.woke) };
  let touched = false;
  const s = { sleepHours: existing?.sleepHours ?? 7.5, sleepQuality: existing?.sleepQuality ?? null, soreness: existing?.soreness ?? null, energy: existing?.energy ?? null, stress: existing?.stress ?? null, restDay: existing?.restDay ?? false };
  const sleepNote = h('div', { class: 'sleep-note' });
  const why = () => {
    if (touched) return 'Set by you.';
    if (night.source === 'health') return 'From Apple Health.';
    if (night.source === 'manual') return 'Set by you.';
    const clue = night.lastUse && night.basis.includes('when you last used Hercules') ? ` You were last in Hercules at ${fmt12(toMin(hhmm(night.lastUse)))}.` : '';
    return `Estimated from your sleep schedule.${clue} Adjust if it’s off.`;
  };
  const drawNote = () => {
    const m = minutesBetween(times.asleep, times.woke);
    s.sleepHours = Math.round((m / 60) * 10) / 10;
    sleepNote.replaceChildren(...[h('b', {}, dur(m)), ` of sleep · ${why()} `,
      night.source !== 'health' && !touched && h('button', { type: 'button', class: 'link', onClick: async () => { sheet.close(); (await import('../settings/alarms.js')).openSleepSetup(); } }, 'Get it from Apple Health')].filter(Boolean));
  };
  function timeInput(which) {
    const el = h('input', { type: 'time', step: '60', class: 'time-pill', value: times[which], 'aria-label': which === 'asleep' ? 'Fell asleep' : 'Woke up',
      onChange: (e) => { if (e.target.value) { times[which] = e.target.value; touched = true; drawNote(); } } });
    return el;
  }

  const sheet = openSheet({
    title: 'Daily Check-in',
    content: h('div', { class: 'stack' },
      List(FieldRow({ title: 'Fell asleep', iconName: 'moon', control: timeInput('asleep') }),
        FieldRow({ title: 'Woke up', iconName: 'sunrise', control: timeInput('woke') }),
        FieldRow({ title: 'Rest day today', control: Switch({ checked: s.restDay, label: 'Rest day', onChange: (v) => { s.restDay = v; } }) })),
      sleepNote,
      scale('Sleep quality', 'poor', 'great', s.sleepQuality, (n) => { s.sleepQuality = n; }),
      scale('Muscle soreness', 'none', 'very sore', s.soreness, (n) => { s.soreness = n; }),
      scale('Energy', 'drained', 'fired up', s.energy, (n) => { s.energy = n; }),
      scale('Stress', 'calm', 'maxed', s.stress, (n) => { s.stress = n; }),
      Button({ label: 'Save Check-in', variant: 'primary', block: true, onClick: async () => {
        const src = touched ? 'manual' : night.source;
        const rec = { date, ...s, ...nightISO(date, times.asleep, times.woke), sleepSource: src, provenance: src === 'health' ? 'measured' : src === 'estimate' ? 'estimated' : 'recorded' };
        if (existing) await repo.update('recoveryLogs', existing.id, rec); else await repo.create('recoveryLogs', rec);
        sheet.close(); haptic('success');
        const r = readiness(rec);
        toast('Check-in saved', { iconName: 'heart', subtitle: r != null ? `Readiness ${r}/100 (self-reported)` : '' });
      } })),
  });
  drawNote();
}
