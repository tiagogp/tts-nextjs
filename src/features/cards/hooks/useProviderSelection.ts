"use client";

import { useState } from "react";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import type { ProviderKind } from "@/lib/cards/provider";
import type { ProviderStatus } from "@/types/aiSettings";

export interface ProviderSelection {
  /** All providers the user has configured (read from settings). */
  providers: ProviderStatus[];
  /** Effective provider after override + (optional) evaluator fallback. */
  provider: ProviderKind;
  /** The ProviderStatus matching `provider`, if any. */
  activeProvider: ProviderStatus | undefined;
  /** True when `activeProvider` is available. */
  providerReady: boolean;
  /** Installed Ollama models (empty when Ollama is offline). */
  ollamaModels: string[];
  /** Effective model: the user's pick if still installed, else the default/first. */
  selectedModel: string;
  /** Whether to show the Ollama model picker. */
  showModelPicker: boolean;
  /** Only meaningful with `fallbackToEvaluator`: a model-backed provider is ready. */
  hasEvaluator: boolean;
  /** The user's explicit override, or null to follow the default. */
  providerOverride: ProviderKind | null;
  setProviderOverride: (kind: ProviderKind) => void;
  /** The user's Ollama model pick (may be stale; use `selectedModel` to act). */
  ollamaModel: string;
  setOllamaModel: (model: string) => void;
}

/**
 * Centralizes the provider/model derivation shared by the Discover and Correct tabs.
 *
 * `fallbackToEvaluator` turns on the Correct-tab behavior: the Local heuristic can't judge free
 * text, so when the default resolves to Local (and the user hasn't explicitly overridden), fall
 * back to the first model-backed provider that's available.
 */
export function useProviderSelection({
  fallbackToEvaluator = false,
}: { fallbackToEvaluator?: boolean } = {}): ProviderSelection {
  const { settings } = useAiSettings();
  const [providerOverride, setProviderOverride] = useState<ProviderKind | null>(null);
  const [ollamaModel, setOllamaModel] = useState("");

  const providers = settings.providers;

  // Ignore a stale override during render: if the provider the user picked is gone or has
  // become unavailable (settings changed, Ollama went offline), fall back to the default
  // instead of leaving the tab stuck on a dead provider it can never generate with. Derived
  // rather than reset-in-an-effect so there's no cascading render; the stored value is never
  // used directly, so it doesn't matter that it stays set.
  const overrideMatch = providerOverride
    ? providers.find((item) => item.kind === providerOverride)
    : undefined;
  const effectiveOverride = overrideMatch?.available ? providerOverride : null;

  const requestedProvider = effectiveOverride ?? settings.defaultProvider;
  const fallbackEvaluator = providers.find(
    (item) => item.kind !== "local" && item.available,
  )?.kind;
  const provider =
    fallbackToEvaluator && requestedProvider === "local" && effectiveOverride == null
      ? (fallbackEvaluator ?? requestedProvider)
      : requestedProvider;

  const activeProvider = providers.find((item) => item.kind === provider);
  const providerReady = activeProvider?.available === true;
  const hasEvaluator = fallbackToEvaluator && provider !== "local" && providerReady;

  const ollamaModels = settings.ollama.models;
  // Effective choice: the user's pick if still installed, else default to the first model.
  // Derived (not stored) so we never sync state in an effect.
  const selectedModel =
    ollamaModel && ollamaModels.includes(ollamaModel)
      ? ollamaModel
      : settings.ollama.model || ollamaModels[0] || "";
  const showModelPicker = provider === "ollama" && ollamaModels.length > 0;

  return {
    providers,
    provider,
    activeProvider,
    providerReady,
    ollamaModels,
    selectedModel,
    showModelPicker,
    hasEvaluator,
    providerOverride: effectiveOverride,
    setProviderOverride,
    ollamaModel,
    setOllamaModel,
  };
}
