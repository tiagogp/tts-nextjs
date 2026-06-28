"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HOME_TABS, type HomeTab } from "@/components/app/homeTabs";
import { getErrorEvents, getCounts } from "@/lib/store/repository";
import { isStoreAvailable } from "@/lib/store/db";
import { getLearningProfile, saveLearningProfile } from "@/features/settings/learningProfile";

export interface UnlockSignals {
  cards: number;
  reviews: number;
  errorEvents: number;
}

export const MAX_UNLOCK_TIER = 3;

export function computeUnlockedTabTier(signals: UnlockSignals, storedTier = 0): number {
  let tier = 0;
  if (signals.cards > 0) tier = 1;
  if (signals.reviews > 0) tier = 2;
  if (signals.errorEvents > 0) tier = 3;
  return Math.max(0, Math.min(MAX_UNLOCK_TIER, Math.max(storedTier, tier)));
}

export function tabsForUnlockTier(tier: number): HomeTab[] {
  const visible = new Set<HomeTab>(["hoje", "study"]);
  if (tier >= 1) visible.add("discover");
  if (tier >= 2) visible.add("speak");
  if (tier >= 3) visible.add("correct");
  return HOME_TABS.map((tab) => tab.id).filter((id) => visible.has(id));
}

function highestNewTab(previousTier: number, nextTier: number): HomeTab | null {
  if (nextTier <= previousTier) return null;
  if (nextTier >= 3 && previousTier < 3) return "correct";
  if (nextTier >= 2 && previousTier < 2) return "speak";
  if (nextTier >= 1 && previousTier < 1) return "discover";
  return null;
}

export function useUnlockedTabs(): {
  tabs: ReadonlyArray<(typeof HOME_TABS)[number]>;
  tier: number;
  announcement: HomeTab | null;
  clearAnnouncement: () => void;
} {
  const [tier, setTier] = useState(() => getLearningProfile().unlockedTabTier);
  const [announcement, setAnnouncement] = useState<HomeTab | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const profile = getLearningProfile();
      if (!isStoreAvailable()) {
        setTier(profile.unlockedTabTier);
        return;
      }

      const [counts, errors] = await Promise.all([getCounts(), getErrorEvents()]);
      if (cancelled) return;

      const nextTier = computeUnlockedTabTier(
        { cards: counts.cards, reviews: counts.reviews, errorEvents: errors.length },
        profile.unlockedTabTier,
      );
      const newlyUnlocked = highestNewTab(profile.unlockedTabTier, nextTier);
      if (nextTier > profile.unlockedTabTier) {
        saveLearningProfile({ unlockedTabTier: nextTier });
      }
      setTier(nextTier);
      if (newlyUnlocked) setAnnouncement(newlyUnlocked);
    };

    const handleRefresh = () => void refresh().catch(() => undefined);
    handleRefresh();
    window.addEventListener("phraseloop:activity", handleRefresh);
    window.addEventListener("phraseloop:lesson-saved", handleRefresh);
    window.addEventListener("phraseloop:profile-updated", handleRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener("phraseloop:activity", handleRefresh);
      window.removeEventListener("phraseloop:lesson-saved", handleRefresh);
      window.removeEventListener("phraseloop:profile-updated", handleRefresh);
    };
  }, []);

  const unlockedIds = useMemo(() => new Set(tabsForUnlockTier(tier)), [tier]);
  const tabs = useMemo(() => HOME_TABS.filter((tab) => unlockedIds.has(tab.id)), [unlockedIds]);
  const clearAnnouncement = useCallback(() => setAnnouncement(null), []);

  return {
    tabs,
    tier,
    announcement,
    clearAnnouncement,
  };
}
