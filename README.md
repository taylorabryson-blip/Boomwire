# HERCULES

*Understand your body. Measure your progress. Build your potential.*

A personal fitness and physical-performance operating system, built as an
iPhone-first Progressive Web App with an architecture ready for a future
native SwiftUI layer.

**Status: v0.1.0 — Phase 1 (Foundation) complete.**

## Run it

No build step. Plain ES modules.

```bash
npm start          # serves on http://localhost:5173 (or use VS Code "Live Server")
npm test           # 13 unit tests, Node 20+, zero dependencies
```

On iPhone: open the hosted URL in Safari → Share → **Add to Home Screen**.
It then runs full-screen and works offline.

### Deploy to GitHub Pages
Push to GitHub → Settings → Pages → Source: `main` / root. Hash routing
(`#/home`) means no server rewrites are needed.

## What Phase 1 delivers

| Area | Delivered |
|---|---|
| Design system | Tokens (color, type scale, 4-pt spacing, radius, motion), base + component CSS |
| Components | Header, Section, Card, List/ListRow, Button, Chips, SegmentedControl, Stat, Provenance badge, ProgressRing/Bar, EmptyState, BottomSheet, Toast, BarChart, icon set |
| Navigation | 5-tab bar (Home, Training, Body, Nutrition, Analytics) + Settings off Home, hash router with lazy-loaded screens |
| Storage | IndexedDB with additive-only versioned migrations; all 10 roadmap stores created up front |
| Data integrity | Schema validation on every write, soft-delete tombstones, `updatedAt`/`rev` envelopes, deterministic merge (newer always wins) |
| Backup | JSON export (share sheet on iOS) and merge-import that never deletes local data |
| PWA | Manifest, icons, offline service worker, safe-area insets, persistent-storage request |
| Working feature | Hydration logging end-to-end (log, undo, delete, goal, 7/30-day analytics) proving every layer works |

Unbuilt modules show their planned contents and phase. They do not show
fake numbers.

## Layout

```
index.html  manifest.webmanifest  sw.js
src/
  app/            bootstrap, version
  design-system/  tokens.css, base.css, components.css
  components/     dom builder, icons, primitives, overlays, charts
  navigation/     routes, router, tab bar
  engines/        calculations/ (pure, tested) + per-domain engines (later phases)
  data/           models.js (schemas + validation); exercises/ foods/ anatomy/ (later)
  services/       storage/ (db, repository, backup), sync/ (merge), pwa/, notifications/
  screens/        home, training, body, nutrition, analytics, settings, shared
  utils/          dates, units, id
tests/            node:test unit tests
docs/             ARCHITECTURE.md, DATA_MODEL.md, CALCULATIONS.md
marketing/        screenshots captured at iPhone resolution (1179×2556)
```

See `docs/` for the rules every later phase must follow.
