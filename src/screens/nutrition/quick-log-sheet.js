/**
 * Quick Log — say (or type) what you ate, check the matches, log everything in one tap.
 */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { Button, SegmentedControl } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import { listen, canListen } from '../../services/voice.js';
import { resolveMeal, logResolved, entryKcal, entryNutrient, shortName, mealForNow } from '../../services/nutrition/quick-log.js';
import { matchPortion } from '../../engines/nutrition/meal-parser.js';
import { localDateKey } from '../../utils/dates.js';
import { MEAL_LABELS } from './nutrition.js';

const EXAMPLES = ['2 eggs and toast', 'chicken breast with a cup of rice', 'protein shake and a banana', 'greek yogurt with blueberries'];

export function openQuickLog({ meal = mealForNow(), date = localDateKey(), autoListen = true } = {}) {
  let rows = [], rec = null, chosenMeal = meal;
  const transcript = h('div', { class: 'ql__transcript' });
  const status = h('div', { class: 'ql__status' });
  const micBtn = h('button', { class: 'ql__mic', type: 'button', 'aria-label': 'Speak' }, icon('mic', 30));
  const input = h('input', { class: 'ql__input', type: 'text', placeholder: 'Or type: 2 eggs and a banana', enterkeyhint: 'done', autocomplete: 'off',
    onKeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); run(input.value); input.blur(); } } });
  const list = h('div', { class: 'ql__list' });
  const footer = h('div', { class: 'ql__footer' });

  const stop = () => { rec?.stop(); rec = null; micBtn.classList.remove('is-listening'); };
  function startListening() {
    if (rec) { stop(); return; }
    haptic();
    rec = listen({
      onPartial: (t) => { transcript.textContent = t; status.textContent = 'Listening…'; },
      onFinal: (t) => { stop(); run(t); },
      onError: (code) => { stop(); status.textContent = code === 'not-allowed' ? 'Microphone blocked — type instead, or allow it in Settings.' : 'Didn’t catch that. Try again or type it.'; },
      onEnd: () => { if (rec) stop(); },
    });
    if (!rec) { status.textContent = 'Tap the field and use your keyboard’s 🎤 key.'; input.focus(); return; }
    micBtn.classList.add('is-listening'); status.textContent = 'Listening…'; transcript.textContent = '';
  }
  micBtn.addEventListener('click', startListening);

  async function run(text) {
    text = String(text ?? '').trim();
    if (!text) return;
    transcript.textContent = `“${text}”`; status.textContent = 'Finding foods…';
    const found = await resolveMeal(text);
    rows = found.map((r) => ({ ...r, mult: 1 }));
    status.textContent = rows.length ? '' : 'Couldn’t find foods in that. Try “2 eggs and a banana”.';
    paint();
  }

  function swap(i) {
    const r = rows[i];
    const opts = [r.food, ...r.alternatives].filter(Boolean);
    const { close } = openSheet({ title: 'Choose food', content: h('div', { class: 'list' }, opts.map((f) => h('button', { class: 'list-row', type: 'button', onClick: () => {
      const portions = f.portions ?? [];
      rows[i] = { ...r, food: f, portion: f.basisGrams ? matchPortion(r.item, portions) : { grams: null, label: f.basisLabel, servings: r.item.qty }, mult: r.mult };
      close(); paint();
    } }, h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, shortName(f.name)), h('div', { class: 'list-row__subtitle' }, f.name)),
      f === r.food ? icon('check', 18) : null))) });
  }

  function paint() {
    list.replaceChildren(...rows.map((r, i) => r.food
      ? h('div', { class: 'ql__row' },
        h('button', { class: 'ql__name', type: 'button', onClick: () => swap(i) },
          h('span', { class: 'ql__food' }, shortName(r.food.name), icon('chevronRight', 12)),
          h('span', { class: 'ql__portion' }, `${r.mult !== 1 ? `${r.mult} × ` : ''}${r.portion.label}${r.portion.estimated ? ' · est.' : ''}`)),
        h('span', { class: 'ql__kcal num' }, `${Math.round(entryKcal(r, r.mult))}`),
        h('div', { class: 'ql__step' },
          h('button', { type: 'button', 'aria-label': 'Less', onClick: () => { r.mult = Math.max(0.25, r.mult - (r.mult > 1 ? 0.5 : 0.25)); haptic(); paint(); } }, '−'),
          h('button', { type: 'button', 'aria-label': 'More', onClick: () => { r.mult = r.mult < 1 ? r.mult + 0.25 : r.mult + 0.5; haptic(); paint(); } }, '+')),
        h('button', { class: 'ql__remove', type: 'button', 'aria-label': 'Remove', onClick: () => { rows.splice(i, 1); paint(); } }, icon('close', 14)))
      : h('div', { class: 'ql__row ql__row--miss' }, h('span', {}, `No match for “${r.item.food}”`), h('button', { class: 'ql__remove', type: 'button', 'aria-label': 'Remove', onClick: () => { rows.splice(i, 1); paint(); } }, icon('close', 14)))));
    const ok = rows.filter((r) => r.food);
    wrap.classList.toggle('has-rows', rows.length > 0);
    const kcal = ok.reduce((s, r) => s + entryKcal(r, r.mult), 0);
    const protein = ok.reduce((s, r) => s + entryNutrient(r, 'protein', r.mult), 0);
    footer.replaceChildren(...(ok.length ? [
      SegmentedControl({ label: 'Meal', value: chosenMeal, options: Object.entries(MEAL_LABELS).map(([value, label]) => ({ value, label })), onChange: (v) => { chosenMeal = v; } }),
      Button({ label: `Log ${ok.length} item${ok.length > 1 ? 's' : ''} · ${Math.round(kcal)} kcal · ${Math.round(protein)} g protein`, variant: 'primary', block: true, onClick: async () => {
        await logResolved(ok, { date, meal: chosenMeal });
        haptic('success'); sheet.close();
        toast(`Logged to ${MEAL_LABELS[chosenMeal]}`, { iconName: 'check', subtitle: `${Math.round(kcal)} kcal · ${Math.round(protein)} g protein` });
      } })] : [
      h('div', { class: 'chips', style: { justifyContent: 'center' } }, EXAMPLES.map((t) => h('button', { class: 'chip', type: 'button', onClick: () => run(t) }, t))),
      Button({ label: 'Search, Scan or Recent', iconName: 'search', block: true, onClick: () => { sheet.close(); location.hash = `#/add-food?meal=${chosenMeal}&date=${date}`; } })]));
  }

  const wrap = h('div', { class: 'ql' }, h('div', { class: 'ql__hero' }, micBtn, transcript, status), input, list, footer);
  paint();
  const sheet = openSheet({ title: 'What did you eat?', content: wrap, onClose: stop });
  if (autoListen && canListen()) setTimeout(startListening, 350);
  return sheet;
}
