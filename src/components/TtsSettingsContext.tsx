"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type KokoroVoice =
  | "af_heart"
  | "af_bella"
  | "af_sarah"
  | "af_nicole"
  | "am_adam"
  | "am_michael"
  | "bf_emma"
  | "bm_george";

export const KOKORO_VOICE_OPTIONS: { value: KokoroVoice; label: string }[] = [
  { value: "af_heart", label: "Heart (US Female)" },
  { value: "af_bella", label: "Bella (US Female)" },
  { value: "af_sarah", label: "Sarah (US Female)" },
  { value: "af_nicole", label: "Nicole (US Female)" },
  { value: "am_adam", label: "Adam (US Male)" },
  { value: "am_michael", label: "Michael (US Male)" },
  { value: "bf_emma", label: "Emma (UK Female)" },
  { value: "bm_george", label: "George (UK Male)" },
];

export function toKokoroVoice(v: string): KokoroVoice {
  const found = KOKORO_VOICE_OPTIONS.find((o) => o.value === (v as KokoroVoice));
  return found?.value ?? "af_heart";
}

type TtsSettings = {
  engine: "kokoro";
  voice: KokoroVoice;
  setVoice: (voice: KokoroVoice) => void;
};

const Ctx = createContext<TtsSettings | null>(null);

export function TtsSettingsProvider({ children }: { children: React.ReactNode }) {
  const [voice, setVoice] = useState<KokoroVoice>("af_heart");

  const value = useMemo<TtsSettings>(() => {
    return { engine: "kokoro", voice, setVoice };
  }, [voice]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTtsSettings(): TtsSettings {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTtsSettings must be used within TtsSettingsProvider");
  return v;
}
