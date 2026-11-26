// Phases 5–7: nutrition, analytics comparisons, recovery, gear. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { totals, entryNutrients, macroPercents, mifflinStJeor, computeTargets, dailySummaries, loggedAverages, adherence } from '../src/engines/nutrition/nutrition.js';
import { weekComparison, readiness, change } from '../src/engines/analytics/compare.js';
import { canDo, exercisesForGear, GEAR, ENVIRONMENTS, REQUIREMENTS } from '../src/data/exercises/gear.js';
import { EXERCISES } from '../src/data/exercises/exercises.js';
import { servingsFor } from '../src/services/nutrition/log.js';
import { validate } from '../src/data/models.js';

const env = (o = {}) => ({ id: 'x' + Math.random(), createdAt: '2026-11-25T10:00:00.000Z', updatedAt: '2026-11-25T10:00:00.000Z', deletedAt: null, rev: 1, ...o });
const chicken = { kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugars: 0, sodium: 74, satfat: 1 };
const entry = (date, servings, n = chicken, meal = 'lunch') => env({ date, time: '12:00', meal, name: 'Chicken', source: 'usda', sourceId: '171477', verification: 'verified', basisLabel: '100 g', basisGrams: 100, nutrients: n, servings, provenance: 'recorded' });

test('USDA data: real values, no invented foods', () => {
  const d = JSON.parse(fs.readFileSync('src/data/foods/usda-sr-legacy.json'));
  assert.ok(d.foods.length > 7000);
  const row = d.foods.find((f) => f[0] === 171477);
  assert.equal(row[1], 'Chicken, broilers or fryers, breast, meat only, cooked, roasted');
  assert.deepEqual(row.slice(3, 7), [165, 31, 0, 3.6]);
  assert.match(d.source, /SR Legacy/);
});

test('N1/N2 servings scale nutrients; deleted entries ignored', () => {
  assert.equal(servingsFor({ basisGrams: 100 }, { portionGrams: 140, quantity: 1.5 }), 2.1);
  assert.equal(servingsFor({ basisGrams: null }, { portionGrams: null, quantity: 2 }), 2);
  const t = totals([entry('2026-11-25', 2), entry('2026-11-25', 1, chicken), { ...entry('2026-11-25', 5), deletedAt: '2026-11-25T11:00:00.000Z' }]);
  assert.equal(t.kcal, 495); assert.equal(t.protein, 93);
  assert.equal(entryNutrients(entry('d', 0.5)).fat, 1.8);
});

test('N3 macro percents use 4/4/9 kcal per gram', () => {
  const p = macroPercents({ protein: 100, carbs: 100, fat: 0 });
  assert.equal(p.protein, 0.5); assert.equal(p.fat, 0);
});

test('N4 Mifflin-St Jeor', () => {
  assert.equal(mifflinStJeor({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' }), 1780);
  assert.equal(mifflinStJeor({ weightKg: 60, heightCm: 165, age: 30, sex: 'female' }), 1320.25);
  assert.equal(mifflinStJeor({ weightKg: 0, heightCm: 180, age: 30 }), null);
});

test('N5 targets: goals, floors, developing users, missing inputs', () => {
  const base = { weightKg: 80, heightCm: 180, age: 30, sex: 'male', activityLevel: 'moderate' };
  const m = computeTargets({ ...base, goal: 'maintain' });
  assert.equal(m.kcal, Math.round((1780 * 1.55) / 10) * 10);
  assert.equal(m.protein, 112);
  assert.ok(Math.abs(m.protein * 4 + m.carbs * 4 + m.fat * 9 - m.kcal) <= 12);
  const cut = computeTargets({ ...base, goal: 'fat_loss' });
  assert.ok(cut.kcal < m.kcal && cut.kcal >= cut.bmr && cut.protein === 160);
  const teen = computeTargets({ ...base, age: 16, goal: 'fat_loss' });
  assert.ok(teen.kcal >= teen.tdee - 10 && teen.goalApplied === 'maintain');
  assert.deepEqual(computeTargets({ weightKg: 80 }).missing, ['height', 'birth year', 'activity level']);
});

test('N6–N8 summaries, logged-day averages, adherence', () => {
  const logs = [entry('2026-11-24', 10), entry('2026-11-25', 12)];
  const days = dailySummaries(logs, ['2026-11-23', '2026-11-24', '2026-11-25']);
  assert.equal(days[0].logged, false);
  const avg = loggedAverages(days);
  assert.equal(avg.kcal, 1815); assert.equal(avg.days, 2);
  const a = adherence(days, { kcal: 1700, protein: 300 });
  assert.equal(a.calorieDays, 1); assert.equal(a.proteinDays, 2);
});

test('food log + saved meal validation', () => {
  assert.deepEqual(validate('foodLogs', entry('2026-11-25', 1.4)), []);
  assert.ok(validate('foodLogs', entry('2026-11-25', 1, { ...chicken, kcal: -5 })).length);
  assert.ok(validate('savedMeals', env({ name: 'x', items: [] })).length);
  assert.deepEqual(validate('foods', env({ name: 'Bar', source: 'custom', verification: 'user', basisLabel: '1 bar', basisGrams: null, nutrients: chicken, portions: [] })), []);
});

test('P1/P2 week comparison', () => {
  const w = (date) => env({ date, startTime: '18:00', startedAt: '2026-11-25T23:00:00.000Z', name: 'W', status: 'completed', durationMin: 60, exercises: [{ exerciseId: 'bench_press', restSec: 90, sets: [{ reps: 10, weightKg: 50, durationSec: null, completed: true }] }] });
  const cmp = weekComparison({ workouts: [w('2026-11-25'), w('2026-11-24'), w('2026-11-15')], foodLogs: [entry('2026-11-25', 10)], bodyMetrics: [], recoveryLogs: [] },
    { this: ['2026-11-19', '2026-11-25'], last: ['2026-11-12', '2026-11-18'] });
  assert.equal(cmp.sessions.delta, 1); assert.equal(cmp.sessions.pct, 1);
  assert.equal(cmp.volume.cur, 1000);
  assert.equal(cmp.kcal.prev, null); assert.equal(cmp.kcal.delta, null);
  assert.deepEqual(change(5, 0), { cur: 5, prev: 0, delta: 5, pct: null });
});

test('R1 readiness: normalized mean, needs ≥2 inputs', () => {
  assert.equal(readiness({ sleepHours: 8, sleepQuality: 5, energy: 5, soreness: 1, stress: 1 }), 100);
  assert.equal(readiness({ sleepHours: 4, energy: 1 }), 35);
  assert.equal(readiness({ sleepHours: 8 }), null);
});

test('gear catalog: 70+ items, valid requirements, any-of logic', () => {
  assert.ok(GEAR.length >= 70);
  const ids = new Set(GEAR.map((g) => g.id));
  for (const [ex, groups] of Object.entries(REQUIREMENTS)) for (const g of groups) for (const id of g) assert.ok(ids.has(id), `${ex} → unknown gear ${id}`);
  for (const e of EXERCISES) for (const g of (e.requires ?? [])) for (const id of g) assert.ok(ids.has(id), `${e.id} → unknown gear ${id}`);
  assert.equal(canDo('back_squat', ['barbell', 'smith_machine']), true);
  assert.equal(canDo('back_squat', ['barbell']), false);
  assert.equal(canDo('push_up', []), true);
  assert.equal(canDo('bench_press', null), true);
  assert.ok(exercisesForGear(ENVIRONMENTS.find((e) => e.id === 'gym').gear).length >= 100);
  assert.ok(EXERCISES.length >= 100);
});

test('every USDA food can be logged (name length within schema)', () => {
  const d = JSON.parse(fs.readFileSync('src/data/foods/usda-sr-legacy.json'));
  const longest = d.foods.reduce((a, f) => (f[1].length > a[1].length ? f : a));
  assert.deepEqual(validate('foodLogs', { ...entry('2026-11-25', 1), name: longest[1] }), []);
  assert.deepEqual(validate('foods', env({ name: longest[1], source: 'usda', verification: 'verified', basisLabel: '100 g', basisGrams: 100, nutrients: chicken, portions: [] })), []);
});

test('complete targets are recognized as set by `!t.missing` (regression: empty array is truthy)', () => {
  const t = computeTargets({ weightKg: 84, heightCm: 183, age: 32, sex: 'male', activityLevel: 'moderate', goal: 'muscle' });
  assert.ok(t && !t.missing && t.kcal > 0);
  assert.ok(computeTargets({ weightKg: 84 }).missing.length === 3);
});
