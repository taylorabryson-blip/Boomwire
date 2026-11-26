/**
 * Say-it-and-log: turns "two eggs and a cup of oatmeal" into ready-to-log entries.
 * Resolution order per item: your own history (so "my protein shake" finds your shake),
 * then your saved/custom foods, then USDA. Portions come from USDA household measures.
 */
import * as repo from '../storage/repository.js';
import { parseMeal, matchPortion } from '../../engines/nutrition/meal-parser.js';
import { searchUSDA, recentFoods, loadUSDA, fromUSDARow } from './food-db.js';
import { logFood } from './log.js';

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const singular = (w) => w.replace(/(ies)$/, 'y').replace(/(oes|ches|shes|sses)$/, (m) => m.slice(0, -2)).replace(/([^s])s$/, '$1');
const words = (s) => norm(s).split(' ').filter((w) => w.length > 1).map(singular);

/** Short display name: "Egg, whole, raw, fresh" → "Egg, whole". */
export function shortName(name) {
  const parts = String(name).split(',').map((x) => x.trim());
  return parts.length > 2 ? parts.slice(0, 2).join(', ') : String(name);
}

async function usdaPortions(food) {
  if (food.source !== 'usda' || !food.sourceId) return food.portions ?? [];
  const d = await loadUSDA();
  const row = d.foods.find((r) => String(r[0]) === String(food.sourceId));
  return row ? fromUSDARow(row, d.categories).portions : (food.portions ?? []);
}

function historyMatch(item, recents, custom) {
  const want = words(item.food);
  if (!want.length) return null;
  const score = (f) => { const have = new Set(words(f.name + ' ' + (f.brand ?? ''))); return want.filter((w) => have.has(w)).length / want.length; };
  const pool = [...custom.map((f) => ({ f, s: score(f) + 0.05 })), ...recents.map((f) => ({ f, s: score(f) + Math.min(0.1, (f.timesLogged ?? 1) * 0.02) }))];
  const best = pool.sort((a, b) => b.s - a.s)[0];
  return best && best.s >= 1 ? best.f : null;
}

/** Resolve text → [{ item, food, alternatives, portion: {grams,label,estimated} }]. */
export async function resolveMeal(text) {
  const items = parseMeal(text);
  if (!items.length) return [];
  const [recents, custom] = await Promise.all([recentFoods(80), repo.list('foods')]);
  return Promise.all(items.map(async (item) => {
    const hist = historyMatch(item, recents, custom.filter((f) => !f.deletedAt));
    const usda = await searchUSDA(item.food, 6);
    const food = hist ?? usda[0] ?? null;
    if (!food) return { item, food: null, alternatives: [], portion: null };
    const portions = await usdaPortions(food);
    let portion;
    if (hist?.lastPortion && !item.explicit && !item.unit && !item.size) {
      portion = { grams: (hist.lastPortion.grams ?? 100) * item.qty * (hist.lastPortion.quantity ?? 1), label: `your usual · ${hist.lastPortion.label}`, estimated: false };
    } else if (food.basisGrams == null) {
      portion = { grams: null, label: `${item.qty} × ${food.basisLabel}`, servings: item.qty, estimated: false };
    } else {
      portion = matchPortion(item, portions, { liquid: /milk|juice|water|coffee|tea|soda|shake|smoothie|beer|wine/.test(item.food) });
    }
    return { item, food: { ...food, portions }, alternatives: usda.filter((f) => f.sourceId !== food.sourceId).slice(0, 4), portion };
  }));
}

export const entryKcal = (r, mult = 1) => {
  if (!r.food || !r.portion) return 0;
  const servings = r.portion.grams != null && r.food.basisGrams ? (r.portion.grams * mult) / r.food.basisGrams : (r.portion.servings ?? 1) * mult;
  return (r.food.nutrients.kcal ?? 0) * servings;
};
export const entryNutrient = (r, key, mult = 1) => {
  if (!r.food || !r.portion) return 0;
  const servings = r.portion.grams != null && r.food.basisGrams ? (r.portion.grams * mult) / r.food.basisGrams : (r.portion.servings ?? 1) * mult;
  return (r.food.nutrients[key] ?? 0) * servings;
};

export async function logResolved(rows, { date, meal }) {
  for (const r of rows) {
    if (!r.food || !r.portion) continue;
    const mult = r.mult ?? 1;
    if (r.portion.grams != null) await logFood(r.food, { date, meal, portionLabel: mult === 1 ? r.portion.label : `${mult} × ${r.portion.label}`, portionGrams: Math.round(r.portion.grams * mult * 10) / 10, quantity: 1 });
    else await logFood(r.food, { date, meal, portionLabel: r.portion.label, portionGrams: null, quantity: (r.portion.servings ?? 1) * mult });
  }
}

/** Meal slot by clock time. */
export function mealForNow(d = new Date()) {
  const m = d.getHours() * 60 + d.getMinutes();
  return m < 10 * 60 + 30 ? 'breakfast' : m < 15 * 60 ? 'lunch' : m < 21 * 60 ? 'dinner' : 'snacks';
}

/** Yesterday's (or last logged day's) entries for a meal — for one-tap "same as yesterday". */
export async function lastMeal(meal, beforeDate) {
  const logs = (await repo.list('foodLogs')).filter((e) => e.meal === meal && e.date < beforeDate && !e.deletedAt);
  if (!logs.length) return null;
  const date = logs.map((e) => e.date).sort().pop();
  return { date, entries: logs.filter((e) => e.date === date) };
}

export async function copyEntries(entries, { date, meal }) {
  for (const e of entries) {
    const { id, createdAt, updatedAt, deletedAt, rev, ...rest } = e; void id; void createdAt; void updatedAt; void deletedAt; void rev;
    await repo.create('foodLogs', { ...rest, date, meal, time: new Date().toTimeString().slice(0, 5) });
  }
}

/**
 * N12 — "Fill my macros": foods you already eat, ranked by protein per kcal, sized to cover
 * part of what's left without blowing the calorie budget. Returns up to 4 suggestions.
 */
export async function suggestions({ remaining }) {
  if (!remaining || remaining.kcal <= 50) return [];
  const recents = await recentFoods(60);
  const STAPLES = ['Chicken, broilers or fryers, breast, meat only, cooked, roasted', 'Yogurt, Greek, plain, nonfat', 'Egg, whole, cooked, hard-boiled', 'Fish, tuna, light, canned in water, drained solids', 'Cheese, cottage, lowfat, 2% milkfat', 'Bananas, raw', 'Oats'];
  const d = await loadUSDA();
  const staples = STAPLES.map((n) => d.foods.find((r) => r[1].startsWith(n))).filter(Boolean).map((r) => fromUSDARow(r, d.categories));
  const pool = [...recents, ...staples.filter((s) => !recents.some((r) => r.sourceId === s.sourceId))];
  const needProtein = remaining.protein > 10;
  const ranked = pool.filter((f) => f.basisGrams && f.nutrients.kcal > 0)
    .map((f) => ({ f, density: (f.nutrients.protein ?? 0) / f.nutrients.kcal }))
    .sort((a, b) => (needProtein ? b.density - a.density : (b.f.timesLogged ?? 0) - (a.f.timesLogged ?? 0)));
  const out = [];
  for (const { f } of ranked) {
    const portions = f.portions?.length ? f.portions : await usdaPortions(f);
    const typical = portions.find(([l]) => /medium|large|serving|cup|breast|each|piece/i.test(l)) ?? portions[0];
    let grams = f.lastPortion?.grams ?? (typical ? typical[1] : 100);
    const kcalPer = (f.nutrients.kcal * grams) / f.basisGrams;
    if (kcalPer > remaining.kcal) grams = Math.max(30, Math.floor((remaining.kcal * 0.9 * f.basisGrams) / f.nutrients.kcal / 10) * 10);
    const k = (f.nutrients.kcal * grams) / f.basisGrams;
    if (k < 40) continue;
    out.push({ food: { ...f, portions }, portion: { grams, label: f.lastPortion?.label && grams === f.lastPortion.grams ? f.lastPortion.label : (typical && grams === typical[1] ? typical[0] : `${grams} g`) }, kcal: Math.round(k), protein: Math.round(((f.nutrients.protein ?? 0) * grams) / f.basisGrams) });
    if (out.length >= 4) break;
  }
  return out;
}
