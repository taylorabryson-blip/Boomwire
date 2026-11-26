# Calculation Register

Every statistic the app shows is listed here with its definition, its formula,
its provenance and the test that covers it. A statistic may not ship without
an entry. Implementations live in `src/engines/calculations/`.

## Hydration (`hydration.js`)

| ID | Statistic | Definition / formula | Provenance | Missing data | Test |
|---|---|---|---|---|---|
| H1 | Daily total | Σ `amountMl` of non-deleted entries whose `date` = day | Recorded | 0 (no entries means nothing recorded) | `hydration H1` |
| H2 | Daily average | Mean of H1 over **logged days only** (≥ 1 entry) in the window | Recorded (derived) | `null` → shown as "—"; unlogged days are excluded, not counted as zero | `hydration H2` |
| H3 | Goal progress | H1 ÷ user goal. Not clamped; the ring caps visually at 100 % | Recorded vs. user target | `null` when no goal is set | `hydration H3/H4` |
| H4 | Days meeting goal | Count of logged days where H1 ≥ goal | Recorded (derived) | `null` without a goal | `hydration H3/H4` |

The goal is a **user-chosen target**. Hercules does not calculate a
"required" water intake, because needs vary with body size, climate and activity.

## Unit constants (`utils/units.js`)

| Constant | Value | Source |
|---|---|---|
| ml per US fl oz | 29.5735295625 (exact) | NIST Handbook 44, Appendix C |
| kg per lb | 0.45359237 (exact) | International Yard and Pound Agreement (1959) |
| cm per inch | 2.54 (exact) | International Yard and Pound Agreement (1959) |

## Rules for future phases

- Training volume (Phase 3) is **load × reps summed over sets**. It is a workload
  measure and must never be labelled as muscle growth.
- Muscle heat maps (Phase 4) show **estimated involvement** from per-exercise
  contribution coefficients. They are labelled *Estimate* and are never shown
  as measured activation.
- Energy expenditure (Phase 5) uses a published equation (Mifflin-St Jeor is the
  default candidate), cites it, labels results *Estimate* and states its error range.
  For users still growing, targets avoid aggressive deficits or surpluses.
