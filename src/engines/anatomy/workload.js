/**
 * Muscle workload model for the 3D heat map — ESTIMATES ONLY.
 * Never represents measured muscle activation or growth.
 * Definitions: docs/CALCULATIONS.md (A1–A4).
 *
 * Modes:
 *   recent     A1 — Fractional sets (T3) weighted by recency: weight = 0.5^(daysAgo / 3.5).
 *   historical A2 — Volume load (T1) × contribution, summed over the range.
 *   exercises  A3 — Distinct exercises performed that involve the muscle, × contribution.
 *   frequency  A4 — Days per week the muscle was trained (contribution ≥ 0.5 on that day).
 *
 * normalize() maps values to 0..1 relative to the busiest muscle in view.
 */
import { EXERCISE_BY_ID, contribution } from '../../data/exercises/exercises.js';
import { MUSCLES } from '../../data/anatomy/muscles.js';
import { completedWorkouts, setVolume } from '../training/metrics.js';
import { parseDateKey } from '../../utils/dates.js';

export const MODES = [
  { id: 'recent', label: 'Recent', unit: 'weighted sets', describe: 'Sets credited to each muscle, with recent sessions weighted more (half-life 3.5 days).' },
  { id: 'historical', label: 'Volume', unit: 'volume load', describe: 'Weight × reps credited to each muscle over the range.' },
  { id: 'exercises', label: 'Exercises', unit: 'exercise credit', describe: 'How many different exercises involved each muscle.' },
  { id: 'frequency', label: 'Frequency', unit: 'days / week', describe: 'Average days per week each muscle was trained.' },
];

export const RANGES = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7d', label: '7D', days: 7 },
  { id: '30d', label: '30D', days: 30 },
  { id: '90d', label: '90D', days: 90 },
  { id: 'all', label: 'All', days: null },
];

const dayDiff = (a, b) => Math.round((parseDateKey(a) - parseDateKey(b)) / 86400000);
export const HALF_LIFE_DAYS = 3.5;

/**
 * @param {object[]} workouts any workouts (filtered here)
 * @param {{mode: string, from: string|null, to: string}} opts from=null → all time
 * @returns {{values: Record<string, number>, rangeDays: number, workoutsUsed: number}}
 */
export function muscleWorkload(workouts, { mode, from, to }) {
  const ws = completedWorkouts(workouts).filter((w) => (!from || w.date >= from) && w.date <= to);
  const values = Object.fromEntries(MUSCLES.map((m) => [m.id, 0]));
  const firstDate = ws.reduce((min, w) => (min == null || w.date < min ? w.date : min), null);
  const rangeDays = from ? dayDiff(to, from) + 1 : firstDate ? dayDiff(to, firstDate) + 1 : 1;

  if (mode === 'recent' || mode === 'historical') {
    for (const w of ws) {
      const decay = mode === 'recent' ? 0.5 ** (dayDiff(to, w.date) / HALF_LIFE_DAYS) : 1;
      for (const ex of w.exercises) {
        const def = EXERCISE_BY_ID[ex.exerciseId];
        if (!def) continue;
        const done = ex.sets.filter((s) => s.completed);
        const amount = mode === 'recent' ? done.length : done.reduce((a, s) => a + setVolume(s), 0);
        for (const m of MUSCLES) values[m.id] += amount * contribution(def, m.id) * decay;
      }
    }
  } else if (mode === 'exercises') {
    const seen = new Set();
    for (const w of ws) for (const ex of w.exercises) if (ex.sets.some((s) => s.completed)) seen.add(ex.exerciseId);
    for (const id of seen) {
      const def = EXERCISE_BY_ID[id];
      if (def) for (const m of MUSCLES) values[m.id] += contribution(def, m.id);
    }
  } else if (mode === 'frequency') {
    const days = Object.fromEntries(MUSCLES.map((m) => [m.id, new Set()]));
    for (const w of ws) for (const ex of w.exercises) {
      const def = EXERCISE_BY_ID[ex.exerciseId];
      if (!def || !ex.sets.some((s) => s.completed)) continue;
      for (const m of MUSCLES) if (contribution(def, m.id) >= 0.5) days[m.id].add(w.date);
    }
    const weeks = Math.max(1, rangeDays / 7);
    for (const m of MUSCLES) values[m.id] = days[m.id].size / weeks;
  } else {
    throw new Error(`Unknown workload mode ${mode}`);
  }
  return { values, rangeDays, workoutsUsed: ws.length };
}

/** Scale to 0..1 by the maximum value. All zeros → all zeros. */
export function normalize(values) {
  const max = Math.max(0, ...Object.values(values));
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, max > 0 ? v / max : 0]));
}

/** Last date each muscle was trained (contribution ≥ 0.5), or null. */
export function lastTrained(workouts) {
  const out = Object.fromEntries(MUSCLES.map((m) => [m.id, null]));
  for (const w of completedWorkouts(workouts)) for (const ex of w.exercises) {
    const def = EXERCISE_BY_ID[ex.exerciseId];
    if (!def || !ex.sets.some((s) => s.completed)) continue;
    for (const m of MUSCLES) if (contribution(def, m.id) >= 0.5 && (!out[m.id] || w.date > out[m.id])) out[m.id] = w.date;
  }
  return out;
}
