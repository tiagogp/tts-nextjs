"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HOME_TABS, type HomeTab } from "@/components/app/homeTabs";
import { getCards, getErrorEvents, getCounts } from "@/lib/store/repository";
import { isStoreAvailable } from "@/lib/store/db";
import { getLearningProfile, saveLearningProfile } from "@/features/settings/learningProfile";
import { OWN_SENTENCE_CARD_PREFIX } from "@/features/learn/lessonDeck";

export interface UnlockSignals {
  cards: number;
  reviews: number;
  errorEvents: number;
  /**
   * Own sentences written at the end of the lesson loop. Counts toward tier 3 so
   * a learner whose first sentence had nothing to fix (no ErrorEvent) still
   * unlocks Correct and the AI settings.
   */
  ownSentences?: number;
}

export const MAX_UNLOCK_TIER = 3;

export function computeUnlockedTabTier(signals: UnlockSignals, storedTier = 0): number {
  let tier = 0;
  if (signals.cards > 0) tier = 1;
  if (signals.reviews > 0) tier = 2;
  if (signals.errorEvents > 0 || (signals.ownSentences ?? 0) > 0) tier = 3;
  return Math.max(0, Math.min(MAX_UNLOCK_TIER, Math.max(storedTier, tier)));
}

export function tabsForUnlockTier(tier: number): HomeTab[] {
  const visible = new Set<HomeTab>(["hoje", "discover", "study"]);
  if (tier >= 3) visible.add("correct");
  return HOME_TABS.map((tab) => tab.id).filter((id) => visible.has(id));
}

function highestNewTab(previousTier: number, nextTier: number): HomeTab | null {
  if (nextTier <= previousTier) return null;
  if (nextTier >= 3 && previousTier < 3) return "correct";
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

      const [counts, errors, cards] = await Promise.all([getCounts(), getErrorEvents(), getCards()]);
      if (cancelled) return;

      const ownSentences = cards.filter((card) => card.id.startsWith(OWN_SENTENCE_CARD_PREFIX)).length;
      const nextTier = computeUnlockedTabTier(
        { cards: counts.cards, reviews: counts.reviews, errorEvents: errors.length, ownSentences },
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
