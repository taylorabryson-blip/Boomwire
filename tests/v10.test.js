// v0.10: food suggestions (N12), duplicate water logs (H5), sleep estimate (S1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestFoods, nutrientsFor } from '../src/engines/nutrition/suggest.js';
import { possibleDuplicate, lastDrinkTime } from '../src/engines/calculations/hydration.js';
import { estimateSleep, minutesBetween, healthNightFor } from '../src/engines/recovery/sleep.js';
import { SUGGESTION_FOODS } from '../src/data/foods/suggestions.js';

// Minimal per-100 g foods for the engine (real values don't matter here).
const f = (name, kcal, protein, carbs, fat, fiber = 0, sugars = 0) => ({ name, basisGrams: 100, basisLabel: '100 g', nutrients: { kcal, protein, carbs, fat, fiber, sugars, sodium: 0, satfat: 0 } });
const C = (key, food, grams, roles, step = 1) => ({ key, food, label: `${grams} g`, grams, roles, step });
const catalog = [
  C('chicken', f('Chicken', 165, 31, 0, 3.6), 113, ['protein', 'recovery'], 0.5),
  C('yogurt', f('Greek yogurt', 59, 10, 3.6, 0.4), 170, ['protein', 'light']),
  C('tuna', f('Tuna', 86, 19, 0, 1), 165, ['protein', 'light'], 0.5),
  C('pbj', { name: 'PB&J', basisGrams: null, basisLabel: '1 sandwich', nutrients: { kcal: 402, protein: 12, carbs: 52, fat: 18, fiber: 3, sugars: 18, sodium: 0, satfat: 0 } }, null, ['dense', 'quick', 'recovery']),
  C('pb', f('Peanut butter', 598, 22, 22, 51, 5, 9), 32, ['dense']),
  C('banana', f('Banana', 89, 1.1, 23, 0.3, 2.6, 12), 118, ['quick', 'recovery']),
  C('honey', f('Honey', 304, 0.3, 82, 0, 0, 82), 21, ['quick']),
  C('gummies', f('Gummies', 396, 0, 99, 0, 0, 58), 63, ['quick']),
  C('oats', f('Oats', 379, 13, 68, 6.5, 10, 1), 40.5, ['dense', 'fiber']),
  C('apple', f('Apple', 52, 0.3, 14, 0.2, 2.4, 10), 182, ['fiber', 'light']),
];
const targets = { kcal: 3000, protein: 160, carbs: 380, fat: 90, fiber: 40, goalApplied: 'muscle' };
const eaten = (o = {}) => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, ...o });

test('suggestion catalog: PB&J recipe and sugar foods are included', () => {
  const pbj = SUGGESTION_FOODS.find((x) => x.key === 'pbj');
  assert.equal(pbj.parts.length, 3);
  assert.ok(SUGGESTION_FOODS.filter((x) => x.roles.includes('quick')).length >= 8);
});

test('N12: protein gap → protein foods sized ~0.4 g/kg per sitting', () => {
  const g = suggestFoods({ targets, eaten: eaten({ kcal: 900, protein: 40 }), weightKg: 80, catalog }).find((x) => x.id === 'protein');
  assert.ok(g, 'protein group');
  for (const it of g.items) assert.ok(Math.abs(it.nutrients.protein - 32) <= 16, `${it.food.name} ${it.nutrients.protein}`);
});

test('N12: bulking with calories left shows PB&J under Easy Calories', () => {
  const g = suggestFoods({ targets, eaten: eaten({ kcal: 1200, protein: 150 }), weightKg: 80, catalog }).find((x) => x.id === 'dense');
  assert.ok(g.items.some((i) => i.key === 'pbj'));
});

test('N12: workout in 60 min → quick sugar first, low fat', () => {
  const groups = suggestFoods({ targets, eaten: eaten({ kcal: 1500, protein: 100 }), weightKg: 80, workout: { minutesUntil: 60 }, catalog });
  assert.equal(groups[0].id, 'pre');
  for (const it of groups[0].items) assert.ok(it.nutrients.fat < 12);
});

test('N12: foods you log often come first when they fit the gap', () => {
  const fav = [{ food: f('Cottage cheese', 81, 10.4, 3.4, 2.3), timesLogged: 5, portion: { label: '1 cup', grams: 226, quantity: 1 } }];
  const groups = suggestFoods({ targets, eaten: eaten({ kcal: 900, protein: 40 }), weightKg: 80, catalog, favorites: fav });
  assert.equal(groups[0].id, 'favorites');
  assert.match(groups[0].items[0].reason, /Logged 5×/);
});

test('N12: cut and at target → only light options, nothing calorie-dense', () => {
  const cut = { ...targets, kcal: 2000, protein: 150, goalApplied: 'fat_loss' };
  const groups = suggestFoods({ targets: cut, eaten: eaten({ kcal: 1950, protein: 148, fiber: 38 }), weightKg: 80, catalog, hour: 20 });
  assert.equal(groups[0].id, 'done');
  assert.ok(!groups.some((g) => g.id === 'dense' || g.id === 'quick'));
});

test('N12: nutrientsFor scales per-100 g and per-serving foods', () => {
  assert.equal(Math.round(nutrientsFor(catalog[0].food, 113, 2).protein), 70);
  assert.equal(nutrientsFor(catalog[3].food, null, 2).kcal, 804);
});

test('H5: same amount within 3 min (or anything within 45 s) looks like a double log', () => {
  const now = new Date('2026-11-27T18:00:00Z');
  const e = (ago, ml) => ({ amountMl: ml, time: '12:59', createdAt: new Date(now - ago * 1000).toISOString() });
  assert.ok(possibleDuplicate([e(90, 237)], 237, now));
  assert.equal(possibleDuplicate([e(400, 237)], 237, now), null);
  assert.ok(possibleDuplicate([e(20, 500)], 237, now));
  assert.equal(possibleDuplicate([e(120, 500)], 237, now), null);
  assert.equal(lastDrinkTime([{ time: '09:30' }, { time: '14:05' }, { time: '11:00', deletedAt: 'x' }]), '14:05');
});

test('S1: last use at 12:40 AM pushes the asleep estimate past bedtime', () => {
  const r = estimateSleep({ now: new Date(2026, 10, 28, 9), bedtime: '23:00', wake: '07:00', activity: [new Date(2026, 10, 28, 0, 40).getTime()] });
  assert.equal(r.asleep.getHours() * 60 + r.asleep.getMinutes(), 55);
  assert.equal(r.minutes, 365);
});

test('S1: no clues → schedule + 15 min to fall asleep; early first open moves wake', () => {
  let r = estimateSleep({ now: new Date(2026, 10, 28, 9), bedtime: '22:30', wake: '06:30' });
  assert.equal(r.minutes, 465);
  r = estimateSleep({ now: new Date(2026, 10, 28, 9), bedtime: '23:00', wake: '07:00', activity: [new Date(2026, 10, 28, 6, 10).getTime()] });
  assert.equal(r.woke.getHours() * 60 + r.woke.getMinutes(), 370);
});

test('S1: helpers', () => {
  assert.equal(minutesBetween('23:40', '07:05'), 445);
  const night = healthNightFor([{ start: new Date(2026, 10, 27, 23).toISOString(), end: new Date(2026, 10, 28, 6, 45).toISOString() }], '2026-11-28');
  assert.ok(night);
});
