"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HOME_TABS, type HomeTab } from "@/components/app/homeTabs";
import { getCards, getErrorEvents, getCounts } from "@/lib/store/repository";
import { isStoreAvailable } from "@/lib/store/db";
import { getLearningProfile, saveLearningProfile } from "@/features/settings/learningProfile";
import { OWN_SENTENCE_CARD_PREFIX } from "@/features/learn/lessonDeck";
import { LEVEL_RANK } from "@/features/discover/levels";
import type { EnglishLevel } from "@/features/discover/types";

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

/**
 * Gates that are not about progress through the method. Unlike the tier, these can go both ways:
 * change the declared level or disconnect the provider and the tab goes away again.
 */
export interface TabGates {
  level?: EnglishLevel;
  /** Whether an LLM provider is actually configured and reachable. */
  hasEvaluator?: boolean;
}

export function tabsForUnlockTier(tier: number, gates: TabGates = {}): HomeTab[] {
  const visible = new Set<HomeTab>(["hoje", "discover", "study"]);
  // Speaking is the method's Rule #1: it gets a persistent home as soon as the
  // learner has anything to say a phrase from, not only when a coach routes there.
  if (tier >= 1) visible.add("speak");
  if (tier >= 3) visible.add("correct");
  // Conversation is its own tab only from C1: below that the bottleneck is still producing
  // language at all, which the Speak tab's drill serves better. It also needs a provider —
  // roleplay cannot run locally, and `speakSurface` sets the precedent of never routing a
  // provider-less learner to a dead end.
  if (gates.hasEvaluator && gates.level && LEVEL_RANK[gates.level] >= LEVEL_RANK.C1) visible.add("conversa");
  return HOME_TABS.map((tab) => tab.id).filter((id) => visible.has(id));
}

function highestNewTab(previousTier: number, nextTier: number): HomeTab | null {
  if (nextTier <= previousTier) return null;
  if (nextTier >= 3 && previousTier < 3) return "correct";
  if (nextTier >= 1 && previousTier < 1) return "speak";
  return null;
}

export function useUnlockedTabs({ hasEvaluator = false }: { hasEvaluator?: boolean } = {}): {
  tabs: ReadonlyArray<(typeof HOME_TABS)[number]>;
  tier: number;
  dueCount: number;
  announcement: HomeTab | null;
  clearAnnouncement: () => void;
} {
  // Seed 0 on server and client alike: the stored tier lives in localStorage, so
  // reading it during the first client render hydrates a different tab list than
  // the server sent (same mismatch HojeHome documents). The mount effect below
  // raises the tier immediately after hydration.
  const [tier, setTier] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [announcement, setAnnouncement] = useState<HomeTab | null>(null);
  // Seeded undefined for the same hydration reason as the tier; the mount effect fills it in,
  // and the `profile-updated` listener keeps it current when the learner changes level.
  const [level, setLevel] = useState<EnglishLevel | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const profile = getLearningProfile();
      setLevel(profile.level);
      if (!isStoreAvailable()) {
        setTier(profile.unlockedTabTier);
        setDueCount(0);
        return;
      }

      const [counts, errors, cards] = await Promise.all([getCounts(), getErrorEvents(), getCards()]);
      if (cancelled) return;

      const ownSentences = cards.filter((card) => card.id.startsWith(OWN_SENTENCE_CARD_PREFIX)).length;
      setDueCount(counts.due);
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
    window.addEventListener("phraseloop:backup-restored", handleRefresh);
    window.addEventListener("phraseloop:profile-updated", handleRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener("phraseloop:activity", handleRefresh);
      window.removeEventListener("phraseloop:lesson-saved", handleRefresh);
      window.removeEventListener("phraseloop:backup-restored", handleRefresh);
      window.removeEventListener("phraseloop:profile-updated", handleRefresh);
    };
  }, []);

  const unlockedIds = useMemo(
    () => new Set(tabsForUnlockTier(tier, { level, hasEvaluator })),
    [tier, level, hasEvaluator],
  );
  const tabs = useMemo(() => HOME_TABS.filter((tab) => unlockedIds.has(tab.id)), [unlockedIds]);
  const clearAnnouncement = useCallback(() => setAnnouncement(null), []);

  return {
    tabs,
    tier,
    dueCount,
    announcement,
    clearAnnouncement,
  };
}
