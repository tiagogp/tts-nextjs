"use client";

import { useState } from "react";
import AppHeader from "@/components/app/AppHeader";
import { HOME_TABS, type HomeTab } from "@/components/app/homeTabs";
import AppProviders from "@/components/app/AppProviders";
import CorrectTab from "@/features/correct/components/CorrectTab";
import DiscoverTab from "@/features/discover/components/DiscoverTab";
import SettingsScreen from "@/features/settings/components/SettingsScreen";
import OnboardingDialog from "@/features/settings/components/OnboardingDialog";
import SpeechTab from "@/features/speech/components/SpeechTab";
import StudyTab from "@/features/study/components/StudyTab";

function TabContent({ tab }: { tab: HomeTab }) {
  if (tab === "discover") return <DiscoverTab />;
  if (tab === "correct") return <CorrectTab />;
  if (tab === "study") return <StudyTab />;
  return <SpeechTab />;
}

export default function HomeClient() {
  const [tab, setTab] = useState<HomeTab>("speech");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const changeTab = (next: HomeTab) => {
    setTab(next);
    setSettingsOpen(false);
  };

  return (
    <AppProviders>
        <div
          className="h-dvh overflow-hidden flex flex-col"
          style={{ backgroundColor: "var(--surface)" }}
        >
          <AppHeader
            activeTab={tab}
            onTabChange={changeTab}
            settingsOpen={settingsOpen}
            onSettingsOpen={() => setSettingsOpen(true)}
          />

          <main className="flex-1 min-h-0" id="main-content">
            {settingsOpen ? (
              <div className="h-full overflow-y-auto app-scroll-region">
                <SettingsScreen onBack={() => setSettingsOpen(false)} />
              </div>
            ) : (
              HOME_TABS.map((item) => (
                <section
                  key={item.id}
                  id={`panel-${item.id}`}
                  hidden={tab !== item.id}
                  aria-labelledby={`tab-${item.id}`}
                  role="tabpanel"
                  tabIndex={0}
                  className={`h-full overflow-y-auto app-scroll-region ${tab === item.id ? "tab-panel-enter" : ""}`}
                >
                  <div className="max-w-5xl mx-auto px-4 py-5 sm:py-7">
                    <TabContent tab={item.id} />
                  </div>
                </section>
              ))
            )}
          </main>
          <OnboardingDialog onOpenSettings={() => setSettingsOpen(true)} />
        </div>
    </AppProviders>
  );
}
