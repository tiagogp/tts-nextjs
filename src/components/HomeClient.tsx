"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import CorrectTab from "@/components/CorrectTab";
import DiscoverTab from "@/components/DiscoverTab";
import { type HomeTab } from "@/components/homeTabs";
import SpeechTab from "@/components/SpeechTab";
import StudyTab from "@/components/StudyTab";
import { TtsSettingsProvider } from "@/components/TtsSettingsContext";

function ActiveTab({ tab }: { tab: HomeTab }) {
  if (tab === "discover") return <DiscoverTab />;
  if (tab === "correct") return <CorrectTab />;
  if (tab === "study") return <StudyTab />;
  return <SpeechTab />;
}

export default function HomeClient() {
  const [tab, setTab] = useState<HomeTab>("speech");

  return (
    <TtsSettingsProvider>
      <div
        className="min-h-screen"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <AppHeader activeTab={tab} onTabChange={setTab} />

        <main className="max-w-4xl mx-auto px-4 py-8">
          <ActiveTab tab={tab} />
        </main>
      </div>
    </TtsSettingsProvider>
  );
}
