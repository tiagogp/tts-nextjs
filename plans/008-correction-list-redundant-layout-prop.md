# 008 — Remove the redundant FLIP `layout` prop from CorrectionList's list items

- **Status**: TODO
- **Commit**: 9532b571
- **Severity**: HIGH
- **Category**: Performance
- **Rule**: `react-doctor/no-layout-property-animation`
- **Estimated scope**: 1 file, trivial

## Problem

The canonical fix recipe for this rule
(`https://www.react.doctor/prompts/rules/react-doctor/no-layout-property-animation.md`)
lists three fix strategies by animation type. For "Expand/collapse with
unknown target size" (category C — exactly this case, a list item growing in
and shrinking out), it says:

> Use framer-motion's `layout` prop for FLIP optimization **Or** render
> through `<AnimatePresence>` with `height: auto` ... Do NOT mechanically
> swap every width/height for scale — scaling an "auto"-sized reveal squashes
> its children and breaks text reflow.

The key word is **"Or"** — pick one strategy, not both. `CorrectionList.tsx`'s
list item currently does both at once:

    // src/features/correct/components/CorrectionList.tsx:118-152 — current
    <ul className="max-h-[28rem] overflow-y-auto">
      <AnimatePresence initial={false}>
        {events.map((event) => (
          <motion.li
            key={event.id}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transition: springSoft }}
            exit={{ opacity: 0, height: 0, transition: tweenSmooth }}
            className="flex items-start gap-3 overflow-hidden border-b border-line px-5 py-3 transition-colors hover:bg-accent/3"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm leading-relaxed text-ink-muted line-through">{event.original}</p>
              <p className="text-sm font-medium leading-relaxed text-ink">{event.corrected}</p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {event.errorTypes.map((type) => (
                  <span key={type} className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-muted">
                    {t(errorTypeLabel(type))}
                  </span>
                ))}
                {event.rationale && <span className="text-xs text-ink-muted">{event.rationale}</span>}
              </div>
            </div>
            <Chip
              className="mt-0.5 shrink-0"
              disabled={generating}
              aria-label={t("Remove correction")}
              onClick={() => onRemove(event.id)}
            >
              {t("Remove")}
            </Chip>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>

The `layout` prop makes Framer Motion perform its own FLIP measurement
(measure position/size before and after every render, then animate the
delta) on top of the *already-present* `height: 0` → `"auto"` keyframe
animation. But these list items are plain block-level `<li>`s stacked
vertically with no absolute positioning and no reordering — when one item's
height animates to 0 on exit (or grows from 0 on enter), the browser's normal
document flow *already* reflows the siblings below it smoothly, frame by
frame, exactly in sync with the height keyframes. `layout` adds a second,
redundant measurement-and-transform pass on the same elements for zero
additional visual benefit, compounding the per-frame layout cost on the
Correct tab's hottest per-row interaction (adding/removing corrections).

**Honesty note on the mechanical check**: because "AnimatePresence with
`height: auto`" is itself an explicitly sanctioned strategy for this category
per the canonical recipe (not just a stopgap), removing `layout` fixes the
real, confirmed performance cost (the redundant FLIP pass) but the static
`no-layout-property-animation` diagnostic on the `height` keyframes
themselves may still fire after this fix — the tool can't distinguish a
sanctioned unknown-size reveal from a naive one. Don't expect
`--scope changed` to fully clear this rule on this file; expect it to stop
flagging the redundant `layout` combination specifically if the tool
attributes severity to that pairing, and don't manufacture a false "cleared"
claim if it doesn't.

## Target

Remove `layout` only. Every keyframe, transition, and the `AnimatePresence`
wrapper stay exactly as they are — this preserves the current enter/exit
visual exactly (block-flow reflow already handles sibling repositioning).

    // src/features/correct/components/CorrectionList.tsx — target (only the `layout` line removed)
    <motion.li
      key={event.id}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto", transition: springSoft }}
      exit={{ opacity: 0, height: 0, transition: tweenSmooth }}
      className="flex items-start gap-3 overflow-hidden border-b border-line px-5 py-3 transition-colors hover:bg-accent/3"
    >

## Repo conventions to follow

- This is a single-line removal — no new pattern to introduce. Keep every
  other prop, indentation, and the surrounding `AnimatePresence`/`ul`
  structure untouched.

## Steps

1. In `src/features/correct/components/CorrectionList.tsx`, remove the
   `layout` line (currently line 123, immediately after `key={event.id}`)
   from the `<motion.li>` at lines 121-127. Nothing else in the file changes.
2. Re-read the diff and confirm it is exactly a one-line deletion.

## Boundaries

- Do NOT touch the "generating" banner (`motion.div` at lines 76-95) — it
  also animates `height` but was not part of the selected finding for this
  plan; it's a separate, one-off reveal, not the list-item enter/exit
  pattern this plan targets.
- Do NOT change any keyframe value, transition token, or the `AnimatePresence`
  wrapper.
- Do NOT add `layoutId`, a measured-height wrapper, or a CSS grid-rows
  rewrite here — this file's fix is scoped to removing the redundant prop,
  not restructuring the animation approach (that pattern is applied
  separately to `Disclosure.tsx` in a different plan, where it's a simple
  boolean toggle rather than a list add/remove).
- STOP if the `motion.li` no longer matches the Problem excerpt (drifted
  since commit `9532b571`) — report the drift instead of guessing.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` does not introduce new
    diagnostics and the score does not regress. Per the Problem section's
    honesty note, do not expect the `no-layout-property-animation` diagnostic
    on this file to necessarily clear — report what actually happens rather
    than assuming.
  - `yarn tsc --noEmit`, `yarn lint`, and `yarn test` all pass.
- **Behavior check**: In the Correct tab, add several corrections (via manual
  entry or JSON import) so the list has 3+ items, then remove one from the
  middle. Confirm the remaining items still smoothly close the gap exactly
  as before (this should be visually identical, since block-flow reflow was
  already doing this work). Using React DevTools Profiler with "Highlight
  updates" on, add/remove an item before and after the change and confirm
  the FLIP-measurement work Framer Motion does per commit is reduced (fewer
  layout reads attributed to this component in the Profiler's flame graph),
  while the visual grow/shrink timing is unchanged.
- **Done when**: the list's enter/exit visual is pixel-identical to before,
  the Profiler shows less layout-measurement work per add/remove, and
  required checks pass.
