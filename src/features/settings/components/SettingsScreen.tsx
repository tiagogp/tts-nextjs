"use client";

import { useState } from "react";
import Select from "@/components/ui/Select";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import type { ProviderKind } from "@/lib/cards/provider";
import type { AiSettingsPatch, ProviderStatus } from "@/types/aiSettings";
import Disclosure from "@/components/ui/Disclosure";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Notice } from "@/components/ui/Notice";
import { StatusPill, type StatusPillProps } from "@/components/ui/StatusPill";

type StatusTone = NonNullable<StatusPillProps["tone"]>;

const PROVIDER_COPY: Record<ProviderKind, string> = {
  ollama:
    "Private and on-device. Recommended for the default PhraseLoop experience.",
  claude:
    "Cloud AI from Anthropic. Your learning content is sent to Anthropic.",
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

function statusTone(provider: ProviderStatus): StatusTone {
  if (provider.state === "connected") return "success";
  if (provider.state === "offline" || provider.state === "invalid")
    return "danger";
  return "default";
}

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, loading, save, test, refresh } = useAiSettings();
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollama.baseUrl);
  const [ollamaModel, setOllamaModel] = useState(settings.ollama.model);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [testResults, setTestResults] = useState<
    Partial<Record<ProviderKind, boolean>>
  >({});

  const run = async (
    name: string,
    action: () => Promise<{ ok: boolean; error?: string; detail?: string }>,
  ) => {
    setBusy(name);
    setNotice(null);
    const result = await action();
    setNotice({
      ok: result.ok,
      text:
        result.detail ||
        result.error ||
        (result.ok ? "Saved." : "Something went wrong."),
    });
    setBusy(null);
  };

  const chooseDefault = (defaultProvider: string) =>
    run("default", () =>
      save({ defaultProvider: defaultProvider as ProviderKind }),
    );

  const testConnection = async (
    kind: ProviderKind,
    draft: AiSettingsPatch = {},
  ) => {
    setBusy(`test-${kind}`);
    setNotice(null);
    const result = await test(kind, draft);
    setTestResults((current) => ({ ...current, [kind]: result.ok }));
    setNotice({ ok: result.ok, text: result.detail });
    setBusy(null);
  };

  const renderedStatus = (
    provider: ProviderStatus,
  ): { label: string; tone: StatusTone } => {
    if (busy === `test-${provider.kind}`)
      return { label: "Testing", tone: "default" };
    if (testResults[provider.kind] === false) {
      return {
        label: provider.kind === "ollama" ? "Offline" : "Invalid key",
        tone: "danger",
      };
    }
    if (testResults[provider.kind] === true)
      return { label: "Connected", tone: "success" };
    return { label: statusLabel(provider), tone: statusTone(provider) };
  };

  const cloudCard = (
    kind: "claude" | "openai",
    key: string,
    setKey: (value: string) => void,
  ) => {
    const provider = settings.providers.find((item) => item.kind === kind);
    const keyField = kind === "claude" ? "anthropicApiKey" : "openaiApiKey";
    const shownStatus = provider ? renderedStatus(provider) : null;
    return (
      <Disclosure
        title={provider?.label ?? kind}
        description={PROVIDER_COPY[kind]}
        defaultOpen={settings.defaultProvider === kind}
        badge={
          shownStatus && (
            <StatusPill tone={shownStatus.tone}>{shownStatus.label}</StatusPill>
          )
        }
      >
        <Field label="API key" htmlFor={`${kind}-key`}>
          <Input
            id={`${kind}-key`}
            type="password"
            autoComplete="off"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={
              provider?.configured
                ? settings.storage === "system"
                  ? "Saved securely — enter a new key to replace it"
                  : "Saved locally — enter a new key to replace it"
                : "Paste your API key"
            }
            disabled={!settings.writable || busy !== null}
          />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!settings.writable || !key.trim() || busy !== null}
            onClick={() =>
              run(`save-${kind}`, async () => {
                const result = await save({
                  [keyField]: key,
                } as AiSettingsPatch);
                if (result.ok) setKey("");
                return result;
              })
            }
          >
            Save key
          </Button>
          <Button
            variant="secondary"
            disabled={
              !settings.writable ||
              busy !== null ||
              (!key.trim() && !provider?.configured)
            }
            onClick={() =>
              void testConnection(
                kind,
                key.trim() ? ({ [keyField]: key } as AiSettingsPatch) : {},
              )
            }
          >
            Test connection
          </Button>
          {provider?.configured && (
            <Button
              variant="danger"
              disabled={!settings.writable || busy !== null}
              onClick={() => {
                if (
                  !window.confirm(
                    `Remove the saved ${provider.label} credential?`,
                  )
                )
                  return;
                void run(`remove-${kind}`, () =>
                  save({ [keyField]: null } as AiSettingsPatch),
                );
              }}
            >
              Remove key
            </Button>
          )}
        </div>
      </Disclosure>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex items-center gap-3">
        <IconButton onClick={onBack} aria-label="Back to PhraseLoop">
          ←
        </IconButton>
        <div>
          <h2 className="text-xl font-semibold text-ink">Settings</h2>
          <p className="text-sm text-ink-muted">
            Choose how PhraseLoop uses AI.
          </p>
        </div>
      </div>

      {notice && (
        <Notice
          tone={notice.ok ? "success" : "error"}
          role="status"
          className="mb-5"
        >
          {notice.text}
        </Notice>
      )}

      {!settings.writable && !loading && (
        <Notice role="note" className="mb-5">
          Settings are read-only in the browser. Configure providers with
          environment variables or open the desktop app.
        </Notice>
      )}

      <Card className="mb-4 p-5">
        <h3 className="font-medium text-ink">Default AI provider</h3>
        <p className="mb-4 mt-1 text-sm text-ink-muted">
          Ollama stays local. Cloud providers are never selected automatically.
        </p>
        <Select
          value={settings.defaultProvider}
          onChange={chooseDefault}
          options={settings.providers.map((provider) => ({
            value: provider.kind,
            label: `${provider.label}${provider.available ? "" : " — unavailable"}`,
          }))}
          disabled={!settings.writable || loading || busy !== null}
        />
      </Card>

      <Disclosure
        title="Ollama"
        description={PROVIDER_COPY.ollama}
        defaultOpen={settings.defaultProvider === "ollama"}
        className="mb-3"
        badge={
          settings.providers[0] &&
          (() => {
            const shown = renderedStatus(settings.providers[0]);
            return <StatusPill tone={shown.tone}>{shown.label}</StatusPill>;
          })()
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Server address" htmlFor="ollama-url">
            <Input
              id="ollama-url"
              value={ollamaUrl}
              onChange={(event) => setOllamaUrl(event.target.value)}
              disabled={!settings.writable || busy !== null}
            />
          </Field>
          <Field label="Model" htmlFor="ollama-model">
            {settings.ollama.models.length > 0 ? (
              <Select
                value={ollamaModel || settings.ollama.models[0]}
                onChange={setOllamaModel}
                options={settings.ollama.models.map((model) => ({
                  value: model,
                  label: model,
                }))}
                disabled={!settings.writable || busy !== null}
              />
            ) : (
              <Input
                id="ollama-model"
                value={ollamaModel}
                onChange={(event) => setOllamaModel(event.target.value)}
                placeholder="llama3.1"
                disabled={!settings.writable || busy !== null}
              />
            )}
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!settings.writable || busy !== null}
            onClick={() =>
              run("save-ollama", () =>
                save({ ollamaBaseUrl: ollamaUrl, ollamaModel }),
              )
            }
          >
            Save
          </Button>
          <Button
            variant="secondary"
            disabled={!settings.writable || busy !== null}
            onClick={() =>
              void testConnection("ollama", {
                ollamaBaseUrl: ollamaUrl,
                ollamaModel,
              })
            }
          >
            Test connection
          </Button>
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void refresh()}
          >
            Refresh models
          </Button>
        </div>
      </Disclosure>

      <div className="space-y-3">
        {cloudCard("claude", anthropicKey, setAnthropicKey)}
        {cloudCard("openai", openaiKey, setOpenaiKey)}
      </div>

      <section className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-line px-4 py-3">
        <div>
          <h3 className="font-medium text-ink">Local heuristic</h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Offline fallback for basic card generation.
          </p>
        </div>
        <StatusPill tone="success">Available</StatusPill>
      </section>
    </div>
  );
}
