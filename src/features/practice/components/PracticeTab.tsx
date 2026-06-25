"use client";

import { Segmented } from "@/components/ui/Segmented";
import StudyTab from "@/features/study/components/StudyTab";
import ConverseTab from "@/features/converse/components/ConverseTab";

type PracticeView = "study" | "conversation";

export default function PracticeTab({
  onOpenSettings,
  onOpenDiscover,
  view,
  onViewChange,
}: {
  onOpenSettings?: () => void;
  onOpenDiscover?: () => void;
  view: PracticeView;
  onViewChange: (view: PracticeView) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[-0.01em] text-ink">Practice loop</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Review what is due, then use conversation when you want new mistakes to learn from.
          </p>
        </div>
        <Segmented<PracticeView>
          label="Practice mode"
          value={view}
          onChange={onViewChange}
          options={[
            { value: "study", label: "Study" },
            { value: "conversation", label: "Conversation" },
          ]}
        />
      </div>
      {view === "study" ? (
        <StudyTab onDiscover={onOpenDiscover} onConversation={() => onViewChange("conversation")} />
      ) : (
        <ConverseTab onOpenSettings={onOpenSettings} />
      )}
    </div>
  );
}
