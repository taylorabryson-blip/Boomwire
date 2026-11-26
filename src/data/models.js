/**
 * HERCULES DATA MODELS
 * --------------------------------------------------------------------------
 * Every persisted record shares a base envelope:
 *   id, createdAt, updatedAt (drives conflict resolution), deletedAt
 *   (soft-delete tombstone), rev (increments on each write).
 *
 * Domain fields are declared per store. Values are stored in metric units.
 * `provenance`: 'recorded' (user entered) | 'measured' (device) | 'estimated' (model).
 * Stores may add a `custom(record)` validator for nested structures.
 * Full documentation: docs/DATA_MODEL.md
 */
import { isDateKey } from '../utils/dates.js';
import { GEAR, ENVIRONMENTS, STYLES, FOCUS_AREAS } from './exercises/gear.js';

export const PROVENANCE = ['recorded', 'measured', 'estimated'];
export const GOALS = ['maintain', 'muscle', 'consistency', 'performance'];
export const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];
export const MEASUREMENTS = ['chestCm', 'waistCm', 'armsCm', 'thighsCm', 'calvesCm', 'shouldersCm'];

const BASE = {
  id: { type: 'string', required: true },
  createdAt: { type: 'iso', required: true },
  updatedAt: { type: 'iso', required: true },
  deletedAt: { type: 'iso', nullable: true },
  rev: { type: 'int', required: true, min: 1 },
};

const num = (min, max, extra = {}) => ({ type: 'number', nullable: true, min, max, ...extra });
const TIME = { type: 'time', required: true };

export const SCHEMAS = {
  settings: {
    phase: 1,
    fields: {
      units: { type: 'enum', values: ['imperial', 'metric'], required: true },
      hydrationGoalMl: num(250, 10000),
      reminders: { type: 'object', nullable: true },
    },
  },
  hydrationLogs: {
    phase: 1,
    fields: {
      date: { type: 'date', required: true },
      time: TIME,
      amountMl: { type: 'number', required: true, min: 1, max: 5000 },
      provenance: { type: 'enum', values: PROVENANCE, required: true },
    },
  },
  profile: {
    phase: 2,
    fields: {
      displayName: { type: 'text', nullable: true, max: 40 },
      birthYear: { type: 'int', nullable: true, min: 1900, max: 2100 },
      sex: { type: 'enum', values: ['male', 'female', 'unspecified'], nullable: true },
      heightCm: num(50, 272),
      experience: { type: 'enum', values: EXPERIENCE, nullable: true },
      goal: { type: 'enum', values: GOALS, nullable: true },
      trainingDaysTarget: { type: 'int', nullable: true, min: 1, max: 7 },
      sessionMinutes: { type: 'int', nullable: true, min: 15, max: 180 },
      environment: { type: 'enum', values: ENVIRONMENTS.map((e) => e.id), nullable: true },
      gear: { type: 'enumArray', values: GEAR.map((g) => g.id), nullable: true },
      style: { type: 'enum', values: STYLES.map((x) => x.id), nullable: true },
      focusAreas: { type: 'enumArray', values: FOCUS_AREAS.map((x) => x.id), nullable: true },
    },
  },
  bodyMetrics: {
    phase: 2,
    fields: {
      date: { type: 'date', required: true },
      weightKg: num(20, 400),
      chestCm: num(30, 250), waistCm: num(30, 250), armsCm: num(10, 100),
      thighsCm: num(20, 150), calvesCm: num(15, 100), shouldersCm: num(50, 250),
      provenance: { type: 'enum', values: PROVENANCE, required: true },
    },
    custom: (r) => (r.weightKg == null && MEASUREMENTS.every((k) => r[k] == null) ? ['at least one value is required'] : []),
  },
  workouts: {
    phase: 3,
    fields: {
      date: { type: 'date', required: true },
      startTime: TIME,
      startedAt: { type: 'iso', required: true },
      name: { type: 'text', required: true, max: 60 },
      status: { type: 'enum', values: ['in_progress', 'completed'], required: true },
      durationMin: num(0, 1440),
      notes: { type: 'text', nullable: true, max: 2000 },
      templateId: { type: 'text', nullable: true },
      planFocus: { type: 'text', nullable: true },
    },
    custom: (r) => validateExercises(r.exercises, true),
  },
  templates: {
    phase: 3,
    fields: { name: { type: 'text', required: true, max: 60 } },
    custom: (r) => validateExercises(r.exercises, false),
  },
  exercises: { phase: 3, fields: {} },
  foods: { phase: 5, fields: {} },
  foodLogs: { phase: 5, fields: { date: { type: 'date', required: true } } },
  recoveryLogs: { phase: 7, fields: { date: { type: 'date', required: true } } },
  schedules: { phase: 7, fields: {} },
  coach: {
    phase: 4,
    fields: { kind: { type: 'enum', values: ['availability', 'plan'], required: true } },
    custom: (r) => (r.kind === 'availability' ? validateAvailability(r) : validatePlan(r)),
  },
  coachMessages: {
    phase: 4,
    fields: {
      date: { type: 'date', required: true },
      role: { type: 'enum', values: ['user', 'kratos'], required: true },
      text: { type: 'text', required: true, max: 4000 },
    },
  },
};

export const STORE_NAMES = Object.keys(SCHEMAS);

export const STORE_LABELS = {
  settings: 'Settings', hydrationLogs: 'Hydration entries', profile: 'Profile',
  bodyMetrics: 'Body metric entries', workouts: 'Workouts', templates: 'Workout templates',
  exercises: 'Custom exercises', foods: 'Custom foods', foodLogs: 'Food entries',
  recoveryLogs: 'Recovery entries', schedules: 'Schedules', coach: 'Kratos plan & schedule',
  coachMessages: 'Kratos messages',
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isTime = (v) => typeof v === 'string' && TIME_RE.test(v);

function checkField(name, rule, value, errors) {
  if (value === undefined || value === null) {
    if (value === null && rule.nullable) return;
    if (rule.required) errors.push(`${name} is required`);
    return;
  }
  switch (rule.type) {
    case 'string': if (typeof value !== 'string' || !value) errors.push(`${name} must be a non-empty string`); break;
    case 'text':
      if (typeof value !== 'string') errors.push(`${name} must be text`);
      else if (rule.required && !value.trim()) errors.push(`${name} is required`);
      else if (rule.max && value.length > rule.max) errors.push(`${name} must be ≤ ${rule.max} characters`);
      break;
    case 'iso': if (typeof value !== 'string' || !ISO_RE.test(value)) errors.push(`${name} must be an ISO-8601 UTC timestamp`); break;
    case 'date': if (!isDateKey(value)) errors.push(`${name} must be a valid YYYY-MM-DD date`); break;
    case 'time': if (!isTime(value)) errors.push(`${name} must be HH:MM`); break;
    case 'enum': if (!rule.values.includes(value)) errors.push(`${name} must be one of ${rule.values.join(', ')}`); break;
    case 'object': if (typeof value !== 'object' || Array.isArray(value)) errors.push(`${name} must be an object`); break;
    case 'enumArray':
      if (!Array.isArray(value) || value.some((v) => !rule.values.includes(v))) errors.push(`${name} must be a list of ${rule.values.join(', ')}`);
      break;
    case 'int':
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) { errors.push(`${name} must be a finite number`); break; }
      if (rule.type === 'int' && !Number.isInteger(value)) errors.push(`${name} must be an integer`);
      if (rule.min != null && value < rule.min) errors.push(`${name} must be ≥ ${rule.min}`);
      if (rule.max != null && value > rule.max) errors.push(`${name} must be ≤ ${rule.max}`);
      break;
    default: errors.push(`${name} has unknown type ${rule.type}`);
  }
}

const SET_RULES = {
  reps: { type: 'int', nullable: true, min: 0, max: 1000 },
  weightKg: { type: 'number', nullable: true, min: 0, max: 1000 },
  durationSec: { type: 'int', nullable: true, min: 0, max: 86400 },
};

/** Workouts: sets carry actual values. Templates: sets carry targets. */
function validateExercises(list, isWorkout) {
  const errors = [];
  if (!Array.isArray(list)) return ['exercises must be a list'];
  if (list.length > 50) errors.push('at most 50 exercises');
  list.forEach((ex, i) => {
    const p = `exercises[${i}]`;
    if (!ex || typeof ex.exerciseId !== 'string' || !ex.exerciseId) { errors.push(`${p}.exerciseId is required`); return; }
    checkField(`${p}.restSec`, { type: 'int', nullable: true, min: 0, max: 900 }, ex.restSec, errors);
    if (!Array.isArray(ex.sets)) { errors.push(`${p}.sets must be a list`); return; }
    if (ex.sets.length > 30) errors.push(`${p} has too many sets`);
    ex.sets.forEach((s, j) => {
      for (const [k, rule] of Object.entries(SET_RULES)) checkField(`${p}.sets[${j}].${k}`, rule, s[k], errors);
      if (isWorkout && typeof s.completed !== 'boolean') errors.push(`${p}.sets[${j}].completed must be true/false`);
    });
  });
  return errors;
}

function validateBlocks(blocks, name, errors) {
  if (!Array.isArray(blocks)) { errors.push(`${name} must be a list`); return; }
  blocks.forEach((b, i) => {
    if (!Number.isInteger(b?.day) || b.day < 0 || b.day > 6) errors.push(`${name}[${i}].day must be 0–6 (Mon–Sun)`);
    if (!isTime(b?.start) || !isTime(b?.end)) errors.push(`${name}[${i}] needs HH:MM start and end`);
    else if (b.end <= b.start && b.end !== '00:00') errors.push(`${name}[${i}] must end after it starts`);
  });
}

function validateAvailability(r) {
  const errors = [];
  if (!isTime(r.wakeTime)) errors.push('wakeTime must be HH:MM');
  if (!isTime(r.sleepTime)) errors.push('sleepTime must be HH:MM');
  validateBlocks(r.busy, 'busy', errors);
  validateBlocks(r.free, 'free', errors);
  if (r.daysPerWeek != null && !(Number.isInteger(r.daysPerWeek) && r.daysPerWeek >= 1 && r.daysPerWeek <= 7)) errors.push('daysPerWeek must be 1–7');
  if (r.sessionMinutes != null && !(Number.isInteger(r.sessionMinutes) && r.sessionMinutes >= 15 && r.sessionMinutes <= 180)) errors.push('sessionMinutes must be 15–180');
  if (!['morning', 'midday', 'evening', 'any'].includes(r.preference)) errors.push('preference is invalid');
  return errors;
}

function validatePlan(r) {
  const errors = [];
  if (!Array.isArray(r.sessions)) return ['sessions must be a list'];
  r.sessions.forEach((s, i) => {
    if (!Number.isInteger(s.day) || s.day < 0 || s.day > 6) errors.push(`sessions[${i}].day invalid`);
    if (!isTime(s.start) || !isTime(s.end)) errors.push(`sessions[${i}] needs times`);
    if (typeof s.focus !== 'string') errors.push(`sessions[${i}].focus required`);
  });
  return errors;
}

/**
 * Validate a full record for a store.
 * @returns {string[]} error messages (empty = valid)
 */
export function validate(store, record) {
  const schema = SCHEMAS[store];
  if (!schema) return [`Unknown store "${store}"`];
  if (!record || typeof record !== 'object') return ['Record must be an object'];
  const errors = [];
  for (const [k, rule] of Object.entries(BASE)) checkField(k, rule, record[k], errors);
  for (const [k, rule] of Object.entries(schema.fields)) checkField(k, rule, record[k], errors);
  if (schema.custom) errors.push(...schema.custom(record));
  return errors;
}

export class ValidationError extends Error {
  constructor(store, errors) {
    super(`Invalid ${store} record: ${errors.join('; ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export const DEFAULT_SETTINGS = Object.freeze({ units: 'imperial', hydrationGoalMl: null, reminders: null });
export const DEFAULT_PROFILE = Object.freeze({
  displayName: null, birthYear: null, sex: null, heightCm: null, experience: null, goal: null,
  trainingDaysTarget: null, sessionMinutes: null, environment: null, gear: null, style: null, focusAreas: null,
});

/** Approximate age from birth year (±1 year). null when unknown. */
export function approxAge(profile, today = new Date()) {
  return profile?.birthYear ? today.getFullYear() - profile.birthYear : null;
}
/** Under 18 (or possibly so) → still developing: no restrictive nutrition advice. */
export function isDeveloping(profile, today = new Date()) {
  const a = approxAge(profile, today);
  return a != null && a < 19;
}
