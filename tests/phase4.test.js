// Phases 2–4 + Kratos. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/data/models.js';
import { setVolume, workoutVolume, setsPerMuscle, setsPerGroup, e1rm, personalRecords, e1rmTrend, exerciseHistory } from '../src/engines/training/metrics.js';
import { muscleWorkload, normalize, HALF_LIFE_DAYS } from '../src/engines/anatomy/workload.js';
import { parseMessage, resolveRange } from '../src/engines/coach/parser.js';
import { planWeek, freeWindows, pickSlot, spacingScore } from '../src/engines/coach/planner.js';
import { respond, mergeAvailability } from '../src/engines/coach/kratos.js';
import { buildReminders, dueAt } from '../src/engines/notifications/schedule.js';
import { buildPlanICS } from '../src/services/calendar/ics.js';
import { exercisesForGear } from '../src/data/exercises/gear.js';
import { EXERCISES } from '../src/data/exercises/exercises.js';
import { MUSCLE_BY_ID } from '../src/data/anatomy/muscles.js';

const env = (o = {}) => ({ id: 'w' + Math.random(), createdAt: '2026-11-25T10:00:00.000Z', updatedAt: '2026-11-25T10:00:00.000Z', deletedAt: null, rev: 1, ...o });
const workout = (date, exercises, status = 'completed') => env({ date, startTime: '18:00', startedAt: '2026-11-25T23:00:00.000Z', name: 'W', status, durationMin: 60, notes: '', templateId: null, planFocus: null, exercises });
const set = (weightKg, reps, completed = true) => ({ weightKg, reps, durationSec: null, completed });

test('exercise DB: every muscle id exists and ids are unique', () => {
  const ids = new Set();
  for (const e of EXERCISES) {
    assert.ok(!ids.has(e.id), `duplicate ${e.id}`); ids.add(e.id);
    for (const m of [...e.primary, ...e.secondary]) assert.ok(MUSCLE_BY_ID[m], `${e.id} → unknown muscle ${m}`);
    assert.ok(e.instructions.length >= 2, `${e.id} needs instructions`);
  }
  assert.ok(EXERCISES.length >= 60);
});

test('T1/T2 volume counts completed sets only', () => {
  const w = workout('2026-11-25', [{ exerciseId: 'bench_press', restSec: 90, sets: [set(100, 5), set(100, 5, false), set(null, 10)] }]);
  assert.equal(setVolume(set(60, 10)), 600);
  assert.equal(workoutVolume(w), 500);
});

test('T3 fractional sets: primary 1, secondary 0.5', () => {
  const w = workout('2026-11-25', [{ exerciseId: 'bench_press', restSec: 90, sets: [set(100, 5), set(100, 5)] }]);
  const s = setsPerMuscle([w]);
  assert.equal(s.pectoralis_major, 2);
  assert.equal(s.triceps_brachii, 1);
  assert.equal(s.quadriceps, 0);
  const g = setsPerGroup([w]);
  assert.equal(g.chest, 2); assert.equal(g.arms, 1);
});

test('T5 Epley e1RM and limits', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(Math.round(e1rm(100, 10) * 100) / 100, 133.33);
  assert.equal(e1rm(100, 13), null);
  assert.equal(e1rm(0, 5), null);
});

test('T6–T8 history, PRs and trend', () => {
  const ws = [
    workout('2026-11-01', [{ exerciseId: 'back_squat', restSec: 120, sets: [set(100, 5)] }]),
    workout('2026-11-08', [{ exerciseId: 'back_squat', restSec: 120, sets: [set(110, 5), set(90, 10)] }]),
    workout('2026-11-09', [{ exerciseId: 'back_squat', restSec: 120, sets: [set(200, 5, false)] }], 'in_progress'),
  ];
  assert.equal(exerciseHistory(ws, 'back_squat').length, 2);
  const pr = personalRecords(ws, 'back_squat');
  assert.equal(pr.heaviest.value, 110);
  assert.equal(pr.mostReps.value, 10);
  const t = e1rmTrend(ws, 'back_squat');
  assert.ok(t.change > 0 && t.sessions === 2);
});

test('A1–A4 workload modes and normalization', () => {
  const ws = [
    workout('2026-11-25', [{ exerciseId: 'barbell_curl', restSec: 60, sets: [set(30, 10), set(30, 10)] }]),
    workout('2026-11-18', [{ exerciseId: 'barbell_curl', restSec: 60, sets: [set(30, 10), set(30, 10)] }]),
  ];
  const recent = muscleWorkload(ws, { mode: 'recent', from: '2026-11-12', to: '2026-11-25' }).values;
  assert.ok(Math.abs(recent.biceps_brachii - (2 + 2 * 0.5 ** (7 / HALF_LIFE_DAYS))) < 1e-9);
  const vol = muscleWorkload(ws, { mode: 'historical', from: null, to: '2026-11-25' }).values;
  assert.equal(vol.biceps_brachii, 1200); assert.equal(vol.forearm_flexors, 600);
  assert.equal(muscleWorkload(ws, { mode: 'exercises', from: null, to: '2026-11-25' }).values.biceps_brachii, 1);
  const freq = muscleWorkload(ws, { mode: 'frequency', from: '2026-11-12', to: '2026-11-25' }).values;
  assert.equal(freq.biceps_brachii, 1); // 2 days over 2 weeks
  assert.equal(normalize(recent).biceps_brachii, 1);
  assert.equal(normalize({ a: 0, b: 0 }).a, 0);
});

test('gear filter: bodyweight-only excludes barbell work', () => {
  const ids = exercisesForGear([]).map((e) => e.id);
  assert.ok(ids.includes('push_up') && !ids.includes('bench_press') && !ids.includes('pull_up'));
  assert.ok(exercisesForGear(['pullup_bar']).some((e) => e.id === 'pull_up'));
});

test('parser: work schedule, wake/sleep, days/week, session length', () => {
  const r = parseMessage('I work 9 to 5 monday through friday, wake up at 6:30 and go to bed at 11. Want to lift 4 days a week for 45 minutes');
  assert.equal(r.busy.length, 5);
  assert.deepEqual([r.busy[0].start, r.busy[0].end], [540, 1020]);
  assert.equal(r.wake, 390); assert.equal(r.sleep, 1380);
  assert.equal(r.daysPerWeek, 4); assert.equal(r.sessionMinutes, 45);
});
test('parser: nearest day phrase, labels, overnight, days off', () => {
  const r = parseMessage('school mon-fri 8-3, practice tues and thurs 3:30-5:30');
  assert.equal(r.busy.filter((b) => b.label === 'School').length, 5);
  assert.deepEqual(r.busy.filter((b) => b.label === 'Practice').map((b) => b.day), [1, 3]);
  const n = parseMessage('I work 10pm-6am on saturday');
  assert.deepEqual(n.busy.map((b) => [b.day, b.start, b.end]), [[5, 1320, 1439], [6, 0, 360]]);
  assert.deepEqual(parseMessage('weekends off').daysOff, [5, 6]);
  assert.equal(parseMessage('I work 5 days a week').daysPerWeek, null); // job, not training
});
test('parser: range resolution rules', () => {
  assert.deepEqual(resolveRange({ h: 3, m: 0, mer: null }, { h: 11, m: 0, mer: null }), { start: 900, end: 1380, overnight: false });
  assert.deepEqual(resolveRange({ h: 7, m: 0, mer: null }, { h: 3, m: 0, mer: null }), { start: 420, end: 900, overnight: false });
  assert.deepEqual(resolveRange({ h: 9, m: 0, mer: null }, { h: 5, m: 0, mer: 'pm' }), { start: 540, end: 1020, overnight: false });
});
test('parser: intents', () => {
  assert.ok(parseMessage('yo make me a plan').intents.has('plan'));
  assert.ok(parseMessage('when do i eat').intents.has('nutrition'));
  assert.ok(!parseMessage('when do i eat').intents.has('plan'));
  assert.ok(parseMessage('i dont feel like it').intents.has('motivate'));
});

test('K1/K2 free windows respect padding and busy blocks', () => {
  const av = { wakeTime: '07:00', sleepTime: '23:00', busy: [{ day: 0, start: '09:00', end: '17:00' }], free: [], preference: 'any' };
  assert.deepEqual(freeWindows(av, 0), [[450, 510], [1050, 1290]]);
  const slot = pickSlot(freeWindows(av, 0), 60, 'evening');
  assert.equal(slot.start, 1080); // 6:00 PM
  assert.equal(pickSlot([[450, 470]], 60, 'any'), null);
});
test('K3/K4 plan: spacing, splits, rest day, beginner cap', () => {
  assert.ok(spacingScore([0, 1, 2]) < spacingScore([0, 2, 4]));
  const p = planWeek({ availability: { daysPerWeek: 3 }, profile: { experience: 'intermediate' }, today: new Date(2026, 10, 25) });
  const days = p.sessions.map((s) => s.day);
  assert.equal(days.length, 3);
  for (let i = 1; i < days.length; i++) assert.ok(days[i] - days[i - 1] >= 2);
  assert.equal(planWeek({ availability: { daysPerWeek: 7 }, profile: { experience: 'advanced' } }).sessions.length, 6);
  assert.equal(planWeek({ availability: { daysPerWeek: 6 }, profile: { experience: 'beginner' } }).sessions.length, 4);
  assert.deepEqual(planWeek({ availability: { daysPerWeek: 4 }, profile: { experience: 'intermediate' } }).sessions.map((s) => s.focus), ['Upper', 'Lower', 'Upper', 'Lower']);
});
test('K4 exercise selection respects gear', () => {
  const p = planWeek({ availability: { daysPerWeek: 3 }, profile: { experience: 'beginner', gear: [] } });
  for (const s of p.sessions) for (const e of s.exercises) assert.equal(EXERCISES.find((x) => x.id === e.exerciseId).equipment, 'bodyweight');
});
test('K5 nutrition timing and start date', () => {
  const p = planWeek({ availability: { wakeTime: '06:00', busy: [], free: [], preference: 'morning', daysPerWeek: 2 }, profile: {}, today: new Date(2026, 10, 25) });
  assert.equal(p.nutrition.meals[0].pre.kind, 'snack'); // 6:30 session can't have a meal 2h before
  assert.equal(p.nutrition.startDate.getDay(), 1); // a Monday
});
test('plan records validate', () => {
  const p = planWeek({ availability: {}, profile: {} });
  assert.deepEqual(validate('coach', env({ id: 'plan', ...p, kind: 'plan', nutrition: { ...p.nutrition, startDate: null } })), []);
});

test('Kratos: schedule message updates availability and returns a plan', () => {
  const out = respond('I work 9-5 weekdays', { now: new Date(2026, 10, 25, 12) });
  assert.equal(out.availability.busy.length, 5);
  assert.ok(out.plan.sessions.length >= 1);
  assert.ok(out.replies.some((r) => r.card?.type === 'plan'));
  for (const s of out.plan.sessions) if (s.day <= 4) assert.ok(s.start >= '17:30' || s.end <= '08:30');
});
test('Kratos: never suggests dieting for a developing user', () => {
  const out = respond('when do i eat', { now: new Date(2026, 10, 25), profile: { birthYear: 2011 } });
  assert.match(out.replies[0].text, /don’t diet/);
});
test('Kratos: merge keeps existing blocks and applies days off', () => {
  const a = mergeAvailability(null, parseMessage('work 9-5 mon-fri'));
  const b = mergeAvailability(a, parseMessage('friday off'));
  assert.equal(b.busy.length, 4);
});

test('reminders: built from plan and prefs; due at exact minute', () => {
  const plan = { sessions: [{ day: 2, start: '18:00', end: '19:00', focus: 'Upper', exercises: [] }], restDays: [0, 1, 3, 4, 5, 6], nutrition: { meals: [] } };
  const r = buildReminders({ workout: { enabled: true, leadMin: 30 }, water: { enabled: true, times: ['10:00'] } }, plan);
  assert.equal(r.find((x) => x.kind === 'workout').time, '17:30');
  assert.equal(dueAt(r, new Date(2026, 10, 25, 17, 30)).length, 1); // Wed 25 Nov 2026
  assert.equal(dueAt(r, new Date(2026, 10, 25, 17, 31)).length, 0);
});

test('ICS: weekly recurring events with alarms', () => {
  const ics = buildPlanICS({ sessions: [{ day: 0, start: '18:00', end: '19:00', focus: 'Upper', exercises: [{ exerciseId: 'bench_press', sets: 3, reps: 8 }] }] }, new Date(2026, 10, 25));
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO/);
  assert.match(ics, /DTSTART:20261130T180000/);
  assert.match(ics, /TRIGGER:-PT30M/);
});

test('workout & body metric validation', () => {
  assert.deepEqual(validate('workouts', workout('2026-11-25', [{ exerciseId: 'bench_press', restSec: 90, sets: [set(60, 8)] }])), []);
  assert.ok(validate('workouts', workout('2026-11-25', [{ exerciseId: 'bench_press', sets: [{ reps: -1, weightKg: 60 }] }])).length >= 2);
  assert.deepEqual(validate('bodyMetrics', env({ date: '2026-11-25', weightKg: 80, provenance: 'recorded' })), []);
  assert.deepEqual(validate('bodyMetrics', env({ date: '2026-11-25', provenance: 'recorded' })), ['at least one value is required']);
});
