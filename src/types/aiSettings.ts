import type { ProviderKind } from "@/lib/cards/provider";

export type AiConnectionState =
  | "connected"
  | "not_configured"
  | "offline"
  | "invalid"
  | "testing";

export interface ProviderStatus {
  kind: ProviderKind;
  label: string;
  available: boolean;
  isLocal: boolean;
  configured: boolean;
  state: AiConnectionState;
  detail?: string;
}

export interface PublicAiSettings {
  defaultProvider: ProviderKind;
  ollama: {
    baseUrl: string;
    model: string;
    models: string[];
  };
  providers: ProviderStatus[];
  writable: boolean;
  storage: "system" | "local-file" | "readonly";
  /** Monotonic counter bumped on every server-side settings write. */
  version: number;
}

export interface SecureAiSettings {
  defaultProvider?: ProviderKind;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
}

export interface AiSettingsPatch {
  defaultProvider?: ProviderKind;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  anthropicApiKey?: string | null;
  openaiApiKey?: string | null;
}

export interface AiSettingsSaveResult {
  ok: boolean;
  error?: string;
  /** Server-confirmed settings version after a successful write. */
  version?: number;
}

export interface PhraseLoopBridge {
  toggleFullscreen: () => void;
  files?: {
    saveApkg: (
      filename: string,
      base64: string,
    ) => Promise<{ ok: boolean; path?: string; error?: string }>;
    revealApkgDebugLog: () => Promise<{ ok: boolean; path?: string; error?: string }>;
    getApkgDebugInfo: () => Promise<{
      ok: boolean;
      path?: string;
      exists?: boolean;
      size?: number;
      error?: string;
    }>;
  };
  aiSettings?: {
    save: (patch: AiSettingsPatch) => Promise<AiSettingsSaveResult>;
    test: (
      provider: ProviderKind,
      draft?: Pick<AiSettingsPatch, "ollamaBaseUrl" | "ollamaModel" | "anthropicApiKey" | "openaiApiKey">,
    ) => Promise<{ ok: boolean; detail: string }>;
  };
}

declare global {
  interface Window {
    phraseLoop?: PhraseLoopBridge;
  }
}
