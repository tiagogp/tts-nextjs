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
        Your first PhraseLoop
      </h2>
      <ol className="mt-5 space-y-3 text-sm text-ink-soft">
        <li>
          <strong>1. Pick a voice.</strong> Speech runs privately on your Mac.
        </li>
        <li>
          <strong>2. Connect Ollama.</strong> It is the default AI provider and keeps learning content local.
        </li>
        <li>
          <strong>3. Generate something.</strong> Start with Speech, or turn native material into study cards in
          Discover.
        </li>
      </ol>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => finish(false)}>
          Explore first
        </Button>
        <Button variant="primary" onClick={() => finish(true)}>
          Set up AI
        </Button>
      </div>
    </Modal>
  );
}
