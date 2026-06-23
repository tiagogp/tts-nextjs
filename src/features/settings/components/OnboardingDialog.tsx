"use client";

import { useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};
const STORAGE_KEY = "phraseloop:onboarding:v1";

export default function OnboardingDialog({ onOpenSettings }: Readonly<{ onOpenSettings: () => void }>) {
  const [dismissed, setDismissed] = useState(false);
  const firstVisit = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(STORAGE_KEY) !== "done",
    () => false,
  );
  if (!firstVisit || dismissed) return null;

  const finish = (openSettings: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, "done");
    setDismissed(true);
    if (openSettings) onOpenSettings();
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <p className="text-xs uppercase tracking-widest text-(--accent)">Welcome</p>
        <h2 id="welcome-title" className="text-xl font-semibold mt-1 text-(--text-primary)">Your first PhraseLoop</h2>
        <ol className="mt-5 space-y-3 text-sm text-(--text-secondary)">
          <li><strong>1. Pick a voice.</strong> Speech runs privately on your Mac.</li>
          <li><strong>2. Connect Ollama.</strong> It is the default AI provider and keeps learning content local.</li>
          <li><strong>3. Generate something.</strong> Start with Speech, or turn native material into study cards in Discover.</li>
        </ol>
        <div className="flex flex-wrap justify-end gap-2 mt-6">
          <button className="secondary-button" onClick={() => finish(false)}>Explore first</button>
          <button className="primary-button" onClick={() => finish(true)}>Set up AI</button>
        </div>
      </section>
    </div>
  );
}
