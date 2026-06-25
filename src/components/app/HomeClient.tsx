"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { springSoft, TRAVEL } from "@/lib/motion";
import AppHeader from "@/components/app/AppHeader";
import { HOME_TABS, type HomeTab } from "@/components/app/homeTabs";
import AppProviders from "@/components/app/AppProviders";
import CorrectTab from "@/features/correct/components/CorrectTab";
import DiscoverTab from "@/features/discover/components/DiscoverTab";
import PracticeTab from "@/features/practice/components/PracticeTab";
import SettingsScreen from "@/features/settings/components/SettingsScreen";
import OnboardingDialog from "@/features/settings/components/OnboardingDialog";
import SpeechTab from "@/features/speech/components/SpeechTab";

type PracticeView = "study" | "conversation";

function TabContent({
  tab,
  onOpenSettings,
  onOpenDiscover,
  onOpenPractice,
  onOpenConversation,
  onOpenCorrect,
  practiceView,
  onPracticeViewChange,
}: {
  tab: HomeTab;
  onOpenSettings: () => void;
  onOpenDiscover: () => void;
  onOpenPractice: () => void;
  onOpenConversation: () => void;
  onOpenCorrect: () => void;
  practiceView: PracticeView;
  onPracticeViewChange: (view: PracticeView) => void;
}) {
  if (tab === "discover") {
    return (
      <DiscoverTab
        onOpenSettings={onOpenSettings}
        onStudyNow={onOpenPractice}
        onSpeakNow={onOpenConversation}
        onCorrectNow={onOpenCorrect}
      />
    );
  }
  if (tab === "converse") {
    return (
      <PracticeTab
        onOpenSettings={onOpenSettings}
        onOpenDiscover={onOpenDiscover}
        view={practiceView}
        onViewChange={onPracticeViewChange}
      />
    );
  }
  if (tab === "correct") return <CorrectTab onOpenSettings={onOpenSettings} onStudyNow={onOpenPractice} />;
  return <SpeechTab />;
}

export default function HomeClient() {
  const [tab, setTab] = useState<HomeTab>("discover");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [practiceView, setPracticeView] = useState<PracticeView>("study");

  const changeTab = (next: HomeTab) => {
    setTab(next);
    setSettingsOpen(false);
  };

  const openPractice = (view: PracticeView) => {
    setPracticeView(view);
    changeTab("converse");
  };

  return (
    <AppProviders>
        <div className="h-dvh overflow-hidden flex flex-col bg-surface">
          <AppHeader
            activeTab={tab}
            onTabChange={changeTab}
            settingsOpen={settingsOpen}
            onSettingsOpen={() => setSettingsOpen(true)}
          />

          <main className="flex-1 min-h-0" id="main-content">
            {settingsOpen ? (
              <div className="h-full overflow-y-auto pb-16 app-scroll-region sm:pb-20">
                <SettingsScreen onBack={() => setSettingsOpen(false)} />
              </div>
            ) : (
              HOME_TABS.map((item) => {
                const active = tab === item.id;
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
                        onOpenSettings={() => setSettingsOpen(true)}
                        onOpenDiscover={() => changeTab("discover")}
                        onOpenPractice={() => openPractice("study")}
                        onOpenConversation={() => openPractice("conversation")}
                        onOpenCorrect={() => changeTab("correct")}
                        practiceView={practiceView}
                        onPracticeViewChange={setPracticeView}
                      />
                    </motion.div>
                  </section>
                );
              })
            )}
          </main>
          <OnboardingDialog onOpenSettings={() => setSettingsOpen(true)} />
        </div>
    </AppProviders>
  );
}
