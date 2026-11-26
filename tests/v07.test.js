// v0.7: meal parser (N10/N11), water target (N9), alarms (K6), gear equivalents + custom gear.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMeal, parseItem, matchPortion } from '../src/engines/nutrition/meal-parser.js';
import { waterTarget } from '../src/engines/nutrition/nutrition.js';
import { alarmsForDay } from '../src/engines/coach/alarms.js';
import { canDo, GEAR, EQUIVALENTS, registerCustomGear, expandGear } from '../src/data/exercises/gear.js';
import { validate } from '../src/data/models.js';

test('N10 splits and parses spoken meals', () => {
  const r = parseMeal('I had two eggs, a cup of oatmeal and a banana');
  assert.deepEqual(r.map((x) => [x.qty, x.unit, x.food]), [[2, null, 'eggs'], [1, 'cup', 'oatmeal'], [1, null, 'banana']]);
  assert.deepEqual(parseMeal('200g chicken breast with 1.5 cups rice').map((x) => [x.qty, x.unit, x.food]), [[200, 'g', 'chicken breast'], [1.5, 'cup', 'rice']]);
  assert.equal(parseItem('half an avocado').qty, 0.5);
  assert.equal(parseItem('a large apple').size, 'large');
  assert.equal(parseItem('8oz steak').unit, 'oz');
  assert.equal(parseItem('3 slices of bacon').unit, 'slice');
  assert.equal(parseItem('banana').explicit, false);
  assert.equal(parseItem('2 bananas').explicit, true);
});

test('N11 portion matching uses USDA household measures', () => {
  const eggs = [['1 cup (4.86 large eggs)', 243], ['1 medium', 44], ['1 large', 50]];
  assert.deepEqual(matchPortion(parseItem('two eggs'), eggs), { grams: 100, label: '2 large', estimated: false });
  const banana = [['1 NLEA serving', 126], ['1 extra large (9" or longer)', 152], ['1 large (8" to 8-7/8" long)', 136]];
  assert.equal(matchPortion(parseItem('a banana'), banana).grams, 136); // never silently "extra large"
  assert.equal(matchPortion(parseItem('8 oz steak'), []).grams, 8 * 28.3495);
  assert.equal(matchPortion(parseItem('1 cup rice'), [['1 cup', 158]]).grams, 158);
  assert.equal(matchPortion(parseItem('mystery'), []).estimated, true);
});

test('N9 water target: 35 mL/kg, +500 training, ≥1.5 L, needs weight', () => {
  assert.equal(waterTarget({ weightKg: 80 }), 2800);
  assert.equal(waterTarget({ weightKg: 80, trainingToday: true }), 3300);
  assert.equal(waterTarget({ weightKg: 30 }), 1500);
  assert.equal(waterTarget({}), null);
});

test('K6 alarms: wake, pre-workout meal, heads-up; rest days just wake', () => {
  const plan = { sessions: [{ day: 2, start: '18:00', end: '19:00', focus: 'Upper' }], nutrition: { meals: [{ day: 2, pre: { time: '16:00', kind: 'meal' } }] } };
  assert.deepEqual(alarmsForDay(plan, { wakeTime: '06:30' }, 2).map((a) => a.time), ['06:30', '16:00', '17:30']);
  assert.deepEqual(alarmsForDay(plan, { wakeTime: '06:30' }, 3), [{ time: '06:30', label: 'Wake up · rest day' }]);
  assert.deepEqual(alarmsForDay(null, null, 1), []);
});

test('gear: 150+ items, equivalents valid, custom gear unlocks exercises', () => {
  assert.ok(GEAR.length >= 150);
  const ids = new Set(GEAR.map((g) => g.id));
  for (const [k, v] of Object.entries(EQUIVALENTS)) { assert.ok(ids.has(k), k); v.forEach((x) => assert.ok(ids.has(x), `${k}→${x}`)); }
  assert.equal(canDo('lat_pulldown', ['tonal']), true);
  assert.equal(canDo('lat_pulldown', ['custom:my_pulley']), false);
  registerCustomGear([{ id: 'custom:my_pulley', label: 'My pulley', like: ['lat_pulldown'] }]);
  assert.equal(canDo('lat_pulldown', ['custom:my_pulley']), true);
  assert.ok(expandGear(['custom:my_pulley']).has('lat_pulldown'));
  registerCustomGear([]);
});

test('profile accepts custom gear ids, rejects junk', () => {
  const env = { id: 'profile', createdAt: '2026-11-26T00:00:00.000Z', updatedAt: '2026-11-26T00:00:00.000Z', deletedAt: null, rev: 1 };
  assert.deepEqual(validate('profile', { ...env, gear: ['barbell', 'custom:my_rack'], customGear: { items: [] } }), []);
  assert.ok(validate('profile', { ...env, gear: ['spaceship'] }).length);
});

test('K7 diet-only plan: three meals spread across the waking day, no sessions', async () => {
  const { dietPlan } = await import('../src/engines/coach/planner.js');
  const p = dietPlan({ wakeTime: '06:30', sleepTime: '22:30' });
  assert.equal(p.mode, 'nutrition'); assert.equal(p.sessions.length, 0);
  assert.deepEqual(p.nutrition.dailyMeals.map((m) => m.label), ['Breakfast', 'Lunch', 'Dinner']);
  assert.equal(p.nutrition.dailyMeals[0].time, '07:00');
  assert.ok(p.nutrition.dailyMeals[2].time <= '19:30');
  assert.deepEqual(alarmsForDay(p, { wakeTime: '06:30' }, 3).map((a) => a.label), ['Wake up', 'Breakfast', 'Lunch', 'Dinner']);
});

test('equipment text: workouts list what they need; gear never "unlocks"', async () => {
  const { equipmentNeeded } = await import('../src/data/exercises/gear.js');
  assert.equal(equipmentNeeded('push_up'), 'No equipment');
  assert.equal(equipmentNeeded('back_squat', { short: true }), 'Barbell + Power rack');
  assert.match(equipmentNeeded('back_squat'), /Squat stands/);
});

test('K8 move, swap, skip and pin sessions', async () => {
  const { moveSession, skipSession, conflicts, applyPins } = await import('../src/engines/coach/reschedule.js');
  const av = { wakeTime: '06:30', busy: [{ day: 3, start: '09:00', end: '17:00', label: 'Work' }] };
  const plan = { sessions: [{ day: 0, start: '18:00', end: '19:00', focus: 'Upper', exercises: [] }, { day: 2, start: '18:00', end: '19:00', focus: 'Lower', exercises: [] }], restDays: [1, 3, 4, 5, 6], nutrition: { meals: [] } };
  const moved = moveSession(plan, 0, { day: 1, start: '07:00' }, av);
  assert.deepEqual(moved.sessions.map((s) => [s.focus, s.day, s.start, s.end]), [['Upper', 1, '07:00', '08:00'], ['Lower', 2, '18:00', '19:00']]);
  assert.deepEqual(moved.restDays, [0, 3, 4, 5, 6]);
  assert.equal(moved.nutrition.meals.find((m) => m.day === 1).post.time, '09:00');
  const swapped = moveSession(plan, 0, { day: 2, start: '17:00' }, av);
  assert.deepEqual(swapped.sessions.map((s) => [s.focus, s.day]), [['Lower', 0], ['Upper', 2]]);
  assert.equal(skipSession(plan, 2, av).sessions.length, 1);
  assert.equal(conflicts(av, 3, '16:00', '17:00').length, 1);
  assert.equal(conflicts(av, 3, '17:00', '18:00').length, 0);
  const pinned = applyPins(plan, [{ focus: 'Lower', day: 5, start: '10:00' }], av);
  assert.deepEqual(pinned.sessions.find((s) => s.focus === 'Lower').day, 5);
});

test('K8 pins stay attached to the exact session when focuses repeat (two Upper days)', async () => {
  const { applyPins } = await import('../src/engines/coach/reschedule.js');
  const ex = (n) => [{ exerciseId: n }];
  const plan = { sessions: [{ day: 0, start: '18:00', end: '19:00', focus: 'Upper', exercises: ex('a') }, { day: 1, start: '18:00', end: '19:00', focus: 'Lower', exercises: ex('b') },
    { day: 3, start: '18:00', end: '19:00', focus: 'Upper', exercises: ex('c') }, { day: 5, start: '18:00', end: '19:00', focus: 'Lower', exercises: ex('d') }], restDays: [], nutrition: { meals: [] } };
  const out = applyPins(plan, [{ focus: 'Upper', fromDay: 3, day: 5, start: '18:00' }], { wakeTime: '06:30' });
  assert.deepEqual(out.sessions.map((s) => [s.focus, s.day]), [['Upper', 0], ['Lower', 1], ['Lower', 3], ['Upper', 5]]);
});
