# PhraseLoop — Post-B1/B2 Plateau (C1 Phase Proposal)

> **Status: Concept — Phase 6 ("Tutor Vision Unlock"), gated on a W5 pass.**
> Do not build against this doc until Phase 6 opens in
> [validation-action-plan.md](validation-action-plan.md). Today the W5 Decision Record in
> [product.md](product.md) reads 0/10 rows scored, pending. Nothing here is scheduled.

## Why this doc exists

**One-sentence version:** when a learner outgrows grammar-error correction, diagnose the
naturalness/register/collocation gap with a measurable instrument, then validate a single
write → feedback → speak loop on a single domain — nothing else from the reviewed proposal
ships until that loop earns it.

An external review of a "post-B1/B2 plateau" proposal (Gap Map, Native Content Ladder, C1
Domain Builder, Skill Balance Score, Fluency Progress Graph, a study-ratio rule, and a
writing-first pipeline) surfaced real fixes worth keeping on record. That reviewed document was
never part of this repo — this file is the elaboration of an idea PhraseLoop had already named
twice before the review existed:

- [product.md](product.md) → "Critica De Produto" → "Avancados": _"C1 precisa naturalidade,
  registro, idiomaticidade e colocacao, nao so erro gramatical."_
- [validation-action-plan.md](validation-action-plan.md) Phase 6: _"A1 and C1-C2 band mechanisms
  (graduated input + L1 scaffolding for A1; naturalness/register/collocation feedback for C1)
  before 'A1-C2' appears in any public copy."_

This is that bullet, written out — not a new product, not a decided next phase.

## The problem (grounded, not re-derived)

The only evidence this repo has for a post-B1 gap is the line quoted above: grammar-error
correction stops being the binding constraint at C1; naturalness, register, idiomaticity, and
collocation become the actual gap. That line is an acknowledged critique, not a validated
finding — no learner data backs it yet, and it shouldn't be treated as more certain than that
until Phase 6 sessions say otherwise.

## Diagnosis instrument

The reviewed proposal's biggest flaw was a "gap" with no defined measurement — a dashboard
around a black box. This section exists so that mistake isn't repeated here.

- **Grammar / error-type gaps** — don't build anything new. `computePerformance` in
  [src/lib/srs/analytics.ts](../src/lib/srs/analytics.ts) already groups the review log by error
  type, worst-accuracy-first (`errorTypes`). That's the grammar-gap signal, and it already
  exists today for every learner past a handful of reviews.
- **Register / naturalness / collocation gaps** — the dimension error-type tracking can't see,
  and the one dimension `product.md` specifically names for C1. Proposal: a short LLM-graded
  writing sample, scored against a rubric grown from the existing per-band descriptors in
  `CEFR_LANGUAGE_PROFILE` / `cefrLanguageLine()` in
  [src/lib/cards/shared.ts](../src/lib/cards/shared.ts). Note the seed is already there: `CEFR_LANGUAGE_PROFILE`
  carries a C1 line ("sophisticated, idiomatic, near-native... subtle register shifts"), but it's a
  single sentence — enough to steer generation, not to score a sample. The work is turning that
  sentence into a scorable register/collocation rubric, not inventing a rubric from nothing.
- **Trust rule** — a wrong "Weak" label breaks the core promise on first use. Every gap label
  must show the evidence next to it (the flagged sentence, the specific error) — never a bare
  skill-level tag with no supporting example.

## Study ratio

The 50/50 → 40/60 grammar/content split is a **starting default the app can adjust**, not a
pedagogical rule presented as fact. If it ships, it ships as a heuristic the learner or the data
can override, not as a claim we can't back.

## Content strategy

No curated "Native Content Ladder" library. That's a content-operations business, not a
feature, and nobody has scoped sourcing/leveling/tagging native content across levels and
domains. Instead: **bring-your-own-content + a difficulty-framing layer** on top of the
ingestion PhraseLoop already has — Discover's YouTube/article/PDF pipeline (see
[product.md](product.md) → "Estado Atual"). The ladder becomes a comprehension/difficulty
framing over content the learner already supplies, not a library this team maintains.

## C1 domain scope

Not a five-domain builder (tech/business/medical/academic/interview) at once. **One domain**,
picked by whatever goal the eventual W5-passing cohort actually states it needs (work,
university, immigration) — proven on one domain before any second domain is considered.

## Protected differentiator

The writing→speaking transfer pipeline (read → collect vocab → write → get feedback → speak) is
the one piece of this proposal not already offered by content-immersion tools like LingQ or
Migaku. If this phase opens, that chain — not the content ladder, not the domain builder — is
what gets validated first.

## MVP slice (only this, once Phase 6 opens)

Diagnosis (existing `errorTypes` signal + one short writing-sample check) + one domain +
one write → feedback → speak loop. Nothing else from this doc gets built in a first pass.

## What would prove it (and what would kill it)

The MVP slice needs the same discipline the diagnosis instrument imposes on itself: a signal that
says continue and a signal that says stop, named before the phase opens rather than rationalized
after. Exact thresholds wait for a real Phase 6 cohort — the same reason [product.md](product.md)
refuses to pre-judge W5 — so these are the directions those thresholds point, not numbers to defend
today.

- **Continue signal** — the bar sits on the write → feedback → speak chain, not on the dashboard.
  A learner who writes, gets register/collocation feedback, and re-speaks the corrected version
  comes back to that loop unprompted, and agrees the gap labels point at real weaknesses. Only then
  is a second domain considered.
- **Kill signal** — learners accept the "Weak" labels but never act on them: no write→speak
  follow-through. That is a report, not a habit — the exact failure mode the reviewed proposal's
  dashboard-around-a-black-box would have shipped. Naturalness feedback that doesn't change what the
  learner does next gets cut, not iterated.
- **Trust precondition** — none of these signals are readable if the labels aren't believed. The
  evidence-next-to-every-label rule from the diagnosis instrument is the precondition for measuring
  any of this at all.

## Explicitly deferred / cut

- Curated Native Content Ladder library.
- Multi-domain C1 builder (5+ domains at launch).
- Skill Balance Score and Fluency Progress Graph — motivational visualizations, not load-bearing;
  revisit only after the diagnosis instrument above is trusted.
- Automated enforcement of the study ratio.

## Gate

This file is inert until the W5 Decision Record in [product.md](product.md) shows a pass and
Phase 6 opens in [validation-action-plan.md](validation-action-plan.md). No checklist boxes live
here — when Phase 6 actually opens, todo items get written against the MVP slice above, not
the full list this doc describes.
