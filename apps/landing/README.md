# PhraseLoop landing — W5 demand test

PT-BR landing page with the qualified waitlist for the Phase 2 demand test in
[docs/validation-action-plan.md](../../docs/validation-action-plan.md). It reuses the
desktop app's UI (repo-root `src/*` via the `@/*` alias, see `next.config.ts`), so it must
be built from inside the monorepo — it is not a standalone app.

PT-BR is the default because W5 targets Brazilian learners. The header PT/EN selector
switches the full landing page and embedded app preview, updates document language/metadata,
and persists the choice in `localStorage` without changing the learner's CEFR profile.

## Local development

```sh
yarn landing:dev     # from the repo root
yarn landing:build   # production build check
./node_modules/.bin/vitest run apps/landing/src/app/api/waitlist/route.test.ts
```

## Waitlist storage

`POST /api/waitlist` validates the entry (email format, platform enum, workflow answer
≥ 8 chars — all three questions are required in the form and re-checked server-side) and
forwards it as JSON to `PHRASELOOP_WAITLIST_WEBHOOK_URL`:

```json
{
  "email": "learner@example.com",
  "platform": "Mac Apple Silicon",
  "workflow": "Copio frases de séries para o Anki…",
  "source": "landing-w5",
  "createdAt": "2026-07-10T12:00:00.000Z"
}
```

Any webhook that appends to a spreadsheet works (Google Apps Script doPost → Sheet, Make,
Zapier). Without the env var, entries are only logged server-side — **do not run the demand
test without the webhook set**, or signups are lost when the deployment recycles.

The platform question feeds the W5 decision gate: export the collected entries as a JSON
array and pass it to `yarn w5:score … --waitlist export.json`.

## Deploying to Vercel

`vercel.json` here pins the framework, skips the Electron binary download during the
monorepo install, and pins the waitlist function to `gru1` (São Paulo — the audience is
Brazilian). One-time project setup:

1. Import the repo on vercel.com (or `npx vercel link` from the repo root).
2. Set **Root Directory** to `apps/landing`.
3. Ensure **"Include source files outside of the Root Directory"** is enabled
   (Settings → Build & Deployment) — the build imports repo-root `src/*`.
4. Add the env var `PHRASELOOP_WAITLIST_WEBHOOK_URL` (Production).
5. Deploy: push the branch, or `npx vercel --prod`.

## Post-deploy verification (before posting to any community)

- [ ] Page loads and shows the one-line pitch before any interaction.
- [ ] PT/EN changes the page and embedded preview; reloading preserves the choice.
- [ ] Submitting with either qualifying question empty is blocked.
- [ ] A valid submit returns success and the entry arrives at the webhook.
- [ ] A bad platform value POSTed directly to `/api/waitlist` returns 400.
- [ ] The submitted webhook row contains `email`, `platform`, `workflow`, `source`, and
      `createdAt`.

Known gap (tracked in the action plan): the 60–90s **real-loop screen recording** is not on
the page yet — it is blocked by the Phase 1 native-clips honesty gate. The interactive
simulation currently in its place does not satisfy that checklist item.

The public CTAs deliberately lead to the waitlist, not `/api/download/macos`, until the
Phase 1 build is signed and notarized. Do not restore a public download CTA to an ad-hoc
signed build: Gatekeeper friction would contaminate the W5 activation timer.
