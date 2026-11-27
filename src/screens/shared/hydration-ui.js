/**
 * Hydration UI shared by Home and Nutrition: summary card, add sheet, goal sheet.
 * All writes go through the repository; screens re-render via onChange.
 */
import { h } from '../../components/dom.js';
import { Card, Provenance, ProgressRing, Button, Stat, List, ListRow, EmptyState } from '../../components/primitives.js';
import { openSheet, toast, confirmSheet } from '../../components/overlays.js';
import { icon } from '../../components/icons.js';
import { haptic } from '../../components/haptics.js';
import { fmt12, toMin } from '../../engines/coach/parser.js';
import * as repo from '../../services/storage/repository.js';
import { localDateKey, localTime } from '../../utils/dates.js';
import { formatVolume, volumeString, volumeInputToMl, volumeInputUnit, flOzToMl, mlToFlOz, cupsString, round } from '../../utils/units.js';
import { goalProgress, possibleDuplicate, dailyTotal } from '../../engines/calculations/hydration.js';

// US presets: 1 cup, a can, a standard bottle, a big tumbler, a quart.
const PRESETS = { imperial: [8, 12, 16, 24, 32], metric: [250, 330, 500, 750, 1000] };
const PRESET_LABEL = { 8: '1 cup · 8 oz', 32: '32 oz' };
const presetText = (amt, units) => (units === 'metric' ? `${amt} ml` : PRESET_LABEL[amt] ?? `${amt} oz`);
const presetMl = (v, units) => (units === 'metric' ? v : Math.round(flOzToMl(v)));

const t12 = (hhmm) => fmt12(toMin(hhmm));
const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'just now' : m === 1 ? '1 minute ago' : `${m} minutes ago`; };

/**
 * Log water. Every entry keeps its time. If it looks like a double tap or a
 * repeat of something just logged (H5), ask first. `time` ("HH:MM") lets you
 * log a drink you forgot earlier; those skip the duplicate check.
 */
export async function addWater(amountMl, settings, { time = null } = {}) {
  const date = localDateKey();
  if (!time) {
    const dup = possibleDuplicate(await repo.listByDate('hydrationLogs', date), amountMl);
    if (dup) {
      const ok = await confirmSheet({ title: 'Already logged this?', confirmLabel: 'Add Again', destructive: false,
        message: `You added ${volumeString(dup.amountMl, settings.units)} at ${t12(dup.time)} (${ago(dup.createdAt)}).` });
      if (!ok) return null;
    }
  }
  const rec = await repo.create('hydrationLogs', { date, time: time ?? localTime(), amountMl, provenance: 'recorded' });
  toast(`Added ${volumeString(amountMl, settings.units)}`, { subtitle: `at ${t12(rec.time)}`, actionLabel: 'Undo', onAction: () => repo.remove('hydrationLogs', rec.id) });
  return rec;
}

/** Today's water, drink by drink, with times. Delete mistakes; add one you forgot. */
export async function openWaterLog(settings) {
  const date = localDateKey();
  const body = h('div', { class: 'stack' });
  const sheet = openSheet({ title: 'Today’s Water', content: body });
  const draw = async () => {
    const list = (await repo.listByDate('hydrationLogs', date)).filter((e) => !e.deletedAt).sort((a, b) => b.time.localeCompare(a.time));
    body.replaceChildren(
      h('div', { class: 't-footnote c-2' }, `${volumeString(dailyTotal(list, date), settings.units)} total · ${list.length} ${list.length === 1 ? 'drink' : 'drinks'}`),
      list.length
        ? List(...list.map((e) => ListRow({ title: t12(e.time), value: volumeString(e.amountMl, settings.units),
            trailing: h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Delete ${t12(e.time)} entry`, onClick: async (ev) => {
              ev.stopPropagation(); haptic();
              await repo.remove('hydrationLogs', e.id);
              toast('Entry deleted', { iconName: 'trash', actionLabel: 'Undo', onAction: async () => { await repo.create('hydrationLogs', { date: e.date, time: e.time, amountMl: e.amountMl, provenance: 'recorded' }); draw(); } });
              draw();
            } }, icon('trash', 16)) })))
        : EmptyState({ inline: true, iconName: 'drop', title: 'No water yet today', body: 'Every drink you log shows here with its time.' }),
      Button({ label: 'Log Water', variant: 'primary', block: true, iconName: 'plus', onClick: () => { sheet.close(); openAddWaterSheet(settings); } }));
  };
  draw();
}

export function HydrationCard({ totalMl, entries, settings }) {
  const { units, hydrationGoalMl: goal } = settings;
  const p = goalProgress(totalMl, goal);
  const v = formatVolume(totalMl, units);
  const presets = [PRESETS[units][0], PRESETS[units][2]];
  const cupsNote = units === 'metric' ? '' : `${cupsString(totalMl)} · `;
  return Card({ label: 'Water', iconName: 'drop', badge: Provenance('recorded') },
    h('div', { class: 'row', style: { gap: '20px' } },
      ProgressRing({ progress: p, size: 92, stroke: 9, center: h('div', { class: 't-footnote c-2 num' }, p == null ? '—' : `${Math.round(p * 100)}%`) }),
      h('div', { style: { flex: 1, minWidth: 0 } },
        Stat({ value: v.value, unit: v.unit, large: true }),
        h('div', { class: 't-footnote c-2', style: { marginTop: '4px' } },
          goal ? `${cupsNote}of ${volumeString(goal, units)} goal`
               : h('span', {}, cupsNote, h('button', { type: 'button', style: { color: 'inherit', textDecoration: 'underline' }, onClick: () => openGoalSheet(settings) }, 'Set a daily goal'))))),
    h('div', { class: 'btn-row', style: { marginTop: '16px' } },
      ...presets.map((amt) => Button({ label: units === 'metric' ? `+${amt} ml` : amt === 8 ? '+1 cup' : `+${amt} oz`, size: 'small', onClick: () => addWater(presetMl(amt, units), settings) })),
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
    } }, presetText(amt, units))));
  const now = localTime();
  const timeInput = h('input', { type: 'time', step: '60', value: now, 'aria-label': 'Time you drank it', max: now });
  input.addEventListener('input', () => { selected = null; chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); });

  const submit = async () => {
    const ml = selected != null ? presetMl(selected, units) : volumeInputToMl(input.value, units);
    if (!Number.isFinite(ml) || ml < 1 || ml > 5000) { error.textContent = `Enter an amount between ${volumeString(1, units)} and ${volumeString(5000, units)}.`; return; }
    sheet.close();
    const t = timeInput.value && timeInput.value !== now ? timeInput.value : null;
    await addWater(ml, settings, { time: t && t <= localTime() ? t : null });
  };

  const sheet = openSheet({ title: 'Log Water', content: h('div', { class: 'stack' },
    chips,
    h('label', { class: 'field' }, input, h('span', { class: 'field__suffix' }, volumeInputUnit(units))),
    h('label', { class: 'field field--row' }, h('span', { class: 'field__label' }, 'When'), timeInput),
    h('div', { class: 't-caption c-3' }, 'Forgot to log one? Set the time you drank it.'),
    error,
    Button({ label: 'Add', variant: 'primary', block: true, onClick: submit })) });
  setTimeout(() => input.focus(), 450);
}

export function openGoalSheet(settings) {
  const { units, hydrationGoalMl } = settings;
  const current = hydrationGoalMl ? (units === 'metric' ? hydrationGoalMl : round(mlToFlOz(hydrationGoalMl), 0)) : '';
  const input = h('input', { type: 'number', inputmode: 'decimal', step: 'any', value: String(current), placeholder: units === 'metric' ? '2000' : '64' });
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
    hydrationGoalMl && Button({ label: 'Use Recommended Goal', block: true, onClick: async () => { await repo.updateSettings({ hydrationGoalMl: null }); sheet.close(); } })) });
}
