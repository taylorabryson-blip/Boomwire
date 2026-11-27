/** Feeds N12 (engines/nutrition/suggest.js) with today's real data. */
import * as repo from '../storage/repository.js';
import { loadUSDA, fromUSDARow, recentFoods } from './food-db.js';
import { activeTargets } from './log.js';
import { totals } from '../../engines/nutrition/nutrition.js';
import { suggestFoods } from '../../engines/nutrition/suggest.js';
import { SUGGESTION_FOODS } from '../../data/foods/suggestions.js';
import { localDateKey } from '../../utils/dates.js';
import { toMin } from '../../engines/coach/parser.js';

let catalog = null;

/** Suggestion foods as normalized foods with USDA nutrition facts. */
export async function suggestionCatalog() {
  if (catalog) return catalog;
  const db = await loadUSDA();
  const byId = new Map(db.foods.map((r) => [r[0], r]));
  catalog = SUGGESTION_FOODS.flatMap((s) => {
    if (s.parts) {
      // Simple recipe: sum USDA ingredients at their gram weights.
      const rows = s.parts.map(([id, g]) => [byId.get(id), g]);
      if (rows.some(([r]) => !r)) return [];
      const n = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, sodium: 0, satfat: 0 };
      for (const [r, g] of rows) {
        const f = fromUSDARow(r, db.categories);
        for (const k of Object.keys(n)) n[k] += ((f.nutrients[k] ?? 0) * g) / 100;
      }
      for (const k of Object.keys(n)) n[k] = Math.round(n[k] * 10) / 10;
      const food = { name: s.name, brand: null, source: 'usda', sourceId: `recipe:${s.key}`, verification: 'verified', basisLabel: s.portion[0], basisGrams: null,
        nutrients: n, portions: [], recipe: s.parts.map((p) => p[2]) };
      return [{ key: s.key, food, label: s.portion[0], grams: null, step: s.step, roles: s.roles }];
    }
    const r = byId.get(s.id);
    if (!r) return [];
    const base = fromUSDARow(r, db.categories);
    const food = { ...base, name: s.name, usdaName: base.name, portions: [[s.portion[0], s.portion[1]], ...base.portions.filter(([l]) => l !== s.portion[0])] };
    return [{ key: s.key, food, label: s.portion[0], grams: s.portion[1], step: s.step, roles: s.roles }];
  });
  return catalog;
}

/** Today's suggestion groups. */
export async function suggestionsForToday(date = localDateKey()) {
  const [cat, targets, food, metrics, plan, recent, workouts] = await Promise.all([
    suggestionCatalog(), activeTargets(), repo.listByDate('foodLogs', date), repo.list('bodyMetrics'),
    repo.get('coach', 'plan').catch(() => null), recentFoods(40), repo.listByDate('workouts', date).catch(() => []),
  ]);
  const w = metrics.filter((m) => m.weightKg != null).sort((a, b) => b.date.localeCompare(a.date))[0];
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Workout timing: a workout logged today wins; otherwise today's planned session.
  let workout = null;
  const done = workouts.filter((x) => x.startTime).sort((a, b) => b.startTime.localeCompare(a.startTime))[0];
  if (done) workout = { minutesUntil: toMin(done.startTime) - nowMin };
  else {
    const dow = (now.getDay() + 6) % 7;
    const s = plan?.sessions?.find((x) => x.day === dow);
    if (s?.start) workout = { minutesUntil: toMin(s.start) - nowMin };
  }
  const friendly = new Map(cat.map((c) => [c.food.sourceId, c.food.name]));
  const favorites = recent.filter((f) => f.timesLogged >= 2).map((f) => ({
    food: { ...f, name: friendly.get(f.sourceId) ?? f.name.replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/, '') }, timesLogged: f.timesLogged,
    portion: f.lastPortion ? { label: f.lastPortion.label, grams: f.lastPortion.grams, quantity: f.lastPortion.quantity ?? 1 } : null,
  }));
  return suggestFoods({ targets, eaten: totals(food), weightKg: w?.weightKg ?? null, workout, catalog: cat, favorites, hour: now.getHours() });
}

/** Meal slot that fits the current time. */
export function mealForNow(h = new Date().getHours()) {
  return h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h >= 17 && h < 21 ? 'dinner' : 'snacks';
}
