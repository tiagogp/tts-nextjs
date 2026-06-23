"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ProviderKind } from "@/lib/cards/provider";
import type {
  AiSettingsPatch,
  PhraseLoopBridge,
  PublicAiSettings,
} from "@/types/aiSettings";
import { getAiSettingsBridge } from "@/platform/electron/bridge";

const EMPTY_SETTINGS: PublicAiSettings = {
  defaultProvider: "ollama",
  ollama: { baseUrl: "http://localhost:11434", model: "", models: [] },
  providers: [],
  writable: false,
};

interface AiSettingsValue {
  settings: PublicAiSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  save: (patch: AiSettingsPatch) => Promise<{ ok: boolean; error?: string }>;
  test: (
    provider: ProviderKind,
    draft?: AiSettingsPatch,
  ) => Promise<{ ok: boolean; detail: string }>;
}

const Context = createContext<AiSettingsValue | null>(null);

function bridge(): PhraseLoopBridge["aiSettings"] | undefined {
  return getAiSettingsBridge();
}

export function AiSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (!response.ok) throw new Error("Settings unavailable");
      setSettings((await response.json()) as PublicAiSettings);
    } catch {
      setSettings(EMPTY_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const save = useCallback(
    async (patch: AiSettingsPatch) => {
      const api = bridge();
      if (!api) return { ok: false, error: "Settings are read-only outside the desktop app." };
      const result = await api.save(patch);
      if (result.ok) await refresh();
      return result;
    },
    [refresh],
  );

  const test = useCallback(
    async (provider: ProviderKind, draft: AiSettingsPatch = {}) => {
      const api = bridge();
      if (!api) {
        return {
          ok: false,
          detail: "Connection tests are available in the desktop app.",
        };
      }
      return api.test(provider, draft);
    },
    [],
  );

  const value = useMemo(
    () => ({ settings, loading, refresh, save, test }),
    [settings, loading, refresh, save, test],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAiSettings(): AiSettingsValue {
  const value = useContext(Context);
  if (!value) throw new Error("useAiSettings must be used inside AiSettingsProvider");
  return value;
}
