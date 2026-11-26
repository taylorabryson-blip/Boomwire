/**
 * Phase 6 — period comparisons (pure). Documented in docs/CALCULATIONS.md (P1–P3).
 * P1 compares two 7-day windows (this week = last 7 days incl. today; last week = the 7 before).
 * P2 change = this − last; pct = change / last (null when last is 0 or missing).
 * P3 averages only include days that have data (never fabricate zeros).
 */
import { completedWorkouts, workoutVolume, workoutSetCount } from '../training/metrics.js';
import { totals } from '../nutrition/nutrition.js';

const within = (d, from, to) => d >= from && d <= to;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function change(cur, prev) {
  if (cur == null || prev == null) return { cur, prev, delta: null, pct: null };
  return { cur, prev, delta: cur - prev, pct: prev ? (cur - prev) / prev : null };
}

/**
 * @param ranges {this:[from,to], last:[from,to]}
 */
export function weekComparison({ workouts, foodLogs, bodyMetrics, recoveryLogs }, ranges) {
  const out = {};
  const pick = (r) => {
    const ws = completedWorkouts(workouts).filter((w) => within(w.date, ...r));
    const foodDays = [...new Set(foodLogs.filter((e) => !e.deletedAt && within(e.date, ...r)).map((e) => e.date))];
    const dayTotals = foodDays.map((d) => totals(foodLogs.filter((e) => e.date === d)));
    const weights = bodyMetrics.filter((m) => m.weightKg != null && within(m.date, ...r)).map((m) => m.weightKg);
    const sleeps = recoveryLogs.filter((x) => x.sleepHours != null && within(x.date, ...r)).map((x) => x.sleepHours);
    return {
      sessions: ws.length,
      sets: ws.reduce((s, w) => s + workoutSetCount(w), 0),
      volume: ws.reduce((s, w) => s + workoutVolume(w), 0),
      kcal: avg(dayTotals.map((t) => t.kcal)),
      protein: avg(dayTotals.map((t) => t.protein)),
      weight: avg(weights),
      sleep: avg(sleeps),
    };
  };
  const a = pick(ranges.this), b = pick(ranges.last);
  for (const k of Object.keys(a)) out[k] = change(a[k], b[k]);
  return out;
}

/**
 * Phase 7 — R1 Readiness (self-reported, ESTIMATE, 0–100):
 * mean of available normalized inputs —
 *   sleep hours min(h/8, 1), sleep quality q/5, energy e/5, (6−soreness)/5, (6−stress)/5.
 * Needs ≥ 2 inputs. Not a medical or physiological measurement.
 */
export function readiness(log) {
  if (!log) return null;
  const parts = [];
  if (log.sleepHours != null) parts.push(Math.min(log.sleepHours / 8, 1));
  if (log.sleepQuality != null) parts.push(log.sleepQuality / 5);
  if (log.energy != null) parts.push(log.energy / 5);
  if (log.soreness != null) parts.push((6 - log.soreness) / 5);
  if (log.stress != null) parts.push((6 - log.stress) / 5);
  if (parts.length < 2) return null;
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

export function readinessAdvice(score) {
  if (score == null) return null;
  if (score >= 75) return 'You reported good recovery. Train as planned.';
  if (score >= 50) return 'Moderate recovery. Train, but stop sets 1–2 reps shy of failure.';
  return 'Low recovery reported. Consider a lighter session — fewer sets, lighter loads — or mobility work.';
}
