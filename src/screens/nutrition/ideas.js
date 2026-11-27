/**
 * For You: personalized food ideas (N12), one group at a time (segmented,
 * like Apple's own apps). Each row opens the food sheet with full USDA
 * nutrition facts and the suggested portion preselected.
 */
import { h } from '../../components/dom.js';
import { NavHeader, SegmentedControl, List, ListRow, EmptyState, Card } from '../../components/primitives.js';
import { liveScreen } from '../shared/live.js';
import { suggestionsForToday, mealForNow } from '../../services/nutrition/suggest.js';
import { openFoodSheet } from './food-sheet.js';
import { localDateKey } from '../../utils/dates.js';

let tab = null;

export function mount(root) {
  return liveScreen(root, async (refresh) => {
    const date = localDateKey();
    const groups = await suggestionsForToday(date);
    const open = (it) => openFoodSheet({ ...it.food, lastPortion: { label: it.portion.label, grams: it.portion.grams, quantity: it.portion.quantity } }, { date, meal: mealForNow() });
    const g = groups.find((x) => x.id === tab) ?? groups[0];
    return [
      NavHeader({ title: 'For You', back: { href: '#/nutrition', label: 'Nutrition' } }),
      ...(g ? [
        groups.length > 1 && SegmentedControl({ label: 'Suggestion type', value: g.id, onChange: (v) => { tab = v; refresh(); }, options: groups.map((x) => ({ value: x.id, label: x.tab })) }),
        h('div', { class: 'ideas-head' }, h('div', { class: 't-title-3' }, g.title), h('div', { class: 't-footnote c-2' }, g.subtitle)),
        List(...g.items.map((it) => ListRow({ title: it.food.name, subtitle: `${it.portionText} · ${it.reason}`, onClick: () => open(it) }))),
        h('p', { class: 't-caption c-3 ideas-foot' }, 'Nutrition facts from USDA. Portions sized to your weight and what’s left today. Tap a food to see the label and log it.'),
      ] : [Card({}, EmptyState({ inline: true, iconName: 'apple', title: 'Nothing to suggest yet', body: 'Add your weight and height in Profile so Hercules can size portions for you.' }))]),
    ];
  });
}
