/** Add Food: search USDA + brands, recent, saved, saved meals, my foods, barcode, custom. */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { NavHeader, Search, SegmentedControl, List, ListRow, Card, EmptyState, Button } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import * as repo from '../../services/storage/repository.js';
import { navigate } from '../../navigation/nav.js';
import { localDateKey } from '../../utils/dates.js';
import { searchUSDA, searchOFF, lookupBarcode, myFoods, recentFoods, loadUSDA } from '../../services/nutrition/food-db.js';
import { logSavedMeal } from '../../services/nutrition/log.js';
import { totals } from '../../engines/nutrition/nutrition.js';
import { MEAL_LABELS } from './nutrition.js';
import { openFoodSheet, SourceBadge } from './food-sheet.js';

let tab = 'search';

export async function mount(root, { params }) {
  const meal = params.get('meal') ?? 'snacks';
  const date = params.get('date') ?? localDateKey();
  if (params.get('tab')) tab = params.get('tab');
  let query = '';
  const results = h('div', {});
  const done = () => navigate(`#/meal?meal=${meal}&date=${date}`, { replace: true });

  const foodRow = (f) => ListRow({
    title: f.name, subtitle: h('span', {}, `${f.brand ? `${f.brand} · ` : ''}${Math.round(f.nutrients.kcal)} kcal / ${f.basisLabel} · `, SourceBadge(f.verification)),
    chevron: false, trailing: h('span', { class: 'add-btn' }, icon('plus', 16)),
    onClick: () => openFoodSheet(f, { date, meal, onDone: done }),
  });

  let searchToken = 0;
  async function render() {
    const my = ++searchToken;
    if (tab === 'search') {
      if (!query.trim()) {
        results.replaceChildren(Card({}, EmptyState({ iconName: 'search', title: 'Search foods', body: '7,283 foods from the USDA database, plus packaged brands from Open Food Facts.' })));
        loadUSDA().catch(() => {});
        return;
      }
      results.replaceChildren(h('div', { class: 't-footnote c-2', style: { padding: '8px 4px' } }, 'Searching…'));
      const list = await searchUSDA(query, 30);
      if (my !== searchToken) return;
      results.replaceChildren(
        list.length ? List(...list.map(foodRow)) : Card({}, EmptyState({ inline: true, title: 'No USDA match', body: 'Try a simpler word, search brands below, or create the food.' })),
        h('div', { class: 'btn-row' },
          Button({ label: 'Search Brands', iconName: 'search', size: 'small', onClick: () => brandSearch(query) }),
          Button({ label: 'Create Food', iconName: 'plus', size: 'small', onClick: () => navigate(`#/custom-food?meal=${meal}&date=${date}&name=${encodeURIComponent(query)}`) })));
    } else if (tab === 'recent') {
      const list = await recentFoods();
      results.replaceChildren(list.length ? List(...list.map(foodRow)) : Card({}, EmptyState({ iconName: 'clock', title: 'Nothing yet', body: 'Foods you log show up here, most frequent first.' })));
    } else if (tab === 'mine') {
      const list = await myFoods();
      results.replaceChildren(
        list.length ? List(...list.map((f) => foodRow(f))) : Card({}, EmptyState({ iconName: 'star', title: 'No saved foods', body: 'Tap the star on any food, or create your own.' })),
        Button({ label: 'Create Custom Food', iconName: 'plus', block: true, onClick: () => navigate(`#/custom-food?meal=${meal}&date=${date}`) }));
    } else if (tab === 'meals') {
      const list = await repo.list('savedMeals');
      results.replaceChildren(list.length ? List(...list.map((m) => {
        const t = totals(m.items.map((i) => ({ ...i, deletedAt: null })));
        return ListRow({ title: m.name, subtitle: `${m.items.length} items · ${Math.round(t.kcal)} kcal · P ${Math.round(t.protein)} g`, chevron: false,
          trailing: h('span', { class: 'add-btn' }, icon('plus', 16)),
          onClick: async () => { await logSavedMeal(m, { date, meal }); haptic('success'); toast(`Logged ${m.name}`, { subtitle: `to ${MEAL_LABELS[meal]}` }); done(); } });
      })) : Card({}, EmptyState({ iconName: 'list', title: 'No saved meals', body: 'Open any meal and tap “Save as Meal” to reuse it.' })));
    }
  }

  async function brandSearch(q) {
    results.replaceChildren(h('div', { class: 't-footnote c-2', style: { padding: '8px 4px' } }, `Searching brands for “${q}”…`));
    try {
      const list = await searchOFF(q);
      results.replaceChildren(
        h('div', { class: 't-footnote c-2', style: { padding: '0 4px' } }, 'Open Food Facts is community-edited. Check values against the label.'),
        list.length ? List(...list.map(foodRow)) : Card({}, EmptyState({ inline: true, title: 'No brand matches' })),
        Button({ label: 'Back to USDA results', size: 'small', onClick: render }));
    } catch (e) {
      results.replaceChildren(Card({}, EmptyState({ inline: true, title: 'Brand search unavailable', body: 'You may be offline. USDA foods still work.' })), Button({ label: 'Back', size: 'small', onClick: render }));
    }
  }

  function barcodeSheet() {
    const input = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'e.g. 012345678905', style: { fontSize: '20px' } });
    const msg = h('div', { class: 'field-error' });
    const video = h('video', { playsinline: true, muted: true, style: { width: '100%', borderRadius: '14px', display: 'none', background: '#000' } });
    let stream = null, scanning = false;
    const lookup = async (code) => {
      msg.textContent = 'Looking up…';
      const f = await lookupBarcode(code).catch(() => null);
      if (!f) { msg.textContent = 'Not found. Try searching by name or create the food.'; return; }
      stop(); sheet.close(); openFoodSheet(f, { date, meal, onDone: done });
    };
    const stop = () => { scanning = false; stream?.getTracks().forEach((t) => t.stop()); };
    const canScan = 'BarcodeDetector' in window;
    const sheet = openSheet({ title: 'Barcode', onClose: stop, content: h('div', { class: 'stack' },
      video,
      canScan && Button({ label: 'Scan with Camera', iconName: 'barcode', block: true, onClick: async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          video.srcObject = stream; video.style.display = 'block'; await video.play(); scanning = true;
          const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          const tick = async () => { if (!scanning) return; const codes = await det.detect(video).catch(() => []); if (codes[0]) { haptic('success'); lookup(codes[0].rawValue); } else requestAnimationFrame(tick); };
          tick();
        } catch { msg.textContent = 'Camera unavailable. Type the number under the barcode instead.'; }
      } }),
      !canScan && h('div', { class: 't-footnote c-2' }, 'This browser can’t read barcodes from the camera. Type the numbers printed under the barcode.'),
      h('label', { class: 'field' }, input), msg,
      Button({ label: 'Look Up', variant: 'primary', block: true, onClick: () => { const c = input.value.replace(/\D/g, ''); if (c.length < 8) { msg.textContent = 'Enter the full barcode number.'; return; } lookup(c); } })) });
  }

  const search = Search({ placeholder: 'Search foods', onInput: (v) => { query = v; clearTimeout(search._t); search._t = setTimeout(render, 180); } });
  root.append(
    NavHeader({ title: `Add to ${MEAL_LABELS[meal]}`, back: { href: '#/nutrition', label: 'Nutrition' },
      trailing: h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Barcode', onClick: barcodeSheet }, icon('barcode', 20)) }),
    search,
    SegmentedControl({ label: 'Source', value: tab, onChange: (v) => { tab = v; render(); },
      options: [{ value: 'search', label: 'Search' }, { value: 'recent', label: 'Recent' }, { value: 'mine', label: 'My Foods' }, { value: 'meals', label: 'Meals' }] }),
    results);
  await render();
  if (tab === 'search') setTimeout(() => search.querySelector('input')?.focus(), 350);
}
