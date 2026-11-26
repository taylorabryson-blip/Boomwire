/**
 * K8 — User control over the plan (pure).
 * Cratos plans; you can still move, swap or skip sessions. Moving onto a day that
 * already has a session swaps the two. Meal timing (K5) is recomputed afterwards.
 */
import { toMin, toHHMM } from './parser.js';
import { nutritionTiming } from './planner.js';

const dur = (s) => Math.max(15, toMin(s.end) - toMin(s.start));
const withTime = (s, day, start) => ({ ...s, day, start, end: toHHMM(Math.min(toMin(start) + dur(s), 23 * 60 + 59)) });

function finish(plan, sessions, av, today) {
  sessions = [...sessions].sort((a, b) => a.day - b.day);
  const days = new Set(sessions.map((s) => s.day));
  return { ...plan, sessions, restDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !days.has(d)), nutrition: { ...plan.nutrition, meals: nutritionTiming(sessions, av ?? { wakeTime: '07:00' }, today).meals } };
}

/** Move the session on `fromDay` to `{ day, start }`. Swaps with a session already on that day. */
export function moveSession(plan, fromDay, to, av, today = new Date()) {
  const s = plan.sessions.find((x) => x.day === fromDay);
  if (!s) return plan;
  const other = to.day !== fromDay ? plan.sessions.find((x) => x.day === to.day) : null;
  const sessions = plan.sessions.map((x) => {
    if (x === s) return withTime(s, to.day, to.start ?? s.start);
    if (x === other) return withTime(other, fromDay, other.start);
    return x;
  });
  return finish(plan, sessions, av, today);
}

export function skipSession(plan, day, av, today = new Date()) {
  return finish(plan, plan.sessions.filter((x) => x.day !== day), av, today);
}

/** Commitments that overlap a proposed time (a warning, never a block). */
export function conflicts(av, day, start, end) {
  const a = toMin(start), b = toMin(end);
  return (av?.busy ?? []).filter((x) => x.day === day && toMin(x.start) < b && toMin(x.end) > a);
}

/**
 * Re-apply "every week" moves after Cratos rebuilds the plan.
 * pins: [{ focus, fromDay, day, start }] — matched on focus + the day Cratos originally put it,
 * falling back to any unpinned session with that focus.
 */
export function applyPins(plan, pins = [], av, today = new Date()) {
  let p = plan;
  const used = new Set();
  const key = (s) => `${s.focus}@${s.day}`;
  // locate every pinned session against the freshly planned week before anything moves
  const targets = pins.map((pin) => {
    const s = p.sessions.find((x) => x.focus === pin.focus && x.day === pin.fromDay && !used.has(key(x)))
      ?? p.sessions.find((x) => x.focus === pin.focus && !used.has(key(x)));
    if (s) used.add(key(s));
    return s ? { s, pin } : null;
  }).filter(Boolean);
  for (const { s, pin } of targets) {
    const cur = p.sessions.find((x) => x.focus === s.focus && x.exercises === s.exercises) ?? p.sessions.find((x) => x.focus === s.focus);
    if (cur) p = moveSession(p, cur.day, { day: pin.day, start: pin.start }, av, today);
  }
  return p;
}
