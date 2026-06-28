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
import { exportLocalBackup } from "@/lib/store/repository";
import { useT } from "@/i18n/I18nProvider";

type StatusTone = NonNullable<StatusPillProps["tone"]>;

const PROVIDER_COPY: Record<ProviderKind, string> = {
  ollama:
    "Private and on-device. Recommended for the default PhraseLoop experience.",
  claude:
    "Cloud AI from Anthropic. Your learning content is sent to Anthropic.",
  openai: "Cloud AI from OpenAI. Your learning content is sent to OpenAI.",
  openrouter:
    "Cloud AI routed through OpenRouter (default model openrouter/fusion). Your learning content is sent to OpenRouter.",
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

export default function SettingsScreen({
  onBack,
  onOpenTools,
}: {
  onBack: () => void;
  onOpenTools?: () => void;
}) {
  const { t } = useT();
  const { settings, loading, save, test, refresh } = useAiSettings();
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollama.baseUrl);
  const [ollamaModel, setOllamaModel] = useState(settings.ollama.model);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
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
        (result.ok ? t("Saved.") : t("Something went wrong.")),
    });
    setBusy(null);
  };

  const chooseDefault = (defaultProvider: string) =>
    run("default", () =>
      save({ defaultProvider: defaultProvider as ProviderKind }),
    );

  const downloadBackup = async () => {
    setBusy("backup");
    setNotice(null);
    try {
      const backup = await exportLocalBackup();
      const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `phraseloop-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice({ ok: true, text: t("Backup downloaded.") });
    } catch {
      setNotice({ ok: false, text: t("Could not export local data.") });
    } finally {
      setBusy(null);
    }
  };

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
    kind: "claude" | "openai" | "openrouter",
    key: string,
    setKey: (value: string) => void,
  ) => {
    const provider = settings.providers.find((item) => item.kind === kind);
    const keyField: "anthropicApiKey" | "openaiApiKey" | "openrouterApiKey" =
      kind === "claude" ? "anthropicApiKey" : kind === "openrouter" ? "openrouterApiKey" : "openaiApiKey";
    const shownStatus = provider ? renderedStatus(provider) : null;
    return (
      <Disclosure
        title={provider?.label ?? kind}
        description={t(PROVIDER_COPY[kind])}
        defaultOpen={settings.defaultProvider === kind}
        badge={
          shownStatus && (
            <StatusPill tone={shownStatus.tone}>{t(shownStatus.label)}</StatusPill>
          )
        }
      >
        <Field label={t("API key")} htmlFor={`${kind}-key`}>
          <Input
            id={`${kind}-key`}
            type="password"
            autoComplete="off"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={
              provider?.configured
                ? settings.storage === "system"
                  ? t("Saved securely — enter a new key to replace it")
                  : t("Saved locally — enter a new key to replace it")
                : t("Paste your API key")
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
            {t("Save key")}
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
            {t("Test connection")}
          </Button>
          {provider?.configured && (
            <Button
              variant="danger"
              disabled={!settings.writable || busy !== null}
              onClick={() => {
                if (
                  !window.confirm(
                    t("Remove the saved {provider} credential?", { provider: provider.label }),
                  )
                )
                  return;
                void run(`remove-${kind}`, () =>
                  save({ [keyField]: null } as AiSettingsPatch),
                );
              }}
            >
              {t("Remove key")}
            </Button>
          )}
        </div>
      </Disclosure>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex items-center gap-3">
        <IconButton onClick={onBack} aria-label={t("Back to PhraseLoop")}>
          ←
        </IconButton>
        <div>
          <h2 className="text-xl font-semibold text-ink">{t("Settings")}</h2>
          <p className="text-sm text-ink-muted">
            {t("Choose how PhraseLoop uses AI.")}
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
          {t("Settings are read-only in the browser. Configure providers with environment variables or open the desktop app.")}
        </Notice>
      )}

      <Card className="mb-4 p-5">
        <h3 className="font-medium text-ink">{t("Default AI provider")}</h3>
        <p className="mb-4 mt-1 text-sm text-ink-muted">
          {t("Ollama stays local. Cloud providers are never selected automatically.")}
        </p>
        <Select
          value={settings.defaultProvider}
          onChange={chooseDefault}
          options={settings.providers.map((provider) => ({
            value: provider.kind,
            label: `${provider.label}${provider.available ? "" : ` ${t("— unavailable")}`}`,
          }))}
          disabled={!settings.writable || loading || busy !== null}
        />
      </Card>

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-ink">{t("Local data")}</h3>
            <p className="mt-1 text-sm text-ink-muted">
              {t("Download a JSON backup of cards, reviews, plans, conversations, and source material.")}
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void downloadBackup()}
          >
            {busy === "backup" ? t("Exporting...") : t("Download backup")}
          </Button>
        </div>
      </Card>

      <Disclosure
        title="Ollama"
        description={t(PROVIDER_COPY.ollama)}
        defaultOpen={settings.defaultProvider === "ollama"}
        className="mb-3"
        badge={
          settings.providers[0] &&
          (() => {
            const shown = renderedStatus(settings.providers[0]);
            return <StatusPill tone={shown.tone}>{t(shown.label)}</StatusPill>;
          })()
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Server address")} htmlFor="ollama-url">
            <Input
              id="ollama-url"
              value={ollamaUrl}
              onChange={(event) => setOllamaUrl(event.target.value)}
              disabled={!settings.writable || busy !== null}
            />
          </Field>
          <Field label={t("Model")} htmlFor="ollama-model">
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
            {t("Save")}
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
            {t("Test connection")}
          </Button>
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void refresh()}
          >
            {t("Refresh models")}
          </Button>
        </div>
      </Disclosure>

      <div className="space-y-3">
        {cloudCard("openrouter", openrouterKey, setOpenrouterKey)}
        {cloudCard("claude", anthropicKey, setAnthropicKey)}
        {cloudCard("openai", openaiKey, setOpenaiKey)}
      </div>

      {onOpenTools && (
        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-ink">{t("Tools")}</h3>
              <p className="mt-1 text-sm text-ink-muted">
                {t("Text-to-speech, theme phrase decks, and JSON-to-Anki export.")}
              </p>
            </div>
            <Button variant="secondary" onClick={onOpenTools}>
              {t("Open tools")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
