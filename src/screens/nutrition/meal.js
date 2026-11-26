/** Meal detail: entries (tap to edit), totals, add food, save as meal. */
import { h } from '../../components/dom.js';
import { NavHeader, Card, List, ListRow, Button, EmptyState } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { navigate } from '../../navigation/nav.js';
import { localDateKey, formatRelativeDay } from '../../utils/dates.js';
import { byMeal, entryNutrients } from '../../engines/nutrition/nutrition.js';
import { saveMeal } from '../../services/nutrition/log.js';
import { MEAL_LABELS } from './nutrition.js';
import { openFoodSheet, foodFromEntry, SourceBadge } from './food-sheet.js';
import { liveScreen } from '../shared/live.js';

export function mount(root, { params }) {
  const meal = params.get('meal') ?? 'breakfast';
  const date = params.get('date') ?? localDateKey();
  return liveScreen(root, async () => {
    const info = byMeal(await repo.listByDate('foodLogs', date))[meal];
    const t = info.totals;
    return [
      NavHeader({ title: MEAL_LABELS[meal], eyebrow: formatRelativeDay(date), back: { href: '#/nutrition', label: 'Nutrition' } }),
      Card({}, h('div', { class: 'tiles', style: { gridTemplateColumns: 'repeat(4, minmax(0,1fr))' } },
        ...[['kcal', 'kcal'], ['protein', 'protein'], ['carbs', 'carbs'], ['fat', 'fat']].map(([k, l]) => h('div', {},
          h('div', { class: 'tile__value' }, String(Math.round(t[k]))), h('div', { class: 'tile__label' }, k === 'kcal' ? l : `${l} g`))))),
      info.entries.length
        ? List(...info.entries.map((e) => {
          const n = entryNutrients(e);
          return ListRow({ title: e.name, subtitle: `${e.portionLabel ? `${e.quantity ?? 1} × ${e.portionLabel}` : `${Math.round(e.servings * 100) / 100} × ${e.basisLabel}`} · P ${Math.round(n.protein)} C ${Math.round(n.carbs)} F ${Math.round(n.fat)}`,
            value: `${Math.round(n.kcal)}`, onClick: () => openFoodSheet(foodFromEntry(e), { date, meal, entry: e }) });
        }))
        : Card({}, EmptyState({ iconName: 'nutrition', title: `No ${MEAL_LABELS[meal].toLowerCase()} logged`, body: 'Search 7,000+ USDA foods or scan brands.' })),
      h('div', { class: 'btn-row' },
        Button({ label: 'Add Food', iconName: 'plus', variant: 'primary', onClick: () => navigate(`#/add-food?meal=${meal}&date=${date}`) }),
        info.entries.length > 0 && Button({ label: 'Save as Meal', iconName: 'star', onClick: () => {
          const input = h('input', { value: `My ${MEAL_LABELS[meal].toLowerCase()}`, maxlength: '60', style: { fontSize: '20px' } });
          const sheet = openSheet({ title: 'Save Meal', content: h('div', { class: 'stack' }, h('label', { class: 'field' }, input),
            h('div', { class: 't-footnote c-2' }, `${info.entries.length} items · ${Math.round(t.kcal)} kcal. Log it again in one tap from Add Food → Meals.`),
            Button({ label: 'Save', variant: 'primary', block: true, onClick: async () => { await saveMeal(input.value.trim() || 'My meal', info.entries); sheet.close(); toast('Meal saved', { iconName: 'star' }); } })) });
        } })),
    ];
  });
}

export { SourceBadge };
