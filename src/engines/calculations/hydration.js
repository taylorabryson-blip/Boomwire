/**
 * Hydration calculations (pure, deterministic). Documented in docs/CALCULATIONS.md.
 * Inputs are hydrationLogs records; amounts are in ml.
 */

const alive = (l) => !l.deletedAt;

/** H1 — Daily total: sum of amountMl for non-deleted entries on `dateKey`. */
export function dailyTotal(logs, dateKey) {
  return logs.filter((l) => alive(l) && l.date === dateKey).reduce((s, l) => s + l.amountMl, 0);
}

/** Daily totals for each key, in the given order. Days without entries → 0 total, logged=false. */
export function dailyTotals(logs, dateKeys) {
  const map = new Map(dateKeys.map((k) => [k, { date: k, totalMl: 0, entries: 0 }]));
  for (const l of logs) {
    if (!alive(l)) continue;
    const d = map.get(l.date);
    if (d) { d.totalMl += l.amountMl; d.entries++; }
  }
  return dateKeys.map((k) => ({ ...map.get(k), logged: map.get(k).entries > 0 }));
}

/**
 * H2 — Average of LOGGED days: mean daily total across days with ≥1 entry.
 * Days with no entries are excluded (absence of a log ≠ zero intake).
 * Returns null when no day in the window is logged (never fabricate).
 */
export function loggedDayAverage(totals) {
  const logged = totals.filter((t) => t.logged);
  if (!logged.length) return null;
  return logged.reduce((s, t) => s + t.totalMl, 0) / logged.length;
}

/** H3 — Goal progress: total / goal. null when no goal is set. Not clamped. */
export function goalProgress(totalMl, goalMl) {
  if (!goalMl || goalMl <= 0) return null;
  return totalMl / goalMl;
}

/** H4 — Days meeting goal within a set of totals (logged days only). */
export function daysMeetingGoal(totals, goalMl) {
  if (!goalMl) return null;
  return totals.filter((t) => t.logged && t.totalMl >= goalMl).length;
}

/**
 * H5 — Probable double log: the same amount (±5%) logged in the last 3 minutes,
 * or any amount in the last 45 seconds. Returns the earlier entry or null.
 * Uses createdAt (when the tap happened), not the drink time the user picked.
 */
export function possibleDuplicate(entries, amountMl, now = new Date()) {
  const t = now.getTime();
  const recent = entries.filter((e) => !e.deletedAt && e.createdAt).map((e) => ({ e, age: t - Date.parse(e.createdAt) }))
    .filter((x) => x.age >= 0).sort((a, b) => a.age - b.age);
  const hit = recent.find(({ e, age }) => (age <= 180000 && Math.abs(e.amountMl - amountMl) <= amountMl * 0.05) || age <= 45000);
  return hit?.e ?? null;
}

/** Most recent drink time today ("HH:MM") or null. */
export function lastDrinkTime(entries) {
  return entries.filter((e) => !e.deletedAt && e.time).map((e) => e.time).sort().at(-1) ?? null;
}
