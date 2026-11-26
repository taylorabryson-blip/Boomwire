/**
 * Training calculations — pure and deterministic. Documented in
 * docs/CALCULATIONS.md (T1–T8). Weights are kg. Only COMPLETED sets of
 * COMPLETED (non-deleted) workouts count.
 *
 * Volume load is a workload measure. It is NOT muscle growth.
 */
import { EXERCISE_BY_ID, contribution } from '../../data/exercises/exercises.js';
import { MUSCLES, GROUPS } from '../../data/anatomy/muscles.js';

export const completedWorkouts = (ws) => ws.filter((w) => !w.deletedAt && w.status === 'completed');
const doneSets = (ex) => ex.sets.filter((s) => s.completed);

/** T1 — Set volume load = weight × reps. 0 when either is missing. */
export function setVolume(set) {
  if (!set.reps || set.weightKg == null) return 0;
  return set.weightKg * set.reps;
}

/** T2 — Workout volume load = Σ T1 over completed sets. */
export function workoutVolume(workout) {
  return workout.exercises.reduce((s, ex) => s + doneSets(ex).reduce((a, set) => a + setVolume(set), 0), 0);
}

export function workoutSetCount(workout) {
  return workout.exercises.reduce((s, ex) => s + doneSets(ex).length, 0);
}

/**
 * T3 — Fractional sets per muscle: each completed set credits primary
 * muscles 1.0 and secondary muscles 0.5. ESTIMATE (attribution is modeled).
 * @returns {Record<string, number>}
 */
export function setsPerMuscle(workouts) {
  const out = Object.fromEntries(MUSCLES.map((m) => [m.id, 0]));
  for (const w of completedWorkouts(workouts)) {
    for (const ex of w.exercises) {
      const def = EXERCISE_BY_ID[ex.exerciseId];
      if (!def) continue;
      const n = doneSets(ex).length;
      for (const m of MUSCLES) out[m.id] += n * contribution(def, m.id);
    }
  }
  return out;
}

/** T3b — Fractional sets per muscle GROUP (sum of its muscles' T3, primary-credit only per set). */
export function setsPerGroup(workouts) {
  const out = Object.fromEntries(GROUPS.map((g) => [g.id, 0]));
  for (const w of completedWorkouts(workouts)) {
    for (const ex of w.exercises) {
      const def = EXERCISE_BY_ID[ex.exerciseId];
      if (!def) continue;
      const n = doneSets(ex).length;
      // A set counts once per group: 1.0 if any primary muscle is in the group, else 0.5 if any secondary is.
      for (const g of GROUPS) {
        const inGroup = (ids) => ids.some((id) => MUSCLES.find((m) => m.id === id)?.group === g.id);
        out[g.id] += n * (inGroup(def.primary) ? 1 : inGroup(def.secondary) ? 0.5 : 0);
      }
    }
  }
  return out;
}

/** T4 — Training frequency: distinct calendar days with ≥1 completed workout. */
export function trainingDays(workouts) {
  return new Set(completedWorkouts(workouts).map((w) => w.date)).size;
}

/**
 * T5 — Estimated one-rep max (Epley, 1985): w × (1 + reps / 30).
 * reps = 1 returns w. Only computed for 1–12 reps (accuracy falls with
 * higher reps). ESTIMATE. Returns null when not computable.
 */
export function e1rm(weightKg, reps) {
  if (weightKg == null || weightKg <= 0 || !reps || reps < 1 || reps > 12) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/**
 * T6 — Per-exercise history: one entry per completed workout containing it.
 * @returns {{date, workoutId, sets, bestE1rm, topWeightKg, volume, bestReps, bestDurationSec}[]} oldest → newest
 */
export function exerciseHistory(workouts, exerciseId) {
  const out = [];
  for (const w of completedWorkouts(workouts)) {
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap(doneSets);
    if (!sets.length) continue;
    const e1s = sets.map((s) => e1rm(s.weightKg, s.reps)).filter((v) => v != null);
    const weights = sets.map((s) => s.weightKg).filter((v) => v != null && v > 0);
    out.push({
      date: w.date, workoutId: w.id, sets,
      bestE1rm: e1s.length ? Math.max(...e1s) : null,
      topWeightKg: weights.length ? Math.max(...weights) : null,
      volume: sets.reduce((a, s) => a + setVolume(s), 0),
      bestReps: Math.max(0, ...sets.map((s) => s.reps ?? 0)),
      bestDurationSec: Math.max(0, ...sets.map((s) => s.durationSec ?? 0)),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** T7 — Personal records for an exercise (recorded maxima + estimated e1RM). */
export function personalRecords(workouts, exerciseId) {
  const h = exerciseHistory(workouts, exerciseId);
  if (!h.length) return null;
  const pick = (key) => h.reduce((best, x) => (x[key] != null && (best == null || x[key] > best[key]) ? x : best), null);
  const w = pick('topWeightKg'), e = pick('bestE1rm'), v = pick('volume'), r = pick('bestReps'), d = pick('bestDurationSec');
  return {
    heaviest: w?.topWeightKg ? { value: w.topWeightKg, date: w.date } : null,
    bestE1rm: e?.bestE1rm ? { value: e.bestE1rm, date: e.date } : null,
    bestVolume: v?.volume ? { value: v.volume, date: v.date } : null,
    mostReps: r?.bestReps ? { value: r.bestReps, date: r.date } : null,
    longestHold: d?.bestDurationSec ? { value: d.bestDurationSec, date: d.date } : null,
    sessions: h.length,
  };
}

/**
 * T8 — Progression: change in best e1RM between the first and latest
 * session of an exercise. ESTIMATE. null with < 2 data points.
 */
export function e1rmTrend(workouts, exerciseId) {
  const pts = exerciseHistory(workouts, exerciseId).filter((x) => x.bestE1rm != null);
  if (pts.length < 2) return null;
  const first = pts[0].bestE1rm, last = pts.at(-1).bestE1rm;
  return { first, last, change: last - first, pct: (last - first) / first, sessions: pts.length };
}

/** Previous completed values for each set index of an exercise (for the logger's "Previous" column). */
export function previousSets(workouts, exerciseId, excludeWorkoutId) {
  const h = exerciseHistory(workouts.filter((w) => w.id !== excludeWorkoutId), exerciseId);
  return h.length ? h.at(-1).sets : [];
}

/** Weekly volume for the last n weeks (Mon-based). @returns {{weekStart, volume, sets, sessions}[]} */
export function weeklyTotals(workouts, weekStarts, addDays) {
  return weekStarts.map((ws) => {
    const we = addDays(ws, 6);
    const inWeek = completedWorkouts(workouts).filter((w) => w.date >= ws && w.date <= we);
    return {
      weekStart: ws,
      volume: inWeek.reduce((s, w) => s + workoutVolume(w), 0),
      sets: inWeek.reduce((s, w) => s + workoutSetCount(w), 0),
      sessions: inWeek.length,
    };
  });
}
