/** Workout lifecycle helpers used by Train, Cratos and Home. */
import * as repo from './storage/repository.js';
import { localDateKey, localTime } from '../utils/dates.js';
import { EXERCISE_BY_ID } from '../data/exercises/exercises.js';

export async function activeWorkout() {
  return (await repo.list('workouts')).find((w) => w.status === 'in_progress') ?? null;
}

/** Template/plan exercise targets → empty workout sets. */
export function setsFromTargets(items = []) {
  return items.map((t) => {
    const def = EXERCISE_BY_ID[t.exerciseId];
    const n = Math.max(1, Math.min(10, t.sets?.length ?? t.sets ?? 3));
    const sets = Array.from({ length: n }, (_, i) => {
      const src = Array.isArray(t.sets) ? t.sets[i] : null;
      return {
        reps: src?.reps ?? (def?.metric === 'time' ? null : t.reps ?? null),
        weightKg: src?.weightKg ?? null,
        durationSec: src?.durationSec ?? (def?.metric === 'time' ? t.durationSec ?? 30 : null),
        completed: false,
      };
    });
    return { exerciseId: t.exerciseId, restSec: t.restSec ?? 90, sets };
  });
}

/** Start a workout (or return the one already in progress). */
export async function startWorkout({ name = 'Workout', exercises = [], templateId = null, planFocus = null } = {}) {
  const existing = await activeWorkout();
  if (existing) return existing;
  return repo.create('workouts', {
    date: localDateKey(), startTime: localTime(), startedAt: new Date().toISOString(), name, status: 'in_progress',
    durationMin: null, notes: '', templateId, planFocus, exercises: setsFromTargets(exercises),
  });
}

export async function finishWorkout(w) {
  const mins = Math.max(1, Math.round((Date.now() - Date.parse(w.startedAt)) / 60000));
  const exercises = w.exercises
    .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.completed) }))
    .filter((ex) => ex.sets.length);
  return repo.update('workouts', w.id, { status: 'completed', durationMin: w.durationMin ?? Math.min(mins, 1440), exercises });
}

export async function saveAsTemplate(w, name) {
  return repo.create('templates', {
    name: name || w.name,
    exercises: w.exercises.map((ex) => ({ exerciseId: ex.exerciseId, restSec: ex.restSec ?? 90, sets: ex.sets.map((s) => ({ reps: s.reps ?? null, weightKg: s.weightKg ?? null, durationSec: s.durationSec ?? null })) })),
  });
}
