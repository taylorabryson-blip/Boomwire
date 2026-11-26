/**
 * Conflict resolution — pure, deterministic, shared by backup import now and
 * Supabase sync later.
 *
 * Rule: for each id, the record with the later `updatedAt` wins.
 *   Tie → higher `rev` wins. Full tie → the LOCAL record is kept.
 * An older incoming record can therefore never overwrite a newer local one.
 * Tombstones (deletedAt set) are records like any other, so deletes propagate.
 */

/** @returns {-1|0|1} 1 if a is newer than b */
export function compareVersions(a, b) {
  const ta = Date.parse(a.updatedAt), tb = Date.parse(b.updatedAt);
  if (ta !== tb) return ta > tb ? 1 : -1;
  if (a.rev !== b.rev) return a.rev > b.rev ? 1 : -1;
  return 0;
}

/**
 * @param {object[]} local
 * @param {object[]} incoming
 * @returns {{ toWrite: object[], added: number, updated: number, skipped: number }}
 */
export function mergeRecords(local, incoming) {
  const byId = new Map(local.map((r) => [r.id, r]));
  const toWrite = [];
  let added = 0, updated = 0, skipped = 0;
  for (const inc of incoming) {
    const cur = byId.get(inc.id);
    if (!cur) { toWrite.push(inc); byId.set(inc.id, inc); added++; continue; }
    if (compareVersions(inc, cur) > 0) { toWrite.push(inc); byId.set(inc.id, inc); updated++; }
    else skipped++;
  }
  return { toWrite, added, updated, skipped };
}
