# Contributing to PhraseLoop

PhraseLoop is a local-first English practice app for Brazilian A2-B1 self-learners. The core loop is: hear real or bundled English, save one useful phrase, produce English without help, get feedback, retry, and review later.

## Good First Contributions

Good first issues are usually small, testable, and do not require native audio setup:

- Improve copy in `README.md`, `docs/`, or empty-state UI.
- Add or fix tests around `src/features/activation`, `src/features/progress`, `src/features/study`, or `src/lib/cards`.
- Add authored lesson metadata in `src/features/learn/lessons.json` when the audio already exists.
- Improve deterministic local checks where the app works without a cloud provider.

Avoid starting with native binary packaging, provider-wide rewrites, local data migrations, or broad UI reorganizations unless an issue explicitly asks for that.

## Local Setup

Install dependencies:

```bash
npm install
```

Run the web app during development:

```bash
npm run dev
```

Run the Electron app:

```bash
./scripts/start.sh
```

Apple Silicon macOS 14+ is the best-tested desktop setup. YouTube import also needs `yt-dlp` on PATH. The first lesson, local review, and deterministic correction checks work without an AI provider.

## Checks

Before opening a PR, run the smallest relevant checks first:

```bash
npm test
npm run lint
npm run build
```

For lesson-content changes, also run:

```bash
npm run learn:content:validate
npm run learn:audio:verify
```

## Product Guardrails

- Keep the first experience centered on the source-to-drill loop.
- Do not add XP, coins, badges, loss-framed streaks, or notification pressure without a written learning hypothesis.
- Treat activity metrics as secondary. Prefer retention, transfer, retry resolution, and unaided production.
- Cloud AI must remain opt-in. The local/no-AI path should keep a useful first loop.
- Conversation practice should close into feedback, retry, and review before becoming a primary surface.

## Pull Requests

Keep PRs narrow and describe:

- The user-facing change.
- The validation or test evidence.
- Any native binary, model, provider, privacy, or content-license impact.

If your change adds external content, include provenance and license information. Do not add copyrighted audio, transcripts, model weights, or datasets unless the license explicitly permits redistribution in this project.
