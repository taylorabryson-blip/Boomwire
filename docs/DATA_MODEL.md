# Data Model & Storage

## Record envelope (every store)

| Field | Type | Purpose |
|---|---|---|
| `id` | string | UUID v4 (`'settings'` for the settings singleton) |
| `createdAt` | ISO-8601 UTC | creation time |
| `updatedAt` | ISO-8601 UTC | last write; **drives conflict resolution** |
| `deletedAt` | ISO or null | soft-delete tombstone so deletions survive sync and import |
| `rev` | int ≥ 1 | increments every write; breaks timestamp ties |

Day-level records also have `date`, a **local** calendar key (`YYYY-MM-DD`).
A log made at 11 pm belongs to that local day.

All quantities are stored in **metric** (ml, kg, cm). Units are converted only for display.

## Stores (schema v1)

| Store | Phase | Indexes | Notes |
|---|---|---|---|
| `settings` | 1 | — | `units`, `hydrationGoalMl` (nullable: no goal is assumed) |
| `hydrationLogs` | 1 | `byDate` | `date`, `time`, `amountMl` (1–5000), `provenance` |
| `profile` | 2 | — | |
| `bodyMetrics` | 2 | `byDate` | weight + measurements |
| `workouts` | 3 | `byDate` | |
| `exercises` | 3 | — | custom exercises (built-in DB ships as static data) |
| `foods` | 5 | — | custom foods |
| `foodLogs` | 5 | `byDate` | |
| `recoveryLogs` | 7 | `byDate` | sleep, fatigue, subjective recovery |
| `schedules` | 7 | — | |
| `meta` | — | — | schema version bookkeeping |

Every store also has a `byUpdatedAt` index for incremental sync.

## Migration rules

1. DB version = `MIGRATIONS.length` in `services/storage/db.js`.
2. **Append only.** Never edit or delete a shipped migration.
3. Never delete a store or field that holds user data. Transform data in place.
4. New fields must be optional, or a migration must backfill them.
5. Add a test with a v(n-1) fixture for any migration that transforms data.

## Conflict resolution (`services/sync/merge.js`)

For each `id`: the later `updatedAt` wins. If that ties, the higher `rev` wins.
If both tie, the local copy is kept. An older record can never overwrite a newer one.
Backup import uses this same function, and cloud sync will too.

## Backup format

```json
{ "format": "hercules-backup", "schemaVersion": 1, "exportedAt": "…", "stores": { "hydrationLogs": [ … ] } }
```

Imports validate each record. Invalid records are skipped and counted. Backups
from a newer schema are refused.
