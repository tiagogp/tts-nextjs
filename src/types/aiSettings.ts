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
    save: (patch: AiSettingsPatch) => Promise<{ ok: boolean; error?: string }>;
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
