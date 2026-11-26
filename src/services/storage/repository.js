/**
 * Repository: the ONLY module screens use to read/write data.
 * Stamps envelopes, validates, soft-deletes, and broadcasts change events
 * so any mounted screen can re-render.
 */
import * as db from './db.js';
import { validate, ValidationError, DEFAULT_SETTINGS } from '../../data/models.js';
import { uuid } from '../../utils/id.js';

const bus = new EventTarget();
const emit = (store, action, record) => bus.dispatchEvent(new CustomEvent('change', { detail: { store, action, record } }));

/** Subscribe to data changes. Returns an unsubscribe function. */
export function onChange(fn) {
  const handler = (e) => fn(e.detail);
  bus.addEventListener('change', handler);
  return () => bus.removeEventListener('change', handler);
}

const now = () => new Date().toISOString();
const alive = (r) => r && !r.deletedAt;

function assertValid(store, record) {
  const errors = validate(store, record);
  if (errors.length) throw new ValidationError(store, errors);
}

export async function create(store, data) {
  const t = now();
  const record = { ...data, id: data.id ?? uuid(), createdAt: t, updatedAt: t, deletedAt: null, rev: 1 };
  assertValid(store, record);
  await db.put(store, record);
  emit(store, 'create', record);
  return record;
}

export async function update(store, id, patch) {
  const existing = await db.get(store, id);
  if (!existing) throw new Error(`${store}/${id} not found`);
  const record = { ...existing, ...patch, id, createdAt: existing.createdAt, updatedAt: now(), rev: existing.rev + 1 };
  assertValid(store, record);
  await db.put(store, record);
  emit(store, 'update', record);
  return record;
}

/** Soft delete: keeps a tombstone so the deletion survives sync/import. */
export async function remove(store, id) {
  const existing = await db.get(store, id);
  if (!existing || existing.deletedAt) return;
  const record = { ...existing, deletedAt: now(), updatedAt: now(), rev: existing.rev + 1 };
  await db.put(store, record);
  emit(store, 'delete', record);
}

export async function restore(store, id) {
  const existing = await db.get(store, id);
  if (!existing || !existing.deletedAt) return;
  const record = { ...existing, deletedAt: null, updatedAt: now(), rev: existing.rev + 1 };
  await db.put(store, record);
  emit(store, 'restore', record);
}

export async function list(store) {
  return (await db.getAll(store)).filter(alive);
}

export async function listByDate(store, from, to = from) {
  return (await db.getByDateRange(store, from, to)).filter(alive);
}

export async function countAlive(store) {
  return (await list(store)).length;
}

/* ---- Settings singleton ------------------------------------------------- */
export async function getSettings() {
  const s = await db.get('settings', 'settings');
  return { ...DEFAULT_SETTINGS, ...(alive(s) ? s : {}) };
}

export async function updateSettings(patch) {
  const existing = await db.get('settings', 'settings');
  if (!existing) return create('settings', { ...DEFAULT_SETTINGS, ...patch, id: 'settings' });
  return update('settings', 'settings', patch);
}

/** Used by backup import after merge has decided winners. */
export async function writeMerged(store, records) {
  if (!records.length) return;
  for (const r of records) assertValid(store, r);
  await db.putMany(store, records);
  emit(store, 'import', null);
}
