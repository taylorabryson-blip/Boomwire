# Architecture

## Layers (dependencies only point downward)

```
screens/        presentation: compose components, read via repository, subscribe to changes
components/     pure view functions: props → DOM element. Never touch storage.
engines/        pure business logic + calculations. No DOM, no storage. Unit-tested.
services/       storage, sync, backup, notifications, PWA
data/           schemas, validation, static reference data
utils/          dates, units, ids
```

- **Screens never call IndexedDB directly.** All reads and writes go through
  `services/storage/repository.js`, which validates, stamps envelopes and
  emits change events.
- **Engines are pure.** They take records and return numbers, so the same
  functions can later run in a Web Worker, on a server, or be ported to Swift
  and checked against the same test vectors.
- **Reactivity** is deliberately simple. `repository.onChange` fires after
  every write. `screens/shared/live.js` re-runs a screen's `build()` and
  coalesces bursts into one redraw.

## Screen contract

```js
export function mount(root) { /* render into root */ return cleanupFn; }
```

Routes are declared in `navigation/routes.js` and lazy-loaded.

## Design-system rules

- Components reference tokens (`var(--sp-4)`, `var(--c-text-2)`) and never raw values.
- Black background, white primary text, gray secondary text. Data series use a
  monochrome ramp. Blue is only for the keyboard focus ring and red only for
  destructive actions.
- Every displayed statistic carries a **Provenance** badge: Recorded, Measured or Estimate.
  Estimates use a dashed outline.
- Touch targets are at least 44 pt. Layout respects `env(safe-area-inset-*)`.

## Planned integrations

| Phase | Integration | Where it plugs in |
|---|---|---|
| 4 | Three.js + GLB muscular model | `engines/anatomy`, `data/anatomy` (muscle IDs shared with the exercise DB) |
| 5 | USDA FoodData Central | `data/foods` import pipeline, records keep `source` + `verified` |
| 6 | Charting library (only if needed) | wrap behind `components/` so screens don't depend on it |
| 7+ | Supabase auth + sync | `services/sync`. It reuses `merge.js`, so conflict rules are identical to import. Sync stays opt-in. |
| Native | SwiftUI widgets | read the same data model; widgets are **not** possible from the PWA |
