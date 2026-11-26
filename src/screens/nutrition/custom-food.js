/** Create a custom food from a nutrition label (stored as "Your entry"). */
import { h } from '../../components/dom.js';
import { NavHeader, List, ListRow, FieldRow, Button, SegmentedControl } from '../../components/primitives.js';
import { toast, openSheet } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { navigate } from '../../navigation/nav.js';
import { openFoodSheet } from './food-sheet.js';

export async function mount(root, { params }) {
  const meal = params.get('meal') ?? 'snacks', date = params.get('date');
  let basis = 'serving';
  const inp = (ph, mode = 'decimal') => h('input', { type: mode === 'text' ? 'text' : 'number', inputmode: mode, step: 'any', min: '0', placeholder: ph, style: { width: '130px' } });
  const f = {
    name: Object.assign(inp('Required', 'text'), { value: params.get('name') ?? '' }), brand: inp('Optional', 'text'),
    servingLabel: Object.assign(inp('1 serving', 'text'), { value: '1 serving' }), servingGrams: Object.assign(inp('g'), { style: 'width:56px' }),
    kcal: inp('0'), protein: inp('0'), carbs: inp('0'), fat: inp('0'), fiber: inp('—'), sugars: inp('—'), sodium: inp('— mg'), satfat: inp('—'),
  };
  const err = h('div', { class: 'field-error' });
  const n = (el) => (el.value === '' ? null : Number(el.value));
  const saveFood = async () => {
      const name = f.name.value.trim();
      if (!name) { err.textContent = 'Give the food a name.'; return; }
      const nutrients = Object.fromEntries(['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugars', 'sodium', 'satfat'].map((k) => [k, n(f[k])]));
      for (const k of ['kcal', 'protein', 'carbs', 'fat']) nutrients[k] = nutrients[k] ?? 0;
      if (Object.values(nutrients).some((v) => v != null && (Number.isNaN(v) || v < 0))) { err.textContent = 'Numbers must be 0 or more.'; return; }
      const sg = n(f.servingGrams);
      const per100 = basis === '100g';
      try {
        const food = await repo.create('foods', {
          name, brand: f.brand.value.trim() || null, source: 'custom', sourceId: null, verification: 'user', saved: true,
          basisLabel: per100 ? '100 g' : (f.servingLabel.value.trim() || '1 serving'), basisGrams: per100 ? 100 : (sg > 0 ? sg : null),
          nutrients, portions: !per100 && sg > 0 ? [[f.servingLabel.value.trim() || '1 serving', sg]] : [],
        });
        toast('Food created', { iconName: 'star' });
        openFoodSheet(food, { date, meal, onDone: () => navigate(`#/meal?meal=${meal}&date=${date}`, { replace: true }) });
      } catch (e) { err.textContent = e.errors?.[0] ?? 'Check the values.'; }
  };
  root.append(
    NavHeader({ title: 'Custom Food', back: { href: `#/add-food?meal=${meal}&date=${date}`, label: 'Back' }, trailing: h('button', { type: 'button', class: 'nav-text-btn', onClick: saveFood }, 'Add') }),
    List(FieldRow({ title: 'Name', control: f.name }), FieldRow({ title: 'Brand', control: f.brand })),
    SegmentedControl({ label: 'Values are', value: basis, onChange: (v) => { basis = v; }, options: [{ value: 'serving', label: 'Per serving' }, { value: '100g', label: 'Per 100 g' }] }),
    List(FieldRow({ title: 'Serving', control: h('span', { class: 'row', style: { gap: '8px' } }, f.servingLabel, f.servingGrams) })),
    h('div', { class: 'grid-2 tile-inputs' }, [['kcal', 'Calories'], ['protein', 'Protein · g'], ['carbs', 'Carbs · g'], ['fat', 'Fat · g']]
      .map(([k, l]) => h('label', { class: 'tile' }, f[k], h('span', { class: 'tile__label' }, l)))),
    List(ListRow({ iconName: 'list', title: 'More Nutrients', value: 'Optional', onClick: () => openSheet({ title: 'More Nutrients',
      content: List(...[['fiber', 'Fiber (g)'], ['sugars', 'Sugars (g)'], ['satfat', 'Saturated fat (g)'], ['sodium', 'Sodium (mg)']].map(([k, l]) => FieldRow({ title: l, control: f[k] }))) }) })),
    err,
  );
}
