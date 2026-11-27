// v0.9: expanded library integrity, data-driven planner (K9), ready-made workouts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, PATTERN_LABELS, EQUIPMENT_LABELS } from '../src/data/exercises/exercises.js';
import { GEAR, ENVIRONMENTS, REQUIREMENTS, exercisesForGear, canDo } from '../src/data/exercises/gear.js';
import { MUSCLES } from '../src/data/anatomy/muscles.js';
import { planWeek, sessionExercises, FOCUS_NAMES } from '../src/engines/coach/planner.js';

const env = (id) => ENVIRONMENTS.find((e) => e.id === id).gear;

test('library: 350+ exercises, unique ids, valid muscles, gear, patterns', () => {
  assert.ok(EXERCISES.length >= 350, `only ${EXERCISES.length}`);
  const ids = new Set(), muscles = new Set(MUSCLES.map((m) => m.id)), gear = new Set(GEAR.map((g) => g.id));
  for (const e of EXERCISES) {
    assert.ok(!ids.has(e.id), `duplicate ${e.id}`); ids.add(e.id);
    for (const m of [...e.primary, ...e.secondary]) assert.ok(muscles.has(m), `${e.id}: muscle ${m}`);
    for (const g of (REQUIREMENTS[e.id] ?? e.requires ?? []).flat()) assert.ok(gear.has(g), `${e.id}: gear ${g}`);
    assert.ok(PATTERN_LABELS[e.pattern], `${e.id}: pattern ${e.pattern}`);
    assert.ok(EQUIPMENT_LABELS[e.equipment], `${e.id}: equipment ${e.equipment}`);
    assert.ok(e.instructions.length >= 3, `${e.id}: instructions`);
  }
});

test('every environment has a real choice of exercises', () => {
  assert.ok(exercisesForGear(env('gym')).length >= 300);
  assert.ok(exercisesForGear(env('home')).length >= 180);
  assert.ok(exercisesForGear(env('minimal')).length >= 50);
});

test('K9: Upper A and Upper B use different exercises', () => {
  const p = planWeek({ availability: { daysPerWeek: 4 }, profile: { experience: 'intermediate', style: 'muscle', gear: env('gym') }, today: new Date(2026, 10, 27) });
  const [a, , b] = p.sessions;
  const overlap = a.exercises.filter((x) => b.exercises.some((y) => y.exerciseId === x.exerciseId));
  assert.equal(overlap.length, 0);
});

test('K9: main lifts stay for a block, accessories rotate weekly', () => {
  const prof = { experience: 'intermediate', style: 'muscle', gear: env('gym') };
  const w1 = planWeek({ availability: { daysPerWeek: 4 }, profile: prof, today: new Date(2026, 10, 27) });
  const w2 = planWeek({ availability: { daysPerWeek: 4 }, profile: prof, today: new Date(2026, 11, 4) });
  const all = (p) => p.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId));
  assert.notDeepEqual(all(w1), all(w2));
});

test('K9: never picks gear the user lacks; beginners get no advanced lifts', () => {
  for (const id of ['minimal', 'apartment', 'home', 'gym']) {
    const p = planWeek({ availability: { daysPerWeek: 3 }, profile: { experience: 'beginner', gear: env(id) } });
    for (const s of p.sessions) for (const e of s.exercises) {
      assert.ok(canDo(e.exerciseId, env(id)), `${id}: ${e.exerciseId}`);
      assert.notEqual(EXERCISES.find((x) => x.id === e.exerciseId).difficulty, 'advanced');
    }
  }
});

test('K9: bodyweight-only full body still includes a pull', () => {
  const ex = sessionExercises('Full Body', { gear: env('minimal'), sessionMinutes: 45 });
  assert.ok(ex.some((e) => EXERCISES.find((x) => x.id === e.exerciseId).pattern === 'horizontal_pull'));
});

test('K9: focus areas add work; athletic adds power first; lean ends with conditioning', () => {
  const arms = sessionExercises('Upper', { gear: env('gym'), experience: 'intermediate', focusAreas: ['arms'], sessionMinutes: 45 });
  assert.ok(arms.some((e) => EXERCISES.find((x) => x.id === e.exerciseId).primary.some((m) => m === 'biceps_brachii' || m === 'triceps_brachii')));
  const ath = sessionExercises('Full Body', { gear: env('gym'), experience: 'intermediate', style: 'athletic', sessionMinutes: 60 });
  const first = EXERCISES.find((x) => x.id === ath[0].exerciseId);
  assert.ok(first.tags.includes('power') || first.tags.includes('plyo'));
  const lean = sessionExercises('Full Body', { gear: env('home'), style: 'lean', sessionMinutes: 45 });
  assert.ok(EXERCISES.find((x) => x.id === lean.at(-1).exerciseId).tags.includes('conditioning'));
});

test('ready-made focuses all build 3+ exercises for a home gym', () => {
  for (const f of FOCUS_NAMES) assert.ok(sessionExercises(f, { gear: env('home'), sessionMinutes: 45 }).length >= 3, f);
});

test('session length controls exercise count', () => {
  const short = sessionExercises('Upper', { gear: env('gym'), sessionMinutes: 30 });
  const long = sessionExercises('Upper', { gear: env('gym'), sessionMinutes: 80 });
  assert.ok(short.length < long.length);
});
