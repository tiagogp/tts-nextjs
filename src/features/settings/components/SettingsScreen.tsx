"use client";

import { useState } from "react";
import Select from "@/components/ui/Select";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import type { ProviderKind } from "@/lib/cards/provider";
import type { AiSettingsPatch, ProviderStatus } from "@/types/aiSettings";
import Disclosure from "@/components/ui/Disclosure";

const PROVIDER_COPY: Record<ProviderKind, string> = {
  ollama: "Private and on-device. Recommended for the default PhraseLoop experience.",
  claude: "Cloud AI from Anthropic. Your learning content is sent to Anthropic.",
  openai: "Cloud AI from OpenAI. Your learning content is sent to OpenAI.",
  local: "Offline keyword heuristics. It cannot evaluate free-form writing.",
};

function statusLabel(provider: ProviderStatus): string {
  if (provider.state === "connected") return "Connected";
  if (provider.state === "offline") return "Offline";
  if (provider.state === "invalid") return "Invalid key";
  if (provider.state === "testing") return "Testing";
  return "Not configured";
}

function statusColor(provider: ProviderStatus): string {
  if (provider.state === "connected") return "#1c8c3c";
  if (provider.state === "offline" || provider.state === "invalid") return "#c41c1c";
  return "var(--text-muted)";
}

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, loading, save, test, refresh } = useAiSettings();
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollama.baseUrl);
  const [ollamaModel, setOllamaModel] = useState(settings.ollama.model);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [testResults, setTestResults] = useState<Partial<Record<ProviderKind, boolean>>>({});

  const run = async (name: string, action: () => Promise<{ ok: boolean; error?: string; detail?: string }>) => {
    setBusy(name);
    setNotice(null);
    const result = await action();
    setNotice({ ok: result.ok, text: result.detail || result.error || (result.ok ? "Saved." : "Something went wrong.") });
    setBusy(null);
  };

  const chooseDefault = (defaultProvider: string) =>
    run("default", () => save({ defaultProvider: defaultProvider as ProviderKind }));

  const testConnection = async (kind: ProviderKind, draft: AiSettingsPatch = {}) => {
    setBusy(`test-${kind}`);
    setNotice(null);
    const result = await test(kind, draft);
    setTestResults((current) => ({ ...current, [kind]: result.ok }));
    setNotice({ ok: result.ok, text: result.detail });
    setBusy(null);
  };

  const renderedStatus = (provider: ProviderStatus) => {
    if (busy === `test-${provider.kind}`) return { label: "Testing", color: "var(--text-muted)" };
    if (testResults[provider.kind] === false) {
      return { label: provider.kind === "ollama" ? "Offline" : "Invalid key", color: "#c41c1c" };
    }
    if (testResults[provider.kind] === true) return { label: "Connected", color: "#1c8c3c" };
    return { label: statusLabel(provider), color: statusColor(provider) };
  };

  const cloudCard = (kind: "claude" | "openai", key: string, setKey: (value: string) => void) => {
    const provider = settings.providers.find((item) => item.kind === kind);
    const keyField = kind === "claude" ? "anthropicApiKey" : "openaiApiKey";
    const shownStatus = provider ? renderedStatus(provider) : null;
    return (
      <Disclosure
        title={provider?.label ?? kind}
        description={PROVIDER_COPY[kind]}
        defaultOpen={settings.defaultProvider === kind}
        badge={shownStatus && <span className="status-pill" style={{ color: shownStatus.color }}>{shownStatus.label}</span>}
      >
        <label className="field-label" htmlFor={`${kind}-key`}>API key</label>
        <input
          id={`${kind}-key`}
          type="password"
          autoComplete="off"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder={provider?.configured ? "Saved securely — enter a new key to replace it" : "Paste your API key"}
          className="app-field"
          disabled={!settings.writable || busy !== null}
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="secondary-button" disabled={!settings.writable || !key.trim() || busy !== null} onClick={() => run(`save-${kind}`, async () => {
            const result = await save({ [keyField]: key } as AiSettingsPatch);
            if (result.ok) setKey("");
            return result;
          })}>Save key</button>
          <button className="secondary-button" disabled={!settings.writable || busy !== null || (!key.trim() && !provider?.configured)} onClick={() => void testConnection(kind, key.trim() ? ({ [keyField]: key } as AiSettingsPatch) : {})}>Test connection</button>
          {provider?.configured && (
            <button className="danger-link" disabled={!settings.writable || busy !== null} onClick={() => {
              if (!window.confirm(`Remove the saved ${provider.label} credential?`)) return;
              void run(`remove-${kind}`, () => save({ [keyField]: null } as AiSettingsPatch));
            }}>Remove key</button>
          )}
        </div>
      </Disclosure>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 correct-tab-enter">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="icon-button" aria-label="Back to PhraseLoop">←</button>
        <div>
          <h2 className="text-xl font-semibold text-(--text-primary)">Settings</h2>
          <p className="text-sm text-(--text-muted)">Choose how PhraseLoop uses AI.</p>
        </div>
      </div>

      {notice && (
        <div className="app-notice mb-5" data-tone={notice.ok ? "success" : "error"} role="status">
          {notice.text}
        </div>
      )}

      {!settings.writable && !loading && (
        <div className="app-notice mb-5" role="note">
          Settings are read-only in the browser. Configure providers with environment variables or open the desktop app.
        </div>
      )}

      <section className="app-panel p-5 mb-4">
        <h3 className="font-medium text-(--text-primary)">Default AI provider</h3>
        <p className="text-sm mt-1 mb-4 text-(--text-muted)">Ollama stays local. Cloud providers are never selected automatically.</p>
        <Select
          value={settings.defaultProvider}
          onChange={chooseDefault}
          options={settings.providers.map((provider) => ({ value: provider.kind, label: `${provider.label}${provider.available ? "" : " — unavailable"}` }))}
          disabled={!settings.writable || loading || busy !== null}
        />
      </section>

      <Disclosure
        title="Ollama"
        description={PROVIDER_COPY.ollama}
        defaultOpen={settings.defaultProvider === "ollama"}
        className="mb-3"
        badge={settings.providers[0] && (() => {
            const shown = renderedStatus(settings.providers[0]);
            return <span className="status-pill" style={{ color: shown.color }}>{shown.label}</span>;
          })()}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="ollama-url">Server address</label>
            <input id="ollama-url" className="app-field" value={ollamaUrl} onChange={(event) => setOllamaUrl(event.target.value)} disabled={!settings.writable || busy !== null} />
          </div>
          <div>
            <label className="field-label" htmlFor="ollama-model">Model</label>
            {settings.ollama.models.length > 0 ? (
              <Select value={ollamaModel || settings.ollama.models[0]} onChange={setOllamaModel} options={settings.ollama.models.map((model) => ({ value: model, label: model }))} disabled={!settings.writable || busy !== null} />
            ) : (
              <input id="ollama-model" className="app-field" value={ollamaModel} onChange={(event) => setOllamaModel(event.target.value)} placeholder="llama3.1" disabled={!settings.writable || busy !== null} />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="secondary-button" disabled={!settings.writable || busy !== null} onClick={() => run("save-ollama", () => save({ ollamaBaseUrl: ollamaUrl, ollamaModel }))}>Save</button>
          <button className="secondary-button" disabled={!settings.writable || busy !== null} onClick={() => void testConnection("ollama", { ollamaBaseUrl: ollamaUrl, ollamaModel })}>Test connection</button>
          <button className="secondary-button" disabled={busy !== null} onClick={() => void refresh()}>Refresh models</button>
        </div>
      </Disclosure>

      <div className="space-y-3">
        {cloudCard("claude", anthropicKey, setAnthropicKey)}
        {cloudCard("openai", openaiKey, setOpenaiKey)}
      </div>

      <section className="mt-3 px-4 py-3 flex items-center justify-between gap-4 rounded-lg border border-(--border)">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium text-(--text-primary)">Local heuristic</h3>
            <p className="text-xs mt-0.5 text-(--text-muted)">Offline fallback for basic card generation.</p>
          </div>
        </div>
        <span className="status-pill" style={{ color: "#1c8c3c" }}>Available</span>
      </section>
    </div>
  );
}
