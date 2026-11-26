# HERCULES

*Understand your body. Measure your progress. Build your potential.*

A personal fitness and physical-performance operating system, built as an
iPhone-first Progressive Web App with an architecture ready for a future
native SwiftUI layer.

**Status: v0.4.0 — Phases 1–4 complete + Kratos coach + push reminders.**

## Run it

No build step. Plain ES modules.

```bash
npm start          # serves on http://localhost:5173 (or use VS Code "Live Server")
npm test           # 36 unit tests, Node 20+
npm run vendor     # copy Three.js into src/vendor (after npm i)
npm run build:anatomy  # regenerate assets/models/muscles.glb
```

On iPhone: open the hosted URL in Safari → Share → **Add to Home Screen**.
It then runs full-screen and works offline.

### Deploy to GitHub Pages
Push to GitHub → Settings → Pages → Source: `main` / root. Hash routing
(`#/home`) means no server rewrites are needed.

## What's in v0.4

| Area | Delivered |
|---|---|
| Navigation | Home · Train · Kratos · Nutrition · Progress (body/anatomy lives in Progress) |
| iOS feel | Floating glass tab bar with spring indicator, Dynamic Island live activities (rest timer, workout, confirmations), collapsing large titles, card-presentation sheets with drag-to-dismiss, view transitions, haptics (iOS 18 switch trick), no long-press link previews |
| Kratos | On-device coach: understands schedules in plain English, builds a weekly plan (days, times, splits, exercises for your gear), meal timing, motivation, lagging-area analysis, calendar export |
| Training (Phase 3) | 61-exercise database, workout logger with previous-set column, rest timer, PRs, templates, history, Epley e1RM trend |
| Anatomy (Phase 4) | Three.js GLB muscle model (24 muscles, 46 meshes), tap-to-select, front/back, labels, heat map: Recent · Volume · Exercises · Frequency × Today/7/30/90/All |
| Body (Phase 2) | Profile, desired build, focus areas, environment + gear checklist, weight & measurement logging with trends |
| Water | US units (oz + cups) by default |
| Notifications | Web Push via Supabase edge function + pg_cron (works with the app closed once added to the Home Screen, iOS 16.4+), in-app reminders, .ics calendar fallback |

The 3D figure is a simplified procedural model; any GLB with meshes named
`muscle__<id>__<side>` can replace it without code changes.

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
