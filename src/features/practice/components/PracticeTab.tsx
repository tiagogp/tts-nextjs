"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import StudyTab from "@/features/study/components/StudyTab";
import ConverseTab from "@/features/converse/components/ConverseTab";

type PracticeView = "study" | "conversation";

export default function PracticeTab({
  onOpenSettings,
  onOpenDiscover,
}: {
  onOpenSettings?: () => void;
  onOpenDiscover?: () => void;
}) {
  const [view, setView] = useState<PracticeView>("study");

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Segmented<PracticeView>
          label="Practice mode"
          value={view}
          onChange={setView}
          options={[
            { value: "study", label: "Study" },
            { value: "conversation", label: "Conversation" },
          ]}
        />
      </div>
      {view === "study" ? (
        <StudyTab onDiscover={onOpenDiscover} />
      ) : (
        <ConverseTab onOpenSettings={onOpenSettings} />
      )}
    </div>
  );
}
