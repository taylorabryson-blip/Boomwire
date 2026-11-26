/**
 * Export / import of the full local database as JSON.
 * Import MERGES (never replaces): see services/sync/merge.js.
 */
import * as db from './db.js';
import { writeMerged } from './repository.js';
import { mergeRecords } from '../sync/merge.js';
import { STORE_NAMES, validate } from '../../data/models.js';
import { localDateKey } from '../../utils/dates.js';

export const BACKUP_FORMAT = 'hercules-backup';

export async function exportAll() {
  const stores = {};
  for (const name of STORE_NAMES) stores[name] = await db.getAll(name); // includes tombstones
  return { format: BACKUP_FORMAT, schemaVersion: db.SCHEMA_VERSION, exportedAt: new Date().toISOString(), stores };
}

export async function downloadBackup() {
  const data = await exportAll();
  const name = `hercules-backup-${localDateKey()}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Hercules backup' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Validate a parsed backup and merge it into the local database.
 * Invalid records are skipped and counted; nothing local is ever removed.
 */
export async function importBackup(json) {
  if (!json || json.format !== BACKUP_FORMAT || typeof json.stores !== 'object') throw new Error('This file is not a Hercules backup.');
  if (json.schemaVersion > db.SCHEMA_VERSION) throw new Error('This backup is from a newer version of Hercules. Update the app first.');
  const summary = { added: 0, updated: 0, skipped: 0, invalid: 0 };
  for (const name of STORE_NAMES) {
    const incoming = Array.isArray(json.stores[name]) ? json.stores[name] : [];
    const valid = incoming.filter((r) => { const ok = validate(name, r).length === 0; if (!ok) summary.invalid++; return ok; });
    const local = await db.getAll(name);
    const { toWrite, added, updated, skipped } = mergeRecords(local, valid);
    await writeMerged(name, toWrite);
    summary.added += added; summary.updated += updated; summary.skipped += skipped;
  }
  return summary;
}
