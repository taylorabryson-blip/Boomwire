/** Food detail sheet: source, portion picker, quantity, live nutrition, add/save. */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { Button, Stepper } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import { logFood, toggleSaved, isSaved, servingsFor } from '../../services/nutrition/log.js';
import { VERIFICATION_LABEL } from '../../services/nutrition/food-db.js';
import { MEAL_LABELS } from './nutrition.js';
import * as repo from '../../services/storage/repository.js';

const fmt = (v, d = 0) => (v == null ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toString());

export function SourceBadge(v) {
  return h('span', { class: `badge-src ${v === 'verified' ? 'badge-src--verified' : ''}` }, icon(v === 'verified' ? 'shield' : v === 'community' ? 'user' : 'edit', 13), VERIFICATION_LABEL[v]);
}

/**
 * @param food normalized food
 * @param opts {date, meal, entry?} — with entry, the sheet edits an existing log entry
 */
export async function openFoodSheet(food, { date, meal, entry = null, onDone } = {}) {
  const portions = [...(food.basisGrams ? [['100 g', 100], ['1 g', 1]] : []), ...(food.portions ?? [])];
  if (!food.basisGrams) portions.unshift([food.basisLabel, null]);
  if (food.basisGrams && !food.portions?.length) portions.unshift(['1 oz (28.35 g)', 28.35]);
  let pIdx = 0;
  if (entry?.portionLabel) pIdx = Math.max(0, portions.findIndex((p) => p[0] === entry.portionLabel));
  else if (food.lastPortion) pIdx = Math.max(0, portions.findIndex((p) => p[0] === food.lastPortion.label));
  else if (food.portions?.length) pIdx = portions.findIndex((p) => p[0] === food.portions[0][0]);
  let qty = entry?.quantity ?? food.lastPortion?.quantity ?? 1;
  let mealSel = entry?.meal ?? meal;
  let saved = await isSaved(food);

  const nut = h('div', { class: 'grid-3', style: { gridTemplateColumns: 'repeat(4, minmax(0,1fr))' } });
  const extra = h('div', { class: 't-caption c-2', style: { marginTop: '8px' } });
  const gramsLine = h('div', { class: 't-footnote c-2' });
  function render() {
    const [label, grams] = portions[pIdx];
    const servings = food.basisGrams ? servingsFor(food, { portionGrams: grams, quantity: qty }) : qty;
    const n = Object.fromEntries(Object.entries(food.nutrients).map(([k, v]) => [k, v == null ? null : v * servings]));
    nut.replaceChildren(...[['kcal', 'Calories', 0, ''], ['protein', 'Protein', 1, 'g'], ['carbs', 'Carbs', 1, 'g'], ['fat', 'Fat', 1, 'g']].map(([k, l, d, u]) =>
      h('div', { class: 'tile' }, h('div', { class: 'tile__value' }, fmt(n[k], d), h('span', { class: 'stat__unit' }, u)), h('div', { class: 'tile__label' }, l))));
    extra.textContent = `Fiber ${fmt(n.fiber, 1)} g · Sugars ${fmt(n.sugars, 1)} g · Sat. fat ${fmt(n.satfat, 1)} g · Sodium ${fmt(n.sodium)} mg`;
    gramsLine.textContent = grams ? `${fmt(grams * qty, 1)} g total · values per ${food.basisLabel}: ${fmt(food.nutrients.kcal)} kcal` : `${qty} × ${label}`;
  }

  const portionChips = h('div', { class: 'chips chips--scroll' }, portions.map(([label], i) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(i === pIdx), onClick: () => { pIdx = i; portionChips.querySelectorAll('.chip').forEach((c, j) => c.setAttribute('aria-pressed', String(j === i))); haptic(); render(); } }, label);
    return b;
  }));
  const qtyInput = h('input', { type: 'number', inputmode: 'decimal', step: 'any', min: '0.1', value: String(qty), style: { width: '80px', textAlign: 'center', fontSize: '20px', fontWeight: 600, background: 'var(--c-surface-2)', border: 0, borderRadius: '10px', height: '40px' },
    onInput: (e) => { const v = Number(e.target.value); if (v > 0 && v <= 100) { qty = v; render(); } } });
  const step = (d) => { qty = Math.max(0.25, Math.round((qty + d) * 4) / 4); qtyInput.value = String(qty); haptic(); render(); };
  const mealSeg = h('div', { class: 'chips' }, Object.entries(MEAL_LABELS).map(([m, l]) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(m === mealSel), onClick: () => { mealSel = m; mealSeg.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b))); haptic(); } }, l);
    return b;
  }));
  const star = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Save food', onClick: async () => { await toggleSaved(food); saved = !saved; star.replaceChildren(icon(saved ? 'starFill' : 'star', 18)); haptic('success'); toast(saved ? 'Saved to My Foods' : 'Removed from My Foods', { iconName: 'star' }); } }, icon(saved ? 'starFill' : 'star', 18));

  const sheet = openSheet({
    title: entry ? 'Edit Entry' : 'Add Food',
    content: h('div', { class: 'stack' },
      h('div', { class: 'row', style: { alignItems: 'flex-start' } },
        h('div', { class: 'grow' }, h('div', { class: 't-headline' }, food.name), food.brand && h('div', { class: 't-footnote c-2' }, food.brand), h('div', { style: { marginTop: '4px' } }, SourceBadge(food.verification))),
        star),
      portionChips,
      h('div', { class: 'row row--between' },
        h('span', { class: 't-subhead c-2' }, 'Quantity'),
        h('div', { class: 'row', style: { gap: '8px' } },
          h('button', { class: 'add-btn', type: 'button', 'aria-label': 'Less', onClick: () => step(-0.5) }, icon('minus', 16)), qtyInput,
          h('button', { class: 'add-btn', type: 'button', 'aria-label': 'More', onClick: () => step(0.5) }, icon('plus', 16)))),
      gramsLine, nut, extra,
      mealSeg,
      Button({ label: entry ? 'Save Changes' : `Add to ${MEAL_LABELS[mealSel] ?? 'Meal'}`, variant: 'primary', block: true, onClick: async () => {
        const [label, grams] = portions[pIdx];
        if (entry) {
          await repo.update('foodLogs', entry.id, { meal: mealSel, portionLabel: label, portionGrams: grams, quantity: qty,
            servings: Math.round((food.basisGrams ? servingsFor(food, { portionGrams: grams, quantity: qty }) : qty) * 1000) / 1000 });
          toast('Entry updated');
        } else {
          await logFood(food, { date, meal: mealSel, portionLabel: label, portionGrams: grams, quantity: qty });
          haptic('success');
          toast(`Added to ${MEAL_LABELS[mealSel]}`, { subtitle: food.name.slice(0, 40) });
        }
        sheet.close(); onDone?.();
      } }),
      entry && Button({ label: 'Delete Entry', variant: 'danger', block: true, onClick: async () => {
        await repo.remove('foodLogs', entry.id); sheet.close();
        toast('Entry deleted', { iconName: 'trash', actionLabel: 'Undo', onAction: () => repo.restore('foodLogs', entry.id) });
        onDone?.();
      } })),
  });
  render();
  return sheet;
}

/** Turn a log entry back into a "food" for editing. */
export function foodFromEntry(e) {
  return { name: e.name, brand: e.brand, source: e.source, sourceId: e.sourceId, verification: e.verification, basisLabel: e.basisLabel, basisGrams: e.basisGrams, nutrients: e.nutrients,
    portions: e.portionLabel && e.portionGrams ? [[e.portionLabel, e.portionGrams]] : [] };
}
