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

## Stores (schema v2)

| Store | Phase | Indexes | Notes |
|---|---|---|---|
| `settings` | 1 | — | `units` ('imperial' default · 'metric'), `hydrationGoalMl`, `reminders` |
| `hydrationLogs` | 1 | `byDate` | `date`, `time`, `amountMl` (1–5000), `provenance` |
| `profile` | 2 | — | name, birthYear, sex, heightCm, experience, goal, style, focusAreas, environment, gear, defaults |
| `bodyMetrics` | 2 | `byDate` | weightKg + chest/waist/arms/thighs/calves/shoulders cm (≥1 required) |
| `workouts` | 3 | `byDate` | name, status (in_progress/completed), startedAt, durationMin, exercises[{exerciseId, restSec, sets[{reps, weightKg, durationSec, completed}]}] |
| `templates` | 3 | — | name, exercises with target sets (v2) |
| `coach` | 4 | — | singletons `availability` (wake/sleep, busy/free blocks, days, length, preference) and `plan` (v2) |
| `coachMessages` | 4 | `byDate` | Kratos chat history (v2) |
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

## Migration v2
Adds `templates`, `coach`, `coachMessages`, and switches the display-unit
preference to US customary (requested). Stored values are untouched.

## Push reminders (server)
Supabase tables `hercules_push_devices` (device id, SHA-256 of device secret,
subscription, timezone, reminder list) and `hercules_push_config` (VAPID keys,
cron secret). RLS on, no policies: only the `hercules-push` edge function
(service role) can read them. `pg_cron` calls the function every minute.
No workout, body or nutrition data is ever sent to the server.
