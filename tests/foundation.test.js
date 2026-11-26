// Run: npm test  (Node 20+, no dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, SCHEMAS } from '../src/data/models.js';
import { mergeRecords, compareVersions } from '../src/services/sync/merge.js';
import { dailyTotal, dailyTotals, loggedDayAverage, goalProgress, daysMeetingGoal } from '../src/engines/calculations/hydration.js';
import { addDays, lastNDays, isDateKey } from '../src/utils/dates.js';
import { formatVolume, volumeInputToMl, mlToFlOz, kgToLb, round } from '../src/utils/units.js';

const env = (o = {}) => ({ id: 'a', createdAt: '2026-11-25T10:00:00.000Z', updatedAt: '2026-11-25T10:00:00.000Z', deletedAt: null, rev: 1, ...o });
const log = (date, amountMl, o = {}) => env({ id: `${date}-${amountMl}-${Math.random()}`, date, time: '09:00', amountMl, provenance: 'recorded', ...o });

test('validate: accepts a valid hydration log', () => {
  assert.deepEqual(validate('hydrationLogs', log('2026-11-25', 250)), []);
});
test('validate: rejects bad date, time, amount, provenance', () => {
  const errs = validate('hydrationLogs', log('2026-02-31', 0, { time: '25:00', provenance: 'guessed' }));
  assert.equal(errs.length, 4);
});
test('validate: rejects missing envelope and unknown store', () => {
  assert.ok(validate('hydrationLogs', { date: '2026-11-25' }).some((e) => e.startsWith('id')));
  assert.deepEqual(validate('nope', {}), ['Unknown store "nope"']);
});
test('validate: settings nullable goal', () => {
  assert.deepEqual(validate('settings', env({ id: 'settings', units: 'metric', hydrationGoalMl: null })), []);
  assert.equal(validate('settings', env({ id: 'settings', units: 'metric', hydrationGoalMl: 100 })).length, 1);
});
test('every dated store schema requires a date', () => {
  for (const s of ['hydrationLogs', 'workouts', 'foodLogs', 'bodyMetrics', 'recoveryLogs']) assert.equal(SCHEMAS[s].fields.date.required, true);
});

test('merge: newer incoming wins, older incoming never overwrites', () => {
  const local = [env({ id: 'x', updatedAt: '2026-11-25T12:00:00.000Z', v: 'local' })];
  const older = [env({ id: 'x', updatedAt: '2026-11-25T11:00:00.000Z', v: 'old' })];
  const newer = [env({ id: 'x', updatedAt: '2026-11-25T13:00:00.000Z', v: 'new' })];
  assert.equal(mergeRecords(local, older).toWrite.length, 0);
  assert.equal(mergeRecords(local, newer).toWrite[0].v, 'new');
});
test('merge: rev breaks timestamp ties; full tie keeps local', () => {
  const a = env({ id: 'x', rev: 2 }), b = env({ id: 'x', rev: 3 });
  assert.equal(compareVersions(b, a), 1);
  assert.equal(mergeRecords([a], [env({ id: 'x', rev: 2, v: 'dup' })]).skipped, 1);
});
test('merge: adds new ids and propagates tombstones', () => {
  const local = [env({ id: 'x' })];
  const r = mergeRecords(local, [env({ id: 'y' }), env({ id: 'x', deletedAt: '2026-11-25T14:00:00.000Z', updatedAt: '2026-11-25T14:00:00.000Z', rev: 2 })]);
  assert.equal(r.added, 1); assert.equal(r.updated, 1);
});

test('hydration H1: daily total ignores other days and deleted', () => {
  const logs = [log('2026-11-25', 250), log('2026-11-25', 500), log('2026-11-24', 999), log('2026-11-25', 300, { deletedAt: '2026-11-25T11:00:00.000Z' })];
  assert.equal(dailyTotal(logs, '2026-11-25'), 750);
});
test('hydration H2: average excludes unlogged days; null when none', () => {
  const keys = ['2026-11-23', '2026-11-24', '2026-11-25'];
  const t = dailyTotals([log('2026-11-23', 1000), log('2026-11-25', 2000)], keys);
  assert.equal(t[1].logged, false);
  assert.equal(loggedDayAverage(t), 1500);
  assert.equal(loggedDayAverage(dailyTotals([], keys)), null);
});
test('hydration H3/H4: progress unclamped, null without goal', () => {
  assert.equal(goalProgress(3000, 2000), 1.5);
  assert.equal(goalProgress(500, null), null);
  const t = dailyTotals([log('2026-11-24', 2500), log('2026-11-25', 1000)], ['2026-11-24', '2026-11-25']);
  assert.equal(daysMeetingGoal(t, 2000), 1);
});

test('dates: calendar arithmetic across month/year and DST', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09'); // US DST start
  assert.deepEqual(lastNDays(3, '2026-11-25'), ['2026-11-23', '2026-11-24', '2026-11-25']);
  assert.equal(isDateKey('2026-02-29'), false);
});

test('units: exact conversion constants and formatting', () => {
  assert.equal(round(mlToFlOz(29.5735295625), 6), 1);
  assert.equal(round(kgToLb(0.45359237), 6), 1);
  assert.equal(volumeInputToMl(8, 'imperial'), 237);
  assert.deepEqual(formatVolume(750), { value: '750', unit: 'ml' });
  assert.deepEqual(formatVolume(1500), { value: '1.5', unit: 'L' });
  assert.deepEqual(formatVolume(null), { value: '—', unit: '' });
});
