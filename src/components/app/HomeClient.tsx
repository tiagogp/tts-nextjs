"use client";

import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { BLUR, springSoft, TRAVEL } from "@/lib/motion";
import AppHeader from "@/components/app/AppHeader";
import { type HomeTab } from "@/components/app/homeTabs";
import AppProviders from "@/components/app/AppProviders";
import { useUnlockedTabs } from "@/components/app/useUnlockedTabs";
import { useDockDueBadge } from "@/components/app/useDockDueBadge";
import C1Tab from "@/features/c1/components/C1Tab";
import ConverseTab from "@/features/converse/components/ConverseTab";
import CorrectTab from "@/features/correct/components/CorrectTab";
import { startFirstRunActivation } from "@/features/activation/firstRun";
import { TabErrorBoundary } from "@/components/app/TabErrorBoundary";
import DiscoverTab from "@/features/discover/components/DiscoverTab";
import { LEVEL_RANK } from "@/features/discover/levels";
import { HojeHome } from "@/features/home/components/HojeHome";
import { LessonView } from "@/features/learn/components/LessonView";
import { completedLessonIdsFromCardIds, firstLesson, lessonById, nextLessonFor } from "@/features/learn/lessonDeck";
import SettingsScreen from "@/features/settings/components/SettingsScreen";
import { getLearningProfile } from "@/features/settings/learningProfile";
import OnboardingDialog from "@/features/settings/components/OnboardingDialog";
import SpeechTab from "@/features/speech/components/SpeechTab";
import StudyTab from "@/features/study/components/StudyTab";
import { useT } from "@/i18n/I18nProvider";
import { isStoreAvailable } from "@/lib/store/db";
import { emitActivity } from "@/lib/store/activityLog";
import { getCards } from "@/lib/store/repository";

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
  onOpenConversation,
  onOpenCorrect,
  onFirstLesson,
  onOpenLesson,
  discoverPrefill,
}: {
  tab: HomeTab;
  onOpenSettings: () => void;
  onOpenDiscover: () => void;
  onOpenPractice: () => void;
  onOpenConversation?: () => void;
  onOpenCorrect: () => void;
  onFirstLesson: () => void;
  onOpenLesson: (lessonId?: string) => void;
  discoverPrefill?: { url: string; nonce: number } | null;
}) {
  if (tab === "hoje") {
    return (
      <HojeHome
        onStudy={onOpenPractice}
        onDiscover={onOpenDiscover}
        onCorrect={onOpenCorrect}
        onFirstLesson={onFirstLesson}
        onLesson={onOpenLesson}
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
  if (tab === "study") return <StudyTab onDiscover={onOpenDiscover} onConversation={onOpenConversation} />;
  if (tab === "correct") return <CorrectTab onOpenSettings={onOpenSettings} onStudyNow={onOpenPractice} />;
  return null;
}

// Conversation/VAD is demoted out of the primary tabs (W3) but stays fully
// functional, reachable as an overlay rather than a phantom tab. C1 diagnosis (experimental,
// experimental diagnosis follows the same pattern: never a primary tab.
type Overlay = "settings" | "tools" | "converse" | "c1" | null;

function HomeContent() {
  const { t } = useT();
  const [tab, setTab] = useState<HomeTab>("hoje");
  const [overlay, setOverlay] = useState<Overlay>(null);
  // "Connect an AI" links must land on a Settings screen that actually shows
  // the AI section, even before the tier unlock reveals it by default.
  const [settingsAiIntent, setSettingsAiIntent] = useState(false);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [discoverPrefill] = useState<{ url: string; nonce: number } | null>(null);
  const lessonRequestRef = useRef(0);
  const { tabs, tier, announcement, clearAnnouncement } = useUnlockedTabs();
  const activeTab = tabs.some((item) => item.id === tab) ? tab : "hoje";
  const advancedSurfacesUnlocked = tier >= 3;
  useDockDueBadge();

  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(clearAnnouncement, 3600);
    return () => window.clearTimeout(timer);
  }, [announcement, clearAnnouncement]);

  const changeTab = (next: HomeTab) => {
    setTab(tabs.some((item) => item.id === next) ? next : "hoje");
    setOverlay(null);
    setLessonId(null);
  };

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

  const openLesson = (nextLessonId?: string) => {
    const requestId = lessonRequestRef.current + 1;
    lessonRequestRef.current = requestId;
    setOverlay(null);
    setTab("hoje");
    void resolveLessonId(nextLessonId).then((resolvedLessonId) => {
      if (lessonRequestRef.current === requestId) setLessonId(resolvedLessonId);
    });
  };

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
          />

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
                  <div className="mb-6 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOverlay("settings")}
                      className="rounded-md border border-line px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
                      aria-label={t("Back to Settings")}
                    >
                      ←
                    </button>
                    <h2 className="text-xl font-semibold text-ink">{t("C1 diagnosis")}</h2>
                  </div>
                  <C1Tab
                    onOpenSettings={() => {
                      setSettingsAiIntent(true);
                      setOverlay("settings");
                    }}
                  />
                </div>
              </div>
            ) : overlay === "converse" ? (
              <div className="h-full overflow-y-auto pb-16 app-scroll-region sm:pb-20">
                <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
                  <div className="mb-6 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOverlay(null)}
                      className="rounded-md border border-line px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
                      aria-label={t("Back")}
                    >
                      ←
                    </button>
                    <h2 className="text-xl font-semibold text-ink">{t("Speak")}</h2>
                  </div>
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
                  <div className="mb-6 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOverlay("settings")}
                      className="rounded-md border border-line px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
                      aria-label={t("Back to Settings")}
                    >
                      ←
                    </button>
                    <div>
                      <h2 className="text-xl font-semibold text-ink">{t("Advanced tools")}</h2>
                      <p className="text-sm text-ink-muted">
                        {t("Export to Anki, text-to-speech, and theme phrase lists.")}
                      </p>
                    </div>
                  </div>
                  <SpeechTab />
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
                        />
                      </TabErrorBoundary>
                    </m.div>
                  </section>
                );
              })
            )}
          </main>
          {announcedLabel && (
            <m.div
              className="pointer-events-none fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-md border border-line bg-card px-3 py-2 text-sm font-medium text-ink shadow-lg"
              initial={{ opacity: 0, y: 10, filter: `blur(${BLUR}px)` }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 10, filter: `blur(${BLUR}px)` }}
              transition={springSoft}
              role="status"
            >
              {t("New section unlocked: {section}", { section: t(announcedLabel) })}
            </m.div>
          )}
          <OnboardingDialog
            onOpenSettings={() => {
              setLessonId(null);
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
