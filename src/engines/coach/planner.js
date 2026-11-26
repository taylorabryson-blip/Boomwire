/**
 * Kratos weekly planner — deterministic scheduling, documented in
 * docs/CALCULATIONS.md (K1–K5).
 *
 * K1 Free windows per day = [wake + 30 min, sleep − 90 min] minus busy blocks
 *    padded by 30 min (travel/transition). Explicit "free" blocks, when given
 *    for a day, restrict that day to those blocks.
 * K2 Slot choice: the start time closest to the preference target
 *    (morning = earliest, midday 12:00, evening 18:00, any 17:30),
 *    snapped to 15 minutes, that fits the session length.
 * K3 Day choice: among all combinations of feasible days, maximise
 *    slot fit and spacing; consecutive days are penalised, 3 in a row more.
 * K4 Split by days/week: 1–3 Full Body · 4 Upper/Lower · 5 U/L + Push/Pull/Legs · 6 PPL×2.
 *    At least one rest day is always kept. Beginners are capped at 4 days.
 * K5 Meal timing: main meal ~2 h before a session (or a light snack 30–60 min
 *    before if that's earlier than wake + 30), protein-rich meal within ~2 h after.
 */
import { toMin, toHHMM, fmt12, DAY_NAMES } from './parser.js';
import { EXERCISE_BY_ID } from '../../data/exercises/exercises.js';
import { exercisesForGear } from '../../data/exercises/gear.js';

export const DEFAULT_AVAILABILITY = Object.freeze({
  kind: 'availability', wakeTime: '07:00', sleepTime: '23:00', busy: [], free: [],
  daysPerWeek: null, sessionMinutes: null, preference: 'any',
});

const BUFFER = 30, WAKE_PAD = 30, SLEEP_PAD = 90, SNAP = 15;
const TARGET = { morning: 0, midday: 12 * 60, evening: 18 * 60, any: 17 * 60 + 30 };

function subtract(windows, block) {
  const out = [];
  for (const [s, e] of windows) {
    if (block[1] <= s || block[0] >= e) { out.push([s, e]); continue; }
    if (block[0] > s) out.push([s, block[0]]);
    if (block[1] < e) out.push([block[1], e]);
  }
  return out;
}

/** K1 — free windows (minutes) for one weekday. */
export function freeWindows(av, day) {
  const wake = toMin(av.wakeTime);
  let sleep = toMin(av.sleepTime);
  if (sleep <= wake) sleep += 1440; // sleeps after midnight
  let windows = [[wake + WAKE_PAD, Math.min(sleep - SLEEP_PAD, 1439)]];
  const explicit = (av.free ?? []).filter((b) => b.day === day);
  if (explicit.length) {
    const allowed = explicit.map((b) => [toMin(b.start), toMin(b.end)]);
    windows = windows.flatMap(([s, e]) => allowed.map(([a, b]) => [Math.max(s, a), Math.min(e, b)]).filter(([x, y]) => y > x));
  }
  for (const b of (av.busy ?? []).filter((x) => x.day === day)) {
    windows = subtract(windows, [toMin(b.start) - BUFFER, toMin(b.end) + BUFFER]);
  }
  return windows.filter(([s, e]) => e - s >= 15);
}

/** K2 — best slot in the windows, or null. */
export function pickSlot(windows, duration, preference = 'any') {
  const T = TARGET[preference] ?? TARGET.any;
  let best = null;
  for (const [s, e] of windows) {
    const len = e - s;
    const dur = len >= duration ? duration : len >= Math.min(30, duration) ? len : 0;
    if (!dur) continue;
    let start = Math.max(s, Math.min(T, e - dur));
    const snapped = Math.ceil(start / SNAP) * SNAP;
    start = snapped + dur <= e ? snapped : Math.floor(start / SNAP) * SNAP;
    if (start < s) start = s;
    const fit = 1 - Math.min(1, Math.abs(start - T) / 720);
    const score = fit * (dur === duration ? 1 : 0.55);
    if (!best || score > best.score) best = { start, end: start + dur, short: dur < duration, score };
  }
  return best;
}

function combos(arr, k) {
  const out = [];
  const rec = (i, cur) => { if (cur.length === k) { out.push([...cur]); return; } for (let j = i; j < arr.length; j++) { cur.push(arr[j]); rec(j + 1, cur); cur.pop(); } };
  rec(0, []);
  return out;
}

/** K3 — spacing score for a set of weekdays (circular week). */
export function spacingScore(days) {
  const set = new Set(days);
  let score = 0;
  for (const d of days) {
    if (set.has((d + 1) % 7)) score -= 0.6;
    if (set.has((d + 1) % 7) && set.has((d + 2) % 7)) score -= 1.5;
  }
  return score;
}

export const SPLITS = {
  1: ['Full Body'], 2: ['Full Body', 'Full Body'], 3: ['Full Body', 'Full Body', 'Full Body'],
  4: ['Upper', 'Lower', 'Upper', 'Lower'], 5: ['Upper', 'Lower', 'Push', 'Pull', 'Legs'],
  6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
};

// Pattern slots per focus: each slot lists candidate exercises in preference order.
const SLOTS = {
  'Full Body': [
    ['back_squat', 'goblet_squat', 'leg_press', 'bodyweight_squat'],
    ['bench_press', 'dumbbell_bench_press', 'machine_chest_press', 'push_up'],
    ['barbell_row', 'seated_cable_row', 'dumbbell_row', 'inverted_row'],
    ['romanian_deadlift', 'dumbbell_romanian_deadlift', 'hip_thrust', 'glute_bridge'],
    ['overhead_press', 'dumbbell_shoulder_press', 'pike_push_up'],
    ['plank', 'hanging_leg_raise', 'crunch'],
  ],
  Upper: [
    ['bench_press', 'dumbbell_bench_press', 'machine_chest_press', 'push_up'],
    ['pull_up', 'lat_pulldown', 'assisted_pull_up', 'inverted_row'],
    ['overhead_press', 'dumbbell_shoulder_press', 'pike_push_up'],
    ['seated_cable_row', 'dumbbell_row', 'barbell_row', 'inverted_row'],
    ['dumbbell_curl', 'barbell_curl', 'hammer_curl'],
    ['triceps_pushdown', 'overhead_triceps_extension', 'dips'],
  ],
  Lower: [
    ['back_squat', 'goblet_squat', 'leg_press', 'bodyweight_squat'],
    ['romanian_deadlift', 'dumbbell_romanian_deadlift', 'glute_bridge'],
    ['bulgarian_split_squat', 'walking_lunge'],
    ['leg_curl', 'hip_thrust', 'glute_bridge'],
    ['standing_calf_raise', 'seated_calf_raise'],
    ['hanging_leg_raise', 'plank', 'crunch'],
  ],
  Push: [
    ['bench_press', 'dumbbell_bench_press', 'push_up'],
    ['overhead_press', 'dumbbell_shoulder_press', 'pike_push_up'],
    ['incline_dumbbell_press', 'incline_bench_press', 'incline_push_up'],
    ['lateral_raise', 'cable_lateral_raise'],
    ['triceps_pushdown', 'overhead_triceps_extension', 'dips'],
  ],
  Pull: [
    ['pull_up', 'lat_pulldown', 'assisted_pull_up', 'inverted_row'],
    ['barbell_row', 'seated_cable_row', 'dumbbell_row'],
    ['face_pull', 'reverse_fly'],
    ['barbell_curl', 'dumbbell_curl'],
    ['hammer_curl', 'shrug'],
  ],
  Legs: [
    ['back_squat', 'front_squat', 'goblet_squat', 'bodyweight_squat'],
    ['romanian_deadlift', 'dumbbell_romanian_deadlift', 'glute_bridge'],
    ['walking_lunge', 'bulgarian_split_squat'],
    ['leg_extension', 'leg_curl', 'hip_thrust'],
    ['standing_calf_raise', 'seated_calf_raise', 'tibialis_raise'],
  ],
};

/** Style goal → rep scheme (documented convention, not a guarantee of outcome). */
export const STYLE_SCHEMES = {
  strength: { compound: [5, 4], iso: [8, 3], restCompound: 180, restIso: 90, label: 'Heavier, lower reps' },
  muscle: { compound: [8, 3], iso: [12, 3], restCompound: 120, restIso: 75, label: 'Moderate reps, more volume' },
  athletic: { compound: [6, 3], iso: [10, 3], restCompound: 120, restIso: 60, label: 'Balanced strength and conditioning' },
  lean: { compound: [10, 3], iso: [15, 2], restCompound: 75, restIso: 45, label: 'Higher reps, shorter rests' },
  general: { compound: [10, 3], iso: [12, 2], restCompound: 90, restIso: 60, label: 'Moderate, sustainable' },
};

/**
 * Pick exercises for a focus given the user's gear, experience and focus muscles.
 * `variant` rotates candidates so repeated sessions of the same focus differ.
 */
export function sessionExercises(focus, { gear, experience, style = 'general', variant = 0, sessionMinutes = 60 }) {
  const allowed = new Set(exercisesForGear(gear).map((e) => e.id));
  const scheme = STYLE_SCHEMES[style] ?? STYLE_SCHEMES.general;
  const maxCount = sessionMinutes < 40 ? 4 : sessionMinutes < 55 ? 5 : 6;
  const out = [];
  for (const candidates of (SLOTS[focus] ?? SLOTS['Full Body'])) {
    const usable = candidates.filter((id) => allowed.has(id) && !(experience === 'beginner' && EXERCISE_BY_ID[id]?.difficulty === 'advanced'));
    if (!usable.length) continue;
    const id = usable[variant % usable.length];
    if (out.some((x) => x.exerciseId === id)) continue;
    const def = EXERCISE_BY_ID[id];
    const compound = def.category === 'compound';
    const [reps, sets] = def.metric === 'time' ? [null, 3] : compound ? scheme.compound : scheme.iso;
    out.push({ exerciseId: id, sets, reps, durationSec: def.metric === 'time' ? 40 : null, restSec: compound ? scheme.restCompound : scheme.restIso });
    if (out.length >= maxCount) break;
  }
  return out;
}

/**
 * Build a weekly plan.
 * @returns {{kind:'plan', sessions:{day,start,end,focus,short,exercises}[], restDays:number[],
 *   daysRequested:number, notes:string[], nutrition:object, generatedFor:object}}
 */
export function planWeek({ availability, profile = {}, today }) {
  const av = { ...DEFAULT_AVAILABILITY, ...availability };
  const notes = [];
  const exp = profile.experience ?? 'beginner';
  let n = av.daysPerWeek ?? profile.trainingDaysTarget ?? { beginner: 3, intermediate: 4, advanced: 5 }[exp] ?? 3;
  if (n >= 7) { n = 6; notes.push('Seven days is a no — growth happens on rest days. Capped at 6.'); }
  if (exp === 'beginner' && n > 4) { n = 4; notes.push('You’re new: 4 days max for now. Quality reps beat junk volume.'); }
  const duration = av.sessionMinutes ?? profile.sessionMinutes ?? 60;

  const perDay = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day: d, slot: pickSlot(freeWindows(av, d), duration, av.preference) }));
  const feasible = perDay.filter((x) => x.slot);
  if (feasible.length < n) {
    if (!feasible.length) notes.push('Your schedule has no gap of 30+ minutes. Tell me when you’re actually free.');
    else notes.push(`Only ${feasible.length} days have room right now, so we go ${feasible.length} days.`);
    n = feasible.length;
  }

  let best = null;
  for (const c of combos(feasible, n)) {
    const s = c.reduce((a, x) => a + x.slot.score, 0) + spacingScore(c.map((x) => x.day));
    if (!best || s > best.s + 1e-9) best = { c, s };
  }
  const chosen = best ? best.c : [];
  const split = SPLITS[n] ?? [];
  const counts = {};
  const sessions = chosen.map((x, i) => {
    const focus = split[i] ?? 'Full Body';
    counts[focus] = (counts[focus] ?? 0) + 1;
    return {
      day: x.day, start: toHHMM(x.slot.start), end: toHHMM(x.slot.end), focus, short: x.slot.short,
      exercises: sessionExercises(focus, { gear: profile.gear, experience: exp, style: profile.style, variant: counts[focus] - 1, sessionMinutes: x.slot.end - x.slot.start }),
    };
  });
  if (sessions.some((s) => s.short)) notes.push('Some days only fit a shorter session. I trimmed those.');

  return {
    kind: 'plan', sessions,
    restDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !sessions.some((s) => s.day === d)),
    daysRequested: n, notes, nutrition: nutritionTiming(sessions, av, today),
    generatedFor: { duration, preference: av.preference, style: profile.style ?? 'general' },
  };
}

/** K5 — meal timing around sessions + the nutrition start date (next Monday, or tomorrow if today is Sun). */
export function nutritionTiming(sessions, av, today) {
  const wake = toMin(av.wakeTime);
  const meals = sessions.map((s) => {
    const start = toMin(s.start), end = toMin(s.end);
    const pre = start - 120;
    return {
      day: s.day,
      pre: pre >= wake + 30 ? { time: toHHMM(pre), kind: 'meal' } : { time: toHHMM(Math.max(wake + 15, start - 45)), kind: 'snack' },
      post: { time: toHHMM(Math.min(end + 60, 1439)), kind: 'meal' },
    };
  });
  let startDate = null;
  if (today) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dow = (d.getDay() + 6) % 7; // Mon=0
    d.setDate(d.getDate() + (dow === 6 ? 1 : 7 - dow));
    startDate = d;
  }
  return { meals, startDate };
}

export const sessionLabel = (s) => `${DAY_NAMES[s.day]} · ${fmt12(toMin(s.start))}`;
