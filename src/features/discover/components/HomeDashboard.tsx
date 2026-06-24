"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { isStoreAvailable } from "@/lib/store/db";
import {
  getConversations,
  getCounts,
  getReviews,
  type Conversation,
  type ReviewRecord,
} from "@/lib/store/repository";
import { computePerformance } from "@/lib/srs/analytics";

export function HomeDashboard({ onStart }: { onStart: () => void }) {
  const [counts, setCounts] = useState({ cards: 0, reviews: 0, due: 0 });
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!isStoreAvailable()) return;
    let cancelled = false;
    const load = async () => {
      const [nextCounts, nextReviews, nextConversations] = await Promise.all([
        getCounts(),
        getReviews(),
        getConversations(),
      ]);
      if (cancelled) return;
      setCounts(nextCounts);
      setReviews(nextReviews);
      setConversations(nextConversations);
      setNow(Date.now());
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = computePerformance(reviews, now || 0);
  const recentConversations = conversations.filter((item) => (now || item.startedAt) - item.startedAt < 7 * 86_400_000).length;

  return (
    <Card className="p-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Due today" value={String(counts.due)} />
          <Stat label="Cards" value={String(counts.cards)} />
          <Stat label="Streak" value={`${stats.streakDays}d`} />
          <Stat label="7d sessions" value={String(recentConversations)} />
        </div>
        <Button variant="primary" size="sm" onClick={onStart}>
          Start with Discover
        </Button>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-xs uppercase tracking-[0.7px] text-ink-muted">{label}</p>
    </div>
  );
}
