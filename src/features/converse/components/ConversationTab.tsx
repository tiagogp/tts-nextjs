"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/I18nProvider";
import ConverseTab from "@/features/converse/components/ConverseTab";
import { ADVANCED_CONVERSATION_SCENARIOS } from "@/features/converse/constants";

/**
 * The C1-C2 conversation surface. At this level the learner can already sustain a conversation,
 * so the constraint is repertoire, not fluency — this opens on a free-text topic, defaults to
 * hands-free free talk, and collects the expressions the partner introduces.
 *
 * Deliberately thin: all of the mechanics (turn-taking, VAD, TTS, persistence, post-session
 * review) are `ConverseTab`'s, which also still serves the Speak tab for everyone below C1.
 */
export default function ConversationTab({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { t } = useT();
  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Conversation")}
        description={t("Talk about whatever you want. Your partner works in expressions worth stealing.")}
      />
      <ConverseTab
        onOpenSettings={onOpenSettings}
        scenarios={ADVANCED_CONVERSATION_SCENARIOS}
        topicFirst
        defaultFreeTalk
      />
    </div>
  );
}
