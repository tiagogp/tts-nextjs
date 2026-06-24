"use client";

import { useState, useSyncExternalStore } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const subscribe = () => () => {};
const STORAGE_KEY = "phraseloop:onboarding:v1";

export default function OnboardingDialog({ onOpenSettings }: Readonly<{ onOpenSettings: () => void }>) {
  const [dismissed, setDismissed] = useState(false);
  const firstVisit = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(STORAGE_KEY) !== "done",
    () => false,
  );
  const open = firstVisit && !dismissed;

  const finish = (openSettings: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, "done");
    setDismissed(true);
    if (openSettings) onOpenSettings();
  };

  return (
    <Modal open={open} onClose={() => finish(false)} labelledBy="welcome-title">
      <p className="text-xs uppercase tracking-widest text-accent">Welcome</p>
      <h2 id="welcome-title" className="mt-1 text-xl font-semibold text-ink">
        Learn from content you actually watch
      </h2>
      <p className="mt-2 text-sm text-ink-soft">
        PhraseLoop turns real English content into study cards — locally, privately, in three steps.
      </p>

      <ol className="mt-5 space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
            1
          </span>
          <div>
            <p className="font-medium text-ink">Discover</p>
            <p className="mt-0.5 text-ink-soft">
              Paste a YouTube URL, article, or PDF. Whisper transcribes it and AI picks the phrases worth learning at your level.
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
            2
          </span>
          <div>
            <p className="font-medium text-ink">Generate cards</p>
            <p className="mt-0.5 text-ink-soft">
              AI turns those phrases into Anki flashcards with audio. Export them straight to your Anki deck.
            </p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
            3
          </span>
          <div>
            <p className="font-medium text-ink">Study</p>
            <p className="mt-0.5 text-ink-soft">
              Spaced repetition keeps phrases in memory. Weak spots are detected automatically so you practice what matters.
            </p>
          </div>
        </li>
      </ol>

      <p className="mt-5 text-xs text-ink-muted">
        Everything runs on your Mac — no data leaves your machine. Ollama is the recommended AI provider and is free.
      </p>

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => finish(false)}>
          Start with Discover
        </Button>
        <Button variant="primary" onClick={() => finish(true)}>
          Set up AI first →
        </Button>
      </div>
    </Modal>
  );
}
