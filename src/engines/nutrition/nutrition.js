/**
 * Nutrition calculations — pure, deterministic. Documented in docs/CALCULATIONS.md (N1–N8).
 *
 * Food entries store a nutrient snapshot per "basis" (USDA: per 100 g) and a
 * `servings` multiplier, so history never changes if a database updates.
 */
import { NUTRIENT_KEYS, MEALS } from '../../data/models.js';

const zero = () => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0]));

/** N1 — Entry nutrients = basis nutrients × servings. */
export function entryNutrients(e) {
  const out = zero();
  for (const k of NUTRIENT_KEYS) out[k] = (e.nutrients?.[k] ?? 0) * e.servings;
  return out;
}

/** N2 — Totals over entries (non-deleted). */
export function totals(entries) {
  const out = zero();
  for (const e of entries) {
    if (e.deletedAt) continue;
    const n = entryNutrients(e);
    for (const k of NUTRIENT_KEYS) out[k] += n[k];
  }
  return out;
}

export function byMeal(entries) {
  return Object.fromEntries(MEALS.map((m) => {
    const list = entries.filter((e) => !e.deletedAt && e.meal === m);
    return [m, { entries: list, totals: totals(list) }];
  }));
}

/** N3 — Macro energy split (% of kcal from protein/carbs at 4 kcal/g, fat at 9 kcal/g). */
export function macroPercents(t) {
  const p = t.protein * 4, c = t.carbs * 4, f = t.fat * 9, sum = p + c + f;
  if (!sum) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: p / sum, carbs: c / sum, fat: f / sum };
}

export const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, very: 1.725, extra: 1.9 };
export const ACTIVITY_LABELS = {
  sedentary: 'Sedentary (desk, little exercise)', light: 'Light (1–3 workouts/week)', moderate: 'Moderate (3–5 workouts/week)',
  very: 'Very active (6–7 hard workouts/week)', extra: 'Extra (physical job + training)',
};

/**
 * N4 — Resting energy, Mifflin-St Jeor (1990):
 *   male   10·kg + 6.25·cm − 5·age + 5
 *   female 10·kg + 6.25·cm − 5·age − 161
 *   unspecified: mean of both (−78)
 */
export function mifflinStJeor({ weightKg, heightCm, age, sex }) {
  if (!(weightKg > 0 && heightCm > 0 && age > 0)) return null;
  const s = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + s;
}

/**
 * N5 — Personalized targets (ESTIMATES).
 *  TDEE = BMR × activity factor.
 *  Goal: maintain/consistency 0 · muscle +10% · performance +5% · fat loss −15% (adults only).
 *  Floor: never below BMR. Developing users (< 19) never get a deficit.
 *  Protein g/kg: muscle 1.8 · fat loss 2.0 · performance 1.6 · other 1.4 (ISSN range 1.4–2.0).
 *  Fat 27.5% of kcal · carbs = remainder · fiber 14 g per 1000 kcal (Dietary Guidelines).
 * Returns null with `missing` when inputs are incomplete.
 */
export function computeTargets({ weightKg, heightCm, age, sex, activityLevel, goal }) {
  const missing = [];
  if (!(weightKg > 0)) missing.push('weight');
  if (!(heightCm > 0)) missing.push('height');
  if (!(age > 0)) missing.push('birth year');
  if (!activityLevel) missing.push('activity level');
  if (missing.length) return { missing };
  const bmr = mifflinStJeor({ weightKg, heightCm, age, sex });
  const tdee = bmr * ACTIVITY_FACTORS[activityLevel];
  const developing = age < 19;
  const g = developing && goal === 'fat_loss' ? 'maintain' : goal ?? 'maintain';
  const adj = { muscle: 0.10, performance: 0.05, fat_loss: -0.15 }[g] ?? 0;
  let kcal = Math.max(bmr, tdee * (1 + adj));
  if (developing) kcal = Math.max(kcal, tdee);
  kcal = Math.round(kcal / 10) * 10;
  const ppk = { muscle: 1.8, fat_loss: 2.0, performance: 1.6 }[g] ?? 1.4;
  const protein = Math.round(weightKg * ppk);
  const fat = Math.round((kcal * 0.275) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((kcal / 1000) * 14);
  return { kcal, protein, carbs, fat, fiber, bmr: Math.round(bmr), tdee: Math.round(tdee), goalApplied: g, developing };
}

/** N6 — Daily summaries for a set of date keys. Unlogged days are flagged, not zero. */
export function dailySummaries(entries, dateKeys) {
  return dateKeys.map((d) => {
    const list = entries.filter((e) => !e.deletedAt && e.date === d);
    return { date: d, logged: list.length > 0, totals: totals(list) };
  });
}

/** N7 — Averages across LOGGED days only. */
export function loggedAverages(days) {
  const logged = days.filter((d) => d.logged);
  if (!logged.length) return null;
  const out = zero();
  for (const d of logged) for (const k of NUTRIENT_KEYS) out[k] += d.totals[k];
  for (const k of NUTRIENT_KEYS) out[k] /= logged.length;
  return { ...out, days: logged.length };
}

/** N8 — Adherence: logged days within ±10% of the calorie target, and protein ≥ 90% of target. */
export function adherence(days, target) {
  const logged = days.filter((d) => d.logged);
  if (!logged.length || !target?.kcal) return null;
  const cal = logged.filter((d) => Math.abs(d.totals.kcal - target.kcal) <= target.kcal * 0.1).length;
  const pro = target.protein ? logged.filter((d) => d.totals.protein >= target.protein * 0.9).length : null;
  return { calorieDays: cal, proteinDays: pro, logged: logged.length };
}

/**
 * N9 — Daily water recommendation (Estimate).
 * 35 mL per kg body weight (a widely used clinical rule of thumb, ~30–35 mL/kg),
 * +500 mL on training days, floored at 1.5 L, rounded to 50 mL.
 * Food supplies part of total water; this is a drinking target, not a medical limit.
 */
export function waterTarget({ weightKg, trainingToday = false } = {}) {
  if (!(weightKg > 0)) return null;
  const ml = Math.max(1500, weightKg * 35) + (trainingToday ? 500 : 0);
  return Math.round(ml / 50) * 50;
}
