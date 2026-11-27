/**
 * Nutrition — one screen: calories & macros, water, four meals.
 * Everything else (meal detail, add food, targets, week) is one tap away.
 */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { NavHeader, Card, ProgressRing, ProgressBar, Provenance, Button, IconButton } from '../../components/primitives.js';
import { haptic } from '../../components/haptics.js';
import * as repo from '../../services/storage/repository.js';
import { navigate } from '../../navigation/nav.js';
import { localDateKey, addDays, formatRelativeDay } from '../../utils/dates.js';
import { volumeString, cupsString, flOzToMl } from '../../utils/units.js';
import { dailyTotal, goalProgress } from '../../engines/calculations/hydration.js';
import { byMeal, totals, macroPercents } from '../../engines/nutrition/nutrition.js';
import { openQuickLog } from './quick-log-sheet.js';
import { activeTargets, waterGoal } from '../../services/nutrition/log.js';
import { addWater, openAddWaterSheet, openWaterLog } from '../shared/hydration-ui.js';
import { lastDrinkTime } from '../../engines/calculations/hydration.js';
import { fmt12, toMin } from '../../engines/coach/parser.js';
import { liveScreen } from '../shared/live.js';
import { suggestionsForToday } from '../../services/nutrition/suggest.js';
import { headline } from '../../engines/nutrition/suggest.js';

export const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks' };
const MEAL_ICONS = { breakfast: 'sunrise', lunch: 'sun', dinner: 'moon', snacks: 'apple' };
let viewDate = null;

export function mount(root, { params }) {
  if (params.get('date')) viewDate = params.get('date');
  return liveScreen(root, async (refresh) => {
    const today = localDateKey();
    const date = viewDate ?? today;
    const [settings0, food, water, targets] = await Promise.all([repo.getSettings(), repo.listByDate('foodLogs', date), repo.listByDate('hydrationLogs', date), activeTargets()]);
    const [wg, ideas] = await Promise.all([waterGoal(settings0), date === today ? suggestionsForToday(date).catch(() => []) : []]);
    const idea = headline(ideas);
    const settings = { ...settings0, hydrationGoalMl: wg.ml };
    const t = totals(food);
    const meals = byMeal(food);
    const hasTargets = targets && !targets.missing;
    const pct = settings.macroDisplay === 'percent';
    const mp = macroPercents(t);
    const waterMl = dailyTotal(water, date);
    const shift = (n) => { viewDate = addDays(date, n) > today ? today : addDays(date, n); haptic(); refresh(); };

    const macroRow = (key, label, color) => {
      const target = hasTargets ? targets[key] : null;
      return h('div', { class: 'macro' },
        h('span', {}, label),
        ProgressBar({ progress: target ? t[key] / target : null, color }),
        h('span', { class: 'macro__val' }, pct ? `${Math.round(mp[key] * 100)}%` : `${Math.round(t[key])}${target ? ` / ${target}` : ''} g`));
    };

    return [
      NavHeader({
        eyebrow: h('span', { class: 'row', style: { gap: '6px' } },
          h('button', { type: 'button', 'aria-label': 'Previous day', onClick: () => shift(-1), class: 'icon-btn', style: { width: '26px', height: '26px' } }, icon('chevronLeft', 14)),
          formatRelativeDay(date, today),
          h('button', { type: 'button', 'aria-label': 'Next day', disabled: date >= today, onClick: () => shift(1), class: 'icon-btn', style: { width: '26px', height: '26px', opacity: date >= today ? 0.3 : 1 } }, icon('chevronRight', 14))),
        title: 'Nutrition',
        trailing: h('div', { class: 'row', style: { gap: '8px' } }, IconButton({ iconName: 'analytics', label: 'Week summary', href: `#/nutrition-week?date=${date}` }), h('button', { class: 'icon-btn icon-btn--primary', type: 'button', 'aria-label': 'Say what you ate', onClick: () => openQuickLog({ date }) }, icon('mic', 18))),
      }),
      Card({},
        h('div', { class: 'row', style: { gap: '18px', alignItems: 'center' } },
          ProgressRing({ progress: hasTargets ? t.kcal / targets.kcal : null, size: 88, stroke: 10, color: t.kcal > (targets?.kcal ?? Infinity) * 1.1 ? '#ff9f0a' : '#fff',
            center: h('div', {},
              h('div', { class: 'rounded num', style: { fontSize: '22px', fontWeight: 700 } }, hasTargets ? String(Math.round(Math.abs(targets.kcal - t.kcal))) : String(Math.round(t.kcal))),
              h('div', { class: 't-caption c-2' }, hasTargets ? (t.kcal > targets.kcal ? 'kcal over' : 'kcal left') : 'kcal')) }),
          h('div', { class: 'grow' },
            h('button', { type: 'button', style: { display: 'block', width: '100%', textAlign: 'left' }, 'aria-label': 'Toggle grams or percent',
              onClick: () => repo.updateSettings({ macroDisplay: pct ? 'grams' : 'percent' }) },
              macroRow('protein', 'Protein', '#64d2ff'), macroRow('carbs', 'Carbs', '#ffd60a'), macroRow('fat', 'Fat', '#ff9f0a')),
            hasTargets
              ? (idea ? null : h('div', { class: 't-caption c-2', style: { marginTop: '10px' } }, `${Math.round(t.kcal)} of ${targets.kcal} kcal · Fiber ${Math.round(t.fiber)}/${targets.fiber} g`))
              : h('div', { style: { marginTop: '10px' } }, Button({ label: 'Set Targets', size: 'small', block: true, onClick: () => navigate('#/nutrition-targets') })))),
        idea && h('button', { class: 'idea-line', type: 'button', 'aria-label': `${idea.title}: ${idea.text}`, onClick: () => navigate('#/food-ideas') },
          icon('bolt', 14), h('span', { class: 'idea-line__text' }, h('b', {}, idea.title), ` · ${idea.text}`), icon('chevronRight', 12))),
      Card({},
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'row grow water-sum', 'aria-label': 'Today’s water log', onClick: () => openWaterLog(settings) },
            h('span', { style: { color: 'var(--c-water)' } }, icon('drop', 22)),
            h('div', { class: 'grow' },
              h('div', { class: 't-headline num' }, volumeString(waterMl, settings.units)),
              h('div', { class: 't-caption c-2' }, [
                settings.hydrationGoalMl ? `${Math.round((goalProgress(waterMl, settings.hydrationGoalMl) ?? 0) * 100)}% of goal` : 'add weight for a goal',
                lastDrinkTime(water) && `last ${fmt12(toMin(lastDrinkTime(water)))}`,
              ].filter(Boolean).join(' · ')))),
          Button({ label: settings.units === 'metric' ? '+250 ml' : '+1 cup', size: 'small', onClick: () => addWater(settings.units === 'metric' ? 250 : Math.round(flOzToMl(8)), settings) }),
          h('button', { class: 'add-btn', type: 'button', 'aria-label': 'Custom amount', onClick: () => openAddWaterSheet(settings) }, icon('plus', 16)))),
      h('div', { class: 'meal-tiles' }, Object.entries(MEAL_LABELS).map(([m, label]) => {
        const info = meals[m]; const n = info.entries.length;
        return h('div', { class: 'meal-tile' },
          h('button', { type: 'button', class: 'meal-tile__main', 'aria-label': `${label} details`, onClick: () => navigate(`#/meal?meal=${m}&date=${date}`) },
            h('span', { class: 'meal-tile__head' }, icon(MEAL_ICONS[m], 15), label),
            h('span', { class: 'meal-tile__kcal num' }, n ? `${Math.round(info.totals.kcal)}` : '—', n ? h('small', {}, ' kcal') : null),
            h('span', { class: 'meal-tile__sub' }, n ? `P ${Math.round(info.totals.protein)} · C ${Math.round(info.totals.carbs)} · F ${Math.round(info.totals.fat)}` : 'Nothing logged')),
          h('button', { class: 'add-btn meal-tile__add', type: 'button', 'aria-label': `Add to ${label}`, onClick: () => navigate(`#/add-food?meal=${m}&date=${date}`) }, icon('plus', 16)));
      })),
    ];
  });
}
