# 010 — Add a focus trap and focus-return to the shared Modal

- **Status**: TODO
- **Commit**: 9532b571
- **Severity**: HIGH
- **Category**: Accessibility
- **Rule**: Beyond the scan
- **Estimated scope**: 1 file, small

## Problem

`Modal` focuses its panel on open and closes on Escape, but has no Tab focus
trap and never returns focus to the element that opened it:

    // src/components/ui/Modal.tsx:1-45 — current (imports + component body up to the effects)
    "use client";

    import { useEffect, useRef, type ReactNode } from "react";
    import { AnimatePresence, m } from "motion/react";
    import { cn } from "@/lib/cn";
    import { springSoft, tweenSmooth } from "@/lib/motion";

    interface ModalProps {
      open: boolean;
      onClose?: () => void;
      children: ReactNode;
      className?: string;
      labelledBy?: string;
      describedBy?: string;
      closeOnBackdrop?: boolean;
    }

    export function Modal({
      open,
      onClose,
      children,
      className,
      labelledBy,
      describedBy,
      closeOnBackdrop = true,
    }: ModalProps) {
      const panelRef = useRef<HTMLDivElement>(null);
      const onCloseRef = useRef(onClose);

      useEffect(() => {
        onCloseRef.current = onClose;
      }, [onClose]);

      useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
          if (event.key === "Escape") onCloseRef.current?.();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
      }, [open]);

      useEffect(() => {
        if (open) panelRef.current?.focus();
      }, [open]);

Two gaps:
1. **No focus trap**: pressing Tab (or Shift+Tab) while the modal is open can
   move focus onto background content behind the backdrop, since nothing
   intercepts Tab to cycle it within the panel.
2. **No focus-return**: when the modal closes, focus is simply left wherever
   it was inside the (now-hidden) panel — the element that originally opened
   the modal never gets focus back, so a keyboard/screen-reader user loses
   their place in the page.

This is a shared primitive — `OnboardingDialog.tsx:70` renders every
first-time user through this exact `Modal`, and any other `Modal` consumer
inherits the same gap.

## Target

Extend the panel's own keydown handler (the existing Escape effect) to also
trap Tab within the panel's focusable elements, and extend the existing
open-focus effect to also store the previously-focused element on open and
restore it on close.

    // src/components/ui/Modal.tsx — target (add above the component, module scope)
    const FOCUSABLE_SELECTOR =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // src/components/ui/Modal.tsx — target (inside the component, replacing the two effects below onCloseRef's effect)
      const previouslyFocusedRef = useRef<HTMLElement | null>(null);

      useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            onCloseRef.current?.();
            return;
          }
          if (event.key !== "Tab") return;
          const panel = panelRef.current;
          if (!panel) return;
          const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
          if (focusable.length === 0) {
            event.preventDefault();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
      }, [open]);

      useEffect(() => {
        if (open) {
          previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
          panelRef.current?.focus();
        } else if (previouslyFocusedRef.current) {
          previouslyFocusedRef.current.focus();
          previouslyFocusedRef.current = null;
        }
      }, [open]);

The rest of the file (the `AnimatePresence`/`m.div` render tree) is
unchanged.

## Repo conventions to follow

- `FOCUSABLE_SELECTOR` as a module-scope constant matches this codebase's own
  `prefer-module-scope-static-value` convention (a static value should not be
  rebuilt on every call) — declare it once above the component, not inside
  the effect.
- Keep the existing `onCloseRef` indirection pattern (a ref mirroring the
  latest `onClose` prop, read inside a stable-identity effect) — don't
  refactor it away; the new Tab-handling logic lives in the *same* keydown
  listener as the existing Escape handling, following the file's own
  established shape (one `document`-level `keydown` listener per open modal).

## Steps

1. In `src/components/ui/Modal.tsx`, add the `FOCUSABLE_SELECTOR` constant at
   module scope, above the `Modal` function (after the `ModalProps` interface
   or above the imports' consumers — anywhere at top level before the
   component).
2. Add `const previouslyFocusedRef = useRef<HTMLElement | null>(null);` next
   to the existing `panelRef`/`onCloseRef` declarations.
3. Extend the existing Escape-handling `useEffect` (currently lines 34-41) to
   also handle `Tab`/`Shift+Tab` cycling within the panel's focusable
   elements, exactly as shown in Target — keep the `Escape` branch first,
   unchanged in behavior.
4. Extend the existing open-focus `useEffect` (currently lines 43-45) to
   store `document.activeElement` before focusing the panel on open, and to
   restore it on close, exactly as shown in Target.
5. Re-read the diff and confirm the `AnimatePresence`/`m.div` render tree
   (lines 47 onward) is completely untouched.

## Boundaries

- Do NOT change the `AnimatePresence`/`m.div` animation values, the backdrop
  click-to-close behavior, or the `ModalProps` public API.
- Do NOT add a third-party focus-trap library (`focus-trap-react`, etc.) —
  this codebase has no such dependency and the fix is small enough not to
  need one; adding a dependency is out of scope per the plan template's
  default boundary.
- Do NOT change `OnboardingDialog.tsx` or any other `Modal` consumer — this
  is a fix to the shared primitive only; every consumer inherits it for
  free with no call-site changes needed.
- STOP if the file's current effects no longer match the Problem excerpt
  (drifted since commit `9532b571`) — report the drift instead of guessing.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` does not introduce new
    diagnostics and the score does not regress (this is a beyond-scan a11y
    fix; no existing diagnostic is expected to clear, since the static
    scanner doesn't check runtime focus behavior).
  - `yarn tsc --noEmit`, `yarn lint`, and `yarn test` all pass.
- **Behavior check**: Trigger `OnboardingDialog` (or any other `Modal`
  consumer) with the keyboard only. Confirm: (a) pressing Tab repeatedly
  cycles focus only among the modal's own controls and wraps from the last
  back to the first (and Shift+Tab wraps the other way from the first to the
  last) — it never lands on background content; (b) closing the modal
  (Escape, backdrop click, or a Close button) returns focus to whatever
  element originally opened it, confirmed by observing the visible focus
  ring land back on the trigger control; (c) Escape-to-close still works
  exactly as before.
- **Done when**: Tab is fully trapped inside the open modal, focus returns to
  the trigger element on close, Escape-to-close is unchanged, and required
  checks pass.
