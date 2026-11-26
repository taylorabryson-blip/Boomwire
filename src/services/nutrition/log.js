/** Food log helpers: create entries from foods, saved meals, favourites. */
import * as repo from '../storage/repository.js';
import { localTime } from '../../utils/dates.js';
import { NUTRIENT_KEYS } from '../../data/models.js';
import { computeTargets, waterTarget } from '../../engines/nutrition/nutrition.js';
import { approxAge } from '../../data/models.js';

const cleanNutrients = (n) => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, n?.[k] == null ? (['kcal', 'protein', 'carbs', 'fat'].includes(k) ? 0 : null) : Number(n[k])]));

/**
 * servings = how many "basis" units were eaten.
 * USDA basis is 100 g, so servings = portionGrams × quantity / 100.
 */
export function servingsFor(food, { portionGrams, quantity }) {
  if (food.basisGrams) return (portionGrams * quantity) / food.basisGrams;
  return quantity; // custom food defined per serving
}

export async function logFood(food, { date, meal, portionLabel, portionGrams, quantity }) {
  const servings = servingsFor(food, { portionGrams, quantity });
  return repo.create('foodLogs', {
    date, time: localTime(), meal, name: food.name, brand: food.brand ?? null, source: food.source, sourceId: food.sourceId ?? null,
    verification: food.verification, basisLabel: food.basisLabel, basisGrams: food.basisGrams ?? null,
    nutrients: cleanNutrients(food.nutrients), servings: Math.round(servings * 1000) / 1000,
    portionLabel: portionLabel ?? null, portionGrams: portionGrams ?? null, quantity: quantity ?? null, provenance: 'recorded',
  });
}

export async function toggleSaved(food) {
  const all = await repo.list('foods');
  const existing = all.find((f) => f.source === food.source && (f.sourceId ?? f.name) === (food.sourceId ?? food.name));
  if (existing) {
    if (existing.source === 'custom') return repo.update('foods', existing.id, { saved: !existing.saved });
    await repo.remove('foods', existing.id); return null;
  }
  return repo.create('foods', { name: food.name, brand: food.brand ?? null, source: food.source, sourceId: food.sourceId ?? null, verification: food.verification,
    basisLabel: food.basisLabel, basisGrams: food.basisGrams ?? null, nutrients: cleanNutrients(food.nutrients), portions: food.portions ?? [], saved: true });
}

export async function isSaved(food) {
  return (await repo.list('foods')).some((f) => f.saved && f.source === food.source && (f.sourceId ?? f.name) === (food.sourceId ?? food.name));
}

export async function saveMeal(name, entries) {
  return repo.create('savedMeals', { name, items: entries.map((e) => ({
    name: e.name, brand: e.brand, source: e.source, sourceId: e.sourceId, verification: e.verification, basisLabel: e.basisLabel, basisGrams: e.basisGrams,
    nutrients: e.nutrients, servings: e.servings, portionLabel: e.portionLabel, portionGrams: e.portionGrams, quantity: e.quantity,
  })) });
}

export async function logSavedMeal(saved, { date, meal }) {
  for (const it of saved.items) {
    await repo.create('foodLogs', { ...it, date, meal, time: localTime(), provenance: 'recorded', nutrients: cleanNutrients(it.nutrients) });
  }
}

/** Active targets: manual if set, else computed from profile + latest weight, else null. */
export async function activeTargets() {
  const [settings, profile, metrics] = await Promise.all([repo.getSettings(), repo.getProfile(), repo.list('bodyMetrics')]);
  const t = settings.nutritionTargets;
  if (t?.mode === 'manual' && t.kcal) return { ...t, source: 'manual' };
  const w = metrics.filter((m) => m.weightKg != null).sort((a, b) => b.date.localeCompare(a.date))[0];
  const computed = computeTargets({ weightKg: w?.weightKg, heightCm: profile.heightCm, age: approxAge(profile), sex: profile.sex, activityLevel: profile.activityLevel, goal: profile.goal });
  if (computed.missing?.length) return { missing: computed.missing, source: 'auto' };
  return { ...computed, source: 'auto' };
}

/**
 * Today's water goal: the user's own number if they set one, otherwise N9 from
 * latest body weight (+ training-day bump from the coach plan). { ml, auto } or { ml: null }.
 */
export async function waterGoal(settings) {
  settings ??= await repo.getSettings();
  if (settings.hydrationGoalMl) return { ml: settings.hydrationGoalMl, auto: false };
  const [metrics, plan] = await Promise.all([repo.list('bodyMetrics'), repo.get('coach', 'plan').catch(() => null)]);
  const w = metrics.filter((m) => m.weightKg != null).sort((a, b) => b.date.localeCompare(a.date))[0];
  const dow = (new Date().getDay() + 6) % 7; // 0 = Monday, matches planner
  const trainingToday = !!plan?.sessions?.some((x) => x.day === dow);
  let ml = waterTarget({ weightKg: w?.weightKg, trainingToday });
  if (ml && settings.units !== 'metric') ml = Math.round(Math.round(ml / 29.5735 / 4) * 4 * 29.5735); // whole half-cups in oz
  return { ml, auto: ml != null, trainingToday };
}
