# Backup/Restore Validation — Moderated Protocol

Phase 4 item (see [validation-action-plan.md](../validation-action-plan.md)): one
participant with **weeks of real history** performs export → wipe → restore, moderated.
The automated round-trip already passes (`src/lib/store/repository.backup.test.ts`); this
session proves it on organically-grown data, on the participant's own machine.

_Done when:_ the round-trip succeeds on real data with **zero loss**.

## Participant

- Has used PhraseLoop for 2+ weeks (cards, reviews, and at least one own-source import).
- Runs the session on their own machine, screen-shared or in person.
- Understands the wipe is real and agrees to it (the restore is the safety net —
  say so plainly, and keep the exported file safe before wiping).

## Session Steps

1. **Record the baseline.** Open Settings → W5 readout and note the on-screen counts.
   Then export: Settings → "Baixar backup". Save the JSON file somewhere outside the app.
2. **Capture ground truth from the backup file.** Open the JSON and record the length of
   every array under `stores` in the capture table below. This is the zero-loss reference.
3. **Copy the backup to a second location** (USB stick or cloud drive) before touching
   anything else.
4. **Wipe.** Settings → "Apagar todos os dados locais" → confirm. The app reloads to
   onboarding. Verify Study is empty and Hoje shows the first-run state.
5. **Restore.** Settings → "Validar restauração" → pick the backup file → confirm the dry
   run counts match step 2 → "Restaurar backup".
6. **Verify zero loss.**
   - Restored-record count in the success notice matches the step 2 total.
   - Study shows the same due count as the baseline (FSRS scheduling is part of the data —
     due dates must survive, not reset).
   - Open 3 specific cards the participant remembers (one from their own import with its
     audio-sliced source, one born from a mistake, one old card) and confirm front/back/
     concept are intact.
   - Weakness list and performance stats render with history, not empty states.
7. **Ask the trust question** (verbatim): "Depois de ver isso, você confiaria seus meses
   de estudo ao PhraseLoop?" Record the answer verbatim.

## Capture Table

| Store | Count in backup (step 2) | Dry run count (step 5) | After restore | Match? |
| --- | --- | --- | --- | --- |
| errorEvents | | | | |
| phraseCandidates | | | | |
| cards | | | | |
| srs | | | | |
| reviews | | | | |
| conversations | | | | |
| activityLog | | | | |
| learningPlan | | | | |
| effortHistory | | | | |
| pronunciationAttempts | | | | |
| progressAssessments | | | | |

| Field | Value |
| --- | --- |
| Date | |
| Participant (initials) | |
| Weeks of history | |
| Due count before / after | |
| 3 spot-check cards intact? | |
| Trust answer (verbatim) | |
| Outcome (zero loss: yes/no) | |

## Known Limits (disclose if asked)

- Restore merges by ID and never deletes — restoring onto a non-empty install keeps
  records created after the backup.
- The imported-audio cache on disk is **not** in the backup; a restored card whose source
  audio was wiped falls back to TTS until the source is re-imported. Note in the capture
  table whether the participant noticed and how they reacted.
- If any count mismatches: stop, keep the backup file, file the bug with the mismatching
  store name. Do not hand-fix the data during the session.
