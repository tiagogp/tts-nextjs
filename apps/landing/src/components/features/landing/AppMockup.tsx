"use client";

import { useCallback, useState } from "react";
import { motion } from "motion/react";
import AppHeader from "@/components/app/AppHeader";
import AppProviders from "@/components/app/AppProviders";
import type { HomeTab } from "@/components/app/homeTabs";
import CorrectTab from "@/features/correct/components/CorrectTab";
import DiscoverTab from "@/features/discover/components/DiscoverTab";
import SettingsScreen from "@/features/settings/components/SettingsScreen";
import SpeechTab from "@/features/speech/components/SpeechTab";
import StudyTab from "@/features/study/components/StudyTab";
import { springSnappy } from "@/lib/motion";
import {
  translateLanding,
  type LandingLanguage,
} from "@landing/lib/landingLanguage";
import { LANDING_TABS } from "@landing/constants/landing";
import { useLandingDemoApi } from "@landing/hooks/useLandingDemoApi";

function DemoTabContent({
  tab,
  onOpenSettings,
  onOpenDiscover,
  onOpenPractice,
  onOpenConversation,
}: {
  tab: HomeTab;
  onOpenSettings: () => void;
  onOpenDiscover: () => void;
  onOpenPractice: () => void;
  onOpenConversation: () => void;
}) {
  if (tab === "discover") {
    return (
      <DiscoverTab
        onOpenSettings={onOpenSettings}
        onStudyNow={onOpenPractice}
      />
    );
  }

  if (tab === "study") {
    return (
      <StudyTab
        onDiscover={onOpenDiscover}
        onConversation={onOpenConversation}
      />
    );
  }

  if (tab === "correct") {
    return (
      <CorrectTab onOpenSettings={onOpenSettings} onStudyNow={onOpenPractice} />
    );
  }

  return <SpeechTab />;
}

export function AppMockup({ language }: { language: LandingLanguage }) {
  useLandingDemoApi(language);
  const [tab, setTab] = useState<HomeTab>("discover");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const changeTab = useCallback((next: HomeTab) => {
    setTab(next);
    setSettingsOpen(false);
  }, []);

  return (
    <motion.div
      className="mx-auto w-full max-w-7xl overflow-hidden rounded-lg border border-line-strong bg-surface"
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-between border-b border-line bg-[#f3eee7] px-3 py-2 dark:bg-[#2a2724] sm:px-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b4a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#d9b86f]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#62b36f]" />
        </div>
        <p className="text-xs font-medium text-[#5f5a52] dark:text-[#d8d3ca]">
          {translateLanding(
            language,
            "Demonstração interativa com dados de exemplo",
          )}
        </p>
      </div>
      <AppProviders lang={language}>
        <div className="flex h-170 flex-col overflow-hidden bg-surface sm:h-[720px] lg:h-[660px]">
          <AppHeader
            activeTab={tab}
            onTabChange={changeTab}
            settingsOpen={settingsOpen}
            onSettingsOpen={() => setSettingsOpen(true)}
            tabs={LANDING_TABS}
          />
          <main className="min-h-0 flex-1">
            {settingsOpen ? (
              <div
                className="h-full overflow-y-auto pb-12 app-scroll-region"
                style={{ overscrollBehavior: "auto" }}
              >
                <div className="mx-auto max-w-5xl px-4 py-5">
                  <SettingsScreen
                    onBack={() => setSettingsOpen(false)}
                    showAdvancedAi={false}
                  />
                </div>
              </div>
            ) : (
              LANDING_TABS.map((item) => {
                const active = tab === item.id;
                return (
                  <section
                    key={item.id}
                    hidden={!active}
                    aria-labelledby={`landing-tab-${item.id}`}
                    role="tabpanel"
                    tabIndex={0}
                    className="h-full overflow-y-auto app-scroll-region"
                    style={{ overscrollBehavior: "auto" }}
                  >
                    <motion.div
                      className="mx-auto max-w-5xl px-4 pb-14 pt-5"
                      initial={false}
                      animate={
                        active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }
                      }
                      transition={springSnappy}
                    >
                      <DemoTabContent
                        tab={item.id}
                        onOpenSettings={() => setSettingsOpen(true)}
                        onOpenDiscover={() => changeTab("discover")}
                        onOpenPractice={() => changeTab("study")}
                        onOpenConversation={() => changeTab("discover")}
                      />
                    </motion.div>
                  </section>
                );
              })
            )}
          </main>
        </div>
      </AppProviders>
    </motion.div>
  );
}
