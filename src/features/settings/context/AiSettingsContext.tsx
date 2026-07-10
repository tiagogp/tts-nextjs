"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ProviderKind } from "@/lib/cards/provider";
import type {
  AiSettingsPatch,
  AiSettingsSaveResult,
  PhraseLoopBridge,
  PublicAiSettings,
} from "@/types/aiSettings";
import { getAiSettingsBridge } from "@/platform/electron/bridge";

const EMPTY_SETTINGS: PublicAiSettings = {
  defaultProvider: "ollama",
  ollama: { baseUrl: "http://localhost:11434", model: "", models: [] },
  providers: [],
  writable: false,
  storage: "readonly",
  version: 0,
};

interface AiSettingsValue {
  settings: PublicAiSettings;
  loading: boolean;
  refresh: () => Promise<void>;
  save: (patch: AiSettingsPatch) => Promise<AiSettingsSaveResult>;
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
  const latestVersionRef = useRef(EMPTY_SETTINGS.version);
  const minimumVersionRef = useRef(EMPTY_SETTINGS.version);
  // Prevents focus/visibility refreshes from overwriting settings while a save is in flight.
  const saveInflightRef = useRef(false);

  const applySettings = useCallback((next: PublicAiSettings, minimumVersion = minimumVersionRef.current) => {
    if (next.version < minimumVersion || next.version < latestVersionRef.current) return false;
    latestVersionRef.current = next.version;
    setSettings(next);
    return true;
  }, []);

  const refreshWithOptions = useCallback(async ({
    allowDuringSave = false,
    minimumVersion,
  }: { allowDuringSave?: boolean; minimumVersion?: number } = {}) => {
    if (saveInflightRef.current && !allowDuringSave) return;
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (!response.ok) throw new Error("Settings unavailable");
      if (saveInflightRef.current && !allowDuringSave) return;
      applySettings((await response.json()) as PublicAiSettings, minimumVersion);
    } catch {
      if (!saveInflightRef.current) {
        latestVersionRef.current = EMPTY_SETTINGS.version;
        minimumVersionRef.current = EMPTY_SETTINGS.version;
        setSettings(EMPTY_SETTINGS);
      }
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  const refresh = useCallback(() => refreshWithOptions(), [refreshWithOptions]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const refreshVisible = () => {
      if (saveInflightRef.current) return;
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [refresh]);

  const save = useCallback(
    async (patch: AiSettingsPatch) => {
      saveInflightRef.current = true;
      try {
        const api = bridge();
        if (api) {
          const result = await api.save(patch);
          if (result.ok) {
            const minimumVersion = typeof result.version === "number" ? result.version : minimumVersionRef.current;
            minimumVersionRef.current = Math.max(minimumVersionRef.current, minimumVersion);
            await refreshWithOptions({ allowDuringSave: true, minimumVersion });
          }
          return result;
        }
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const result = (await response.json()) as AiSettingsSaveResult;
        if (result.ok) {
          const minimumVersion = typeof result.version === "number" ? result.version : minimumVersionRef.current;
          minimumVersionRef.current = Math.max(minimumVersionRef.current, minimumVersion);
          await refreshWithOptions({ allowDuringSave: true, minimumVersion });
        }
        return result;
      } catch {
        return { ok: false, error: "Could not save settings." };
      } finally {
        saveInflightRef.current = false;
      }
    },
    [refreshWithOptions],
  );

  const test = useCallback(
    async (provider: ProviderKind, draft: AiSettingsPatch = {}) => {
      const api = bridge();
      if (api) return api.test(provider, draft);
      try {
        const response = await fetch("/api/settings/test", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider, ...draft }),
        });
        const result = (await response.json()) as { ok: boolean; detail?: string };
        return { ok: result.ok, detail: result.detail ?? "Done." };
      } catch {
        return { ok: false, detail: "Could not reach the backend." };
      }
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
