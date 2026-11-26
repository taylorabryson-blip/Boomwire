/** Body measurements: log sheet + full history with per-metric chart. */
import { h } from '../../components/dom.js';
import { NavHeader, IconButton, Section, Card, List, ListRow, FieldRow, Button, EmptyState, SegmentedControl, Provenance } from '../../components/primitives.js';
import { LineChart } from '../../components/line-chart.js';
import { openSheet, confirmSheet, toast } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { MEASUREMENTS } from '../../data/models.js';
import { localDateKey, formatRelativeDay, parseDateKey } from '../../utils/dates.js';
import { weightUnit, lengthUnit, weightValue, lengthValue, weightInputToKg, lengthInputToCm, weightString, lengthString } from '../../utils/units.js';
import { liveScreen } from '../shared/live.js';

export const MEASURE_LABELS = { chestCm: 'Chest', waistCm: 'Waist', armsCm: 'Arms', thighsCm: 'Thighs', calvesCm: 'Calves', shouldersCm: 'Shoulders' };

export function openLogWeightSheet(settings, existing = null) {
  const u = settings.units;
  const num = (val) => h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: '0', placeholder: '—', value: val ?? '', style: { width: '90px' } });
  const date = h('input', { type: 'date', value: existing?.date ?? localDateKey(), max: localDateKey() });
  const weight = num(existing?.weightKg != null ? weightValue(existing.weightKg, u) : '');
  const inputs = Object.fromEntries(MEASUREMENTS.map((k) => [k, num(existing?.[k] != null ? lengthValue(existing[k], u) : '')]));
  const err = h('div', { class: 'field-error' });
  const sheet = openSheet({
    title: existing ? 'Edit Entry' : 'Log Body Metrics',
    content: h('div', { class: 'stack' },
      List(
        FieldRow({ title: 'Date', control: date }),
        FieldRow({ title: `Weight (${weightUnit(u)})`, control: weight })),
      h('div', { class: 't-footnote c-2' }, `Measurements (${lengthUnit(u)}) — optional. Measure at the same spot and time of day each time.`),
      List(...MEASUREMENTS.map((k) => FieldRow({ title: MEASURE_LABELS[k], control: inputs[k] }))),
      err,
      Button({ label: 'Save', variant: 'primary', block: true, onClick: async () => {
        const rec = { date: date.value, weightKg: weightInputToKg(weight.value, u), provenance: 'recorded' };
        for (const k of MEASUREMENTS) rec[k] = lengthInputToCm(inputs[k].value, u);
        if ([rec.weightKg, ...MEASUREMENTS.map((k) => rec[k])].some((v) => Number.isNaN(v))) { err.textContent = 'Numbers only, please.'; return; }
        try {
          if (existing) await repo.update('bodyMetrics', existing.id, rec);
          else await repo.create('bodyMetrics', rec);
          sheet.close();
          toast('Saved', { subtitle: rec.weightKg != null ? weightString(rec.weightKg, u) : 'Measurements logged' });
        } catch (e) {
          err.textContent = e.errors?.includes('at least one value is required') ? 'Enter at least one value.' : 'Check the values — something is out of range.';
        }
      } }),
      existing && Button({ label: 'Delete Entry', variant: 'danger', block: true, onClick: async () => {
        sheet.close();
        if (await confirmSheet({ title: 'Delete entry?', message: 'This weigh-in and its measurements will be removed.' })) await repo.remove('bodyMetrics', existing.id);
      } })),
  });
}

let metric = 'weightKg';

export function mount(root) {
  return liveScreen(root, async (refresh) => {
    const [settings, metrics] = await Promise.all([repo.getSettings(), repo.list('bodyMetrics')]);
    const u = settings.units;
    const sorted = metrics.sort((a, b) => a.date.localeCompare(b.date));
    const pts = sorted.filter((m) => m[metric] != null).map((m) => ({
      label: parseDateKey(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: metric === 'weightKg' ? weightValue(m[metric], u) : lengthValue(m[metric], u),
    }));
    const opts = [{ value: 'weightKg', label: 'Weight' }, ...MEASUREMENTS.slice(0, 3).map((k) => ({ value: k, label: MEASURE_LABELS[k] }))];
    return [
      NavHeader({ title: 'Measurements', back: { href: '#/progress', label: 'Progress' }, trailing: IconButton({ iconName: 'plus', label: 'Log measurement', onClick: () => openLogWeightSheet(settings) }) }),
      Section({ first: true, action: Provenance('recorded') },
        h('div', { class: 'chips chips--scroll' }, [{ value: 'weightKg', label: 'Weight' }, ...MEASUREMENTS.map((k) => ({ value: k, label: MEASURE_LABELS[k] }))].map((o) =>
          h('button', { class: 'chip', type: 'button', 'aria-pressed': String(metric === o.value), onClick: () => { metric = o.value; refresh(); } }, o.label))),
        h('div', { style: { marginTop: '12px' } }, Card({}, pts.length ? LineChart({ points: pts, format: (v) => `${v} ${metric === 'weightKg' ? weightUnit(u) : lengthUnit(u)}` }) : EmptyState({ inline: true, title: 'No data for this measurement yet' })))),
      (() => {
        if (!sorted.length) return Card({}, EmptyState({ iconName: 'ruler', title: 'No entries yet', body: 'Tap + to log your first weigh-in.', action: Button({ label: 'Log Now', variant: 'primary', onClick: () => openLogWeightSheet(settings) }) }));
        const row = (m, after) => ListRow({
          title: formatRelativeDay(m.date),
          subtitle: [m.weightKg != null && weightString(m.weightKg, u), ...MEASUREMENTS.filter((k) => m[k] != null).map((k) => `${MEASURE_LABELS[k]} ${lengthString(m[k], u)}`)].filter(Boolean).join(' · '),
          onClick: () => { after?.(); openLogWeightSheet(settings, m); },
        });
        const recent = [...sorted].reverse();
        return List(...recent.slice(0, 3).map((m) => row(m)),
          recent.length > 3 && ListRow({ iconName: 'list', title: 'All Entries', value: String(recent.length), onClick: () => { const { close } = openSheet({ title: 'All Entries', content: List(...recent.map((m) => row(m, () => close()))) }); } }));
      })(),
    ];
    void opts;
  });
}
