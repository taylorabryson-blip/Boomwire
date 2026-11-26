/**
 * HERCULES DATA MODELS
 * --------------------------------------------------------------------------
 * Every persisted record shares a base envelope:
 *   id         string   UUID (or fixed key for singletons, e.g. 'settings')
 *   createdAt  string   ISO-8601 UTC
 *   updatedAt  string   ISO-8601 UTC — drives sync/import conflict resolution
 *   deletedAt  string|null  soft-delete tombstone (needed so deletes sync)
 *   rev        number   increments on every write (tie-breaker)
 *
 * Domain fields are declared per store below. Values are always stored in
 * metric units. `provenance` marks how a value came to exist:
 *   'recorded'  – entered/logged by the user
 *   'measured'  – captured by a device/integration
 *   'estimated' – produced by a model or formula
 *
 * Stores marked `phase` > 1 are created now so later phases never need a
 * destructive migration; their schemas will be extended additively.
 */

import { isDateKey } from '../utils/dates.js';

export const PROVENANCE = ['recorded', 'measured', 'estimated'];

const BASE = {
  id: { type: 'string', required: true },
  createdAt: { type: 'iso', required: true },
  updatedAt: { type: 'iso', required: true },
  deletedAt: { type: 'iso', nullable: true },
  rev: { type: 'int', required: true, min: 1 },
};

export const SCHEMAS = {
  settings: {
    phase: 1,
    fields: {
      units: { type: 'enum', values: ['metric', 'imperial'], required: true },
      hydrationGoalMl: { type: 'number', nullable: true, min: 250, max: 10000 },
    },
  },
  hydrationLogs: {
    phase: 1,
    fields: {
      date: { type: 'date', required: true },
      time: { type: 'time', required: true },
      amountMl: { type: 'number', required: true, min: 1, max: 5000 },
      provenance: { type: 'enum', values: PROVENANCE, required: true },
    },
  },
  profile: { phase: 2, fields: {} },
  bodyMetrics: { phase: 2, fields: { date: { type: 'date', required: true } } },
  workouts: { phase: 3, fields: { date: { type: 'date', required: true } } },
  exercises: { phase: 3, fields: {} },
  foods: { phase: 5, fields: {} },
  foodLogs: { phase: 5, fields: { date: { type: 'date', required: true } } },
  recoveryLogs: { phase: 7, fields: { date: { type: 'date', required: true } } },
  schedules: { phase: 7, fields: {} },
};

export const STORE_NAMES = Object.keys(SCHEMAS);

export const STORE_LABELS = {
  settings: 'Settings', hydrationLogs: 'Hydration entries', profile: 'Profile',
  bodyMetrics: 'Body metrics', workouts: 'Workouts', exercises: 'Custom exercises',
  foods: 'Custom foods', foodLogs: 'Food entries', recoveryLogs: 'Recovery entries', schedules: 'Schedules',
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function checkField(name, rule, value, errors) {
  if (value === undefined || value === null) {
    if (value === null && rule.nullable) return;
    if (rule.required) errors.push(`${name} is required`);
    return;
  }
  switch (rule.type) {
    case 'string': if (typeof value !== 'string' || !value) errors.push(`${name} must be a non-empty string`); break;
    case 'iso': if (typeof value !== 'string' || !ISO_RE.test(value)) errors.push(`${name} must be an ISO-8601 UTC timestamp`); break;
    case 'date': if (!isDateKey(value)) errors.push(`${name} must be a valid YYYY-MM-DD date`); break;
    case 'time': if (typeof value !== 'string' || !TIME_RE.test(value)) errors.push(`${name} must be HH:MM`); break;
    case 'enum': if (!rule.values.includes(value)) errors.push(`${name} must be one of ${rule.values.join(', ')}`); break;
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

/**
 * Validate a full record for a store.
 * @returns {string[]} list of error messages (empty = valid)
 */
export function validate(store, record) {
  const schema = SCHEMAS[store];
  if (!schema) return [`Unknown store "${store}"`];
  if (!record || typeof record !== 'object') return ['Record must be an object'];
  const errors = [];
  for (const [k, rule] of Object.entries(BASE)) checkField(k, rule, record[k], errors);
  for (const [k, rule] of Object.entries(schema.fields)) checkField(k, rule, record[k], errors);
  return errors;
}

export class ValidationError extends Error {
  constructor(store, errors) {
    super(`Invalid ${store} record: ${errors.join('; ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export const DEFAULT_SETTINGS = Object.freeze({ units: 'metric', hydrationGoalMl: null });
