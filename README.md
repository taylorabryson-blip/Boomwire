# HERCULES

*Understand your body. Measure your progress. Build your potential.*

A personal fitness and physical-performance operating system, built as an
iPhone-first Progressive Web App with an architecture ready for a future
native SwiftUI layer.

**Status: v0.5.0 — Phases 1–4 complete + Kratos coach + push reminders.**

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

## What's in v0.7

| Area | Delivered |
|---|---|
| Navigation | Home · Train · Cratos · Nutrition · Progress. Every screen fits one iPhone screen (Library and chat excepted) |
| iOS feel | Floating glass tab bar, iOS notification banners (swipe up to dismiss), "now playing"-style bar for live workouts/rest timers, collapsing large titles, card sheets with drag-to-dismiss, edge-swipe back, Liquid Glass touches, haptics. Material 3 on Android |
| Cratos (coach) | Button-first dashboard + 9-step setup (schedule, goal, body stats → plan and targets). Voice: talk to him (Web Speech / keyboard dictation), he answers aloud in a deep, male or female voice |
| Nutrition | 7,283 USDA foods + Open Food Facts brands/barcodes. Say what you ate (“2 eggs and a banana”) → logged in one tap. Same-as-yesterday, your usuals, “fill your macros” suggestions. Auto calorie, protein and water targets from your body |
| Training | 110 exercises, 187 pieces of equipment in 12 categories (incl. Tonal/Bowflex-style equivalents), custom equipment, logger, PRs, templates |
| Anatomy | Real human anatomy (BodyParts3D) with workload heat map |
| Phone integration | Web Push reminders (app closed), real Clock alarms via the “Hercules Alarms” shortcut, Home + Lock Screen widgets via Scriptable (snapshot relay: `supabase/functions/hercules-widget`), .ics calendar export |

The 3D body is a real human anatomy model built from BodyParts3D scan data
(437 muscles + 251 bones, CC BY-SA 2.1 JP — see `assets/models/ATTRIBUTION.md`),
rebuilt with `npm run build:anatomy`.

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
