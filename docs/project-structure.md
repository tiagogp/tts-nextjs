# PhraseLoop Project Structure

This document is the practical map for where code should live. It keeps the
repo organized without forcing a risky rewrite while the W5 validation work is
active.

## Current App Boundaries

```text
.
├── apps/
│   └── landing/              # Vercel marketing/waitlist app only
├── electron/                 # Electron shell and desktop packaging
├── src/                      # Desktop Next app, API routes, product code
├── native-audio/             # Source recordings for bundled native clips
├── public/                   # Generated/static assets served by the desktop app
├── scripts/                  # Build, launch, validation, and asset-generation scripts
├── docs/                     # Product, architecture, validation, and planning docs
└── assets/                   # Imported source decks/data fixtures
```

The root app is the local-first desktop product. `apps/landing` is the only app
that should be deployed to Vercel for the public landing page.

## Runtime Shape

```text
Electron
  -> standalone Next server
    -> src/app/api/* route handlers
      -> src/server/* Node/native services
        -> Kokoro, Whisper, yt-dlp, APKG, local files

Browser UI
  -> src/features/*
    -> src/lib/* domain helpers
      -> IndexedDB local-first store
```

There is no Nest service in the repo today. Do not add one until there is a
clear hosted-backend need that Next API routes cannot handle cleanly.

## Source Directory Rules

```text
src/app/
  Next.js routes only. Keep pages and route handlers thin.

src/app/api/
  HTTP boundary for the desktop app. Validate requests, call server/domain code,
  return stable responses. Do not place product workflows here.

src/components/app/
  App shell, navigation, providers, and cross-feature app chrome.

src/components/ui/
  Small reusable UI primitives with no product-specific behavior.

src/features/
  User-facing product areas. Feature components, hooks, constants, and
  feature-specific API clients live here.

src/lib/
  Pure or mostly-pure shared domain logic: cards, SRS, store, i18n helpers,
  filenames, logging, and small utilities.

src/server/
  Server-only code used by API routes: native models, discovery, audio,
  provider runtime, APKG generation, and integrations.

src/platform/
  Platform bridges and typed wrappers, currently Electron preload access.

src/types/
  Shared TypeScript types that do not belong to one feature.
```

## Feature Modules

```text
src/features/activation/     W5 and first-run instrumentation
src/features/home/           Today surface and guided entry points
src/features/learn/          Bundled lessons and first-run loop
src/features/discover/       Source import and phrase capture
src/features/study/          Review, SRS session UI, weakness review
src/features/correct/        Own mistakes to correction cards
src/features/settings/       Profile, providers, backup, validation card
src/features/cards/          Shared card generation/export UI hooks
src/features/progress/       Progress summaries and assessment model
src/features/pronunciation/  Pronunciation assessment surfaces
```

Advanced surfaces are present but should stay secondary during W5:

```text
src/features/speech/         Advanced TTS/export tools
src/features/converse/       Conversation practice
src/features/plan/           90-day plan
```

Before editing frozen advanced surfaces, check `AGENTS.md` and
`docs/validation-action-plan.md`.

## Landing App

```text
apps/landing/
├── src/app/page.tsx
├── src/app/landing/*         # Landing page experience
├── src/app/api/waitlist/     # Qualified waitlist endpoint
├── src/app/api/download/     # Download redirect or local artifact fallback
├── vercel.json               # Vercel deploy config
└── README.md                 # Deployment runbook
```

Rules:

- Deploy from `apps/landing`, not the repo root.
- Keep Electron and native runtime dependencies out of the landing app.
- It may reuse root UI through the `@/*` alias, but avoid importing desktop-only
  server/native modules.
- Demand-test copy should match the target audience and validation protocol.

## Desktop App

```text
src/app/page.tsx              Redirects to /app
src/app/app/page.tsx          Renders the desktop client shell
src/components/app/HomeClient.tsx
electron/main.js              Starts the local Next server and BrowserWindow
electron/build-app.sh         Builds standalone Next + Electron package
```

Rules:

- Root Next build is for the desktop app, not public hosting.
- API routes may rely on local native addons and filesystem access.
- Keep the visible app focused on `Home -> Learn -> Discover -> Study -> Correct`
  until W5 decides the next product direction.

## Where New Work Goes

| Work type | Put it here |
| --- | --- |
| New landing copy/sections | `apps/landing/src/app/landing/` |
| Waitlist changes | `apps/landing/src/app/api/waitlist/route.ts` |
| Desktop page/shell routing | `src/app/`, `src/components/app/` |
| Feature UI | `src/features/<feature>/components/` |
| Feature hooks | `src/features/<feature>/hooks/` |
| Feature-specific client API wrapper | `src/features/<feature>/api.ts` |
| Shared UI primitive | `src/components/ui/` |
| Card/SRS/store domain logic | `src/lib/cards/`, `src/lib/srs/`, `src/lib/store/` |
| Server-only native work | `src/server/native/` |
| API request validation/failure helpers | `src/server/http/` |
| Product decisions | `docs/product.md` |
| Validation execution | `docs/validation-action-plan.md`, `docs/w5-*` |

## Organization Priorities

1. Keep the landing deployable from `apps/landing`.
2. Keep the desktop app local-first and packaged through Electron.
3. Keep `src/app/api/*` thin; move behavior into `src/server`, `src/lib`, or
   `src/features`.
4. Avoid new top-level apps or services until validation creates a real need.
5. Prefer small module cleanups over large file moves while W5 is active.
