/**
 * Cratos weekly planner — deterministic scheduling, documented in
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

/** Style goal → rep scheme (documented convention, not a guarantee of outcome). */
export const STYLE_SCHEMES = {
  strength: { compound: [5, 4], iso: [8, 3], restCompound: 180, restIso: 90, label: 'Heavier, lower reps' },
  muscle: { compound: [8, 3], iso: [12, 3], restCompound: 120, restIso: 75, label: 'Moderate reps, more volume' },
  athletic: { compound: [6, 3], iso: [10, 3], restCompound: 120, restIso: 60, label: 'Balanced strength and conditioning' },
  lean: { compound: [10, 3], iso: [15, 2], restCompound: 75, restIso: 45, label: 'Higher reps, shorter rests' },
  general: { compound: [10, 3], iso: [12, 2], restCompound: 90, restIso: 60, label: 'Moderate, sustainable' },
};

/* ── K9 Exercise selection (data-driven) ──────────────────────────────────
 * Each focus is an ordered list of slots. A slot is a filter over the whole
 * exercise library; candidates the user can do with their gear are scored:
 *   + staple lifts, + equipment that suits the style, + difficulty match,
 *   + small deterministic jitter (rotates accessories weekly, main lifts every
 *     4 weeks so progression has time to work),
 *   − anything already used this week (so Upper A ≠ Upper B).
 * Focus areas add an extra slot for that region; athletic adds power work and
 * a finisher, lean adds a conditioning finisher. Slots are trimmed to fit time.
 */
const has = (e, m) => e.primary.includes(m);
const lift = (e) => e.category !== 'cardio' && e.category !== 'mobility' && e.metric !== 'time';
const SLOT = {
  squat: (e) => lift(e) && e.pattern === 'squat' && e.category === 'compound',
  hinge: (e) => lift(e) && e.pattern === 'hinge' && e.category === 'compound' && !e.tags.includes('power'),
  hpush: (e) => lift(e) && e.pattern === 'horizontal_push' && e.category === 'compound',
  incline: (e) => lift(e) && e.pattern === 'horizontal_push' && e.category === 'compound' && has(e, 'deltoid_anterior'),
  vpush: (e) => lift(e) && e.pattern === 'vertical_push' && e.category === 'compound' && has(e, 'deltoid_anterior'),
  hpull: (e) => lift(e) && e.pattern === 'horizontal_pull' && e.category === 'compound',
  vpull: (e) => lift(e) && e.pattern === 'vertical_pull' && e.category === 'compound',
  lunge: (e) => lift(e) && e.pattern === 'lunge',
  chestIso: (e) => lift(e) && e.category === 'isolation' && has(e, 'pectoralis_major'),
  sideDelt: (e) => lift(e) && e.category === 'isolation' && has(e, 'deltoid_lateral'),
  rearDelt: (e) => lift(e) && e.category === 'isolation' && (has(e, 'deltoid_posterior') || has(e, 'infraspinatus')),
  biceps: (e) => lift(e) && e.category === 'isolation' && has(e, 'biceps_brachii'),
  triceps: (e) => lift(e) && (e.category === 'isolation' || e.id === 'dips' || e.id === 'bench_dip' || e.id === 'machine_dip') && has(e, 'triceps_brachii') && !has(e, 'pectoralis_major'),
  quadIso: (e) => lift(e) && e.category === 'isolation' && has(e, 'quadriceps'),
  hamIso: (e) => lift(e) && e.category === 'isolation' && has(e, 'hamstrings'),
  glute: (e) => lift(e) && has(e, 'gluteus_maximus') && (e.pattern === 'hinge' || e.pattern === 'isolation') && !has(e, 'hamstrings') && !e.tags.includes('power'),
  traps: (e) => lift(e) && e.category === 'isolation' && has(e, 'trapezius') && e.pattern === 'isolation',
  calf: (e) => e.pattern === 'calf' && e.category !== 'cardio',
  core: (e) => e.category === 'core' && e.pattern === 'core',
  power: (e) => e.tags.includes('power') || e.tags.includes('plyo'),
  finisher: (e) => e.tags.includes('conditioning'),
};

const TEMPLATES = {
  'Full Body': ['squat', 'hpush', 'hpull', 'hinge', 'vpush', 'vpull', 'lunge', 'core', 'biceps', 'triceps'],
  Upper: ['hpush', 'vpull', 'vpush', 'hpull', 'sideDelt', 'biceps', 'triceps', 'rearDelt', 'chestIso'],
  Lower: ['squat', 'hinge', 'lunge', 'hamIso', 'quadIso', 'glute', 'calf', 'core'],
  Push: ['hpush', 'vpush', 'incline', 'sideDelt', 'triceps', 'chestIso', 'triceps'],
  Pull: ['vpull', 'hpull', 'rearDelt', 'biceps', 'hpull', 'biceps', 'traps'],
  Legs: ['squat', 'hinge', 'lunge', 'quadIso', 'hamIso', 'calf', 'glute', 'core'],
  // Extra ready-made focuses (Templates screen, Cratos chat).
  Arms: ['biceps', 'triceps', 'biceps', 'triceps', 'biceps', 'triceps'],
  'Chest & Back': ['hpush', 'hpull', 'incline', 'vpull', 'chestIso', 'rearDelt'],
  Shoulders: ['vpush', 'sideDelt', 'rearDelt', 'sideDelt', 'traps', 'rearDelt'],
  Glutes: ['hinge', 'glute', 'lunge', 'glute', 'hamIso', 'glute'],
  Core: ['core', 'core', 'core', 'core', 'core'],
  Conditioning: ['power', 'finisher', 'power', 'finisher', 'finisher', 'core'],
};
export const FOCUS_NAMES = Object.keys(TEMPLATES);

// Focus areas → extra slot, only on sessions that train that region.
const AREA_SLOTS = { chest: ['chestIso', 'hpush'], back: ['hpull', 'vpull'], shoulders: ['sideDelt', 'rearDelt'], arms: ['biceps', 'triceps'], core: ['core'], legs: ['quadIso', 'hamIso'] };
const AREA_FITS = {
  'Full Body': ['chest', 'back', 'shoulders', 'arms', 'core', 'legs'], Upper: ['chest', 'back', 'shoulders', 'arms', 'core'],
  Lower: ['legs', 'core'], Push: ['chest', 'shoulders', 'arms'], Pull: ['back', 'arms'], Legs: ['legs', 'core'],
};

// Equipment fit per style (higher = preferred).
const STYLE_EQUIP = {
  strength: { barbell: 3, dumbbell: 1.5, machine: 1, cable: 0.5, bodyweight: 0.5, kettlebell: 1, band: 0, other: 0.5 },
  muscle: { barbell: 1.5, dumbbell: 2, machine: 2, cable: 2, bodyweight: 0.5, kettlebell: 0.5, band: 0.3, other: 0 },
  athletic: { barbell: 2.5, dumbbell: 2, machine: 0.5, cable: 1, bodyweight: 1.5, kettlebell: 2, band: 0.5, other: 1.5 },
  lean: { barbell: 1, dumbbell: 2, machine: 1.5, cable: 1.5, bodyweight: 1.5, kettlebell: 2, band: 0.8, other: 0.5 },
  general: { barbell: 1.5, dumbbell: 2, machine: 2, cable: 1.5, bodyweight: 1.2, kettlebell: 1, band: 0.5, other: 0 },
};
const MAIN = new Set(['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull']);

// Specialty gear: used when it's what you have, not picked over the basics.
const NICHE = new Set(['axle_bar', 'cambered_bar', 'swiss_bar', 'multigrip_bar', 'log', 'yoke', 'atlas_stones', 'keg', 'husafell', 'tire', 'sledgehammer',
  'chains', 'climbing_rope', 'pegboard', 'tricep_bar', 'clubbell', 'heavy_bag', 'speed_bag', 'double_end_bag', 'vertical_climber', 'jacobs_ladder']);
const niche = (e) => (e.requires ?? []).some((g) => g.every((id) => NICHE.has(id)));

function hash(str) { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; }

/** ISO-ish week number used to rotate accessories. */
export function weekIndex(date = new Date()) { return Math.floor((date.getTime() - Date.UTC(2024, 0, 1)) / (7 * 86400000)); }

function scoreFor(e, slot, { style, experience, used, seed, sessionUsed }) {
  if (sessionUsed.has(e.id)) return -Infinity;
  if (experience === 'beginner' && e.difficulty === 'advanced') return -Infinity;
  let s = (STYLE_EQUIP[style] ?? STYLE_EQUIP.general)[e.equipment] ?? 0;
  if (e.tags.includes('staple')) s += experience === 'advanced' ? 1.5 : 2.5;
  if (experience === 'beginner') s += e.difficulty === 'beginner' ? 1.5 : 0;
  if (experience === 'advanced') s += e.difficulty === 'beginner' && MAIN.has(slot) ? -0.8 : 0.3;
  if (style === 'strength' && e.tags.includes('unilateral') && MAIN.has(slot)) s -= 1;
  if (MAIN.has(slot) && experience !== 'beginner' && e.equipment === 'barbell') s += 1.2;
  if (slot === 'rearDelt' && has(e, 'deltoid_posterior')) s += 1;
  if (niche(e)) s -= 2;
  if (used.has(e.id)) s -= 4;
  const block = MAIN.has(slot) ? Math.floor(seed / 4) : seed; // main lifts hold for 4 weeks
  return s + hash(`${e.id}|${block}`) * (MAIN.has(slot) ? 1.2 : 2.5);
}

/**
 * Pick exercises for a focus.
 * @param {string} focus  one of FOCUS_NAMES
 * @param {object} o gear, experience, style, sessionMinutes, focusAreas, week (rotation seed), used (Set shared across the week)
 */
export function sessionExercises(focus, { gear, experience = 'beginner', style = 'general', variant = 0, sessionMinutes = 60, focusAreas = [], week = 0, used = new Set() } = {}) {
  const pool = exercisesForGear(gear);
  const scheme = STYLE_SCHEMES[style] ?? STYLE_SCHEMES.general;
  const maxCount = (sessionMinutes < 35 ? 4 : sessionMinutes < 50 ? 5 : sessionMinutes < 65 ? 6 : sessionMinutes < 85 ? 7 : 8) - (style === 'strength' && sessionMinutes >= 50 ? 1 : 0);

  // Build candidate slots with priorities, keep the top `maxCount`, then order
  // them the way a session runs: power first, main lifts, accessories, finisher.
  const base = TEMPLATES[focus] ?? TEMPLATES['Full Body'];
  const cand = base.map((slot, i) => ({ slot, pri: i, ord: i }));
  const areas = (focusAreas ?? []).filter((a) => (AREA_FITS[focus] ?? []).includes(a));
  // One focus-area slot per session (two on long sessions), rotating through the areas across the week.
  const areaCount = Math.min(areas.length, maxCount >= 7 ? 2 : 1);
  for (let i = 0; i < areaCount; i++) {
    const a = areas[(variant + i) % areas.length], opts = AREA_SLOTS[a];
    cand.push({ slot: opts[(variant + Math.floor(week / 2)) % opts.length], pri: 3.5 + i * 0.1, ord: 3.5 + i * 0.1 });
  }
  const trains = !!AREA_FITS[focus];
  if (style === 'athletic' && trains) cand.push({ slot: 'power', pri: 2.5, ord: -1 });
  if (style === 'lean' && trains) cand.push({ slot: 'finisher', pri: 3.2, ord: 99 });
  if (style === 'athletic' && trains) cand.push({ slot: 'finisher', pri: 5.5, ord: 99 });
  if (style === 'strength') for (const c of cand) if (!MAIN.has(c.slot) && c.pri > 3) c.pri += 2; // fewer, heavier movements
  let slots = cand.sort((a, b) => a.pri - b.pri).slice(0, maxCount).sort((a, b) => a.ord - b.ord).map((c) => c.slot);
  // Alternate the lead lift on repeat sessions (Upper B leads with the pull).
  const lead = slots.findIndex((x) => MAIN.has(x));
  if (variant % 2 === 1 && lead >= 0 && MAIN.has(slots[lead + 1])) [slots[lead], slots[lead + 1]] = [slots[lead + 1], slots[lead]];

  const out = [];
  const sessionUsed = new Set();
  for (const slot of slots) {
    const test = SLOT[slot];
    let best = null, bestScore = -Infinity;
    for (const e of pool) {
      if (!test(e)) continue;
      const sc = scoreFor(e, slot, { style, experience, used, seed: week * 7 + variant, sessionUsed });
      if (sc > bestScore) { best = e; bestScore = sc; }
    }
    if (!best || bestScore === -Infinity) continue;
    sessionUsed.add(best.id); used.add(best.id);
    out.push(prescribe(best, slot, scheme));
  }
  return out;
}

function prescribe(def, slot, scheme) {
  if (def.metric === 'time') {
    const cond = slot === 'finisher' || def.category === 'cardio';
    return { exerciseId: def.id, sets: cond ? 4 : 3, reps: null, durationSec: cond ? 40 : 30, restSec: cond ? 40 : 60 };
  }
  if (slot === 'power') return { exerciseId: def.id, sets: 4, reps: def.tags.includes('plyo') ? 5 : 3, durationSec: null, restSec: 90 };
  if (slot === 'finisher') return { exerciseId: def.id, sets: 3, reps: 12, durationSec: null, restSec: 45 };
  const compound = def.category === 'compound';
  const [reps, sets] = compound ? scheme.compound : scheme.iso;
  return { exerciseId: def.id, sets, reps, durationSec: null, restSec: compound ? scheme.restCompound : scheme.restIso };
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
  const used = new Set();
  const week = weekIndex(today ?? new Date());
  const sessions = chosen.map((x, i) => {
    const focus = split[i] ?? 'Full Body';
    counts[focus] = (counts[focus] ?? 0) + 1;
    return {
      day: x.day, start: toHHMM(x.slot.start), end: toHHMM(x.slot.end), focus, short: x.slot.short,
      exercises: sessionExercises(focus, { gear: profile.gear, experience: exp, style: profile.style ?? 'general', variant: counts[focus] - 1, sessionMinutes: x.slot.end - x.slot.start, focusAreas: profile.focusAreas ?? [], week, used }),
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

/**
 * K7 — Diet-only plan: no training, three meals spaced across the waking day
 * (breakfast ~30 min after waking, dinner ≥ 3 h before bed, lunch midway).
 */
export function dietPlan(av) {
  const wake = toMin(av?.wakeTime ?? '07:00');
  let sleep = toMin(av?.sleepTime ?? '23:00');
  if (sleep <= wake) sleep += 24 * 60;
  const breakfast = wake + 30;
  const dinner = Math.max(breakfast + 6 * 60, Math.min(sleep - 180, breakfast + 11 * 60));
  const lunch = Math.round((breakfast + dinner) / 2 / 15) * 15;
  const meals = [['Breakfast', breakfast], ['Lunch', lunch], ['Dinner', dinner]].map(([label, m]) => ({ label, time: toHHMM(m % 1440) }));
  return { kind: 'plan', mode: 'nutrition', sessions: [], restDays: [0, 1, 2, 3, 4, 5, 6], daysRequested: 0, notes: [], nutrition: { meals: [], dailyMeals: meals, startDate: null } };
}
