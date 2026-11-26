/**
 * Hydration UI shared by Home and Nutrition: summary card, add sheet, goal sheet.
 * All writes go through the repository; screens re-render via onChange.
 */
import { h } from '../../components/dom.js';
import { Card, Provenance, ProgressRing, Button, Stat } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { localDateKey, localTime } from '../../utils/dates.js';
import { formatVolume, volumeString, volumeInputToMl, volumeInputUnit, flOzToMl } from '../../utils/units.js';
import { goalProgress } from '../../engines/calculations/hydration.js';

const PRESETS = { metric: [250, 330, 500, 750], imperial: [8, 12, 16, 24] };
const presetMl = (v, units) => (units === 'imperial' ? Math.round(flOzToMl(v)) : v);

export async function addWater(amountMl, settings) {
  const rec = await repo.create('hydrationLogs', { date: localDateKey(), time: localTime(), amountMl, provenance: 'recorded' });
  toast(`Added ${volumeString(amountMl, settings.units)}`, { actionLabel: 'Undo', onAction: () => repo.remove('hydrationLogs', rec.id) });
  return rec;
}

export function HydrationCard({ totalMl, entries, settings }) {
  const { units, hydrationGoalMl: goal } = settings;
  const p = goalProgress(totalMl, goal);
  const v = formatVolume(totalMl, units);
  const presets = [PRESETS[units][0], PRESETS[units][2]];
  return Card({ label: 'Water', iconName: 'drop', badge: Provenance('recorded') },
    h('div', { class: 'row', style: { gap: '20px' } },
      ProgressRing({ progress: p, size: 92, stroke: 9, center: h('div', { class: 't-footnote c-2 num' }, p == null ? '—' : `${Math.round(p * 100)}%`) }),
      h('div', { style: { flex: 1, minWidth: 0 } },
        Stat({ value: v.value, unit: v.unit, large: true }),
        h('div', { class: 't-footnote c-2', style: { marginTop: '4px' } },
          goal ? `of ${volumeString(goal, units)} goal · ${entries} ${entries === 1 ? 'entry' : 'entries'}`
               : h('a', { href: '#/settings', style: { color: 'inherit' } }, 'Set a daily goal in Settings')))),
    h('div', { class: 'btn-row', style: { marginTop: '16px' } },
      ...presets.map((amt) => Button({ label: `+${amt} ${volumeInputUnit(units)}`, size: 'small', onClick: () => addWater(presetMl(amt, units), settings) })),
      Button({ label: 'Custom', size: 'small', iconName: 'plus', onClick: () => openAddWaterSheet(settings) })));
}

export function openAddWaterSheet(settings) {
  const { units } = settings;
  let selected = null;
  const input = h('input', { type: 'number', inputmode: 'decimal', min: '1', step: 'any', placeholder: '0', 'aria-label': `Amount in ${volumeInputUnit(units)}` });
  const error = h('div', { class: 'field-error' });
  const chips = h('div', { class: 'chips' }, PRESETS[units].map((amt) =>
    h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onClick: (e) => {
      selected = amt; input.value = amt;
      chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget)));
    } }, `${amt} ${volumeInputUnit(units)}`)));
  input.addEventListener('input', () => { selected = null; chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); });

  const submit = async () => {
    const ml = selected != null ? presetMl(selected, units) : volumeInputToMl(input.value, units);
    if (!Number.isFinite(ml) || ml < 1 || ml > 5000) { error.textContent = `Enter an amount between ${volumeString(1, units)} and ${volumeString(5000, units)}.`; return; }
    sheet.close();
    await addWater(ml, settings);
  };

  const sheet = openSheet({ title: 'Log Water', content: h('div', { class: 'stack' },
    chips,
    h('label', { class: 'field' }, input, h('span', { class: 'field__suffix' }, volumeInputUnit(units))),
    error,
    Button({ label: 'Add', variant: 'primary', block: true, onClick: submit })) });
  setTimeout(() => input.focus(), 450);
}

export function openGoalSheet(settings) {
  const { units, hydrationGoalMl } = settings;
  const current = hydrationGoalMl ? (units === 'imperial' ? Math.round(hydrationGoalMl / 29.5735295625) : hydrationGoalMl) : '';
  const input = h('input', { type: 'number', inputmode: 'decimal', step: 'any', value: String(current), placeholder: units === 'imperial' ? '64' : '2000' });
  const error = h('div', { class: 'field-error' });
  const save = async () => {
    const ml = volumeInputToMl(input.value, units);
    if (!Number.isFinite(ml) || ml < 250 || ml > 10000) { error.textContent = `Enter a goal between ${volumeString(250, units)} and ${volumeString(10000, units)}.`; return; }
    await repo.updateSettings({ hydrationGoalMl: ml });
    sheet.close();
  };
  const sheet = openSheet({ title: 'Daily Water Goal', content: h('div', { class: 'stack' },
    h('p', { class: 't-subhead c-2', style: { margin: 0 } }, 'A personal target you choose. Hercules does not calculate a required intake — needs vary with body size, climate and activity.'),
    h('label', { class: 'field' }, input, h('span', { class: 'field__suffix' }, volumeInputUnit(units))),
    error,
    Button({ label: 'Save Goal', variant: 'primary', block: true, onClick: save }),
    hydrationGoalMl && Button({ label: 'Remove Goal', variant: 'danger', block: true, onClick: async () => { await repo.updateSettings({ hydrationGoalMl: null }); sheet.close(); } })) });
}
