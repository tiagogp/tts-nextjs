"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { springSoft, TRAVEL } from "@/lib/motion";
import AppHeader from "@/components/app/AppHeader";
import { HOME_TABS, type HomeTab } from "@/components/app/homeTabs";
import AppProviders from "@/components/app/AppProviders";
import ConverseTab from "@/features/converse/components/ConverseTab";
import CorrectTab from "@/features/correct/components/CorrectTab";
import DiscoverTab from "@/features/discover/components/DiscoverTab";
import SettingsScreen from "@/features/settings/components/SettingsScreen";
import OnboardingDialog from "@/features/settings/components/OnboardingDialog";
import SpeechTab from "@/features/speech/components/SpeechTab";

function TabContent({ tab }: { tab: HomeTab }) {
  if (tab === "discover") return <DiscoverTab />;
  if (tab === "converse") return <ConverseTab />;
  if (tab === "correct") return <CorrectTab />;
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
        <div className="h-dvh overflow-hidden flex flex-col bg-surface">
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
                      className="max-w-5xl mx-auto px-4 py-5 sm:py-7"
                      initial={false}
                      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: TRAVEL }}
                      transition={springSoft}
                    >
                      <TabContent tab={item.id} />
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
