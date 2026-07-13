# 002 — Wrap each primary tab in an error boundary

- **Status**: DONE
- **Commit**: 9532b571
- **Severity**: HIGH
- **Category**: Bugs & correctness
- **Rule**: Beyond the scan
- **Estimated scope**: 2 files (1 new, 1 edited), small

## Problem

There is no `error.tsx` under `src/app/` and no `ErrorBoundary`/
`componentDidCatch` anywhere in `src/` (confirmed by repo-wide search). All
four primary tabs (`HojeHome`, `StudyTab`, `DiscoverTab`, `CorrectTab`) are
mounted directly inside `HomeClient.tsx`'s tab-panel loop,
with no boundary isolating any one of them:

    // src/components/app/HomeClient.tsx:272-319 — current
    ) : (
              tabs.map((item) => {
                const active = activeTab === item.id;
                return (
                  <section
                    key={item.id}
                    id={`panel-${item.id}`}
                    hidden={!active}
                    aria-labelledby={`tab-${item.id}`}
                    role="tabpanel"
                    tabIndex={0}
                    className="h-full overflow-y-auto app-scroll-region"
                  >
                    {/* Mount stays alive across tab switches so each tab keeps its
                        state; only the entrance animation replays on activation. */}
                    <motion.div
                      className="max-w-5xl mx-auto px-4 pt-5 pb-14 sm:pt-7 sm:pb-20"
                      initial={false}
                      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: TRAVEL }}
                      transition={springSoft}
                    >
                      <TabContent
                        tab={item.id}
                        onOpenSettings={() => {
                          setSettingsAiIntent(true);
                          setOverlay("settings");
                        }}
                        onOpenDiscover={() => changeTab("discover")}
                        onOpenPractice={() => changeTab("study")}
                        onOpenConversation={
                          advancedSurfacesUnlocked
                            ? () => {
                                setLessonId(null);
                                setOverlay("converse");
                              }
                            : undefined
                        }
                        onOpenCorrect={() => changeTab("correct")}
                        onFirstLesson={startFirstLesson}
                        onOpenLesson={openLesson}
                        discoverPrefill={discoverPrefill}
                        active={active}
                      />
                    </motion.div>
                  </section>
                );
              })
            )}

A render-time throw in any one tab — an unexpected IndexedDB record shape, a
null card, a bad date — takes down the *entire* app shell (header, nav, every
other already-mounted tab) to React's default unstyled crash state, with no
recovery path short of a full page reload. This is on the highest-traffic
surface in the app: every session hits this render tree.

React 19 still requires a class component for `getDerivedStateFromError`/
`componentDidCatch` — there is no hook-based equivalent — so the fix adds one
small, reusable class component and wraps each tab panel's content with it.

## Target

    // src/components/app/TabErrorBoundary.tsx — new file
    "use client";

    import { Component, type ReactNode } from "react";
    import { Button } from "@/components/ui/Button";
    import { Card } from "@/components/ui/Card";
    import { useT } from "@/i18n/I18nProvider";

    function TabErrorFallback({ onReset }: { onReset: () => void }) {
      const { t } = useT();
      return (
        <Card className="p-6 text-center">
          <p className="text-sm font-medium text-ink">{t("Something went wrong on this tab.")}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {t("Try again, or switch to another tab.")}
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onReset}>
            {t("Try again")}
          </Button>
        </Card>
      );
    }

    interface TabErrorBoundaryProps {
      children: ReactNode;
    }

    interface TabErrorBoundaryState {
      hasError: boolean;
    }

    export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
      state: TabErrorBoundaryState = { hasError: false };

      static getDerivedStateFromError() {
        return { hasError: true };
      }

      componentDidCatch(error: unknown) {
        console.error("Tab crashed:", error);
      }

      reset = () => this.setState({ hasError: false });

      render() {
        if (this.state.hasError) return <TabErrorFallback onReset={this.reset} />;
        return this.props.children;
      }
    }

    // src/components/app/HomeClient.tsx — target (only the <TabContent /> call site changes)
                    <motion.div
                      className="max-w-5xl mx-auto px-4 pt-5 pb-14 sm:pt-7 sm:pb-20"
                      initial={false}
                      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: TRAVEL }}
                      transition={springSoft}
                    >
                      <TabErrorBoundary>
                        <TabContent
                          tab={item.id}
                          onOpenSettings={() => {
                            setSettingsAiIntent(true);
                            setOverlay("settings");
                          }}
                          onOpenDiscover={() => changeTab("discover")}
                          onOpenPractice={() => changeTab("study")}
                          onOpenConversation={
                            advancedSurfacesUnlocked
                              ? () => {
                                  setLessonId(null);
                                  setOverlay("converse");
                                }
                              : undefined
                          }
                          onOpenCorrect={() => changeTab("correct")}
                          onFirstLesson={startFirstLesson}
                          onOpenLesson={openLesson}
                          discoverPrefill={discoverPrefill}
                          active={active}
                        />
                      </TabErrorBoundary>
                    </motion.div>

    // src/components/app/HomeClient.tsx — add the import near the other local imports (top of file)
    import { TabErrorBoundary } from "@/components/app/TabErrorBoundary";

## Repo conventions to follow

- `Card` (`src/components/ui/Card.tsx`) and `Button` (`src/components/ui/Button.tsx`)
  are the shared primitives used for exactly this kind of centered,
  card-boxed status message elsewhere (e.g. `StudyCard.tsx:118-127`'s
  "No practice phrases yet" empty state) — imitate that structure: a `Card`
  wrapper, a `text-sm font-medium text-ink` heading line, a
  `text-xs text-ink-muted` supporting line, a `Button variant="secondary" size="sm"`
  action.
- Use `useT()` / `t(...)` for every user-facing string, exactly as every
  other component in `src/features` and `src/components` does — do not
  hardcode English strings.
- Keep the new file a single-purpose primitive under `src/components/app/`,
  matching the existing flat layout of that directory (`AppHeader.tsx`,
  `AppProviders.tsx`, `HomeClient.tsx`, `homeTabs.ts`, etc.) — do not create a
  new subfolder for one component.

## Steps

1. Create `src/components/app/TabErrorBoundary.tsx` exactly as shown in Target.
2. In `src/components/app/HomeClient.tsx`, add the `TabErrorBoundary` import
   near the top with the other local component imports.
3. In the tab-panel `.map()` (around lines 272-319), wrap the existing
   `<TabContent ... />` element with `<TabErrorBoundary>...</TabErrorBoundary>`,
   changing nothing about `TabContent`'s own props.
4. Re-read the diff and confirm no other branch of `HomeContent` (lessonId,
   settings/c1/converse/tools overlays) was touched — this plan intentionally
   scopes only the five primary tab panels, which are the every-session hot
   path; the overlays are opened far less often and are out of scope here.

## Boundaries

- Do NOT wrap the `lessonId`, `settings`, `c1`, `converse`, or `tools` overlay
  branches (lines 181-271) — only the primary tab-panel loop.
- Do NOT change `TabContent`'s signature, the tab-switching logic, or the
  `motion.div` entrance animation.
- Do NOT add a global/root-level error boundary or a Next.js `error.tsx` in
  this plan — the finding and fix are scoped to the in-shell tab boundary.
- STOP if the tab-panel `.map()` no longer matches the Problem excerpt
  (drifted since commit `9532b571`) — report the drift instead of guessing a
  new insertion point.

## Verification

- **Mechanical**:
  - `npx react-doctor@latest --scope changed` does not introduce new
    diagnostics and the score does not regress.
  - `yarn tsc --noEmit`, `yarn lint`, and `yarn test` all pass.
- **Behavior check**: Temporarily throw inside one tab (e.g. add
  `if (true) throw new Error("test")` at the top of `DiscoverTab`'s render),
  confirm only that tab's panel shows the "Something went wrong" card while
  the header, nav, and other tabs remain fully interactive — switch away and
  back, and click "Try again" to confirm it re-attempts rendering. Remove the
  temporary throw before finishing. Then click through all five tabs normally
  and confirm no visual or behavioral change from before this plan (same
  entrance animation, same state-preservation across tab switches).
- **Done when**: a render throw in one tab no longer crashes the whole shell,
  the fallback card matches the repo's existing empty-state visual pattern,
  required checks pass, and normal tab navigation is unchanged.
