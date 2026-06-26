"use client";

import Select from "@/components/ui/Select";
import ProviderBadge from "@/components/ui/ProviderBadge";
import type { ProviderKind } from "@/lib/cards/provider";
import type { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";

type Selection = ReturnType<typeof useProviderSelection>;

/** AI provider + Ollama model pickers, shared by Discover and Correct. */
export function ProviderPicker({ selection, disabled }: { selection: Selection; disabled?: boolean }) {
  const {
    providers,
    provider,
    activeProvider,
    ollamaModels,
    selectedModel,
    showModelPicker,
    setProviderOverride,
    setOllamaModel,
  } = selection;

  const selectableProviders = providers;
  const selectValue = provider;

  if (selectableProviders.length <= 1 && !showModelPicker) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
      {selectableProviders.length > 1 && (
        <div className="grid grid-rows-[1.625rem_auto] gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <label className="text-xs font-medium text-ink-muted">AI provider</label>
            {activeProvider && <ProviderBadge isLocal={activeProvider.isLocal} available={activeProvider.available} />}
          </div>
          <Select
            value={selectValue}
            onChange={(value) => setProviderOverride(value as ProviderKind)}
            options={selectableProviders.map((entry) => ({
              value: entry.kind,
              label: `${entry.label}${entry.available ? "" : " — unavailable"}`,
            }))}
            disabled={disabled}
          />
        </div>
      )}

      {showModelPicker && (
        <div className="grid grid-rows-[1.625rem_auto] gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <label className="text-xs font-medium text-ink-muted">Ollama model</label>
          </div>
          <Select
            value={selectedModel}
            onChange={setOllamaModel}
            options={ollamaModels.map((model) => ({ value: model, label: model }))}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
