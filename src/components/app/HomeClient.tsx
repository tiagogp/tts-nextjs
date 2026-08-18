"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { BLUR, springSoft, TRAVEL } from "@/lib/motion";
import AppHeader from "@/components/app/AppHeader";
import { type HomeTab } from "@/components/app/homeTabs";
import AppProviders from "@/components/app/AppProviders";
import { useUnlockedTabs } from "@/components/app/useUnlockedTabs";
import { useDockDueBadge } from "@/components/app/useDockDueBadge";
import C1Tab from "@/features/c1/components/C1Tab";
import ConverseTab from "@/features/converse/components/ConverseTab";
import ConversationTab from "@/features/converse/components/ConversationTab";
import CorrectTab from "@/features/correct/components/CorrectTab";
import { startFirstRunActivation } from "@/features/activation/firstRun";
import { TabErrorBoundary } from "@/components/app/TabErrorBoundary";
import DiscoverTab from "@/features/discover/components/DiscoverTab";
import { LEVEL_RANK } from "@/features/discover/levels";
import { HojeHome } from "@/features/home/components/HojeHome";
import { GuidedSpeaking } from "@/features/pronunciation/components/GuidedSpeaking";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { LessonView } from "@/features/learn/components/LessonView";
import { completedLessonIdsFromCardIds, firstLesson, lessonById, nextLessonFor } from "@/features/learn/lessonDeck";
import SettingsScreen from "@/features/settings/components/SettingsScreen";
import { getLearningProfile } from "@/features/settings/learningProfile";
import OnboardingDialog from "@/features/settings/components/OnboardingDialog";
import SpeechTab from "@/features/speech/components/SpeechTab";
import StudyTab from "@/features/study/components/StudyTab";
import { PlanOnboarding } from "@/features/plan/components/PlanOnboarding";
import { PlanGenerationToast } from "@/features/plan/components/PlanGenerationToast";
import { installDefaultPlan } from "@/features/plan/defaultPlans";
import type { TaskItem } from "@/features/plan/schema";
import ModelDownloadBar from "@/features/speech/components/ModelDownloadBar";
import { useKokoroModel, type LocalModelState } from "@/features/speech/hooks/useLocalModel";
import { useT } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { isStoreAvailable } from "@/lib/store/db";
import { emitActivity } from "@/lib/store/activityLog";
import { getCards } from "@/lib/store/repository";
import { refreshMethodProgression } from "@/features/method/progressionPersistence";

async function recommendedLessonId(): Promise<string> {
  const profile = getLearningProfile();
  if (!isStoreAvailable()) return nextLessonFor(profile, [])?.id ?? firstLesson().id;
  try {
    const cards = await getCards();
    const completed = completedLessonIdsFromCardIds(cards.map((card) => card.id));
    return nextLessonFor(profile, completed)?.id ?? firstLesson().id;
  } catch {
    return nextLessonFor(profile, [])?.id ?? firstLesson().id;
  }
}

async function resolveLessonId(nextLessonId?: string): Promise<string> {
  const profile = getLearningProfile();
  const requested = nextLessonId ? lessonById(nextLessonId) : undefined;
  if (requested && LEVEL_RANK[requested.level] >= LEVEL_RANK[profile.level]) return requested.id;
  return recommendedLessonId();
}

function TabContent({
  tab,
  onOpenSettings,
  onOpenDiscover,
  onOpenPractice,
  onSpeak,
  onOpenCorrect,
  onFirstLesson,
  onOpenLesson,
  onOpenPlanTask,
  onCreatePlan,
  onInstallDefaultPlan,
  speakSurface,
  onSpeakDone,
  discoverPrefill,
  kokoro,
}: {
  tab: HomeTab;
  onOpenSettings: () => void;
  onOpenDiscover: () => void;
  onOpenPractice: () => void;
  /** Always defined: the method requires speaking to be reachable from day 1. */
  onSpeak: () => void;
  onOpenCorrect: () => void;
  onFirstLesson: () => void;
  onOpenLesson: (lessonId?: string) => void;
  onOpenPlanTask: (task: TaskItem) => void;
  onCreatePlan: () => void;
  onInstallDefaultPlan: () => void;
  /** Which speaking surface the learner's real capability supports (see `openSpeaking`). */
  speakSurface: "guided" | "converse";
  onSpeakDone: () => void;
  discoverPrefill?: { url: string; nonce: number } | null;
  kokoro: LocalModelState;
}) {
  if (tab === "hoje") {
    return (
      <HojeHome
        onStudy={onOpenPractice}
        onDiscover={onOpenDiscover}
        onCorrect={onOpenCorrect}
        onFirstLesson={onFirstLesson}
        onLesson={onOpenLesson}
        onSpeak={onSpeak}
        onOpenPlanTask={onOpenPlanTask}
        onCreatePlan={onCreatePlan}
        onInstallDefaultPlan={onInstallDefaultPlan}
      />
    );
  }
  if (tab === "discover") {
    return (
      <DiscoverTab
        key={discoverPrefill?.nonce ?? "discover"}
        onOpenSettings={onOpenSettings}
        onStudyNow={onOpenPractice}
        onCorrect={onOpenCorrect}
        prefill={discoverPrefill}
      />
    );
  }
  if (tab === "study") return <StudyTab onDiscover={onOpenDiscover} onConversation={onSpeak} onLesson={() => onOpenLesson()} onCorrect={onOpenCorrect} />;
  if (tab === "speak") return <SpeakTab surface={speakSurface} onOpenSettings={onOpenSettings} onDone={onSpeakDone} />;
  if (tab === "conversa") return <ConversationTab onOpenSettings={onOpenSettings} />;
  if (tab === "correct") return <CorrectTab onOpenSettings={onOpenSettings} onStudyNow={onOpenPractice} kokoroModel={kokoro} />;
  return null;
}

/** Speaking's persistent home (tier ≥ 1). The surface mirrors `openSpeaking`:
 *  guided drill always works locally; open roleplay needs an LLM evaluator. */
function SpeakTab({
  surface,
  onOpenSettings,
  onDone,
}: {
  surface: "guided" | "converse";
  onOpenSettings: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Speak")}
        description={surface === "converse"
          ? t("Practice a real conversation and retry the most important correction.")
          : t("Repeat a useful phrase, then use it in a sentence of your own.")}
      />
      {surface === "converse" ? (
        <ConverseTab onOpenSettings={onOpenSettings} />
      ) : (
        <GuidedSpeaking onDone={onDone} />
      )}
    </div>
  );
}

// Conversation/VAD is demoted out of the primary tabs (W3) but stays fully
// functional, reachable as an overlay rather than a phantom tab. C1 diagnosis (experimental,
// experimental diagnosis follows the same pattern: never a primary tab.
// `speak` is the beginner half of that pair — see `openSpeaking`.
//
// The W3 demotion holds up to B2, where producing language at all is still the bottleneck and a
// roleplay tab would sit unused next to the drill that actually helps. From C1 it stops holding:
// those learners can already converse, and conversation is the only surface that supplies the
// repertoire they're short of — so it earns a real tab there. See `tabsForUnlockTier`.
type Overlay = "settings" | "tools" | "converse" | "speak" | "c1" | null;

function OverlayHeader({
  title,
  description,
  backLabel,
  onBack,
}: {
  title: string;
  description?: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-6 space-y-4 border-b border-line pb-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 min-h-9">
        <span aria-hidden="true">←</span>
        {backLabel}
      </Button>
      <PageHeader title={title} description={description} />
    </div>
  );
}

function HomeContent() {
  const { t } = useT();
  const [tab, setTab] = useState<HomeTab>("hoje");
  const [overlay, setOverlay] = useState<Overlay>(null);
  // "Connect an AI" links must land on a Settings screen that actually shows
  // the AI section, even before the tier unlock reveals it by default.
  const [settingsAiIntent, setSettingsAiIntent] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [discoverPrefill] = useState<{ url: string; nonce: number } | null>(null);
  const lessonRequestRef = useRef(0);
  const kokoro = useKokoroModel();
  // Provider first: the Conversation tab's visibility depends on it.
  const { hasEvaluator } = useProviderSelection({ fallbackToEvaluator: true });
  const { tabs, tier, dueCount, announcement, clearAnnouncement } = useUnlockedTabs({ hasEvaluator });
  const activeTab = tabs.some((item) => item.id === tab) ? tab : "hoje";
  const advancedSurfacesUnlocked = tier >= 3;
  useDockDueBadge();

  // Attempt records are the source of truth for support level. Refresh their
  // derived snapshot immediately after IndexedDB confirms a write, rather than
  // making progression depend on whether the learner visits Progress.
  useEffect(() => {
    if (!isStoreAvailable()) return;
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      void refreshMethodProgression()
        .catch(() => undefined)
        .finally(() => {
          queued = false;
        });
    };
    refresh();
    window.addEventListener("phraseloop:performance-evidence", refresh);
    return () => window.removeEventListener("phraseloop:performance-evidence", refresh);
  }, []);

  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(clearAnnouncement, 3600);
    return () => window.clearTimeout(timer);
  }, [announcement, clearAnnouncement]);

  const changeTab = useCallback((next: HomeTab) => {
    setTab(tabs.some((item) => item.id === next) ? next : "hoje");
    setOverlay(null);
    setLessonId(null);
  }, [tabs]);

  /**
   * The method's Rule #1: speaking is present from the beginning. Which speaking surface
   * the learner gets is decided by a real capability, not by the tier alone.
   *
   * `ConverseTab`'s open roleplay cannot even start without an LLM provider
   * (`canStart = hasEvaluator`), and tier 3 is reached the moment a learner saves their
   * first own sentence — long before most of them configure one. Routing on the tier
   * alone would therefore drop a provider-less beginner straight onto a dead end. The
   * guided drill runs on local Whisper + local Kokoro, so it always works; roleplay is
   * offered only once it can actually run.
   *
   * From tier 1 the Speak tab is that surface's persistent home; the overlay remains
   * only for the tier-0 learner routed here (e.g. a starter-plan converse task).
   *
   * Once the Talk tab exists (C1-C2 with a provider) it owns roleplay, and Speak falls back to
   * the guided drill — otherwise the identical conversation would render in two tabs at once.
   */
  const hasTalkTab = tabs.some((item) => item.id === "conversa");
  const speakSurface: "guided" | "converse" =
    !hasTalkTab && advancedSurfacesUnlocked && hasEvaluator ? "converse" : "guided";
  const openSpeaking = useCallback(() => {
    setLessonId(null);
    // Callers here mean "go talk" (Study's conversation prompt, Hoje's speak CTA). When Talk
    // exists it is that destination; Speak now holds the guided drill instead.
    if (hasTalkTab) {
      changeTab("conversa");
      return;
    }
    if (tabs.some((item) => item.id === "speak")) {
      changeTab("speak");
      return;
    }
    setOverlay(speakSurface === "converse" ? "converse" : "speak");
  }, [changeTab, hasTalkTab, speakSurface, tabs]);

  // "Hoje" -> Start: open the learner's recommended bundled lesson through the
  // same save -> review path used after custom discovery.
  const startFirstLesson = () => {
    setOverlay(null);
    const requestId = lessonRequestRef.current + 1;
    lessonRequestRef.current = requestId;
    void recommendedLessonId().then((resolvedLessonId) => {
      if (lessonRequestRef.current !== requestId) return;
      startFirstRunActivation({ source: "bundled_lesson", sourceId: resolvedLessonId });
      void emitActivity("first_run_started", { source: "bundled_lesson", sourceId: resolvedLessonId });
      setLessonId(resolvedLessonId);
    });
  };

  const openLesson = useCallback((nextLessonId?: string) => {
    const requestId = lessonRequestRef.current + 1;
    lessonRequestRef.current = requestId;
    setOverlay(null);
    setTab("hoje");
    void resolveLessonId(nextLessonId).then((resolvedLessonId) => {
      if (lessonRequestRef.current === requestId) setLessonId(resolvedLessonId);
    });
  }, []);

  const openPlanTask = useCallback((task: TaskItem) => {
    if (task.type === "discover") return changeTab("discover");
    if (task.type === "study" || task.type === "readWrite") return changeTab("study");
    if (task.type === "correct") return changeTab("correct");
    if (task.type === "converse") return openSpeaking();
    return openLesson(task.lessonId);
  }, [changeTab, openLesson, openSpeaking]);

  const installStarterPlan = useCallback(() => {
    void installDefaultPlan(getLearningProfile()).catch(() => undefined);
  }, []);

  const announcedLabel = announcement
    ? tabs.find((item) => item.id === announcement)?.label ?? announcement
    : null;

  return (
        <div className="h-dvh overflow-hidden flex flex-col bg-surface">
          <AppHeader
            activeTab={activeTab}
            onTabChange={changeTab}
            settingsOpen={overlay === "settings"}
            onSettingsOpen={() => {
              setLessonId(null);
              setSettingsAiIntent(false);
              setOverlay("settings");
            }}
            tabs={tabs}
            badges={{ study: dueCount }}
          />

          {/* The model installs start on their own — voice right after onboarding,
              speech recognition on first use — so this bar lives above <main> and
              outside the tab switch: whichever tab or overlay the learner is on,
              they can see a download is still running and, if it failed, retry
              from where they already are. */}
          <ModelDownloadBar />

          <main className="flex-1 min-h-0" id="main-content">
            {lessonId !== null ? (
              <section className="h-full overflow-y-auto app-scroll-region">
                <m.div
                  className="max-w-5xl mx-auto px-4 pt-5 pb-14 sm:pt-7 sm:pb-20"
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springSoft}
                >
                  <LessonView
                    lessonId={lessonId}
                    onBack={() => setLessonId(null)}
                    onStudyNow={() => changeTab("study")}
                  />
                </m.div>
              </section>
            ) : overlay === "settings" ? (
              <div className="h-full overflow-y-auto pb-16 app-scroll-region sm:pb-20">
                <SettingsScreen
                  onBack={() => setOverlay(null)}
                  onOpenTools={advancedSurfacesUnlocked ? () => setOverlay("tools") : undefined}
                  onOpenC1={advancedSurfacesUnlocked ? () => setOverlay("c1") : undefined}
                  showAdvancedAi={advancedSurfacesUnlocked || settingsAiIntent}
                />
              </div>
            ) : overlay === "c1" ? (
              <div className="h-full overflow-y-auto pb-16 app-scroll-region sm:pb-20">
                <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
                  <OverlayHeader
                    title={t("C1 diagnosis")}
                    description={t("Review register, naturalness, and collocation at an advanced level.")}
                    backLabel={t("Back to Settings")}
                    onBack={() => setOverlay("settings")}
                  />
                  <C1Tab
                    onOpenSettings={() => {
                      setSettingsAiIntent(true);
                      setOverlay("settings");
                    }}
                  />
                </div>
              </div>
            ) : overlay === "speak" ? (
              <div className="h-full overflow-y-auto pb-16 app-scroll-region sm:pb-20">
                <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
                  <OverlayHeader
                    title={t("Speak")}
                    description={t("Repeat a useful phrase, then use it in a sentence of your own.")}
                    backLabel={t("Back")}
                    onBack={() => setOverlay(null)}
                  />
                  <GuidedSpeaking onDone={() => setOverlay(null)} />
                </div>
              </div>
            ) : overlay === "converse" ? (
              <div className="h-full overflow-y-auto pb-16 app-scroll-region sm:pb-20">
                <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
                  <OverlayHeader
                    title={t("Speak")}
                    description={t("Practice a real conversation and retry the most important correction.")}
                    backLabel={t("Back")}
                    onBack={() => setOverlay(null)}
                  />
                  <ConverseTab
                    onOpenSettings={() => {
                      setSettingsAiIntent(true);
                      setOverlay("settings");
                    }}
                  />
                </div>
              </div>
            ) : overlay === "tools" ? (
              <div className="h-full overflow-y-auto pb-16 app-scroll-region sm:pb-20">
                <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
                  <OverlayHeader
                    title={t("Advanced tools")}
                    description={t("Export to Anki, text-to-speech, and theme phrase lists.")}
                    backLabel={t("Back to Settings")}
                    onBack={() => setOverlay("settings")}
                  />
                  <SpeechTab kokoroModel={kokoro} />
                </div>
              </div>
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
                    <m.div
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
                          onSpeak={openSpeaking}
                          onOpenCorrect={() => changeTab("correct")}
                          onFirstLesson={startFirstLesson}
                          onOpenLesson={openLesson}
                          onOpenPlanTask={openPlanTask}
                          onCreatePlan={() => setPlanDialogOpen(true)}
                          onInstallDefaultPlan={installStarterPlan}
                          speakSurface={speakSurface}
                          onSpeakDone={() => changeTab("hoje")}
                          discoverPrefill={discoverPrefill}
                          kokoro={kokoro}
                        />
                      </TabErrorBoundary>
                    </m.div>
                  </section>
                );
              })
            )}
          </main>
          {/* One bottom-center stack, so a plan finishing while a section unlocks
              does not put two toasts on top of each other. */}
          <div className="pointer-events-none fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
            {announcedLabel && (
              <m.div
                className="rounded-md border border-line bg-card px-3 py-2 text-sm font-medium text-ink shadow-lg"
                initial={{ opacity: 0, y: 10, filter: `blur(${BLUR}px)` }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 10, filter: `blur(${BLUR}px)` }}
                transition={springSoft}
                role="status"
              >
                {t("New section unlocked: {section}", { section: t(announcedLabel) })}
              </m.div>
            )}
            <PlanGenerationToast onViewPlan={() => changeTab("hoje")} />
          </div>
          <OnboardingDialog
            onOpenSettings={() => {
              setLessonId(null);
              setOverlay("settings");
            }}
          />
          <PlanOnboarding
            open={planDialogOpen}
            onClose={() => setPlanDialogOpen(false)}
            onOpenSettings={() => {
              setPlanDialogOpen(false);
              setSettingsAiIntent(true);
              setOverlay("settings");
            }}
          />
        </div>
  );
}

export default function HomeClient() {
  return (
    <AppProviders>
      <HomeContent />
    </AppProviders>
  );
}
