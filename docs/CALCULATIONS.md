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
| H5 | Probable double log | Same amount (±5 %) tapped within 3 min, or any amount within 45 s, asks “Already logged this?” before adding. Drinks logged at an earlier time skip the check. Every entry keeps its time | Recorded | No prompt when nothing recent | `v10 H5` |

The goal is a **user-chosen target**. Hercules does not calculate a
"required" water intake, because needs vary with body size, climate and activity.

## Unit constants (`utils/units.js`)

| Constant | Value | Source |
|---|---|---|
| ml per US fl oz | 29.5735295625 (exact) | NIST Handbook 44, Appendix C |
| kg per lb | 0.45359237 (exact) | International Yard and Pound Agreement (1959) |
| cm per inch | 2.54 (exact) | International Yard and Pound Agreement (1959) |

## Training (`engines/training/metrics.js`)

| ID | Statistic | Definition / formula | Provenance |
|---|---|---|---|
| T1 | Set volume load | weight × reps (0 if either missing) | Recorded |
| T2 | Workout volume | Σ T1 over **completed** sets | Recorded |
| T3 | Fractional sets per muscle | each completed set credits primary muscles 1.0, secondary 0.5 | Estimate |
| T4 | Training days | distinct dates with ≥1 completed workout | Recorded |
| T5 | Estimated 1RM | Epley (1985): w × (1 + reps/30); reps=1 → w; only 1–12 reps | Estimate |
| T6 | Exercise history | per completed workout: sets, best e1RM, top weight, volume | Recorded |
| T7 | Personal records | heaviest set, most reps, longest hold, best volume; best e1RM (Estimate) | Recorded / Estimate |
| T8 | e1RM trend | best e1RM latest − first session (≥2 points) | Estimate |

Volume load is a workload measure — never labelled as muscle growth.

## Anatomy heat map (`engines/anatomy/workload.js`) — all Estimates

| ID | Mode | Definition |
|---|---|---|
| A1 | Recent | T3 weighted by recency: × 0.5^(days ago / 3.5) |
| A2 | Volume | T1 × contribution (1 / 0.5), summed over range |
| A3 | Exercises | distinct exercises performed × contribution |
| A4 | Frequency | days a muscle was trained (contribution ≥ 0.5) ÷ weeks in range |

Colors are normalized to the most-worked muscle in view. Never presented as measured activation or growth.

## Kratos planner (`engines/coach/planner.js`)

| ID | Rule |
|---|---|
| K1 | Free windows = [wake + 30 min, bed − 90 min] minus commitments padded by 30 min; explicit free blocks restrict a day |
| K2 | Slot = start closest to preference target (morning earliest, midday 12:00, evening 18:00, any 17:30), snapped to 15 min |
| K3 | Days = best-scoring combination; consecutive days −0.6, three in a row −1.5 |
| K4 | Splits: 1–3 Full Body · 4 Upper/Lower · 5 U/L/Push/Pull/Legs · 6 PPL×2; ≥1 rest day; beginners ≤ 4 days; exercises filtered by owned gear |
| K5 | Meal ~2 h before (snack 30–60 min before if earlier than wake + 30), protein meal within ~2 h after; nutrition start = next Monday |

Users under ~19 (by birth year) never receive restrictive nutrition advice. Kratos gives no calorie numbers until Phase 5 targets exist.

## Phone alarms (`engines/coach/alarms.js`)
| K6 | Per day: wake time; pre-workout meal/snack time from K5; a heads-up `lead` minutes (your workout reminder setting, default 30) before each session. Delivered to the Clock app through the user’s “Hercules Alarms” shortcut (Create Alarm) |

| K7 | Diet-only plan: no sessions; breakfast 30 min after waking, dinner ≥ 3 h before bed (at most 11 h after breakfast), lunch midway (rounded to 15 min). Meal times feed alarms and calendar |
| K8 | You can move or skip sessions. Moving onto a day that has a session swaps them; duration is kept; meal timing (K5) is recomputed. “This week” changes keep a backup that is restored after Sunday; “every week” changes are pins (focus + the day Cratos originally planned) re-applied after every re-plan. Overlaps with commitments are warned, never blocked |
| K9 | Exercise selection: each session focus is an ordered list of slots (squat, hinge, horizontal/vertical push and pull, lunge, isolation groups, core, power, finisher), each a filter over the full library limited to the user's gear. Candidates are scored on staple status, how well the equipment suits the style, difficulty vs experience, a specialty-gear penalty, and −4 if already used that week. A deterministic jitter rotates accessories weekly and main lifts every 4 weeks. Focus areas add a slot; Athletic adds power first and a finisher, Lean adds a finisher; Strength trims accessories. The slot count comes from session length. Rep and rest schemes are a convention (STYLE_SCHEMES), not a guaranteed outcome |

## Schedule parser rules (`engines/coach/parser.js`)
Bare times in a range: start 7–11 → AM, 12 → noon, 1–4 → PM, 5–6 → AM; the end is the first matching clock time after the start. Every assumption is echoed back to the user.

## Nutrition (`engines/nutrition/nutrition.js`)
Food values come from USDA FoodData Central SR Legacy (per 100 g, public domain, labelled *Verified*), Open Food Facts (labelled *Community*) or the user (*Your entry*). Nothing is invented.

| ID | Rule |
|---|---|
| N1 | servings = (portion grams × quantity) ÷ basis grams; without gram weights, servings = quantity |
| N2 | entry nutrients = basis nutrients × servings; day totals sum non-deleted entries |
| N3 | macro % of energy uses 4 / 4 / 9 kcal per g (protein / carbs / fat) |
| N4 | Mifflin-St Jeor BMR = 10·kg + 6.25·cm − 5·age + 5 (male) / −161 (female) / −78 (unspecified, midpoint) |
| N5 | TDEE = BMR × activity (1.2 / 1.375 / 1.55 / 1.725 / 1.9). Goal: muscle +10 %, performance +5 %, fat loss −15 %, else 0; never below BMR. Under 19: fat loss treated as maintain and never below TDEE. Protein g/kg: muscle 1.8, fat loss 2.0, performance 1.6, else 1.4. Fat 27.5 % of kcal, carbs = remainder, fiber 14 g / 1,000 kcal. Labelled *Estimate* (±10 % or more) |
| N6 | Daily summaries flag unlogged days instead of counting them as zero |
| N7 | Averages divide by logged days only |
| N8 | Adherence: calorie day = within ±10 % of target; protein day = ≥ target |

| N9 | Water target = max(1.5 L, 35 mL × kg) + 500 mL on planned training days, rounded to 50 mL (imperial: nearest 4 oz). A user-set goal overrides it. Estimate |
| N10 | Spoken/typed meals are split on commas, “and”, “with”, “plus”; each item → quantity (digits, fractions, words like “two”, “half”), unit (cup, tbsp, oz, g, slice, scoop…), size (small–jumbo) and food words |
| N12 | Food suggestions: groups ranked by need. Before training (≤ 2 h) quick low-fat carbs ≈ 0.5 g/kg (20–60 g); after training protein + carbs; foods you log 2+ times that fit the biggest gap; protein to close the gap at ≈ 0.4 g/kg per sitting (20–50 g); easy calories on a bulk (≥ 400 kcal left); fiber when ≥ 8 g short; quick-energy sugar foods when there’s room; light options only once targets are met. Nutrition facts are USDA SR Legacy (PB&J summed from USDA bread, peanut butter and jelly). Conventions, not guarantees |
| N11 | Portions: mass units convert exactly; household units use that food’s USDA measure; size words pick that measure; otherwise one typical unit (medium → large → piece → serving). Eggs default to large. Unmatched portions are marked *est.* |
| N12 | Suggestions: foods you already log (plus a few lean staples), ranked by protein per kcal when > 10 g protein remains, sized to your usual portion but never above 90 % of the calories left |

Manual targets (Nutrition → Targets → Manual) override N5 entirely. Food items said without a number use your last portion of that food (“your usual”).

## Sleep (`engines/recovery/sleep.js`)
| ID | Rule |
|---|---|
| S1 | Best evidence first. **Apple Health** (iPhone Sleep Schedule time in bed, or Apple Watch sleep) via the “Hercules Sleep” shortcut: first non-awake sample start → last sample end. Otherwise an **estimate**: asleep = later of scheduled bedtime and your last use of Hercules last night, plus 15 min sleep-onset latency (typical 10–20 min); woke = scheduled wake time, or your first open this morning if earlier. Times you set yourself always win and are never overwritten by an import. App-use moments stay on the phone (3 days) |

## Comparisons & recovery (`engines/analytics/compare.js`)
| ID | Rule |
|---|---|
| P1 | change(cur, prev) = {delta, pct}; pct is null when prev is 0 or missing |
| P2 | Week vs last week: sessions, completed sets, volume (kg × reps), average logged kcal and protein |
| P3 | A metric with no data in either week shows "—", never 0 % |
| R1 | Readiness 0–100 = mean of available normalized inputs (sleep hours vs 8 h, quality, energy, inverted soreness and stress); needs ≥ 2 inputs, else no score |

## Rules for future phases

- Energy expenditure (Phase 5) uses a published equation (Mifflin-St Jeor is the
  default candidate), cites it, labels results *Estimate* and states its error range.
  For users still growing, targets avoid aggressive deficits or surpluses.
