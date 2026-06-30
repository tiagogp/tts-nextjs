"use client";

import { useRef, useState } from "react";
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
import {
  exportLocalBackup,
  restoreLocalBackup,
  validateLocalBackup,
  type BackupValidationResult,
} from "@/lib/store/repository";
import type { StoreName } from "@/lib/store/db";
import W5ValidationCard from "@/features/settings/components/W5ValidationCard";
import { useT } from "@/i18n/I18nProvider";

type StatusTone = NonNullable<StatusPillProps["tone"]>;

const PROVIDER_COPY: Record<ProviderKind, string> = {
  ollama:
    "Private and on-device. Optional for custom content.",
  claude:
    "Cloud IA from Anthropic. Your learning content is sent to Anthropic.",
  openai: "Cloud IA from OpenAI. Your learning content is sent to OpenAI.",
  openrouter:
    "Cloud IA routed through OpenRouter (default model openrouter/fusion). Your learning content is sent to OpenRouter.",
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
  showAdvancedAi = true,
}: {
  onBack: () => void;
  onOpenTools?: () => void;
  showAdvancedAi?: boolean;
}) {
  const { t } = useT();
  const { settings, loading, save, test, refresh } = useAiSettings();
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
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
  const [restoreDraft, setRestoreDraft] = useState<{
    fileName: string;
    raw: unknown;
    validation: BackupValidationResult;
  } | null>(null);

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

  const readBackupFile = async (file: File) => {
    setBusy("restore-read");
    setNotice(null);
    setRestoreDraft(null);
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const validation = validateLocalBackup(raw);
      setRestoreDraft({ fileName: file.name, raw, validation });
      setNotice({
        ok: validation.ok,
        text: validation.ok
          ? t("Backup validated. Review the dry run before restoring.")
          : validation.errors[0] ?? t("Backup could not be validated."),
      });
    } catch {
      setNotice({ ok: false, text: t("Could not read this backup file.") });
    } finally {
      setBusy(null);
    }
  };

  const restoreBackup = async () => {
    if (!restoreDraft?.validation.ok) return;
    if (
      !window.confirm(
        t("Restore this backup? Matching records will be updated, and nothing will be deleted."),
      )
    ) {
      return;
    }
    setBusy("restore");
    setNotice(null);
    try {
      const result = await restoreLocalBackup(restoreDraft.raw);
      if (!result.ok) {
        setNotice({ ok: false, text: result.errors[0] ?? t("Backup could not be restored.") });
        return;
      }
      setRestoreDraft(null);
      setNotice({
        ok: true,
        text: t("{count} records restored.", { count: result.totalRecords }),
      });
    } catch {
      setNotice({ ok: false, text: t("Could not restore local data.") });
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
        nested
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
            {showAdvancedAi
              ? t("Manage local data, advanced AI, and export tools.")
              : t("Manage your local PhraseLoop data.")}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-ink">{t("Local data")}</h3>
            <p className="mt-1 text-sm text-ink-muted">
              {t("Back up or restore practice phrases, reviews, and source material.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => void downloadBackup()}
            >
              {busy === "backup" ? t("Exporting...") : t("Download backup")}
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => restoreInputRef.current?.click()}
            >
              {t("Validate restore")}
            </Button>
          </div>
        </div>
        <input
          ref={restoreInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void readBackupFile(file);
          }}
        />
        {restoreDraft && (
          <div className="mt-4 rounded-lg border border-line bg-surface p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{restoreDraft.fileName}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {restoreDraft.validation.ok
                    ? t("Dry run passed: {count} records can be restored.", {
                        count: restoreDraft.validation.totalRecords,
                      })
                    : t("Dry run failed. Fix the backup file before restoring.")}
                </p>
                {restoreDraft.validation.exportedAt && (
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {t("Exported at {date}", { date: restoreDraft.validation.exportedAt })}
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={!restoreDraft.validation.ok || busy !== null}
                onClick={() => void restoreBackup()}
              >
                {busy === "restore" ? t("Restoring...") : t("Restore backup")}
              </Button>
            </div>
            <BackupCounts counts={restoreDraft.validation.counts} />
            {restoreDraft.validation.errors.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-danger">
                {restoreDraft.validation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            {restoreDraft.validation.ok && (
              <p className="mt-3 text-xs text-ink-muted">
                {t("Restore adds or updates matching records by ID. It does not delete anything currently in PhraseLoop.")}
              </p>
            )}
          </div>
        )}
      </Card>

      {showAdvancedAi && (
        <Disclosure
          title={t("Advanced AI for custom content")}
          description={t("Connect local or cloud AI only when you want custom sources, corrections, conversations, or custom plans.")}
          className="mb-4"
        >
          <Card className="mb-4 p-5">
              <h3 className="font-medium text-ink">{t("Default AI")}</h3>
            <p className="mb-4 mt-1 text-sm text-ink-muted">
              {t("The bundled lesson and review work without AI setup. Custom content can use local or cloud AI.")}
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

          <Disclosure
            title="Ollama"
            description={t(PROVIDER_COPY.ollama)}
            defaultOpen={settings.defaultProvider === "ollama"}
            className="mb-3"
            nested
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
              <Field label={t("AI model")} htmlFor="ollama-model">
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
        </Disclosure>
      )}

      {onOpenTools && (
        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-ink">{t("Advanced tools")}</h3>
              <p className="mt-1 text-sm text-ink-muted">
                {t("Export to Anki, text-to-speech, and theme phrase lists.")}
              </p>
            </div>
            <Button variant="secondary" onClick={onOpenTools}>
              {t("Open tools")}
            </Button>
          </div>
        </Card>
      )}

      <W5ValidationCard />
    </div>
  );
}

function BackupCounts({ counts }: { counts: Record<StoreName, number> }) {
  const nonZero = Object.entries(counts).filter(([, count]) => count > 0);
  if (nonZero.length === 0) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {nonZero.map(([store, count]) => (
        <div key={store} className="flex items-center justify-between gap-2 rounded border border-line bg-card px-2.5 py-1.5">
          <span className="truncate text-xs text-ink-muted">{store}</span>
          <span className="text-xs font-medium tabular-nums text-ink">{count}</span>
        </div>
      ))}
    </div>
  );
}
